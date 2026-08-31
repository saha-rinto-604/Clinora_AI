package com.clinora.patients.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.http.HttpStatus;
import com.clinora.patients.api.PatientApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PatientTimelineService {
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public PatientTimelineService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public void append(
        UUID patientUserId,
        String eventType,
        TimelineCategory category,
        String sourceType,
        UUID sourceId,
        String title,
        String detail,
        Instant occurredAt,
        String deduplicationKey
    ) {
        jdbc.update(
            """
            INSERT INTO patient_timeline_events (
                id, patient_user_id, event_type, category, source_type, source_id,
                title, detail, occurred_at, deduplication_key, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (patient_user_id, deduplication_key) DO NOTHING
            """,
            UUID.randomUUID(), patientUserId, eventType, category.name(), sourceType, sourceId,
            title, detail, Timestamp.from(occurredAt), deduplicationKey, Timestamp.from(clock.instant())
        );
    }

    @Transactional(readOnly = true)
    public TimelinePage list(UUID patientUserId, TimelineCategory category, Instant before, UUID beforeId, int limit) {
        requireActivePatient(patientUserId);
        int safeLimit = Math.max(1, Math.min(limit, 50));
        StringBuilder sql = new StringBuilder("""
            SELECT id, event_type, category, source_type, source_id, title, detail, occurred_at
            FROM patient_timeline_events
            WHERE patient_user_id = ?
            """);
        java.util.ArrayList<Object> parameters = new java.util.ArrayList<>();
        parameters.add(patientUserId);
        if (category != null) {
            if (category == TimelineCategory.PROFILE) {
                sql.append(" AND category IN ('PROFILE', 'CONDITIONS_MEDICATIONS')");
            } else {
                sql.append(" AND category = ?");
                parameters.add(category.name());
            }
        }
        if (before != null && beforeId != null) {
            sql.append(" AND (occurred_at < ? OR (occurred_at = ? AND id < ?))");
            parameters.add(Timestamp.from(before));
            parameters.add(Timestamp.from(before));
            parameters.add(beforeId);
        } else if (before != null) {
            sql.append(" AND occurred_at < ?");
            parameters.add(Timestamp.from(before));
        }
        sql.append(" ORDER BY occurred_at DESC, id DESC LIMIT ?");
        parameters.add(safeLimit + 1);
        List<TimelineEventView> rows = jdbc.query(sql.toString(), EVENT_MAPPER, parameters.toArray());
        boolean hasMore = rows.size() > safeLimit;
        List<TimelineEventView> items = hasMore ? rows.subList(0, safeLimit) : rows;
        TimelineEventView last = hasMore && !items.isEmpty() ? items.get(items.size() - 1) : null;
        Instant nextBefore = last == null ? null : last.occurredAt();
        UUID nextBeforeId = last == null ? null : last.id();
        return new TimelinePage(List.copyOf(items), hasMore, nextBefore, nextBeforeId);
    }

    @Transactional(readOnly = true)
    public List<TimelineEventView> recent(UUID patientUserId, int limit) {
        return list(patientUserId, null, null, null, Math.min(limit, 10)).items();
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

    private static final RowMapper<TimelineEventView> EVENT_MAPPER = (rs, rowNum) -> new TimelineEventView(
        rs.getObject("id", UUID.class),
        rs.getString("event_type"),
        TimelineCategory.valueOf(rs.getString("category").toUpperCase(Locale.ROOT)),
        rs.getString("source_type"),
        rs.getObject("source_id", UUID.class),
        rs.getString("title"),
        rs.getString("detail"),
        instant(rs, "occurred_at")
    );

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    public enum TimelineCategory {
        PROFILE,
        CONDITIONS_MEDICATIONS,
        REPORTS,
        APPOINTMENTS
    }

    public record TimelineEventView(
        UUID id,
        String eventType,
        TimelineCategory category,
        String sourceType,
        UUID sourceId,
        String title,
        String detail,
        Instant occurredAt
    ) {
    }

    public record TimelinePage(List<TimelineEventView> items, boolean hasMore, Instant nextBefore, UUID nextBeforeId) {
    }
}
