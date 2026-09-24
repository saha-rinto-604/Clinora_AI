package com.clinora.appointments.service;

import com.clinora.patients.api.PatientApiException;
import java.time.*;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PatientConsultationJoinService {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    public PatientConsultationJoinService(JdbcTemplate jdbc, Clock clock) { this.jdbc = jdbc; this.clock = clock; }

    @Transactional(readOnly = true)
    public JoinStatus status(UUID patient, UUID appointment) { return status(load(patient, appointment)); }

    @Transactional(readOnly = true)
    public JoinRoom join(UUID patient, UUID appointment) {
        Room room = load(patient, appointment);
        JoinStatus state = status(room);
        if (!state.canJoin()) throw new PatientApiException(HttpStatus.CONFLICT,
            "CONSULTATION_JOIN_UNAVAILABLE", "TOO_EARLY".equals(state.state()) ? "Join will be available shortly." : "This consultation is not available to join.");
        return new JoinRoom(PatientAppointmentService.requireSafeMeetingUrl(room.url()));
    }

    private Room load(UUID patient, UUID appointment) {
        var rows = jdbc.query("""
            SELECT a.status, a.consultation_mode, a.meeting_url, a.scheduled_start, a.scheduled_end,
                EXISTS (SELECT 1 FROM doctor_consultations c WHERE c.appointment_id = a.id AND c.status = 'IN_PROGRESS') AS active
            FROM appointments a JOIN users u ON u.id = a.patient_user_id JOIN users d ON d.id = a.doctor_user_id
            WHERE a.id = ? AND a.patient_user_id = ? AND u.role = 'PATIENT' AND u.account_status = 'ACTIVE'
                AND u.email_verified_at IS NOT NULL AND d.account_status = 'ACTIVE'
            """, (rs, i) -> new Room(rs.getString(1), rs.getString(2), rs.getString(3),
                rs.getTimestamp(4).toInstant(), rs.getTimestamp(5).toInstant(), rs.getBoolean(6)), appointment, patient);
        if (rows.isEmpty()) throw new PatientApiException(HttpStatus.NOT_FOUND, "APPOINTMENT_NOT_FOUND", "That appointment could not be found.");
        return rows.getFirst();
    }

    private JoinStatus status(Room room) {
        Instant opens = room.start().minus(Duration.ofMinutes(15)), now = clock.instant();
        if (!"BOOKED".equals(room.status()) || !"ONLINE".equals(room.mode())) return new JoinStatus(false, false, "UNAVAILABLE", null);
        if (room.url() == null || room.url().isBlank()) return new JoinStatus(false, false, "ROOM_NOT_READY", opens);
        if (now.isBefore(opens)) return new JoinStatus(true, false, "TOO_EARLY", opens);
        if (now.isAfter(room.end()) && !room.active()) return new JoinStatus(true, false, "ENDED", opens);
        return new JoinStatus(true, true, "READY", opens);
    }
    private record Room(String status, String mode, String url, Instant start, Instant end, boolean active) {}
    public record JoinStatus(boolean roomReady, boolean canJoin, String state, Instant opensAt) {}
    public record JoinRoom(String meetingUrl) {}
}
