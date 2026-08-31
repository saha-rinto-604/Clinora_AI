package com.clinora.notifications.service;

import com.clinora.notifications.config.PatientNotificationMessagingConfig;
import com.clinora.notifications.email.EmailDeliveryNotConfiguredException;
import com.clinora.notifications.email.EmailDeliveryPort;
import com.clinora.notifications.email.TransactionalEmail;
import com.clinora.notifications.service.NotificationOutboxPublisher.NotificationReadyMessage;
import com.clinora.notifications.service.PatientNotificationService.NotificationCategory;
import com.clinora.notifications.service.PatientNotificationService.NotificationDeliveryView;
import com.clinora.notifications.service.PatientNotificationService.NotificationView;
import java.util.UUID;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class NotificationDeliveryConsumer {
    private final JdbcTemplate jdbc;
    private final PatientNotificationService notifications;
    private final SimpMessagingTemplate messaging;
    private final EmailDeliveryPort emailDelivery;

    public NotificationDeliveryConsumer(
        JdbcTemplate jdbc,
        PatientNotificationService notifications,
        SimpMessagingTemplate messaging,
        EmailDeliveryPort emailDelivery
    ) {
        this.jdbc = jdbc;
        this.notifications = notifications;
        this.messaging = messaging;
        this.emailDelivery = emailDelivery;
    }

    @RabbitListener(queues = PatientNotificationMessagingConfig.QUEUE)
    public void deliver(NotificationReadyMessage message) {
        NotificationDeliveryView delivery = notifications.notificationDeliveryById(
            message.notificationId(),
            message.userId()
        );
        if (delivery == null || !activePatient(message.userId())) return;
        NotificationView notification = delivery.notification();
        if (delivery.deliverEmail()) {
            try {
                sendPrivacyPreservingEmail(message.userId(), notification.category());
            } catch (EmailDeliveryNotConfiguredException ignored) {
                // Development deployments may intentionally omit an external email provider.
            }
        }
        if (delivery.deliverInApp()) {
            try {
                messaging.convertAndSendToUser(message.userId().toString(), "/queue/notifications", notification);
            } catch (RuntimeException ignored) {
                // REST persistence remains authoritative if the Patient is offline or the relay is unavailable.
            }
        }
    }

    private boolean activePatient(UUID userId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'PATIENT' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            userId
        );
        return count != null && count == 1;
    }

    private void sendPrivacyPreservingEmail(UUID userId, NotificationCategory category) {
        String to = jdbc.queryForObject("SELECT email FROM users WHERE id = ?", String.class, userId);
        if (to == null || to.isBlank()) return;
        String subject = switch (category) {
            case APPOINTMENTS -> "Your Clinora appointment has an update";
            case REPORTS -> "You have a new Clinora report update";
            case SECURITY -> "Important Clinora account security update";
            case SYSTEM -> "You have a new Clinora update";
        };
        String text = "You have a new Clinora update. Sign in to Clinora to review the details securely.";
        String html = "<p>You have a new Clinora update.</p><p>Sign in to Clinora to review the details securely.</p>";
        emailDelivery.send(new TransactionalEmail(to, subject, text, html));
    }
}
