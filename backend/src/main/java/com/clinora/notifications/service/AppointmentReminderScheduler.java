package com.clinora.notifications.service;

import com.clinora.notifications.service.PatientNotificationService.NotificationCategory;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AppointmentReminderScheduler {
    private final JdbcTemplate jdbc;
    private final PatientNotificationService notifications;
    private final Clock clock;

    public AppointmentReminderScheduler(JdbcTemplate jdbc, PatientNotificationService notifications, Clock clock) {
        this.jdbc = jdbc;
        this.notifications = notifications;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${clinora.notifications.reminder-scan-delay-ms:60000}")
    public void createReminders() {
        Instant target = clock.instant().plus(24, ChronoUnit.HOURS);
        Instant from = target.minus(10, ChronoUnit.MINUTES);
        Instant to = target.plus(10, ChronoUnit.MINUTES);
        List<ReminderCandidate> candidates = jdbc.query(
            """
            SELECT a.id, a.patient_user_id, a.scheduled_start, p.display_name
            FROM appointments a
            JOIN doctor_booking_profiles p ON p.doctor_user_id = a.doctor_user_id
            JOIN users u ON u.id = a.patient_user_id
            WHERE a.status = 'BOOKED'
              AND u.role = 'PATIENT' AND u.account_status = 'ACTIVE' AND u.email_verified_at IS NOT NULL
              AND a.scheduled_start >= ? AND a.scheduled_start < ?
            """,
            (rs, rowNum) -> new ReminderCandidate(
                rs.getObject("id", UUID.class), rs.getObject("patient_user_id", UUID.class),
                rs.getTimestamp("scheduled_start").toInstant(), rs.getString("display_name")
            ),
            Timestamp.from(from), Timestamp.from(to)
        );
        for (ReminderCandidate candidate : candidates) {
            notifications.create(
                candidate.patientUserId(),
                "APPOINTMENT_REMINDER",
                NotificationCategory.APPOINTMENTS,
                "Appointment tomorrow",
                "Your appointment with " + candidate.doctorName() + " is tomorrow.",
                "APPOINTMENT",
                candidate.appointmentId(),
                "appointment-reminder-24h:" + candidate.appointmentId() + ":" + candidate.startsAt().toEpochMilli()
            );
        }
    }

    private record ReminderCandidate(UUID appointmentId, UUID patientUserId, Instant startsAt, String doctorName) {}
}

