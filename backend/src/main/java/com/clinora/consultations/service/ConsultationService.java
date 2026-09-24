package com.clinora.consultations.service;

import com.clinora.consultations.service.ConsultationModels.ConsultationDraftRequest;
import com.clinora.consultations.service.ConsultationModels.ConsultationView;
import com.clinora.consultations.service.ConsultationModels.FollowUpInput;
import com.clinora.consultations.service.ConsultationModels.FollowUpView;
import com.clinora.consultations.service.ConsultationModels.InvestigationInput;
import com.clinora.consultations.service.ConsultationModels.InvestigationView;
import com.clinora.consultations.service.ConsultationModels.PatientConsultationSummary;
import com.clinora.consultations.service.ConsultationModels.PatientDoctorCareRelationship;
import com.clinora.consultations.service.ConsultationModels.PrescriptionInput;
import com.clinora.consultations.service.ConsultationModels.PrescriptionView;
import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.notifications.service.PatientNotificationService.NotificationCategory;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.service.PatientTimelineService;
import com.clinora.patients.service.PatientTimelineService.TimelineCategory;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ConsultationService {
    private static final int MAX_NOTE_LENGTH = 8_000;
    private static final int MAX_CARE_ITEMS = 20;
    private static final Duration MAX_LATE_START_AGE = Duration.ofDays(30);

    private final JdbcTemplate jdbc;
    private final DoctorClinicalAccessService access;
    private final PatientNotificationService notifications;
    private final PatientTimelineService timeline;
    private final PrescriptionDocumentService prescriptionDocuments;
    private final Clock clock;

    public ConsultationService(
        JdbcTemplate jdbc,
        DoctorClinicalAccessService access,
        PatientNotificationService notifications,
        PatientTimelineService timeline,
        PrescriptionDocumentService prescriptionDocuments,
        Clock clock
    ) {
        this.jdbc = jdbc;
        this.access = access;
        this.notifications = notifications;
        this.timeline = timeline;
        this.prescriptionDocuments = prescriptionDocuments;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ConsultationView findForDoctor(UUID doctorId, UUID appointmentId) {
        access.requireOwnedAppointment(doctorId, appointmentId);
        List<ConsultationCore> rows = consultationRows(
            "WHERE c.appointment_id = ? AND c.doctor_user_id = ?",
            appointmentId,
            doctorId
        );
        return rows.isEmpty() ? null : view(rows.getFirst());
    }

    @Transactional
    public ConsultationView start(UUID doctorId, UUID appointmentId) {
        DoctorClinicalAccessService.AppointmentAccess appointment = access.requireOwnedAppointment(doctorId, appointmentId);
        AppointmentStartState appointmentState = jdbc.queryForObject(
            "SELECT status, scheduled_end FROM appointments WHERE id = ? AND doctor_user_id = ? FOR UPDATE",
            (rs, rowNum) -> new AppointmentStartState(
                rs.getString("status"),
                instant(rs.getTimestamp("scheduled_end"))
            ),
            appointmentId,
            doctorId
        );
        String appointmentStatus = appointmentState == null ? null : appointmentState.status();

        List<ConsultationCore> existing = consultationRows(
            "WHERE c.appointment_id = ? AND c.doctor_user_id = ?",
            appointmentId,
            doctorId
        );
        if (!existing.isEmpty()) return view(existing.getFirst());

        if (!"BOOKED".equals(appointmentStatus)) {
            throw conflict(
                "CONSULTATION_NOT_STARTABLE",
                "Only a booked appointment can start a consultation."
            );
        }

        Instant now = clock.instant();
        if (appointmentState != null
            && appointmentState.scheduledEnd() != null
            && appointmentState.scheduledEnd().isBefore(now.minus(MAX_LATE_START_AGE))) {
            throw conflict(
                "CONSULTATION_APPOINTMENT_TOO_OLD",
                "This appointment ended more than 30 days ago and can no longer start a new consultation."
            );
        }
        UUID consultationId = UUID.randomUUID();
        jdbc.update(
            """
            INSERT INTO doctor_consultations (
                id, appointment_id, doctor_user_id, patient_user_id, status,
                started_at, created_at, updated_at, version
            ) VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?, 0)
            """,
            consultationId,
            appointmentId,
            doctorId,
            appointment.patientId(),
            Timestamp.from(now),
            Timestamp.from(now),
            Timestamp.from(now)
        );
        return requireView(consultationId, doctorId);
    }

    @Transactional
    public ConsultationView saveDraft(UUID doctorId, UUID consultationId, ConsultationDraftRequest request) {
        access.requireActiveDoctor(doctorId);
        LockedConsultation locked = lockConsultation(doctorId, consultationId);
        if (!"IN_PROGRESS".equals(locked.status())) {
            throw conflict("CONSULTATION_ALREADY_COMPLETED", "A completed consultation cannot be edited.");
        }
        NormalizedDraft draft = normalize(request, false);
        requireVersion(locked, draft.version());
        Instant now = clock.instant();
        int changed = jdbc.update(
            """
            UPDATE doctor_consultations
               SET history_notes = ?, findings_notes = ?, assessment = ?, plan = ?,
                   updated_at = ?, version = version + 1
             WHERE id = ? AND doctor_user_id = ? AND status = 'IN_PROGRESS' AND version = ?
            """,
            draft.historyNotes(),
            draft.findingsNotes(),
            draft.assessment(),
            draft.plan(),
            Timestamp.from(now),
            consultationId,
            doctorId,
            draft.version()
        );
        if (changed != 1) throw stale();
        replaceCareActions(consultationId, draft, now);
        return requireView(consultationId, doctorId);
    }

    @Transactional
    public ConsultationView complete(UUID doctorId, UUID consultationId, ConsultationDraftRequest request) {
        access.requireActiveDoctor(doctorId);
        LockedConsultation locked = lockConsultation(doctorId, consultationId);
        if ("COMPLETED".equals(locked.status())) return requireView(consultationId, doctorId);

        NormalizedDraft draft = normalize(request, true);
        requireVersion(locked, draft.version());
        Instant now = clock.instant();

        String appointmentStatus = jdbc.queryForObject(
            "SELECT status FROM appointments WHERE id = ? AND doctor_user_id = ? FOR UPDATE",
            String.class,
            locked.appointmentId(),
            doctorId
        );
        if (!"BOOKED".equals(appointmentStatus)) {
            throw conflict(
                "CONSULTATION_APPOINTMENT_CLOSED",
                "This appointment changed before the consultation could be completed. Reload the workspace."
            );
        }

        int changed = jdbc.update(
            """
            UPDATE doctor_consultations
               SET history_notes = ?, findings_notes = ?, assessment = ?, plan = ?,
                   status = 'COMPLETED', completed_at = ?, updated_at = ?, version = version + 1
             WHERE id = ? AND doctor_user_id = ? AND status = 'IN_PROGRESS' AND version = ?
            """,
            draft.historyNotes(),
            draft.findingsNotes(),
            draft.assessment(),
            draft.plan(),
            Timestamp.from(now),
            Timestamp.from(now),
            consultationId,
            doctorId,
            draft.version()
        );
        if (changed != 1) throw stale();

        replaceCareActions(consultationId, draft, now);
        int appointmentChanged = jdbc.update(
            """
            UPDATE appointments
               SET status = 'COMPLETED', updated_at = ?, version = version + 1
             WHERE id = ? AND doctor_user_id = ? AND patient_user_id = ? AND status = 'BOOKED'
            """,
            Timestamp.from(now),
            locked.appointmentId(),
            doctorId,
            locked.patientId()
        );
        if (appointmentChanged != 1) {
            throw conflict(
                "CONSULTATION_APPOINTMENT_CLOSED",
                "This appointment changed before the consultation could be completed. Reload the workspace."
            );
        }
        jdbc.update(
            "UPDATE appointment_report_shares SET revoked_at = ? WHERE appointment_id = ? AND revoked_at IS NULL",
            Timestamp.from(now),
            locked.appointmentId()
        );

        String doctorName = jdbc.queryForObject(
            "SELECT display_name FROM doctor_booking_profiles WHERE doctor_user_id = ?",
            String.class,
            doctorId
        );
        timeline.append(
            locked.patientId(),
            "CONSULTATION_COMPLETED",
            TimelineCategory.APPOINTMENTS,
            "APPOINTMENT",
            locked.appointmentId(),
            "Consultation completed",
            doctorName == null ? "Doctor consultation" : doctorName,
            now,
            "consultation-completed:" + consultationId
        );
        notifications.create(
            locked.patientId(),
            "CONSULTATION_COMPLETED",
            NotificationCategory.APPOINTMENTS,
            "Your consultation summary is ready",
            "Your Doctor completed the consultation. Review the assessment, care plan, prescriptions, investigations and follow-up.",
            "APPOINTMENT",
            locked.appointmentId(),
            "consultation-completed:" + consultationId
        );
        if (draft.followUp() != null) {
            notifications.create(locked.patientId(), "FOLLOW_UP_RECOMMENDED", NotificationCategory.APPOINTMENTS,
                "Follow-up recommended", "Your Doctor recommended a follow-up on " + draft.followUp().recommendedDate() + ". Review the recommendation in Clinora.",
                "APPOINTMENT", locked.appointmentId(), "follow-up-recommended:" + consultationId);
        }
        return requireView(consultationId, doctorId);
    }

    @Transactional(readOnly = true)
    public PatientConsultationSummary patientSummary(UUID patientId, UUID appointmentId) {
        requireActivePatient(patientId);
        List<PatientSummaryCore> rows = jdbc.query(
            """
            SELECT c.id, c.appointment_id, c.assessment, c.plan, c.completed_at,
                   a.doctor_user_id, p.display_name, p.specialization
              FROM doctor_consultations c
              JOIN appointments a ON a.id = c.appointment_id
              JOIN doctor_booking_profiles p ON p.doctor_user_id = a.doctor_user_id
             WHERE c.appointment_id = ?
               AND c.patient_user_id = ?
               AND a.patient_user_id = ?
               AND c.status = 'COMPLETED'
            """,
            (rs, rowNum) -> new PatientSummaryCore(
                rs.getObject("id", UUID.class),
                rs.getObject("appointment_id", UUID.class),
                rs.getObject("doctor_user_id", UUID.class),
                rs.getString("display_name"),
                rs.getString("specialization"),
                rs.getString("assessment"),
                rs.getString("plan"),
                instant(rs.getTimestamp("completed_at"))
            ),
            appointmentId,
            patientId,
            patientId
        );
        if (rows.isEmpty()) return null;
        PatientSummaryCore core = rows.getFirst();
        return new PatientConsultationSummary(
            core.consultationId(),
            core.appointmentId(),
            core.doctorId(),
            core.doctorName(),
            core.specialization(),
            core.assessment(),
            core.plan(),
            core.completedAt(),
            prescriptions(core.consultationId()),
            prescriptionDocuments.listForConsultation(core.consultationId()),
            investigations(core.consultationId()),
            followUp(core.consultationId())
        );
    }

    @Transactional(readOnly = true)
    public List<PatientConsultationSummary> patientPrescriptions(UUID patientId) {
        requireActivePatient(patientId);
        List<PatientSummaryCore> rows = jdbc.query(
            """
            SELECT c.id, c.appointment_id, c.assessment, c.plan, c.completed_at,
                   c.doctor_user_id, p.display_name, p.specialization
              FROM doctor_consultations c
              JOIN doctor_booking_profiles p ON p.doctor_user_id = c.doctor_user_id
             WHERE c.patient_user_id = ?
               AND c.status = 'COMPLETED'
               AND (
                   EXISTS (SELECT 1 FROM consultation_prescriptions rx WHERE rx.consultation_id = c.id)
                   OR EXISTS (SELECT 1 FROM consultation_prescription_documents d WHERE d.consultation_id = c.id)
               )
             ORDER BY c.completed_at DESC
             LIMIT 100
            """,
            (rs, rowNum) -> new PatientSummaryCore(
                rs.getObject("id", UUID.class),
                rs.getObject("appointment_id", UUID.class),
                rs.getObject("doctor_user_id", UUID.class),
                rs.getString("display_name"),
                rs.getString("specialization"),
                rs.getString("assessment"),
                rs.getString("plan"),
                instant(rs.getTimestamp("completed_at"))
            ),
            patientId
        );
        return rows.stream().map(core -> new PatientConsultationSummary(
            core.consultationId(),
            core.appointmentId(),
            core.doctorId(),
            core.doctorName(),
            core.specialization(),
            core.assessment(),
            core.plan(),
            core.completedAt(),
            prescriptions(core.consultationId()),
            prescriptionDocuments.listForConsultation(core.consultationId()),
            investigations(core.consultationId()),
            followUp(core.consultationId())
        )).toList();
    }

    @Transactional(readOnly = true)
    public PatientDoctorCareRelationship patientDoctorRelationship(UUID patientId, UUID doctorId) {
        requireActivePatient(patientId);
        List<PatientDoctorCareRelationship> rows = jdbc.query(
            """
            SELECT c.completed_at,
                   (SELECT f.recommended_date
                      FROM consultation_follow_ups f
                     WHERE f.consultation_id = c.id) AS follow_up_date
              FROM doctor_consultations c
             WHERE c.patient_user_id = ?
               AND c.doctor_user_id = ?
               AND c.status = 'COMPLETED'
             ORDER BY c.completed_at DESC, c.id DESC
             LIMIT 1
            """,
            (rs, rowNum) -> new PatientDoctorCareRelationship(
                true,
                instant(rs.getTimestamp("completed_at")),
                rs.getDate("follow_up_date") == null ? null : rs.getDate("follow_up_date").toLocalDate()
            ),
            patientId,
            doctorId
        );
        return rows.isEmpty() ? new PatientDoctorCareRelationship(false, null, null) : rows.getFirst();
    }

    private void replaceCareActions(UUID consultationId, NormalizedDraft draft, Instant now) {
        jdbc.update("DELETE FROM consultation_prescriptions WHERE consultation_id = ?", consultationId);
        for (int i = 0; i < draft.prescriptions().size(); i++) {
            NormalizedPrescription item = draft.prescriptions().get(i);
            jdbc.update(
                """
                INSERT INTO consultation_prescriptions (
                    id, consultation_id, position, medication_name, strength, dose, route,
                    frequency, duration, instructions, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(), consultationId, i, item.medicationName(), item.strength(), item.dose(), item.route(),
                item.frequency(), item.duration(), item.instructions(), Timestamp.from(now), Timestamp.from(now)
            );
        }

        jdbc.update("DELETE FROM consultation_investigations WHERE consultation_id = ?", consultationId);
        for (int i = 0; i < draft.investigations().size(); i++) {
            NormalizedInvestigation item = draft.investigations().get(i);
            jdbc.update(
                """
                INSERT INTO consultation_investigations (
                    id, consultation_id, position, test_name, reason, instructions, priority, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(), consultationId, i, item.testName(), item.reason(), item.instructions(), item.priority(),
                Timestamp.from(now), Timestamp.from(now)
            );
        }

        jdbc.update("DELETE FROM consultation_follow_ups WHERE consultation_id = ?", consultationId);
        if (draft.followUp() != null) {
            jdbc.update(
                """
                INSERT INTO consultation_follow_ups (
                    id, consultation_id, recommended_date, reason, instructions, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(), consultationId, java.sql.Date.valueOf(draft.followUp().recommendedDate()),
                draft.followUp().reason(), draft.followUp().instructions(), Timestamp.from(now), Timestamp.from(now)
            );
        }
    }

    private ConsultationView requireView(UUID consultationId, UUID doctorId) {
        List<ConsultationCore> rows = consultationRows(
            "WHERE c.id = ? AND c.doctor_user_id = ?",
            consultationId,
            doctorId
        );
        if (rows.isEmpty()) {
            throw new DoctorApiException(HttpStatus.NOT_FOUND, "CONSULTATION_NOT_FOUND", "That consultation could not be found.");
        }
        return view(rows.getFirst());
    }

    private ConsultationView view(ConsultationCore core) {
        return new ConsultationView(
            core.id(),
            core.appointmentId(),
            core.patientId(),
            core.status(),
            core.version(),
            core.historyNotes(),
            core.findingsNotes(),
            core.assessment(),
            core.plan(),
            core.startedAt(),
            core.completedAt(),
            prescriptions(core.id()),
            prescriptionDocuments.listForConsultation(core.id()),
            investigations(core.id()),
            followUp(core.id())
        );
    }

    private List<ConsultationCore> consultationRows(String where, Object... params) {
        return jdbc.query(
            """
            SELECT c.id, c.appointment_id, c.patient_user_id, c.status, c.version,
                   c.history_notes, c.findings_notes, c.assessment, c.plan,
                   c.started_at, c.completed_at
              FROM doctor_consultations c
            """ + where,
            (rs, rowNum) -> new ConsultationCore(
                rs.getObject("id", UUID.class),
                rs.getObject("appointment_id", UUID.class),
                rs.getObject("patient_user_id", UUID.class),
                rs.getString("status"),
                rs.getLong("version"),
                rs.getString("history_notes"),
                rs.getString("findings_notes"),
                rs.getString("assessment"),
                rs.getString("plan"),
                instant(rs.getTimestamp("started_at")),
                instant(rs.getTimestamp("completed_at"))
            ),
            params
        );
    }

    private List<PrescriptionView> prescriptions(UUID consultationId) {
        return jdbc.query(
            """
            SELECT id, medication_name, strength, dose, route, frequency, duration, instructions
              FROM consultation_prescriptions
             WHERE consultation_id = ?
             ORDER BY position
            """,
            (rs, rowNum) -> new PrescriptionView(
                rs.getObject("id", UUID.class),
                rs.getString("medication_name"),
                rs.getString("strength"),
                rs.getString("dose"),
                rs.getString("route"),
                rs.getString("frequency"),
                rs.getString("duration"),
                rs.getString("instructions")
            ),
            consultationId
        );
    }

    private List<InvestigationView> investigations(UUID consultationId) {
        return jdbc.query(
            """
            SELECT id, test_name, reason, instructions, priority
              FROM consultation_investigations
             WHERE consultation_id = ?
             ORDER BY position
            """,
            (rs, rowNum) -> new InvestigationView(
                rs.getObject("id", UUID.class),
                rs.getString("test_name"),
                rs.getString("reason"),
                rs.getString("instructions"),
                rs.getString("priority")
            ),
            consultationId
        );
    }

    private FollowUpView followUp(UUID consultationId) {
        List<FollowUpView> rows = jdbc.query(
            """
            SELECT id, recommended_date, reason, instructions
              FROM consultation_follow_ups
             WHERE consultation_id = ?
            """,
            (rs, rowNum) -> new FollowUpView(
                rs.getObject("id", UUID.class),
                rs.getDate("recommended_date").toLocalDate(),
                rs.getString("reason"),
                rs.getString("instructions")
            ),
            consultationId
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private LockedConsultation lockConsultation(UUID doctorId, UUID consultationId) {
        List<LockedConsultation> rows = jdbc.query(
            """
            SELECT id, appointment_id, patient_user_id, status, version
              FROM doctor_consultations
             WHERE id = ? AND doctor_user_id = ?
             FOR UPDATE
            """,
            (rs, rowNum) -> new LockedConsultation(
                rs.getObject("id", UUID.class),
                rs.getObject("appointment_id", UUID.class),
                rs.getObject("patient_user_id", UUID.class),
                rs.getString("status"),
                rs.getLong("version")
            ),
            consultationId,
            doctorId
        );
        if (rows.isEmpty()) {
            throw new DoctorApiException(HttpStatus.NOT_FOUND, "CONSULTATION_NOT_FOUND", "That consultation could not be found.");
        }
        return rows.getFirst();
    }

    private NormalizedDraft normalize(ConsultationDraftRequest request, boolean completing) {
        if (request == null || request.version() == null || request.version() < 0) {
            throw badRequest("CONSULTATION_VERSION_REQUIRED", "Reload the consultation and try again.");
        }
        String history = optionalText(request.historyNotes(), MAX_NOTE_LENGTH, "History");
        String findings = optionalText(request.findingsNotes(), MAX_NOTE_LENGTH, "Findings");
        String assessment = optionalText(request.assessment(), MAX_NOTE_LENGTH, "Assessment");
        String plan = optionalText(request.plan(), MAX_NOTE_LENGTH, "Plan");
        if (completing && assessment == null && plan == null) {
            throw badRequest(
                "CONSULTATION_CLINICAL_CONTENT_REQUIRED",
                "Add a Doctor assessment or plan before completing the consultation."
            );
        }

        List<PrescriptionInput> prescriptionInputs = request.prescriptions() == null ? List.of() : request.prescriptions();
        List<InvestigationInput> investigationInputs = request.investigations() == null ? List.of() : request.investigations();
        if (prescriptionInputs.size() > MAX_CARE_ITEMS || investigationInputs.size() > MAX_CARE_ITEMS) {
            throw badRequest("CONSULTATION_CARE_ITEM_LIMIT", "A consultation can contain up to 20 prescriptions and 20 investigations.");
        }

        List<NormalizedPrescription> prescriptions = new ArrayList<>();
        for (PrescriptionInput input : prescriptionInputs) {
            if (input == null) continue;
            prescriptions.add(new NormalizedPrescription(
                requiredText(input.medicationName(), 180, "Medication name"),
                optionalText(input.strength(), 120, "Medication strength"),
                optionalText(input.dose(), 120, "Medication dose"),
                optionalText(input.route(), 120, "Medication route"),
                optionalText(input.frequency(), 160, "Medication frequency"),
                optionalText(input.duration(), 160, "Medication duration"),
                optionalText(input.instructions(), 1_000, "Medication instructions")
            ));
        }

        List<NormalizedInvestigation> investigations = new ArrayList<>();
        for (InvestigationInput input : investigationInputs) {
            if (input == null) continue;
            String priority = input.priority() == null || input.priority().isBlank()
                ? "ROUTINE"
                : input.priority().trim().toUpperCase(Locale.ROOT);
            if (!priority.equals("ROUTINE") && !priority.equals("URGENT")) {
                throw badRequest("INVESTIGATION_PRIORITY_INVALID", "Investigation priority must be routine or urgent.");
            }
            investigations.add(new NormalizedInvestigation(
                requiredText(input.testName(), 180, "Investigation name"),
                optionalText(input.reason(), 1_000, "Investigation reason"),
                optionalText(input.instructions(), 1_000, "Investigation instructions"),
                priority
            ));
        }

        NormalizedFollowUp followUp = null;
        FollowUpInput followUpInput = request.followUp();
        if (followUpInput != null) {
            if (followUpInput.recommendedDate() == null) {
                throw badRequest("FOLLOW_UP_DATE_REQUIRED", "Choose a follow-up date or remove the follow-up recommendation.");
            }
            LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
            if (followUpInput.recommendedDate().isBefore(today)) {
                throw badRequest("FOLLOW_UP_DATE_INVALID", "Follow-up date cannot be in the past.");
            }
            if (followUpInput.recommendedDate().isAfter(today.plusYears(1))) {
                throw badRequest("FOLLOW_UP_DATE_INVALID", "Choose a follow-up date within the next year.");
            }
            followUp = new NormalizedFollowUp(
                followUpInput.recommendedDate(),
                optionalText(followUpInput.reason(), 1_000, "Follow-up reason"),
                optionalText(followUpInput.instructions(), 1_000, "Follow-up instructions")
            );
        }
        return new NormalizedDraft(
            request.version(), history, findings, assessment, plan,
            List.copyOf(prescriptions), List.copyOf(investigations), followUp
        );
    }

    private void requireVersion(LockedConsultation locked, long requestedVersion) {
        if (locked.version() != requestedVersion) throw stale();
    }

    private void requireActivePatient(UUID patientId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'PATIENT' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            patientId
        );
        if (count == null || count != 1) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "ACTIVE_PATIENT_REQUIRED", "An active Patient account is required.");
        }
    }

    private static String requiredText(String value, int max, String label) {
        String cleaned = optionalText(value, max, label);
        if (cleaned == null) throw badRequest("CONSULTATION_FIELD_REQUIRED", label + " is required.");
        return cleaned;
    }

    private static String optionalText(String value, int max, String label) {
        if (value == null || value.isBlank()) return null;
        String cleaned = value.trim();
        if (cleaned.length() > max) {
            throw badRequest("CONSULTATION_FIELD_TOO_LONG", label + " is too long.");
        }
        return cleaned;
    }

    private static DoctorApiException badRequest(String code, String message) {
        return new DoctorApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private static DoctorApiException conflict(String code, String message) {
        return new DoctorApiException(HttpStatus.CONFLICT, code, message);
    }

    private static DoctorApiException stale() {
        return conflict(
            "CONSULTATION_STALE_VERSION",
            "This consultation changed in another tab. Reload before saving again."
        );
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private record ConsultationCore(
        UUID id,
        UUID appointmentId,
        UUID patientId,
        String status,
        long version,
        String historyNotes,
        String findingsNotes,
        String assessment,
        String plan,
        Instant startedAt,
        Instant completedAt
    ) {}

    private record LockedConsultation(UUID id, UUID appointmentId, UUID patientId, String status, long version) {}
    private record AppointmentStartState(String status, Instant scheduledEnd) {}

    private record PatientSummaryCore(
        UUID consultationId,
        UUID appointmentId,
        UUID doctorId,
        String doctorName,
        String specialization,
        String assessment,
        String plan,
        Instant completedAt
    ) {}

    private record NormalizedDraft(
        long version,
        String historyNotes,
        String findingsNotes,
        String assessment,
        String plan,
        List<NormalizedPrescription> prescriptions,
        List<NormalizedInvestigation> investigations,
        NormalizedFollowUp followUp
    ) {}

    private record NormalizedPrescription(
        String medicationName,
        String strength,
        String dose,
        String route,
        String frequency,
        String duration,
        String instructions
    ) {}

    private record NormalizedInvestigation(String testName, String reason, String instructions, String priority) {}
    private record NormalizedFollowUp(LocalDate recommendedDate, String reason, String instructions) {}
}
