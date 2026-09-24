package com.clinora.doctors.service;

import com.clinora.appointments.service.PatientAppointmentService;
import com.clinora.audit.*;
import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.notifications.service.PatientNotificationService.NotificationCategory;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DoctorMeetingRoomService {
    private final JdbcTemplate jdbc;
    private final DoctorClinicalAccessService access;
    private final PatientAppointmentService appointments;
    private final PatientNotificationService notifications;
    private final AuthAuditService audit;
    private final Clock clock;
    public DoctorMeetingRoomService(JdbcTemplate jdbc, DoctorClinicalAccessService access,
        PatientAppointmentService appointments, PatientNotificationService notifications, AuthAuditService audit, Clock clock) {
        this.jdbc = jdbc; this.access = access; this.appointments = appointments;
        this.notifications = notifications; this.audit = audit; this.clock = clock;
    }

    @Transactional
    public RoomView save(UUID doctor, String url, String ip, String userAgent) {
        access.requireActiveDoctor(doctor);
        String safe = PatientAppointmentService.requireSafeMeetingUrl(url);
        // Shared lock order with booking, rescheduling and routine materialization.
        jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, doctor);
        appointments.prepareDoctorBookingProfile(doctor);
        String previous = jdbc.queryForObject("SELECT default_meeting_url FROM doctor_booking_profiles WHERE doctor_user_id = ?", String.class, doctor);
        if (safe.equals(previous)) return new RoomView(safe, 0);
        var now = Timestamp.from(clock.instant());
        jdbc.update("UPDATE doctor_booking_profiles SET default_meeting_url = ?, updated_at = ? WHERE doctor_user_id = ?", safe, now, doctor);
        var updated = jdbc.query("""
            UPDATE appointments SET meeting_url = ?, meeting_link_updated_at = ?, updated_at = ?, version = version + 1
            WHERE doctor_user_id = ? AND status = 'BOOKED' AND consultation_mode = 'ONLINE'
              AND scheduled_start > ? AND meeting_url IS DISTINCT FROM ?
            RETURNING id, patient_user_id, version
            """, (rs, i) -> new Updated(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getLong(3)),
            safe, now, now, doctor, now, safe);
        for (Updated appointment : updated) notifications.create(appointment.patient(),
            "APPOINTMENT_MEETING_LINK_UPDATED", NotificationCategory.APPOINTMENTS,
            "Online consultation details updated", "Your Doctor updated the room for your online appointment. Sign in to review your appointment.",
            "APPOINTMENT", appointment.id(), "appointment-meeting-link:" + appointment.id() + ":" + appointment.version());
        audit.record(doctor, AuthAuditAction.DOCTOR_DEFAULT_MEETING_ROOM_UPDATED, AuthAuditOutcome.SUCCESS,
            ip, userAgent, doctor.toString(), "affectedAppointments=" + updated.size());
        return new RoomView(safe, updated.size());
    }
    public record RoomView(String defaultMeetingUrl, int updatedAppointments) {}
    private record Updated(UUID id, UUID patient, long version) {}
}
