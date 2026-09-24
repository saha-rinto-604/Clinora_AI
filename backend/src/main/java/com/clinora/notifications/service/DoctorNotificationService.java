package com.clinora.notifications.service;

import com.clinora.doctors.api.DoctorApiException;
import com.clinora.notifications.service.PatientNotificationService.NotificationCategory;
import com.clinora.notifications.service.PatientNotificationService.NotificationPage;
import com.clinora.notifications.service.PatientNotificationService.NotificationView;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Doctor-authorized access to the shared notification ledger. */
@Service
public class DoctorNotificationService {
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public DoctorNotificationService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public NotificationView create(
        UUID doctorId,
        String type,
        NotificationCategory category,
        String title,
        String body,
        String targetType,
        UUID targetId,
        String sourceEventId
    ) {
        List<NotificationView> existing = bySource(doctorId, sourceEventId);
        if (!existing.isEmpty()) return existing.getFirst();

        Instant now = clock.instant();
        UUID notificationId = UUID.randomUUID();
        int inserted = jdbc.update(
            """
            INSERT INTO notifications
                (id, user_id, type, category, title, body, target_type, target_id, source_event_id,
                 deliver_in_app, deliver_email, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, FALSE, ?)
            ON CONFLICT (user_id, source_event_id) DO NOTHING
            """,
            notificationId,
            doctorId,
            type,
            category.name(),
            title,
            body,
            targetType,
            targetId,
            sourceEventId,
            Timestamp.from(now)
        );
        if (inserted == 0) {
            List<NotificationView> replay = bySource(doctorId, sourceEventId);
            if (!replay.isEmpty()) return replay.getFirst();
            throw new IllegalStateException("Doctor notification idempotency conflict could not be reconciled.");
        }
        jdbc.update(
            """
            INSERT INTO outbox_events
                (id, aggregate_type, aggregate_id, event_type, user_id, payload, created_at, next_attempt_at)
            VALUES (?, 'NOTIFICATION', ?, 'NOTIFICATION_READY', ?, CAST(? AS jsonb), ?, ?)
            """,
            UUID.randomUUID(),
            notificationId,
            doctorId,
            "{\"notificationId\":\"" + notificationId + "\"}",
            Timestamp.from(now),
            Timestamp.from(now)
        );
        return notification(doctorId, notificationId);
    }

    @Transactional(readOnly = true)
    public NotificationPage list(UUID doctorId, boolean unreadOnly, Instant before, UUID beforeId, int limit) {
        requireActiveDoctor(doctorId);
        int safeLimit = Math.max(1, Math.min(limit, 50));
        StringBuilder sql = new StringBuilder("""
            SELECT id, type, category, title, body, target_type, target_id, created_at, read_at
            FROM notifications WHERE user_id = ? AND deliver_in_app = TRUE
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            """);
        ArrayList<Object> parameters = new ArrayList<>();
        parameters.add(doctorId);
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
        return new NotificationPage(
            List.copyOf(items),
            unreadCount(doctorId),
            hasMore,
            last == null ? null : last.createdAt(),
            last == null ? null : last.id()
        );
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID doctorId) {
        requireActiveDoctor(doctorId);
        Long count = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM notifications
            WHERE user_id = ? AND deliver_in_app = TRUE AND read_at IS NULL
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            """,
            Long.class,
            doctorId
        );
        return count == null ? 0 : count;
    }

    @Transactional
    public NotificationView markRead(UUID doctorId, UUID notificationId) {
        requireActiveDoctor(doctorId);
        int changed = jdbc.update(
            "UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ? AND deliver_in_app = TRUE",
            Timestamp.from(clock.instant()),
            notificationId,
            doctorId
        );
        if (changed == 0) throw notFound();
        return notification(doctorId, notificationId);
    }

    @Transactional
    public void markAllRead(UUID doctorId) {
        requireActiveDoctor(doctorId);
        jdbc.update(
            "UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE user_id = ? AND deliver_in_app = TRUE",
            Timestamp.from(clock.instant()),
            doctorId
        );
    }

    @Transactional(readOnly = true)
    public NotificationView notification(UUID doctorId, UUID notificationId) {
        List<NotificationView> rows = jdbc.query(
            "SELECT id, type, category, title, body, target_type, target_id, created_at, read_at FROM notifications WHERE id = ? AND user_id = ?",
            MAPPER,
            notificationId,
            doctorId
        );
        if (rows.isEmpty()) throw notFound();
        return rows.getFirst();
    }

    private List<NotificationView> bySource(UUID doctorId, String sourceEventId) {
        return jdbc.query(
            "SELECT id, type, category, title, body, target_type, target_id, created_at, read_at FROM notifications WHERE user_id = ? AND source_event_id = ?",
            MAPPER,
            doctorId,
            sourceEventId
        );
    }

    private void requireActiveDoctor(UUID doctorId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'DOCTOR' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            doctorId
        );
        if (count == null || count != 1) {
            throw new DoctorApiException(HttpStatus.FORBIDDEN, "ACTIVE_DOCTOR_REQUIRED", "An active verified Doctor account is required.");
        }
    }

    private static DoctorApiException notFound() {
        return new DoctorApiException(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "That notification could not be found.");
    }

    private static final org.springframework.jdbc.core.RowMapper<NotificationView> MAPPER = (rs, rowNum) -> new NotificationView(
        rs.getObject("id", UUID.class),
        rs.getString("type"),
        NotificationCategory.valueOf(rs.getString("category")),
        rs.getString("title"),
        rs.getString("body"),
        rs.getString("target_type"),
        rs.getObject("target_id", UUID.class),
        rs.getTimestamp("created_at").toInstant(),
        rs.getTimestamp("read_at") == null ? null : rs.getTimestamp("read_at").toInstant()
    );
}
