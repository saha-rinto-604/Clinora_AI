package com.clinora.appointments.service;

import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.notifications.service.PatientNotificationService.NotificationCategory;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.service.PatientTimelineService;
import com.clinora.patients.service.PatientTimelineService.TimelineCategory;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PatientAppointmentService {
    private final JdbcTemplate jdbc;
    private final PatientTimelineService timeline;
    private final PatientNotificationService notifications;
    private final Clock clock;

    public PatientAppointmentService(
        JdbcTemplate jdbc,
        PatientTimelineService timeline,
        PatientNotificationService notifications,
        Clock clock
    ) {
        this.jdbc = jdbc;
        this.timeline = timeline;
        this.notifications = notifications;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DoctorSearchPage searchDoctors(UUID patientUserId, String query, String specialty, int limit) {
        requireActiveUser(patientUserId, "PATIENT");
        int safeLimit = Math.max(1, Math.min(limit, 40));
        String cleanedQuery = text(query, 120);
        String cleanedSpecialty = text(specialty, 180);
        List<DoctorView> items = jdbc.query(
            """
            SELECT p.doctor_user_id, p.display_name, p.professional_title, p.specialization,
                   p.years_experience, p.current_organization, p.current_position,
                   p.registration_jurisdiction, p.registration_authority, p.registration_type,
                   p.registration_valid_until,
                   (SELECT MIN(s.starts_at) FROM doctor_availability_slots s
                     WHERE s.doctor_user_id = p.doctor_user_id
                       AND s.status = 'AVAILABLE' AND s.starts_at > CURRENT_TIMESTAMP) AS next_available_at
            FROM doctor_booking_profiles p
            JOIN users u ON u.id = p.doctor_user_id
            WHERE p.booking_enabled = TRUE
              AND u.role = 'DOCTOR'
              AND u.account_status = 'ACTIVE'
              AND u.email_verified_at IS NOT NULL
              AND (p.registration_valid_until IS NULL OR p.registration_valid_until >= CURRENT_DATE)
              AND (CAST(? AS VARCHAR) IS NULL OR lower(p.display_name) LIKE '%' || lower(?) || '%'
                    OR lower(p.specialization) LIKE '%' || lower(?) || '%')
              AND (CAST(? AS VARCHAR) IS NULL OR lower(p.specialization) = lower(?))
            ORDER BY next_available_at NULLS LAST, p.display_name
            LIMIT ?
            """,
            DOCTOR_MAPPER,
            cleanedQuery, cleanedQuery, cleanedQuery, cleanedSpecialty, cleanedSpecialty, safeLimit
        );
        return new DoctorSearchPage(items);
    }

    @Transactional(readOnly = true)
    public DoctorDetailView doctor(UUID patientUserId, UUID doctorUserId) {
        requireActiveUser(patientUserId, "PATIENT");
        List<DoctorView> doctors = jdbc.query(
            """
            SELECT p.doctor_user_id, p.display_name, p.professional_title, p.specialization,
                   p.years_experience, p.current_organization, p.current_position,
                   p.registration_jurisdiction, p.registration_authority, p.registration_type,
                   p.registration_valid_until,
                   (SELECT MIN(s.starts_at) FROM doctor_availability_slots s
                     WHERE s.doctor_user_id = p.doctor_user_id
                       AND s.status = 'AVAILABLE' AND s.starts_at > CURRENT_TIMESTAMP) AS next_available_at
            FROM doctor_booking_profiles p
            JOIN users u ON u.id = p.doctor_user_id
            WHERE p.doctor_user_id = ? AND p.booking_enabled = TRUE
              AND u.role = 'DOCTOR' AND u.account_status = 'ACTIVE' AND u.email_verified_at IS NOT NULL
              AND (p.registration_valid_until IS NULL OR p.registration_valid_until >= CURRENT_DATE)
            """,
            DOCTOR_MAPPER,
            doctorUserId
        );
        if (doctors.isEmpty()) throw notFound("DOCTOR_NOT_AVAILABLE", "That Clinora Doctor is not available for booking.");
        return new DoctorDetailView(doctors.getFirst(), availability(patientUserId, doctorUserId, clock.instant(), 30));
    }

    @Transactional(readOnly = true)
    public List<AvailabilitySlotView> availability(UUID patientUserId, UUID doctorUserId, Instant after, int limit) {
        requireActiveUser(patientUserId, "PATIENT");
        requireBookableDoctor(doctorUserId);
        int safeLimit = Math.max(1, Math.min(limit, 100));
        Instant start = after == null || after.isBefore(clock.instant()) ? clock.instant() : after;
        return jdbc.query(
            """
            SELECT id, doctor_user_id, starts_at, ends_at, timezone, status
            FROM doctor_availability_slots
            WHERE doctor_user_id = ? AND status = 'AVAILABLE' AND starts_at > ?
            ORDER BY starts_at
            LIMIT ?
            """,
            (rs, rowNum) -> new AvailabilitySlotView(
                rs.getObject("id", UUID.class),
                rs.getObject("doctor_user_id", UUID.class),
                rs.getTimestamp("starts_at").toInstant(),
                rs.getTimestamp("ends_at").toInstant(),
                rs.getString("timezone"),
                rs.getString("status")
            ),
            doctorUserId, Timestamp.from(start), safeLimit
        );
    }

    @Transactional
    public List<AvailabilitySlotView> addAvailability(
        UUID doctorUserId,
        Instant startsAt,
        Instant endsAt,
        int slotMinutes,
        String timezone
    ) {
        requireActiveUser(doctorUserId, "DOCTOR");
        refreshDoctorBookingProjection(doctorUserId);
        requireBookableDoctor(doctorUserId);
        requireTimezone(timezone);
        // Serialize availability mutations for a Doctor so overlapping windows cannot pass the pre-insert check concurrently.
        jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, doctorUserId);
        Instant now = clock.instant();
        if (startsAt == null || endsAt == null || !endsAt.isAfter(startsAt) || !startsAt.isAfter(now)) {
            throw badRequest("AVAILABILITY_TIME_INVALID", "Choose a future availability window.");
        }
        if (Duration.between(startsAt, endsAt).toHours() > 12 || endsAt.isAfter(now.plus(Duration.ofDays(120)))) {
            throw badRequest("AVAILABILITY_RANGE_INVALID", "Availability can cover up to 12 hours within the next 120 days.");
        }
        if (slotMinutes < 15 || slotMinutes > 120 || slotMinutes % 5 != 0) {
            throw badRequest("AVAILABILITY_SLOT_INVALID", "Appointment length must be between 15 and 120 minutes.");
        }
        Integer overlapping = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM doctor_availability_slots
            WHERE doctor_user_id = ? AND status IN ('AVAILABLE','BOOKED')
              AND starts_at < ? AND ends_at > ?
            """,
            Integer.class,
            doctorUserId, Timestamp.from(endsAt), Timestamp.from(startsAt)
        );
        if (overlapping != null && overlapping > 0) {
            throw new PatientApiException(HttpStatus.CONFLICT, "AVAILABILITY_OVERLAP", "This availability overlaps an existing time.");
        }
        List<AvailabilitySlotView> created = new ArrayList<>();
        Instant cursor = startsAt;
        while (!cursor.plus(Duration.ofMinutes(slotMinutes)).isAfter(endsAt)) {
            Instant slotEnd = cursor.plus(Duration.ofMinutes(slotMinutes));
            UUID id = UUID.randomUUID();
            jdbc.update(
                """
                INSERT INTO doctor_availability_slots
                    (id, doctor_user_id, starts_at, ends_at, timezone, status, created_at, updated_at, version)
                VALUES (?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, 0)
                """,
                id, doctorUserId, Timestamp.from(cursor), Timestamp.from(slotEnd), timezone,
                Timestamp.from(now), Timestamp.from(now)
            );
            created.add(new AvailabilitySlotView(id, doctorUserId, cursor, slotEnd, timezone, "AVAILABLE"));
            cursor = slotEnd;
        }
        if (created.isEmpty()) throw badRequest("AVAILABILITY_SLOT_INVALID", "The availability window is shorter than one appointment.");
        return List.copyOf(created);
    }

    @Transactional(readOnly = true)
    public List<AvailabilitySlotView> doctorAvailability(UUID doctorUserId) {
        requireActiveUser(doctorUserId, "DOCTOR");
        // A newly activated Doctor may not have a booking projection until the first availability write.
        // Reading an empty schedule must remain side-effect free so the page can initialize cleanly.
        return jdbc.query(
            """
            SELECT id, doctor_user_id, starts_at, ends_at, timezone, status
            FROM doctor_availability_slots
            WHERE doctor_user_id = ? AND starts_at > CURRENT_TIMESTAMP
            ORDER BY starts_at LIMIT 120
            """,
            (rs, rowNum) -> new AvailabilitySlotView(
                rs.getObject("id", UUID.class), rs.getObject("doctor_user_id", UUID.class),
                rs.getTimestamp("starts_at").toInstant(), rs.getTimestamp("ends_at").toInstant(), rs.getString("timezone"),
                rs.getString("status")
            ),
            doctorUserId
        );
    }

    @Transactional
    public void removeAvailability(UUID doctorUserId, UUID slotId) {
        requireActiveUser(doctorUserId, "DOCTOR");
        requireBookableDoctor(doctorUserId);
        int changed = jdbc.update(
            "UPDATE doctor_availability_slots SET status = 'BLOCKED', updated_at = ?, version = version + 1 " +
                "WHERE id = ? AND doctor_user_id = ? AND status = 'AVAILABLE' AND starts_at > CURRENT_TIMESTAMP",
            Timestamp.from(clock.instant()), slotId, doctorUserId
        );
        if (changed == 0) throw new PatientApiException(HttpStatus.CONFLICT, "AVAILABILITY_NOT_REMOVABLE", "Only future unbooked availability can be removed.");
    }

    @Transactional
    public AppointmentView book(
        UUID patientUserId,
        String idempotencyKey,
        UUID slotId,
        String reasonForVisit,
        String timezone,
        List<UUID> reportIds
    ) {
        requireActiveUser(patientUserId, "PATIENT");
        String key = requiredText(idempotencyKey, 120, "IDEMPOTENCY_KEY_REQUIRED", "A booking request key is required.");
        // Serialize booking requests for one Patient so a retried Idempotency-Key cannot leave a slot reserved by a losing transaction.
        jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, patientUserId);
        List<AppointmentView> existing = appointmentByIdempotency(patientUserId, key);
        if (!existing.isEmpty()) return existing.getFirst();
        requireTimezone(timezone);
        SlotLock slot = lockSlot(slotId);
        if (!"AVAILABLE".equals(slot.status()) || !slot.startsAt().isAfter(clock.instant())) {
            throw new PatientApiException(HttpStatus.CONFLICT, "APPOINTMENT_SLOT_UNAVAILABLE", "That appointment time is no longer available.");
        }
        requireBookableDoctor(slot.doctorUserId());
        String reason = text(reasonForVisit, 500);
        Instant now = clock.instant();
        UUID appointmentId = UUID.randomUUID();
        int slotReserved = jdbc.update(
            "UPDATE doctor_availability_slots SET status = 'BOOKED', updated_at = ?, version = version + 1 WHERE id = ? AND status = 'AVAILABLE'",
            Timestamp.from(now), slotId
        );
        if (slotReserved != 1) {
            throw new PatientApiException(HttpStatus.CONFLICT, "APPOINTMENT_SLOT_UNAVAILABLE", "That appointment time is no longer available.");
        }
        jdbc.update(
            """
            INSERT INTO appointments (
                id, patient_user_id, doctor_user_id, slot_id, status, reason_for_visit,
                scheduled_start, scheduled_end, booking_timezone, idempotency_key,
                booked_at, created_at, updated_at, version
            ) VALUES (?, ?, ?, ?, 'BOOKED', ?, ?, ?, ?, ?, ?, ?, ?, 0)
            """,
            appointmentId, patientUserId, slot.doctorUserId(), slotId, reason,
            Timestamp.from(slot.startsAt()), Timestamp.from(slot.endsAt()), timezone, key,
            Timestamp.from(now), Timestamp.from(now), Timestamp.from(now)
        );
        for (UUID reportId : distinct(reportIds)) addShareInternal(patientUserId, appointmentId, reportId, now);
        timeline.append(
            patientUserId, "APPOINTMENT_BOOKED", TimelineCategory.APPOINTMENTS, "APPOINTMENT", appointmentId,
            "Appointment booked", slot.doctorName(), now, "appointment-booked:" + appointmentId
        );
        notifications.create(
            patientUserId, "APPOINTMENT_BOOKED", NotificationCategory.APPOINTMENTS,
            "Appointment confirmed", "Your appointment with " + slot.doctorName() + " is confirmed.",
            "APPOINTMENT", appointmentId, "appointment-booked:" + appointmentId
        );
        return appointment(patientUserId, appointmentId);
    }

    @Transactional(readOnly = true)
    public List<AppointmentView> appointments(UUID patientUserId, AppointmentCollection collection) {
        requireActiveUser(patientUserId, "PATIENT");
        String direction = collection == AppointmentCollection.UPCOMING ? "ASC" : "DESC";
        String condition = collection == AppointmentCollection.UPCOMING
            ? " a.status = 'BOOKED' AND a.scheduled_start >= CURRENT_TIMESTAMP"
            : " (a.status <> 'BOOKED' OR a.scheduled_start < CURRENT_TIMESTAMP)";
        return jdbc.query(
            """
            SELECT a.id, a.status, a.reason_for_visit, a.scheduled_start, a.scheduled_end, a.booking_timezone,
                   a.booked_at, a.cancelled_at, p.doctor_user_id, p.display_name, p.specialization,
                   (SELECT COUNT(*) FROM appointment_report_shares s WHERE s.appointment_id = a.id AND s.revoked_at IS NULL) AS shared_report_count
            FROM appointments a JOIN doctor_booking_profiles p ON p.doctor_user_id = a.doctor_user_id
            WHERE a.patient_user_id = ? AND """ + condition + " ORDER BY a.scheduled_start " + direction + " LIMIT 100",
            APPOINTMENT_MAPPER,
            patientUserId
        );
    }

    @Transactional(readOnly = true)
    public AppointmentView appointment(UUID patientUserId, UUID appointmentId) {
        requireActiveUser(patientUserId, "PATIENT");
        List<AppointmentView> items = jdbc.query(
            """
            SELECT a.id, a.status, a.reason_for_visit, a.scheduled_start, a.scheduled_end, a.booking_timezone,
                   a.booked_at, a.cancelled_at, p.doctor_user_id, p.display_name, p.specialization,
                   (SELECT COUNT(*) FROM appointment_report_shares s WHERE s.appointment_id = a.id AND s.revoked_at IS NULL) AS shared_report_count
            FROM appointments a JOIN doctor_booking_profiles p ON p.doctor_user_id = a.doctor_user_id
            WHERE a.id = ? AND a.patient_user_id = ?
            """,
            APPOINTMENT_MAPPER,
            appointmentId, patientUserId
        );
        if (items.isEmpty()) throw notFound("APPOINTMENT_NOT_FOUND", "That appointment could not be found.");
        return items.getFirst();
    }

    @Transactional
    public AppointmentView cancel(UUID patientUserId, UUID appointmentId, String cancellationReason) {
        requireActiveUser(patientUserId, "PATIENT");
        LockedAppointment appointment = lockAppointment(patientUserId, appointmentId);
        if ("CANCELLED".equals(appointment.status())) return appointment(patientUserId, appointmentId);
        if (!"BOOKED".equals(appointment.status())) {
            throw new PatientApiException(HttpStatus.CONFLICT, "APPOINTMENT_NOT_CANCELLABLE", "This appointment cannot be cancelled.");
        }
        Instant now = clock.instant();
        if (!appointment.scheduledStart().isAfter(now)) {
            throw new PatientApiException(HttpStatus.CONFLICT, "APPOINTMENT_ALREADY_STARTED", "Past appointments cannot be cancelled from the Patient portal.");
        }
        jdbc.update(
            "UPDATE appointments SET status = 'CANCELLED', cancelled_at = ?, cancellation_reason = ?, updated_at = ?, version = version + 1 WHERE id = ?",
            Timestamp.from(now), text(cancellationReason, 240), Timestamp.from(now), appointmentId
        );
        jdbc.update(
            "UPDATE doctor_availability_slots SET status = 'AVAILABLE', updated_at = ?, version = version + 1 WHERE id = ? AND status = 'BOOKED'",
            Timestamp.from(now), appointment.slotId()
        );
        jdbc.update(
            "UPDATE appointment_report_shares SET revoked_at = ? WHERE appointment_id = ? AND revoked_at IS NULL",
            Timestamp.from(now), appointmentId
        );
        timeline.append(
            patientUserId, "APPOINTMENT_CANCELLED", TimelineCategory.APPOINTMENTS, "APPOINTMENT", appointmentId,
            "Appointment cancelled", appointment.doctorName(), now, "appointment-cancelled:" + appointmentId
        );
        notifications.create(
            patientUserId, "APPOINTMENT_CANCELLED", NotificationCategory.APPOINTMENTS,
            "Appointment cancelled", "Your appointment with " + appointment.doctorName() + " has been cancelled.",
            "APPOINTMENT", appointmentId, "appointment-cancelled:" + appointmentId
        );
        return appointment(patientUserId, appointmentId);
    }

    @Transactional
    public AppointmentView reschedule(UUID patientUserId, UUID appointmentId, UUID nextSlotId, String timezone) {
        requireActiveUser(patientUserId, "PATIENT");
        requireTimezone(timezone);
        LockedAppointment appointment = lockAppointment(patientUserId, appointmentId);
        if (!"BOOKED".equals(appointment.status())) {
            throw new PatientApiException(HttpStatus.CONFLICT, "APPOINTMENT_NOT_RESCHEDULABLE", "This appointment cannot be rescheduled.");
        }
        if (appointment.slotId().equals(nextSlotId)) {
            return appointment(patientUserId, appointmentId);
        }
        Instant now = clock.instant();
        if (!appointment.scheduledStart().isAfter(now)) {
            throw new PatientApiException(HttpStatus.CONFLICT, "APPOINTMENT_ALREADY_STARTED", "Past appointments cannot be rescheduled.");
        }
        SlotLock next = lockSlot(nextSlotId);
        if (!next.doctorUserId().equals(appointment.doctorUserId())) {
            throw badRequest("RESCHEDULE_DOCTOR_MISMATCH", "Choose another time with the same Doctor, or book a new Doctor separately.");
        }
        if (!"AVAILABLE".equals(next.status()) || !next.startsAt().isAfter(now)) {
            throw new PatientApiException(HttpStatus.CONFLICT, "APPOINTMENT_SLOT_UNAVAILABLE", "That appointment time is no longer available.");
        }
        int nextReserved = jdbc.update(
            "UPDATE doctor_availability_slots SET status = 'BOOKED', updated_at = ?, version = version + 1 WHERE id = ? AND status = 'AVAILABLE'",
            Timestamp.from(now), nextSlotId
        );
        if (nextReserved != 1) {
            throw new PatientApiException(HttpStatus.CONFLICT, "APPOINTMENT_SLOT_UNAVAILABLE", "That appointment time is no longer available.");
        }
        jdbc.update(
            "UPDATE doctor_availability_slots SET status = 'AVAILABLE', updated_at = ?, version = version + 1 WHERE id = ? AND status = 'BOOKED'",
            Timestamp.from(now), appointment.slotId()
        );
        jdbc.update(
            """
            UPDATE appointments SET slot_id = ?, scheduled_start = ?, scheduled_end = ?, booking_timezone = ?,
                updated_at = ?, version = version + 1 WHERE id = ?
            """,
            nextSlotId, Timestamp.from(next.startsAt()), Timestamp.from(next.endsAt()), timezone, Timestamp.from(now), appointmentId
        );
        timeline.append(
            patientUserId, "APPOINTMENT_RESCHEDULED", TimelineCategory.APPOINTMENTS, "APPOINTMENT", appointmentId,
            "Appointment rescheduled", next.doctorName(), now, "appointment-rescheduled:" + appointmentId + ":" + next.startsAt().toEpochMilli()
        );
        notifications.create(
            patientUserId, "APPOINTMENT_RESCHEDULED", NotificationCategory.APPOINTMENTS,
            "Appointment rescheduled", "Your appointment with " + next.doctorName() + " has a new time.",
            "APPOINTMENT", appointmentId, "appointment-rescheduled:" + appointmentId + ":" + next.startsAt().toEpochMilli()
        );
        return appointment(patientUserId, appointmentId);
    }

    @Transactional(readOnly = true)
    public List<ReportShareView> shares(UUID patientUserId, UUID appointmentId) {
        appointment(patientUserId, appointmentId);
        return jdbc.query(
            """
            SELECT s.report_id, r.report_name, r.report_type, r.report_date, s.shared_at, s.revoked_at
            FROM appointment_report_shares s
            JOIN patient_medical_reports r ON r.id = s.report_id
            WHERE s.appointment_id = ? AND s.patient_user_id = ?
            ORDER BY s.shared_at DESC
            """,
            (rs, rowNum) -> new ReportShareView(
                rs.getObject("report_id", UUID.class), rs.getString("report_name"), rs.getString("report_type"),
                rs.getDate("report_date") == null ? null : rs.getDate("report_date").toLocalDate(),
                rs.getTimestamp("shared_at").toInstant(),
                rs.getTimestamp("revoked_at") == null ? null : rs.getTimestamp("revoked_at").toInstant()
            ),
            appointmentId, patientUserId
        );
    }

    @Transactional
    public ReportShareView shareReport(UUID patientUserId, UUID appointmentId, UUID reportId) {
        requireActiveUser(patientUserId, "PATIENT");
        LockedAppointment appointment = lockAppointment(patientUserId, appointmentId);
        if (!"BOOKED".equals(appointment.status()) || !appointment.scheduledStart().isAfter(clock.instant())) {
            throw new PatientApiException(HttpStatus.CONFLICT, "APPOINTMENT_NOT_ACTIVE", "Reports can only be shared for an upcoming appointment.");
        }
        Instant now = clock.instant();
        addShareInternal(patientUserId, appointmentId, reportId, now);
        return shares(patientUserId, appointmentId).stream()
            .filter(item -> item.reportId().equals(reportId))
            .findFirst()
            .orElseThrow();
    }

    @Transactional
    public void revokeShare(UUID patientUserId, UUID appointmentId, UUID reportId) {
        requireActiveUser(patientUserId, "PATIENT");
        lockAppointment(patientUserId, appointmentId);
        int changed = jdbc.update(
            "UPDATE appointment_report_shares SET revoked_at = ? WHERE appointment_id = ? AND patient_user_id = ? AND report_id = ? AND revoked_at IS NULL",
            Timestamp.from(clock.instant()), appointmentId, patientUserId, reportId
        );
        if (changed == 0) throw notFound("REPORT_SHARE_NOT_FOUND", "That active report share could not be found.");
    }

    private void addShareInternal(UUID patientUserId, UUID appointmentId, UUID reportId, Instant now) {
        Integer owned = jdbc.queryForObject(
            "SELECT COUNT(*) FROM patient_medical_reports WHERE id = ? AND patient_user_id = ? AND archived_at IS NULL",
            Integer.class, reportId, patientUserId
        );
        if (owned == null || owned != 1) throw badRequest("REPORT_NOT_SHAREABLE", "Choose an active medical report from your own report library.");
        UUID doctorUserId = jdbc.queryForObject("SELECT doctor_user_id FROM appointments WHERE id = ? AND patient_user_id = ?", UUID.class, appointmentId, patientUserId);
        jdbc.update(
            """
            INSERT INTO appointment_report_shares
                (id, appointment_id, report_id, patient_user_id, doctor_user_id, shared_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (appointment_id, report_id)
            DO UPDATE SET revoked_at = NULL, shared_at = EXCLUDED.shared_at
            """,
            UUID.randomUUID(), appointmentId, reportId, patientUserId, doctorUserId, Timestamp.from(now), Timestamp.from(now)
        );
    }

    @Transactional(readOnly = true)
    public PortalCareSummary portalSummary(UUID patientUserId) {
        List<AppointmentView> upcoming = appointments(patientUserId, AppointmentCollection.UPCOMING);
        AppointmentView next = upcoming.isEmpty() ? null : upcoming.getFirst();
        Long activeShares = jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM appointment_report_shares s
            JOIN appointments a ON a.id = s.appointment_id
            WHERE s.patient_user_id = ? AND s.revoked_at IS NULL
              AND a.status = 'BOOKED' AND a.scheduled_end >= CURRENT_TIMESTAMP
            """,
            Long.class, patientUserId
        );
        Long doctorCount = jdbc.queryForObject(
            """
            SELECT COUNT(DISTINCT s.doctor_user_id)
            FROM appointment_report_shares s
            JOIN appointments a ON a.id = s.appointment_id
            WHERE s.patient_user_id = ? AND s.revoked_at IS NULL
              AND a.status = 'BOOKED' AND a.scheduled_end >= CURRENT_TIMESTAMP
            """,
            Long.class, patientUserId
        );
        return new PortalCareSummary(next, activeShares == null ? 0 : activeShares, doctorCount == null ? 0 : doctorCount);
    }

    private void refreshDoctorBookingProjection(UUID doctorUserId) {
        Timestamp now = Timestamp.from(clock.instant());
        jdbc.update(
            """
            INSERT INTO doctor_booking_profiles (
                doctor_user_id, application_id, display_name, professional_title, specialization,
                years_experience, current_organization, current_position, registration_jurisdiction,
                registration_authority, registration_type, registration_valid_until,
                booking_enabled, created_at, updated_at
            )
            SELECT u.id, a.id, concat_ws(' ', a.first_name, a.last_name), d.professional_title,
                   d.specialization, d.years_experience, d.current_organization, d.current_position,
                   d.registration_jurisdiction, d.registration_authority, d.registration_type,
                   d.registration_valid_until, TRUE, ?, ?
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
            WHERE u.id = ? AND u.role = 'DOCTOR' AND u.account_status = 'ACTIVE' AND u.email_verified_at IS NOT NULL
              AND d.specialization IS NOT NULL AND btrim(d.specialization) <> ''
            ON CONFLICT (doctor_user_id) DO UPDATE SET
              application_id = EXCLUDED.application_id,
              display_name = EXCLUDED.display_name,
              professional_title = EXCLUDED.professional_title,
              specialization = EXCLUDED.specialization,
              years_experience = EXCLUDED.years_experience,
              current_organization = EXCLUDED.current_organization,
              current_position = EXCLUDED.current_position,
              registration_jurisdiction = EXCLUDED.registration_jurisdiction,
              registration_authority = EXCLUDED.registration_authority,
              registration_type = EXCLUDED.registration_type,
              registration_valid_until = EXCLUDED.registration_valid_until,
              updated_at = EXCLUDED.updated_at
            """,
            now, now, doctorUserId
        );
    }

    private SlotLock lockSlot(UUID slotId) {
        List<SlotLock> rows = jdbc.query(
            """
            SELECT s.id, s.doctor_user_id, s.starts_at, s.ends_at, s.status, p.display_name
            FROM doctor_availability_slots s
            JOIN doctor_booking_profiles p ON p.doctor_user_id = s.doctor_user_id
            WHERE s.id = ? FOR UPDATE OF s
            """,
            (rs, rowNum) -> new SlotLock(
                rs.getObject("id", UUID.class), rs.getObject("doctor_user_id", UUID.class),
                rs.getTimestamp("starts_at").toInstant(), rs.getTimestamp("ends_at").toInstant(),
                rs.getString("status"), rs.getString("display_name")
            ),
            slotId
        );
        if (rows.isEmpty()) throw notFound("APPOINTMENT_SLOT_NOT_FOUND", "That appointment time could not be found.");
        return rows.getFirst();
    }

    private LockedAppointment lockAppointment(UUID patientUserId, UUID appointmentId) {
        List<LockedAppointment> rows = jdbc.query(
            """
            SELECT a.id, a.patient_user_id, a.doctor_user_id, a.slot_id, a.status, a.scheduled_start, p.display_name
            FROM appointments a JOIN doctor_booking_profiles p ON p.doctor_user_id = a.doctor_user_id
            WHERE a.id = ? AND a.patient_user_id = ? FOR UPDATE OF a
            """,
            (rs, rowNum) -> new LockedAppointment(
                rs.getObject("id", UUID.class), rs.getObject("patient_user_id", UUID.class),
                rs.getObject("doctor_user_id", UUID.class), rs.getObject("slot_id", UUID.class),
                rs.getString("status"), rs.getTimestamp("scheduled_start").toInstant(), rs.getString("display_name")
            ),
            appointmentId, patientUserId
        );
        if (rows.isEmpty()) throw notFound("APPOINTMENT_NOT_FOUND", "That appointment could not be found.");
        return rows.getFirst();
    }

    private List<AppointmentView> appointmentByIdempotency(UUID patientUserId, String key) {
        return jdbc.query(
            """
            SELECT a.id, a.status, a.reason_for_visit, a.scheduled_start, a.scheduled_end, a.booking_timezone,
                   a.booked_at, a.cancelled_at, p.doctor_user_id, p.display_name, p.specialization,
                   (SELECT COUNT(*) FROM appointment_report_shares s WHERE s.appointment_id = a.id AND s.revoked_at IS NULL) AS shared_report_count
            FROM appointments a JOIN doctor_booking_profiles p ON p.doctor_user_id = a.doctor_user_id
            WHERE a.patient_user_id = ? AND a.idempotency_key = ?
            """,
            APPOINTMENT_MAPPER,
            patientUserId, key
        );
    }

    private void requireBookableDoctor(UUID doctorUserId) {
        Integer count = jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM doctor_booking_profiles p
            JOIN users u ON u.id = p.doctor_user_id
            WHERE p.doctor_user_id = ? AND p.booking_enabled = TRUE
              AND u.role = 'DOCTOR' AND u.account_status = 'ACTIVE' AND u.email_verified_at IS NOT NULL
              AND (p.registration_valid_until IS NULL OR p.registration_valid_until >= CURRENT_DATE)
            """,
            Integer.class, doctorUserId
        );
        if (count == null || count != 1) {
            throw notFound("DOCTOR_NOT_AVAILABLE", "That Clinora Doctor is not available for booking.");
        }
    }

    private void requireActiveUser(UUID userId, String role) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = ? AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class, userId, role
        );
        if (count == null || count != 1) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "ACTIVE_" + role + "_REQUIRED", "An active " + role.toLowerCase(Locale.ROOT) + " account is required.");
        }
    }

    private static List<UUID> distinct(List<UUID> values) {
        return values == null ? List.of() : values.stream().filter(java.util.Objects::nonNull).distinct().limit(20).toList();
    }

    private static String requiredText(String value, int max, String code, String message) {
        String result = text(value, max);
        if (result == null) throw badRequest(code, message);
        return result;
    }

    private static String text(String value, int max) {
        if (value == null) return null;
        String cleaned = value.trim().replaceAll("\\s+", " ");
        if (cleaned.isEmpty()) return null;
        if (cleaned.length() > max) throw badRequest("VALUE_TOO_LONG", "The supplied information is too long.");
        return cleaned;
    }

    private static ZoneId requireTimezone(String value) {
        String timezone = requiredText(value, 80, "TIMEZONE_REQUIRED", "Choose a valid timezone.");
        try {
            return ZoneId.of(timezone);
        } catch (DateTimeException exception) {
            throw badRequest("TIMEZONE_INVALID", "Choose a valid IANA timezone such as Asia/Dhaka.");
        }
    }

    private static PatientApiException badRequest(String code, String message) {
        return new PatientApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private static PatientApiException notFound(String code, String message) {
        return new PatientApiException(HttpStatus.NOT_FOUND, code, message);
    }

    private static final org.springframework.jdbc.core.RowMapper<DoctorView> DOCTOR_MAPPER = (rs, rowNum) -> new DoctorView(
        rs.getObject("doctor_user_id", UUID.class), rs.getString("display_name"), rs.getString("professional_title"),
        rs.getString("specialization"), (Integer) rs.getObject("years_experience"), rs.getString("current_organization"),
        rs.getString("current_position"), rs.getString("registration_jurisdiction"), rs.getString("registration_authority"),
        rs.getString("registration_type"), rs.getDate("registration_valid_until") == null ? null : rs.getDate("registration_valid_until").toLocalDate(),
        rs.getTimestamp("next_available_at") == null ? null : rs.getTimestamp("next_available_at").toInstant()
    );

    private static final org.springframework.jdbc.core.RowMapper<AppointmentView> APPOINTMENT_MAPPER = (rs, rowNum) -> new AppointmentView(
        rs.getObject("id", UUID.class), rs.getString("status"), rs.getString("reason_for_visit"),
        rs.getTimestamp("scheduled_start").toInstant(), rs.getTimestamp("scheduled_end").toInstant(), rs.getString("booking_timezone"),
        rs.getTimestamp("booked_at").toInstant(), rs.getTimestamp("cancelled_at") == null ? null : rs.getTimestamp("cancelled_at").toInstant(),
        rs.getObject("doctor_user_id", UUID.class), rs.getString("display_name"), rs.getString("specialization"), rs.getLong("shared_report_count")
    );

    private record SlotLock(UUID id, UUID doctorUserId, Instant startsAt, Instant endsAt, String status, String doctorName) {}
    private record LockedAppointment(UUID id, UUID patientUserId, UUID doctorUserId, UUID slotId, String status, Instant scheduledStart, String doctorName) {}

    public enum AppointmentCollection { UPCOMING, PAST }
    public record DoctorSearchPage(List<DoctorView> items) {}
    public record DoctorView(
        UUID id, String displayName, String professionalTitle, String specialization, Integer yearsExperience,
        String currentOrganization, String currentPosition, String registrationJurisdiction,
        String registrationAuthority, String registrationType, java.time.LocalDate registrationValidUntil,
        Instant nextAvailableAt
    ) {}
    public record DoctorDetailView(DoctorView doctor, List<AvailabilitySlotView> availability) {}
    public record AvailabilitySlotView(UUID id, UUID doctorId, Instant startsAt, Instant endsAt, String timezone, String status) {}
    public record AppointmentView(
        UUID id, String status, String reasonForVisit, Instant scheduledStart, Instant scheduledEnd, String bookingTimezone,
        Instant bookedAt, Instant cancelledAt, UUID doctorId, String doctorName, String specialization, long sharedReportCount
    ) {}
    public record ReportShareView(UUID reportId, String reportName, String reportType, java.time.LocalDate reportDate, Instant sharedAt, Instant revokedAt) {}
    public record PortalCareSummary(AppointmentView nextAppointment, long activeReportShareCount, long doctorCount) {}
}
