package com.clinora.doctors.service;

import com.clinora.doctors.api.DoctorApiException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DoctorClinicalAccessService {
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public DoctorClinicalAccessService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public void requireActiveDoctorAccount(UUID doctorUserId) {
        Integer count = jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM users u
            WHERE u.id = ?
              AND u.role = 'DOCTOR'
              AND u.account_status = 'ACTIVE'
              AND u.email_verified_at IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM access_applications a
                  JOIN doctor_application_details d ON d.application_id = a.id
                  WHERE a.normalized_email = u.normalized_email
                    AND a.application_type = 'DOCTOR'
                    AND a.status = 'ACTIVATED'
              )
            """,
            Integer.class,
            doctorUserId
        );
        if (count == null || count != 1) {
            throw new DoctorApiException(
                HttpStatus.FORBIDDEN,
                "ACTIVE_DOCTOR_ACCOUNT_REQUIRED",
                "Your Doctor account is not currently available."
            );
        }
    }

    public void requireActiveDoctor(UUID doctorUserId) {
        Integer count = jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM users u
            WHERE u.id = ?
              AND u.role = 'DOCTOR'
              AND u.account_status = 'ACTIVE'
              AND u.email_verified_at IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM access_applications a
                  JOIN doctor_application_details d ON d.application_id = a.id
                  WHERE a.normalized_email = u.normalized_email
                    AND a.application_type = 'DOCTOR'
                    AND a.status = 'ACTIVATED'
                    AND (d.registration_valid_until IS NULL OR d.registration_valid_until >= CURRENT_DATE)
              )
            """,
            Integer.class,
            doctorUserId
        );
        if (count == null || count != 1) {
            throw new DoctorApiException(
                HttpStatus.FORBIDDEN,
                "ACTIVE_DOCTOR_REQUIRED",
                "Your Doctor account is not currently available for clinical work."
            );
        }
    }

    public AppointmentAccess requireOwnedAppointment(UUID doctorUserId, UUID appointmentId) {
        requireActiveDoctor(doctorUserId);
        var rows = jdbc.query(
            """
            SELECT id, patient_user_id, doctor_user_id, status, scheduled_start, scheduled_end, booking_timezone
            FROM appointments
            WHERE id = ? AND doctor_user_id = ?
            """,
            (rs, rowNum) -> new AppointmentAccess(
                rs.getObject("id", UUID.class),
                rs.getObject("patient_user_id", UUID.class),
                rs.getObject("doctor_user_id", UUID.class),
                rs.getString("status"),
                instant(rs.getTimestamp("scheduled_start")),
                instant(rs.getTimestamp("scheduled_end")),
                rs.getString("booking_timezone")
            ),
            appointmentId,
            doctorUserId
        );
        if (rows.isEmpty()) {
            throw notFound("APPOINTMENT_NOT_FOUND", "That appointment could not be found.");
        }
        return rows.getFirst();
    }

    public ActiveAppointmentAccess requireActiveOwnedAppointment(UUID doctorUserId, UUID appointmentId) {
        AppointmentAccess appointment = requireOwnedAppointment(doctorUserId, appointmentId);
        if (!"BOOKED".equals(appointment.status()) || appointment.scheduledEnd() == null || appointment.scheduledEnd().isBefore(clock.instant())) {
            throw notFound("APPOINTMENT_NOT_ACTIVE", "That active appointment could not be found.");
        }
        return new ActiveAppointmentAccess(appointment);
    }

    public SharedReportAccess requireSharedReport(UUID doctorUserId, UUID appointmentId, UUID reportId) {
        AppointmentAccess appointment = requireActiveOwnedAppointment(doctorUserId, appointmentId).appointment();
        var rows = jdbc.query(
            """
            SELECT s.report_id, s.shared_at
            FROM appointment_report_shares s
            JOIN patient_medical_reports r
              ON r.id = s.report_id
             AND r.patient_user_id = s.patient_user_id
            WHERE s.appointment_id = ?
              AND s.report_id = ?
              AND s.doctor_user_id = ?
              AND s.patient_user_id = ?
              AND s.revoked_at IS NULL
              AND r.archived_at IS NULL
            """,
            (rs, rowNum) -> new SharedReportAccess(
                appointment,
                rs.getObject("report_id", UUID.class),
                instant(rs.getTimestamp("shared_at"))
            ),
            appointmentId,
            reportId,
            doctorUserId,
            appointment.patientId()
        );
        if (rows.isEmpty()) {
            // Do not reveal whether the report exists, belongs to another Patient, or was revoked.
            throw notFound("SHARED_REPORT_NOT_AVAILABLE", "That report is not available for this appointment.");
        }
        return rows.getFirst();
    }

    public boolean mayModifyAppointment(AppointmentAccess appointment) {
        return "BOOKED".equals(appointment.status())
            && appointment.scheduledStart() != null
            && appointment.scheduledStart().isAfter(clock.instant());
    }

    private static DoctorApiException notFound(String code, String message) {
        return new DoctorApiException(HttpStatus.NOT_FOUND, code, message);
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    public record AppointmentAccess(
        UUID appointmentId,
        UUID patientId,
        UUID doctorId,
        String status,
        Instant scheduledStart,
        Instant scheduledEnd,
        String timezone
    ) {}

    public record ActiveAppointmentAccess(AppointmentAccess appointment) {}

    public record SharedReportAccess(
        AppointmentAccess appointment,
        UUID reportId,
        Instant sharedAt
    ) {}
}
