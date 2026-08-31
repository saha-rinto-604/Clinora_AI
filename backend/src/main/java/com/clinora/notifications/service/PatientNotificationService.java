package com.clinora.notifications.service;

import com.clinora.patients.api.PatientApiException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PatientNotificationService {
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public PatientNotificationService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public NotificationView create(
        UUID userId,
        String type,
        NotificationCategory category,
        String title,
        String body,
        String targetType,
        UUID targetId,
        String sourceEventId
    ) {
        List<NotificationView> existing = bySource(userId, sourceEventId);
        if (!existing.isEmpty()) return existing.getFirst();
        Instant now = clock.instant();
        UUID notificationId = UUID.randomUUID();
        DeliveryDecision delivery = deliveryDecision(userId, category);
        int inserted = jdbc.update(
            """
            INSERT INTO notifications
                (id, user_id, type, category, title, body, target_type, target_id, source_event_id,
                 deliver_in_app, deliver_email, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id, source_event_id) DO NOTHING
            """,
            notificationId, userId, type, category.name(), title, body, targetType, targetId, sourceEventId,
            delivery.inApp(), delivery.email(), Timestamp.from(now)
        );
        if (inserted == 0) {
            List<NotificationView> replay = bySource(userId, sourceEventId);
            if (!replay.isEmpty()) return replay.getFirst();
            throw new IllegalStateException("Notification idempotency conflict could not be reconciled.");
        }
        jdbc.update(
            """
            INSERT INTO outbox_events
                (id, aggregate_type, aggregate_id, event_type, user_id, payload, created_at, next_attempt_at)
            VALUES (?, 'NOTIFICATION', ?, 'NOTIFICATION_READY', ?, CAST(? AS jsonb), ?, ?)
            """,
            UUID.randomUUID(), notificationId, userId,
            "{\"notificationId\":\"" + notificationId + "\"}", Timestamp.from(now), Timestamp.from(now)
        );
        return notification(userId, notificationId);
    }

    @Transactional(readOnly = true)
    public NotificationPage list(UUID userId, boolean unreadOnly, Instant before, UUID beforeId, int limit) {
        requireActivePatient(userId);
        int safeLimit = Math.max(1, Math.min(limit, 50));
        StringBuilder sql = new StringBuilder("""
            SELECT id, type, category, title, body, target_type, target_id, created_at, read_at
            FROM notifications WHERE user_id = ? AND deliver_in_app = TRUE
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            """);
        java.util.ArrayList<Object> parameters = new java.util.ArrayList<>();
        parameters.add(userId);
        if (unreadOnly) sql.append(" AND read_at IS NULL");
        if (before != null && beforeId != null) {
            sql.append(" AND (created_at < ? OR (created_at = ? AND id < ?))");
            parameters.add(Timestamp.from(before));
            parameters.add(Timestamp.from(before));
            parameters.add(beforeId);
        } else if (before != null) {
            sql.append(" AND created_at < ?");
            parameters.add(Timestamp.from(before));
        }
        sql.append(" ORDER BY created_at DESC, id DESC LIMIT ?");
        parameters.add(safeLimit + 1);
        List<NotificationView> rows = jdbc.query(sql.toString(), MAPPER, parameters.toArray());
        boolean hasMore = rows.size() > safeLimit;
        List<NotificationView> items = hasMore ? rows.subList(0, safeLimit) : rows;
        NotificationView last = hasMore && !items.isEmpty() ? items.get(items.size() - 1) : null;
        Instant nextBefore = last == null ? null : last.createdAt();
        UUID nextBeforeId = last == null ? null : last.id();
        return new NotificationPage(List.copyOf(items), unreadCount(userId), hasMore, nextBefore, nextBeforeId);
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        requireActivePatient(userId);
        Long count = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM notifications
            WHERE user_id = ? AND deliver_in_app = TRUE AND read_at IS NULL
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            """,
            Long.class,
            userId
        );
        return count == null ? 0 : count;
    }

    @Transactional
    public NotificationView markRead(UUID userId, UUID notificationId) {
        requireActivePatient(userId);
        int changed = jdbc.update(
            "UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ? AND deliver_in_app = TRUE",
            Timestamp.from(clock.instant()), notificationId, userId
        );
        if (changed == 0) throw new PatientApiException(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "That notification could not be found.");
        return notification(userId, notificationId);
    }

    @Transactional
    public void markAllRead(UUID userId) {
        requireActivePatient(userId);
        jdbc.update("UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE user_id = ? AND deliver_in_app = TRUE", Timestamp.from(clock.instant()), userId);
    }

    @Transactional
    public NotificationPreferences preferences(UUID userId) {
        requireActivePatient(userId);
        ensurePreferences(userId);
        return jdbc.queryForObject(
            "SELECT appointments_in_app, reports_in_app, security_in_app, appointments_email, reports_email FROM notification_preferences WHERE user_id = ?",
            (rs, rowNum) -> new NotificationPreferences(
                rs.getBoolean("appointments_in_app"), rs.getBoolean("reports_in_app"), rs.getBoolean("security_in_app"),
                rs.getBoolean("appointments_email"), rs.getBoolean("reports_email")
            ),
            userId
        );
    }

    @Transactional
    public NotificationPreferences updatePreferences(UUID userId, NotificationPreferences input) {
        requireActivePatient(userId);
        ensurePreferences(userId);
        jdbc.update(
            """
            UPDATE notification_preferences SET appointments_in_app = ?, reports_in_app = ?, security_in_app = ?,
                appointments_email = ?, reports_email = ?, updated_at = ? WHERE user_id = ?
            """,
            input.appointmentsInApp(), input.reportsInApp(), true,
            input.appointmentsEmail(), input.reportsEmail(), Timestamp.from(clock.instant()), userId
        );
        return preferences(userId);
    }

    @Transactional(readOnly = true)
    public NotificationView notification(UUID userId, UUID id) {
        List<NotificationView> rows = jdbc.query(
            "SELECT id, type, category, title, body, target_type, target_id, created_at, read_at FROM notifications WHERE id = ? AND user_id = ?",
            MAPPER, id, userId
        );
        if (rows.isEmpty()) throw new PatientApiException(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "That notification could not be found.");
        return rows.getFirst();
    }

    @Transactional(readOnly = true)
    public NotificationDeliveryView notificationDeliveryById(UUID id, UUID userId) {
        List<NotificationDeliveryView> rows = jdbc.query(
            """
            SELECT id, type, category, title, body, target_type, target_id, deliver_in_app, deliver_email, created_at, read_at
            FROM notifications WHERE id = ? AND user_id = ?
            """,
            DELIVERY_MAPPER, id, userId
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private List<NotificationView> bySource(UUID userId, String sourceEventId) {
        return jdbc.query(
            "SELECT id, type, category, title, body, target_type, target_id, created_at, read_at FROM notifications WHERE user_id = ? AND source_event_id = ?",
            MAPPER, userId, sourceEventId
        );
    }

    @Transactional(readOnly = true)
    public DeliveryPreferences deliveryPreferences(UUID userId) {
        return jdbc.queryForObject(
            """
            SELECT
              COALESCE((SELECT appointments_in_app FROM notification_preferences WHERE user_id = ?), TRUE),
              COALESCE((SELECT reports_in_app FROM notification_preferences WHERE user_id = ?), TRUE),
              COALESCE((SELECT appointments_email FROM notification_preferences WHERE user_id = ?), TRUE),
              COALESCE((SELECT reports_email FROM notification_preferences WHERE user_id = ?), FALSE)
            """,
            (rs, rowNum) -> new DeliveryPreferences(rs.getBoolean(1), rs.getBoolean(2), rs.getBoolean(3), rs.getBoolean(4)),
            userId, userId, userId, userId
        );
    }

    private DeliveryDecision deliveryDecision(UUID userId, NotificationCategory category) {
        DeliveryPreferences preferences = deliveryPreferences(userId);
        return switch (category) {
            case APPOINTMENTS -> new DeliveryDecision(preferences.appointmentsInApp(), preferences.appointmentsEmail());
            case REPORTS -> new DeliveryDecision(preferences.reportsInApp(), preferences.reportsEmail());
            case SECURITY -> new DeliveryDecision(true, true);
            case SYSTEM -> new DeliveryDecision(true, false);
        };
    }

    private void requireActivePatient(UUID userId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'PATIENT' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            userId
        );
        if (count == null || count != 1) {
            throw new PatientApiException(
                HttpStatus.FORBIDDEN,
                "ACTIVE_PATIENT_REQUIRED",
                "An active Patient account is required."
            );
        }
    }

    private void ensurePreferences(UUID userId) {
        jdbc.update(
            """
            INSERT INTO notification_preferences (user_id, updated_at)
            VALUES (?, ?)
            ON CONFLICT (user_id) DO NOTHING
            """,
            userId, Timestamp.from(clock.instant())
        );
    }

    private static final org.springframework.jdbc.core.RowMapper<NotificationView> MAPPER = (rs, rowNum) -> new NotificationView(
        rs.getObject("id", UUID.class), rs.getString("type"), NotificationCategory.valueOf(rs.getString("category")),
        rs.getString("title"), rs.getString("body"), rs.getString("target_type"), rs.getObject("target_id", UUID.class),
        rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("read_at") == null ? null : rs.getTimestamp("read_at").toInstant()
    );

    private static final org.springframework.jdbc.core.RowMapper<NotificationDeliveryView> DELIVERY_MAPPER = (rs, rowNum) ->
        new NotificationDeliveryView(
            MAPPER.mapRow(rs, rowNum),
            rs.getBoolean("deliver_in_app"),
            rs.getBoolean("deliver_email")
        );

    public enum NotificationCategory { APPOINTMENTS, SECURITY, REPORTS, SYSTEM }
    public record NotificationView(
        UUID id, String type, NotificationCategory category, String title, String body,
        String targetType, UUID targetId, Instant createdAt, Instant readAt
    ) {}
    public record NotificationDeliveryView(NotificationView notification, boolean deliverInApp, boolean deliverEmail) {}
    public record NotificationPage(List<NotificationView> items, long unreadCount, boolean hasMore, Instant nextBefore, UUID nextBeforeId) {}
    public record NotificationPreferences(
        boolean appointmentsInApp, boolean reportsInApp, boolean securityInApp,
        boolean appointmentsEmail, boolean reportsEmail
    ) {}
    public record DeliveryPreferences(
        boolean appointmentsInApp, boolean reportsInApp, boolean appointmentsEmail, boolean reportsEmail
    ) {}
    private record DeliveryDecision(boolean inApp, boolean email) {}
}

