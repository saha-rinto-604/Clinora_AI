package com.clinora.notifications.service;

import com.clinora.notifications.config.PatientNotificationMessagingConfig;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class NotificationOutboxPublisher {
    private final JdbcTemplate jdbc;
    private final RabbitTemplate rabbit;
    private final Clock clock;

    public NotificationOutboxPublisher(JdbcTemplate jdbc, RabbitTemplate rabbit, Clock clock) {
        this.jdbc = jdbc;
        this.rabbit = rabbit;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${clinora.notifications.outbox-delay-ms:3000}")
    public void publishPending() {
        List<PendingOutbox> rows = jdbc.query(
            """
            WITH candidates AS (
                SELECT id FROM outbox_events
                WHERE published_at IS NULL AND next_attempt_at <= CURRENT_TIMESTAMP
                ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED
            )
            UPDATE outbox_events outbox
            SET next_attempt_at = CURRENT_TIMESTAMP + INTERVAL '30 seconds'
            FROM candidates
            WHERE outbox.id = candidates.id
            RETURNING outbox.id, outbox.aggregate_id, outbox.user_id, outbox.attempt_count
            """,
            (rs, rowNum) -> new PendingOutbox(
                rs.getObject("id", UUID.class),
                rs.getObject("aggregate_id", UUID.class),
                rs.getObject("user_id", UUID.class),
                rs.getInt("attempt_count")
            )
        );
        rows.forEach(this::publish);
    }

    private void publish(PendingOutbox row) {
        try {
            rabbit.convertAndSend(
                PatientNotificationMessagingConfig.EXCHANGE,
                PatientNotificationMessagingConfig.ROUTING_KEY,
                new NotificationReadyMessage(row.notificationId(), row.userId())
            );
            jdbc.update("UPDATE outbox_events SET published_at = ? WHERE id = ?", Timestamp.from(clock.instant()), row.id());
        } catch (RuntimeException exception) {
            int attempts = row.attemptCount() + 1;
            long delaySeconds = Math.min(300, (long) Math.pow(2, Math.min(attempts, 8)));
            Instant retryAt = clock.instant().plusSeconds(delaySeconds);
            jdbc.update(
                "UPDATE outbox_events SET attempt_count = ?, next_attempt_at = ? WHERE id = ?",
                attempts,
                Timestamp.from(retryAt),
                row.id()
            );
        }
    }

    private record PendingOutbox(UUID id, UUID notificationId, UUID userId, int attemptCount) {}

    public record NotificationReadyMessage(UUID notificationId, UUID userId) {}
}
