package com.clinora.patients.service;

import com.clinora.patients.domain.BloodGroup;
import com.clinora.patients.service.PatientProfileService.PatientProfileView;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PatientHealthRecordService {
    private static final String PROFILE_SOURCE = "PATIENT_PROFILE";

    private final PatientProfileService profiles;
    private final JdbcTemplate jdbc;

    public PatientHealthRecordService(PatientProfileService profiles, JdbcTemplate jdbc) {
        this.profiles = profiles;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public HealthRecordView record(UUID patientUserId) {
        PatientProfileView profile = profiles.profile(patientUserId);
        List<HealthRecordReportView> recentReports = jdbc.query(
            """
            SELECT id, report_name, report_type, report_date, provider_laboratory, created_at
              FROM patient_medical_reports
             WHERE patient_user_id = ?
               AND archived_at IS NULL
             ORDER BY report_date DESC NULLS LAST, created_at DESC, id DESC
             LIMIT 3
            """,
            this::reportView,
            patientUserId
        );
        List<CareAppointmentView> upcoming = jdbc.query(
            """
            SELECT a.id, a.status, a.scheduled_start, a.scheduled_end,
                   p.display_name, p.specialization
              FROM appointments a
              JOIN doctor_booking_profiles p ON p.doctor_user_id = a.doctor_user_id
             WHERE a.patient_user_id = ?
               AND a.status = 'BOOKED'
               AND a.scheduled_end >= CURRENT_TIMESTAMP
             ORDER BY a.scheduled_start ASC, a.id ASC
             LIMIT 1
            """,
            this::appointmentView,
            patientUserId
        );
        List<CareAppointmentView> recent = jdbc.query(
            """
            SELECT a.id, a.status, a.scheduled_start, a.scheduled_end,
                   p.display_name, p.specialization
              FROM appointments a
              JOIN doctor_booking_profiles p ON p.doctor_user_id = a.doctor_user_id
             WHERE a.patient_user_id = ?
               AND (a.status IN ('CANCELLED', 'COMPLETED') OR a.scheduled_end < CURRENT_TIMESTAMP)
             ORDER BY a.scheduled_start DESC, a.id DESC
             LIMIT 2
            """,
            this::appointmentView,
            patientUserId
        );
        Instant lastUpdatedAt = jdbc.queryForObject(
            """
            SELECT MAX(activity_at)
              FROM (
                    SELECT MAX(occurred_at) AS activity_at
                      FROM patient_timeline_events
                     WHERE patient_user_id = ?
                    UNION ALL
                    SELECT MAX(updated_at)
                      FROM patient_medical_reports
                     WHERE patient_user_id = ?
                    UNION ALL
                    SELECT MAX(recorded_at)
                      FROM patient_body_measurement_snapshots
                     WHERE patient_user_id = ?
                    UNION ALL
                    SELECT MAX(updated_at)
                      FROM appointments
                     WHERE patient_user_id = ?
              ) activity
            """,
            (rs, rowNum) -> {
                Timestamp value = rs.getTimestamp(1);
                return value == null ? null : value.toInstant();
            },
            patientUserId,
            patientUserId,
            patientUserId,
            patientUserId
        );

        ClinicalEssentialsView essentials = new ClinicalEssentialsView(
            sourced(profile.allergies()),
            sourced(profile.chronicConditions()),
            sourced(profile.currentMedications())
        );
        CurrentMeasurementsView currentMeasurements = new CurrentMeasurementsView(
            profile.bloodGroup(),
            profile.heightCm(),
            profile.weightKg(),
            PatientBodyMeasurementService.bmi(profile.heightCm(), profile.weightKg()),
            PROFILE_SOURCE
        );
        HealthBackgroundView background = new HealthBackgroundView(
            profile.familyMedicalHistory(),
            profile.lifestyleInformation(),
            PROFILE_SOURCE
        );
        return new HealthRecordView(
            profile,
            essentials,
            currentMeasurements,
            recentReports,
            new CareHistoryView(upcoming.isEmpty() ? null : upcoming.getFirst(), recent),
            background,
            lastUpdatedAt
        );
    }

    private static List<SourcedValueView> sourced(List<String> values) {
        return values.stream().map(value -> new SourcedValueView(value, PROFILE_SOURCE)).toList();
    }

    private HealthRecordReportView reportView(ResultSet rs, int rowNum) throws SQLException {
        return new HealthRecordReportView(
            rs.getObject("id", UUID.class),
            rs.getString("report_name"),
            rs.getString("report_type"),
            rs.getObject("report_date", LocalDate.class),
            rs.getString("provider_laboratory"),
            rs.getTimestamp("created_at").toInstant(),
            "MEDICAL_REPORT"
        );
    }

    private CareAppointmentView appointmentView(ResultSet rs, int rowNum) throws SQLException {
        return new CareAppointmentView(
            rs.getObject("id", UUID.class),
            rs.getString("status"),
            rs.getTimestamp("scheduled_start").toInstant(),
            rs.getTimestamp("scheduled_end").toInstant(),
            rs.getString("display_name"),
            rs.getString("specialization"),
            "APPOINTMENT"
        );
    }

    public record HealthRecordView(
        PatientProfileView profile,
        ClinicalEssentialsView clinicalEssentials,
        CurrentMeasurementsView currentMeasurements,
        List<HealthRecordReportView> recentReports,
        CareHistoryView care,
        HealthBackgroundView background,
        Instant lastUpdatedAt
    ) {
    }

    public record ClinicalEssentialsView(
        List<SourcedValueView> allergies,
        List<SourcedValueView> conditions,
        List<SourcedValueView> medications
    ) {
    }

    public record SourcedValueView(String name, String sourceType) {
    }

    public record CurrentMeasurementsView(
        BloodGroup bloodGroup,
        BigDecimal heightCm,
        BigDecimal weightKg,
        BigDecimal bmi,
        String sourceType
    ) {
    }

    public record HealthRecordReportView(
        UUID id,
        String reportName,
        String reportType,
        LocalDate reportDate,
        String providerLaboratory,
        Instant uploadedAt,
        String sourceType
    ) {
    }

    public record CareHistoryView(CareAppointmentView nextAppointment, List<CareAppointmentView> recentAppointments) {
    }

    public record CareAppointmentView(
        UUID id,
        String status,
        Instant scheduledStart,
        Instant scheduledEnd,
        String doctorName,
        String specialization,
        String sourceType
    ) {
    }

    public record HealthBackgroundView(String familyMedicalHistory, String lifestyleInformation, String sourceType) {
    }
}
