package com.clinora.notifications.service;

import com.clinora.notifications.service.PatientNotificationService.NotificationCategory;
import java.sql.Timestamp;
import java.time.*;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Date-based reminders in the consultation's booked timezone, using the existing outbox. */
@Component
public class FollowUpReminderScheduler {
    private final JdbcTemplate jdbc;
    private final PatientNotificationService notifications;
    private final Clock clock;
    public FollowUpReminderScheduler(JdbcTemplate jdbc, PatientNotificationService notifications, Clock clock) {
        this.jdbc = jdbc; this.notifications = notifications; this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${clinora.notifications.follow-up-scan-delay-ms:3600000}")
    @Transactional
    public void createReminders() {
        Instant now = clock.instant();
        var candidates = jdbc.query("""
            SELECT c.id, c.appointment_id, c.patient_user_id, c.doctor_user_id, c.completed_at,
                   f.recommended_date, a.booking_timezone
            FROM consultation_follow_ups f JOIN doctor_consultations c ON c.id = f.consultation_id
            JOIN appointments a ON a.id = c.appointment_id JOIN users u ON u.id = c.patient_user_id
            WHERE c.status = 'COMPLETED' AND a.status = 'COMPLETED'
              AND u.role = 'PATIENT' AND u.account_status = 'ACTIVE' AND u.email_verified_at IS NOT NULL
              AND f.recommended_date BETWEEN CAST(? AS date) AND CAST(? AS date)
            ORDER BY c.patient_user_id, c.id
            """, (rs, i) -> new Candidate(rs.getObject(1, UUID.class),rs.getObject(2, UUID.class),
                rs.getObject(3, UUID.class),rs.getObject(4, UUID.class),rs.getTimestamp(5).toInstant(),
                rs.getDate(6).toLocalDate(),rs.getString(7)),
            java.sql.Date.valueOf(LocalDate.now(clock).minusDays(1)), java.sql.Date.valueOf(LocalDate.now(clock).plusDays(9)));
        for (Candidate c : candidates) {
            ZoneId zone = ZoneId.of(c.timezone());
            LocalDate today = now.atZone(zone).toLocalDate();
            long days = java.time.temporal.ChronoUnit.DAYS.between(today, c.date());
            if (days != 7 && days != 1) continue;
            // A recommendation made inside a window does not retroactively create that reminder.
            if (!c.completed().isBefore(today.atStartOfDay(zone).toInstant())) continue;
            // Serialize against a new booking by this Patient, then recheck the actual booked inventory.
            jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE",UUID.class,c.patient());
            Integer booked = jdbc.queryForObject("""
                SELECT COUNT(*) FROM appointments WHERE patient_user_id = ? AND doctor_user_id = ?
                    AND status = 'BOOKED' AND scheduled_start > ? AND scheduled_start >= ? AND scheduled_start < ?
                """, Integer.class,c.patient(),c.doctor(),Timestamp.from(now),
                Timestamp.from(c.date().minusDays(7).atStartOfDay(zone).toInstant()),
                Timestamp.from(c.date().plusDays(8).atStartOfDay(zone).toInstant()));
            if (booked != null && booked > 0) continue;
            notifications.create(c.patient(),"FOLLOW_UP_REMINDER",NotificationCategory.APPOINTMENTS,
                days == 7 ? "Follow-up next week" : "Follow-up tomorrow",
                "Your Doctor recommended a follow-up on " + c.date() + ". Review the recommendation and arrange an appointment if needed.",
                "APPOINTMENT",c.appointment(),"follow-up-reminder-" + days + "d:" + c.consultation() + ":" + c.date());
        }
    }
    private record Candidate(UUID consultation, UUID appointment, UUID patient, UUID doctor, Instant completed, LocalDate date, String timezone) {}
}
