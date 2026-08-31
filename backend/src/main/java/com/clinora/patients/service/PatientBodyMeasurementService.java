package com.clinora.patients.service;

import com.clinora.patients.api.PatientApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PatientBodyMeasurementService {
    public static final String PATIENT_PROFILE_SOURCE = "PATIENT_PROFILE";
    private static final int MAX_POINTS = 200;

    private final JdbcTemplate jdbc;

    public PatientBodyMeasurementService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public boolean appendProfileSnapshotIfChanged(
        UUID patientUserId,
        UUID patientProfileId,
        BigDecimal beforeHeightCm,
        BigDecimal beforeWeightKg,
        BigDecimal heightCm,
        BigDecimal weightKg,
        Instant recordedAt,
        String deduplicationKey
    ) {
        if (same(beforeHeightCm, heightCm) && same(beforeWeightKg, weightKg)) {
            return false;
        }
        if (heightCm == null && weightKg == null) {
            return false;
        }
        int inserted = jdbc.update(
            """
            INSERT INTO patient_body_measurement_snapshots (
                id, patient_user_id, patient_profile_id, height_cm, weight_kg,
                recorded_at, source_type, source_id, recorded_by_user_id,
                deduplication_key, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (patient_user_id, deduplication_key) DO NOTHING
            """,
            UUID.randomUUID(),
            patientUserId,
            patientProfileId,
            heightCm,
            weightKg,
            Timestamp.from(recordedAt),
            PATIENT_PROFILE_SOURCE,
            patientProfileId,
            patientUserId,
            deduplicationKey,
            Timestamp.from(recordedAt)
        );
        return inserted == 1;
    }

    @Transactional(readOnly = true)
    public HealthTrendView trends(UUID patientUserId, Instant from, Instant to) {
        requireActivePatient(patientUserId);
        StringBuilder sql = new StringBuilder(
            """
            SELECT id, height_cm, weight_kg, recorded_at, source_type
            FROM patient_body_measurement_snapshots
            WHERE patient_user_id = ?
            """
        );
        List<Object> parameters = new ArrayList<>();
        parameters.add(patientUserId);
        if (from != null) {
            sql.append(" AND recorded_at >= ?");
            parameters.add(Timestamp.from(from));
        }
        if (to != null) {
            sql.append(" AND recorded_at <= ?");
            parameters.add(Timestamp.from(to));
        }
        sql.append(" ORDER BY recorded_at DESC, id DESC LIMIT ?");
        parameters.add(MAX_POINTS);
        List<BodyMeasurementPoint> newestFirst = jdbc.query(sql.toString(), this::point, parameters.toArray());
        List<BodyMeasurementPoint> points = new ArrayList<>(newestFirst);
        Collections.reverse(points);
        return new HealthTrendView(List.copyOf(points));
    }

    public static BigDecimal bmi(BigDecimal heightCm, BigDecimal weightKg) {
        if (heightCm == null || weightKg == null || heightCm.compareTo(BigDecimal.valueOf(30)) < 0
            || heightCm.compareTo(BigDecimal.valueOf(300)) > 0 || weightKg.compareTo(BigDecimal.ONE) < 0
            || weightKg.compareTo(BigDecimal.valueOf(700)) > 0) {
            return null;
        }
        BigDecimal meters = heightCm.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        return weightKg.divide(meters.multiply(meters), 1, RoundingMode.HALF_UP);
    }

    private BodyMeasurementPoint point(ResultSet rs, int rowNum) throws SQLException {
        BigDecimal heightCm = rs.getBigDecimal("height_cm");
        BigDecimal weightKg = rs.getBigDecimal("weight_kg");
        return new BodyMeasurementPoint(
            rs.getObject("id", UUID.class),
            heightCm,
            weightKg,
            bmi(heightCm, weightKg),
            rs.getTimestamp("recorded_at").toInstant(),
            rs.getString("source_type")
        );
    }

    private void requireActivePatient(UUID patientUserId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'PATIENT' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            patientUserId
        );
        if (count == null || count != 1) {
            throw new PatientApiException(
                HttpStatus.FORBIDDEN,
                "ACTIVE_PATIENT_REQUIRED",
                "An active Patient account is required."
            );
        }
    }

    private static boolean same(BigDecimal first, BigDecimal second) {
        return Objects.equals(first, second) || (first != null && second != null && first.compareTo(second) == 0);
    }

    public record BodyMeasurementPoint(
        UUID id,
        BigDecimal heightCm,
        BigDecimal weightKg,
        BigDecimal bmi,
        Instant recordedAt,
        String sourceType
    ) {
    }

    public record HealthTrendView(List<BodyMeasurementPoint> points) {
    }
}
