package com.clinora.doctors.service;

import com.clinora.appointments.service.PatientAppointmentService;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.doctors.api.DoctorApiException;
import com.clinora.patients.service.PatientReportDisplayName;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DoctorWorkspaceService {
    private static final int MAX_PAGE_SIZE = 50;

    private final JdbcTemplate jdbc;
    private final DoctorClinicalAccessService access;
    private final PatientAppointmentService patientAppointments;
    private final AuthAuditService audit;
    private final Clock clock;

    public DoctorWorkspaceService(
        JdbcTemplate jdbc,
        DoctorClinicalAccessService access,
        PatientAppointmentService patientAppointments,
        AuthAuditService audit,
        Clock clock
    ) {
        this.jdbc = jdbc;
        this.access = access;
        this.patientAppointments = patientAppointments;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DoctorWorkspaceModels.DashboardView dashboard(UUID doctorId) {
        access.requireActiveDoctor(doctorId);
        DoctorWorkspaceModels.DoctorIdentity doctor = doctorIdentity(doctorId);

        List<DoctorWorkspaceModels.AppointmentSummary> today = appointmentRows(doctorId, "today", 12, 0);
        List<DoctorWorkspaceModels.AppointmentSummary> upcoming = appointmentRows(doctorId, "upcoming", 1, 0);

        int todayCount = countAppointments(doctorId, "today");
        int upcomingCount = countAppointments(doctorId, "upcoming");
        Integer sharedReportCount = jdbc.queryForObject(
            """
            SELECT COUNT(*)::int
            FROM appointment_report_shares s
            JOIN appointments a ON a.id = s.appointment_id
            JOIN patient_medical_reports r
              ON r.id = s.report_id
             AND r.patient_user_id = s.patient_user_id
            WHERE a.doctor_user_id = ?
              AND a.status = 'BOOKED'
              AND a.scheduled_end >= CURRENT_TIMESTAMP
              AND s.doctor_user_id = ?
              AND s.revoked_at IS NULL
              AND r.archived_at IS NULL
            """,
            Integer.class,
            doctorId,
            doctorId
        );
        AvailabilitySummary availability = availabilitySummary(doctorId);
        DoctorProfileModels.ProfileReadiness readiness = profileReadiness(doctorId, availability.availableSlotCount() > 0);

        return new DoctorWorkspaceModels.DashboardView(
            doctor,
            readiness.percent(),
            readiness.completedItems(),
            readiness.totalItems(),
            readiness.missingItems(),
            todayCount,
            upcomingCount,
            value(sharedReportCount),
            availability.availableSlotCount(),
            availability.nextAvailableAt(),
            upcoming.isEmpty() ? null : upcoming.getFirst(),
            today
        );
    }

    @Transactional(readOnly = true)
    public DoctorWorkspaceModels.AppointmentPage appointments(UUID doctorId, String scope, int limit, int offset) {
        access.requireActiveDoctor(doctorId);
        String normalizedScope = normalizeScope(scope);
        int safeLimit = Math.max(1, Math.min(MAX_PAGE_SIZE, limit));
        int safeOffset = Math.max(0, offset);
        List<DoctorWorkspaceModels.AppointmentSummary> rows = appointmentRows(
            doctorId,
            normalizedScope,
            safeLimit + 1,
            safeOffset
        );
        boolean hasMore = rows.size() > safeLimit;
        if (hasMore) rows = new ArrayList<>(rows.subList(0, safeLimit));
        return new DoctorWorkspaceModels.AppointmentPage(List.copyOf(rows), safeLimit, safeOffset, hasMore);
    }

    @Transactional(readOnly = true)
    public DoctorWorkspaceModels.AppointmentDetail appointment(
        UUID doctorId,
        UUID appointmentId,
        String ip,
        String userAgent
    ) {
        DoctorClinicalAccessService.AppointmentAccess appointment = access.requireOwnedAppointment(doctorId, appointmentId);
        DoctorWorkspaceModels.AppointmentDetail result = appointmentDetail(appointment);
        audit.record(
            doctorId,
            AuthAuditAction.DOCTOR_APPOINTMENT_VIEWED,
            AuthAuditOutcome.SUCCESS,
            ip,
            userAgent,
            appointmentId.toString(),
            "patientId=" + appointment.patientId()
        );
        return result;
    }

    @Transactional
    public DoctorWorkspaceModels.AppointmentDetail cancel(
        UUID doctorId,
        UUID appointmentId,
        String reason,
        String ip,
        String userAgent
    ) {
        DoctorClinicalAccessService.AppointmentAccess appointment = access.requireOwnedAppointment(doctorId, appointmentId);
        if (!access.mayModifyAppointment(appointment)) {
            throw new DoctorApiException(
                HttpStatus.CONFLICT,
                "DOCTOR_APPOINTMENT_NOT_CANCELLABLE",
                "Only a future booked appointment can be cancelled."
            );
        }
        patientAppointments.cancel(appointment.patientId(), appointmentId, clean(reason, 240));
        audit.record(
            doctorId,
            AuthAuditAction.DOCTOR_APPOINTMENT_CANCELLED,
            AuthAuditOutcome.SUCCESS,
            ip,
            userAgent,
            appointmentId.toString(),
            "patientId=" + appointment.patientId()
        );
        return appointmentDetail(access.requireOwnedAppointment(doctorId, appointmentId));
    }

    @Transactional
    public DoctorWorkspaceModels.AppointmentDetail reschedule(
        UUID doctorId,
        UUID appointmentId,
        UUID slotId,
        String timezone,
        String ip,
        String userAgent
    ) {
        if (slotId == null) {
            throw new DoctorApiException(HttpStatus.BAD_REQUEST, "DOCTOR_SLOT_REQUIRED", "Choose a new appointment time.");
        }
        DoctorClinicalAccessService.AppointmentAccess appointment = access.requireOwnedAppointment(doctorId, appointmentId);
        if (!access.mayModifyAppointment(appointment)) {
            throw new DoctorApiException(
                HttpStatus.CONFLICT,
                "DOCTOR_APPOINTMENT_NOT_RESCHEDULABLE",
                "Only a future booked appointment can be rescheduled."
            );
        }
        String chosenTimezone = clean(timezone, 80);
        if (chosenTimezone == null) chosenTimezone = appointment.timezone();
        patientAppointments.reschedule(appointment.patientId(), appointmentId, slotId, chosenTimezone);
        audit.record(
            doctorId,
            AuthAuditAction.DOCTOR_APPOINTMENT_RESCHEDULED,
            AuthAuditOutcome.SUCCESS,
            ip,
            userAgent,
            appointmentId.toString(),
            "patientId=" + appointment.patientId() + ";slotId=" + slotId
        );
        return appointmentDetail(access.requireOwnedAppointment(doctorId, appointmentId));
    }

    private DoctorWorkspaceModels.AppointmentDetail appointmentDetail(
        DoctorClinicalAccessService.AppointmentAccess appointment
    ) {
        var rows = jdbc.query(
            """
            SELECT a.id,
                   a.status,
                   a.reason_for_visit,
                   a.scheduled_start,
                   a.scheduled_end,
                   a.booking_timezone,
                   u.id AS patient_id,
                   u.first_name,
                   u.last_name,
                   p.id AS patient_profile_id,
                   p.date_of_birth,
                   p.gender,
                   p.blood_group
            FROM appointments a
            JOIN users u ON u.id = a.patient_user_id
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            WHERE a.id = ? AND a.doctor_user_id = ?
            """,
            (rs, rowNum) -> new AppointmentCore(
                rs.getObject("id", UUID.class),
                rs.getString("status"),
                rs.getString("reason_for_visit"),
                instant(rs.getTimestamp("scheduled_start")),
                instant(rs.getTimestamp("scheduled_end")),
                rs.getString("booking_timezone"),
                rs.getObject("patient_id", UUID.class),
                rs.getObject("patient_profile_id", UUID.class),
                displayName(rs.getString("first_name"), rs.getString("last_name")),
                localDate(rs.getDate("date_of_birth")),
                rs.getString("gender"),
                rs.getString("blood_group")
            ),
            appointment.appointmentId(),
            appointment.doctorId()
        );
        if (rows.isEmpty()) {
            throw new DoctorApiException(HttpStatus.NOT_FOUND, "APPOINTMENT_NOT_FOUND", "That appointment could not be found.");
        }
        AppointmentCore core = rows.getFirst();
        DoctorWorkspaceModels.PatientContext patient = new DoctorWorkspaceModels.PatientContext(
            core.patientId(),
            core.patientName(),
            core.dateOfBirth(),
            core.gender(),
            core.bloodGroup(),
            clinicalList("patient_allergies", core.patientProfileId()),
            clinicalList("patient_chronic_conditions", core.patientProfileId()),
            clinicalList("patient_current_medications", core.patientProfileId())
        );
        boolean reportAccessActive = "BOOKED".equals(core.status())
            && core.scheduledEnd() != null
            && !core.scheduledEnd().isBefore(clock.instant());
        return new DoctorWorkspaceModels.AppointmentDetail(
            core.id(),
            core.status(),
            core.reason(),
            core.scheduledStart(),
            core.scheduledEnd(),
            core.timezone(),
            access.mayModifyAppointment(appointment),
            reportAccessActive,
            patient,
            reportAccessActive ? sharedReports(appointment) : List.of()
        );
    }

    private List<String> clinicalList(String table, UUID patientProfileId) {
        if (patientProfileId == null) return List.of();
        return jdbc.query(
            "SELECT name FROM " + table + " WHERE patient_profile_id = ? ORDER BY lower(name)",
            (rs, rowNum) -> rs.getString("name"),
            patientProfileId
        );
    }

    private DoctorWorkspaceModels.DoctorIdentity doctorIdentity(UUID doctorId) {
        var rows = jdbc.query(
            """
            SELECT u.id,
                   u.first_name,
                   u.last_name,
                   d.professional_title,
                   d.specialization,
                   d.current_organization,
                   d.current_position
            FROM users u
            JOIN LATERAL (
                SELECT candidate.*
                FROM access_applications candidate
                WHERE candidate.normalized_email = u.normalized_email
                  AND candidate.application_type = 'DOCTOR'
                  AND candidate.status = 'ACTIVATED'
                ORDER BY candidate.updated_at DESC, candidate.id DESC
                LIMIT 1
            ) a ON TRUE
            JOIN doctor_application_details d ON d.application_id = a.id
            WHERE u.id = ?
            """,
            (rs, rowNum) -> new DoctorWorkspaceModels.DoctorIdentity(
                rs.getObject("id", UUID.class),
                displayName(rs.getString("first_name"), rs.getString("last_name")),
                rs.getString("professional_title"),
                rs.getString("specialization"),
                rs.getString("current_organization"),
                rs.getString("current_position")
            ),
            doctorId
        );
        if (rows.isEmpty()) {
            throw new DoctorApiException(HttpStatus.FORBIDDEN, "DOCTOR_PROFILE_REQUIRED", "Your Doctor profile is unavailable.");
        }
        return rows.getFirst();
    }

    private List<DoctorWorkspaceModels.AppointmentSummary> appointmentRows(
        UUID doctorId,
        String scope,
        int limit,
        int offset
    ) {
        String predicate = predicate(scope);
        String order = "history".equals(scope) ? "a.scheduled_start DESC" : "a.scheduled_start ASC";
        String sql = """
            SELECT a.id,
                   a.patient_user_id,
                   u.first_name,
                   u.last_name,
                   a.scheduled_start,
                   a.scheduled_end,
                   a.booking_timezone,
                   a.status,
                   a.reason_for_visit,
                   (SELECT COUNT(*)::int
                      FROM appointment_report_shares s
                      JOIN patient_medical_reports sr
                        ON sr.id = s.report_id
                       AND sr.patient_user_id = s.patient_user_id
                     WHERE s.appointment_id = a.id
                       AND s.doctor_user_id = a.doctor_user_id
                       AND s.revoked_at IS NULL
                       AND sr.archived_at IS NULL) AS shared_report_count
            FROM appointments a
            JOIN users u ON u.id = a.patient_user_id
            WHERE a.doctor_user_id = ?
            """ + predicate + " ORDER BY " + order + " LIMIT ? OFFSET ?";

        return jdbc.query(
            sql,
            (rs, rowNum) -> new DoctorWorkspaceModels.AppointmentSummary(
                rs.getObject("id", UUID.class),
                rs.getObject("patient_user_id", UUID.class),
                displayName(rs.getString("first_name"), rs.getString("last_name")),
                instant(rs.getTimestamp("scheduled_start")),
                instant(rs.getTimestamp("scheduled_end")),
                rs.getString("booking_timezone"),
                rs.getString("status"),
                rs.getString("reason_for_visit"),
                rs.getInt("shared_report_count")
            ),
            doctorId,
            limit,
            offset
        );
    }

    private int countAppointments(UUID doctorId, String scope) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM appointments a WHERE a.doctor_user_id = ? " + predicate(scope),
            Integer.class,
            doctorId
        );
        return value(count);
    }

    private String predicate(String scope) {
        return switch (scope) {
            case "today" -> """
                 AND a.status = 'BOOKED'
                 AND (a.scheduled_start AT TIME ZONE COALESCE(NULLIF(a.booking_timezone, ''), 'UTC'))::date
                     = (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(a.booking_timezone, ''), 'UTC'))::date
                """;
            case "history" -> """
                 AND (a.status IN ('CANCELLED', 'COMPLETED') OR a.scheduled_end < CURRENT_TIMESTAMP)
                """;
            default -> """
                 AND a.status = 'BOOKED'
                 AND a.scheduled_end >= CURRENT_TIMESTAMP
                """;
        };
    }

    private List<DoctorWorkspaceModels.SharedReportSummary> sharedReports(
        DoctorClinicalAccessService.AppointmentAccess appointment
    ) {
        return jdbc.query(
            """
            SELECT r.id,
                   r.report_name,
                   r.report_type,
                   r.report_date,
                   r.provider_laboratory,
                   r.original_filename,
                   r.mime_type,
                   s.shared_at
            FROM appointment_report_shares s
            JOIN patient_medical_reports r
              ON r.id = s.report_id
             AND r.patient_user_id = s.patient_user_id
            WHERE s.appointment_id = ?
              AND s.doctor_user_id = ?
              AND s.patient_user_id = ?
              AND s.revoked_at IS NULL
              AND r.archived_at IS NULL
            ORDER BY COALESCE(r.report_date, DATE '1900-01-01') DESC, s.shared_at DESC
            """,
            (rs, rowNum) -> {
                LocalDate reportDate = localDate(rs.getDate("report_date"));
                return new DoctorWorkspaceModels.SharedReportSummary(
                    rs.getObject("id", UUID.class),
                    PatientReportDisplayName.resolve(
                        rs.getString("report_name"),
                        rs.getString("original_filename"),
                        rs.getString("report_type"),
                        reportDate,
                        rs.getString("provider_laboratory")
                    ),
                    rs.getString("report_type"),
                    reportDate,
                    rs.getString("provider_laboratory"),
                    rs.getString("mime_type"),
                    instant(rs.getTimestamp("shared_at"))
                );
            },
            appointment.appointmentId(),
            appointment.doctorId(),
            appointment.patientId()
        );
    }

    private AvailabilitySummary availabilitySummary(UUID doctorId) {
        return jdbc.queryForObject(
            """
            SELECT COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int AS available_count,
                   MIN(starts_at) FILTER (WHERE status = 'AVAILABLE') AS next_available
            FROM doctor_availability_slots
            WHERE doctor_user_id = ? AND starts_at > CURRENT_TIMESTAMP
            """,
            (rs, rowNum) -> new AvailabilitySummary(
                rs.getInt("available_count"),
                instant(rs.getTimestamp("next_available"))
            ),
            doctorId
        );
    }

    private DoctorProfileModels.ProfileReadiness profileReadiness(UUID doctorId, boolean hasAvailability) {
        var rows = jdbc.query(
            """
            SELECT p.professional_bio, p.professional_profile_url, p.display_title,
                   p.preferred_timezone, p.default_consultation_minutes
            FROM doctor_booking_profiles p
            WHERE p.doctor_user_id = ?
            """,
            (rs, rowNum) -> {
                int score = 60;
                int completed = 0;
                List<DoctorProfileModels.MissingSetupItem> missing = new ArrayList<>();
                if (notBlank(rs.getString("professional_profile_url"))) { score += 10; completed++; }
                else missing.add(new DoctorProfileModels.MissingSetupItem("professionalProfileUrl", "Professional profile URL", "/doctor/profile"));
                if (notBlank(rs.getString("professional_bio"))) { score += 10; completed++; }
                else missing.add(new DoctorProfileModels.MissingSetupItem("professionalBio", "Professional bio", "/doctor/profile"));
                if (notBlank(rs.getString("display_title"))) { score += 5; completed++; }
                else missing.add(new DoctorProfileModels.MissingSetupItem("displayTitle", "Display title", "/doctor/profile"));
                if (notBlank(rs.getString("preferred_timezone"))) { score += 5; completed++; }
                else missing.add(new DoctorProfileModels.MissingSetupItem("preferredTimezone", "Preferred timezone", "/doctor/profile"));
                if (rs.getObject("default_consultation_minutes") != null) { score += 5; completed++; }
                else missing.add(new DoctorProfileModels.MissingSetupItem("defaultConsultationMinutes", "Default consultation duration", "/doctor/profile"));
                if (hasAvailability) { score += 5; completed++; }
                else missing.add(new DoctorProfileModels.MissingSetupItem("availability", "Future availability", "/doctor/availability"));
                return new DoctorProfileModels.ProfileReadiness(Math.min(100, score), completed, 6, List.copyOf(missing));
            },
            doctorId
        );
        if (!rows.isEmpty()) return rows.getFirst();
        return new DoctorProfileModels.ProfileReadiness(60, 0, 6, List.of());
    }

    private String normalizeScope(String scope) {
        if (scope == null) return "upcoming";
        String value = scope.toLowerCase(Locale.ROOT).trim();
        return switch (value) {
            case "today", "history", "upcoming" -> value;
            default -> "upcoming";
        };
    }

    private static String clean(String value, int max) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }

    private static String displayName(String firstName, String lastName) {
        return ((firstName == null ? "" : firstName.trim()) + " " + (lastName == null ? "" : lastName.trim())).trim();
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static int value(Integer value) {
        return value == null ? 0 : value;
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private static LocalDate localDate(java.sql.Date value) {
        return value == null ? null : value.toLocalDate();
    }


    private record AppointmentCore(
        UUID id,
        String status,
        String reason,
        Instant scheduledStart,
        Instant scheduledEnd,
        String timezone,
        UUID patientId,
        UUID patientProfileId,
        String patientName,
        LocalDate dateOfBirth,
        String gender,
        String bloodGroup
    ) {}
    private record AvailabilitySummary(int availableSlotCount, Instant nextAvailableAt) {}
}
