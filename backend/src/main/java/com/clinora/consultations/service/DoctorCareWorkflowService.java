package com.clinora.consultations.service;

import com.clinora.consultations.service.ConsultationModels.ClinicalInboxItem;
import com.clinora.consultations.service.ConsultationModels.ClinicalInboxView;
import com.clinora.consultations.service.ConsultationModels.DoctorPatientCurrentCare;
import com.clinora.consultations.service.ConsultationModels.DoctorPatientDetail;
import com.clinora.consultations.service.ConsultationModels.DoctorPatientListItem;
import com.clinora.consultations.service.ConsultationModels.PatientAppointmentLink;
import com.clinora.consultations.service.ConsultationModels.PatientCareEpisode;
import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DoctorCareWorkflowService {
    private final JdbcTemplate jdbc;
    private final DoctorClinicalAccessService access;
    private final Clock clock;

    public DoctorCareWorkflowService(JdbcTemplate jdbc, DoctorClinicalAccessService access, Clock clock) {
        this.jdbc = jdbc;
        this.access = access;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ClinicalInboxView inbox(UUID doctorId) {
        access.requireActiveDoctor(doctorId);
        Instant now = clock.instant();
        Instant upcomingCutoff = now.plusSeconds(48 * 60 * 60L);
        LocalDate today = LocalDate.now(clock);
        List<ClinicalInboxItem> items = new ArrayList<>();

        items.addAll(jdbc.query(
            """
            SELECT c.id AS consultation_id, a.id AS appointment_id, a.patient_user_id,
                   u.first_name, u.last_name, a.scheduled_end
              FROM doctor_consultations c
              JOIN appointments a ON a.id = c.appointment_id
              JOIN users u ON u.id = a.patient_user_id
             WHERE c.doctor_user_id = ? AND c.status = 'IN_PROGRESS'
             ORDER BY c.started_at ASC
             LIMIT 20
            """,
            (rs, rowNum) -> new ClinicalInboxItem(
                "consultation:" + rs.getObject("consultation_id", UUID.class),
                "IN_PROGRESS",
                "HIGH",
                rs.getObject("patient_user_id", UUID.class),
                displayName(rs.getString("first_name"), rs.getString("last_name")),
                rs.getObject("appointment_id", UUID.class),
                rs.getObject("consultation_id", UUID.class),
                "Consultation in progress",
                "Documentation is unfinished. Resume the encounter and complete the Doctor-authored care plan when ready.",
                instant(rs.getTimestamp("scheduled_end")),
                null,
                "/doctor/appointments/" + rs.getObject("appointment_id", UUID.class) + "/consultation"
            ),
            doctorId
        ));

        items.addAll(jdbc.query(
            """
            SELECT a.id AS appointment_id, a.patient_user_id, u.first_name, u.last_name,
                   a.scheduled_start,
                   (SELECT COUNT(*)::int
                      FROM appointment_report_shares s
                     WHERE s.appointment_id = a.id AND s.revoked_at IS NULL) AS shared_count
              FROM appointments a
              JOIN users u ON u.id = a.patient_user_id
             WHERE a.doctor_user_id = ?
               AND a.status = 'BOOKED'
               AND a.scheduled_start >= ?
               AND a.scheduled_start <= ?
               AND EXISTS (
                   SELECT 1 FROM appointment_report_shares s
                    WHERE s.appointment_id = a.id AND s.revoked_at IS NULL
               )
               AND NOT EXISTS (
                   SELECT 1 FROM doctor_consultations c
                    WHERE c.appointment_id = a.id AND c.status = 'IN_PROGRESS'
               )
             ORDER BY a.scheduled_start ASC
             LIMIT 30
            """,
            (rs, rowNum) -> {
                int shared = rs.getInt("shared_count");
                UUID appointmentId = rs.getObject("appointment_id", UUID.class);
                return new ClinicalInboxItem(
                    "evidence:" + appointmentId,
                    "EVIDENCE_READY",
                    "NORMAL",
                    rs.getObject("patient_user_id", UUID.class),
                    displayName(rs.getString("first_name"), rs.getString("last_name")),
                    appointmentId,
                    null,
                    "Patient-shared evidence ready",
                    shared + " currently authorized report" + (shared == 1 ? " is" : "s are") + " available for review before this consultation.",
                    instant(rs.getTimestamp("scheduled_start")),
                    null,
                    "/doctor/appointments/" + appointmentId
                );
            },
            doctorId,
            Timestamp.from(now),
            Timestamp.from(upcomingCutoff)
        ));

        items.addAll(jdbc.query(
            """
            WITH ranked_follow_up AS (
                SELECT f.consultation_id, c.appointment_id, c.patient_user_id,
                       u.first_name, u.last_name, f.recommended_date,
                       ROW_NUMBER() OVER (
                           PARTITION BY c.patient_user_id
                           ORDER BY f.recommended_date DESC, c.completed_at DESC, f.consultation_id DESC
                       ) AS rn
                  FROM consultation_follow_ups f
                  JOIN doctor_consultations c ON c.id = f.consultation_id
                  JOIN users u ON u.id = c.patient_user_id
                 WHERE c.doctor_user_id = ?
                   AND c.status = 'COMPLETED'
                   AND NOT EXISTS (
                       SELECT 1
                         FROM appointments next_a
                        WHERE next_a.doctor_user_id = c.doctor_user_id
                          AND next_a.patient_user_id = c.patient_user_id
                          AND next_a.status = 'BOOKED'
                          AND next_a.scheduled_start >= CURRENT_TIMESTAMP
                   )
            )
            SELECT consultation_id, appointment_id, patient_user_id,
                   first_name, last_name, recommended_date
              FROM ranked_follow_up
             WHERE rn = 1
               AND recommended_date <= ?
             ORDER BY recommended_date ASC
             LIMIT 30
            """,
            (rs, rowNum) -> {
                LocalDate followUp = rs.getDate("recommended_date").toLocalDate();
                UUID appointmentId = rs.getObject("appointment_id", UUID.class);
                UUID consultationId = rs.getObject("consultation_id", UUID.class);
                boolean overdue = followUp.isBefore(today);
                return new ClinicalInboxItem(
                    "follow-up:" + rs.getObject("patient_user_id", UUID.class),
                    "FOLLOW_UP",
                    overdue || followUp.isEqual(today) ? "HIGH" : "NORMAL",
                    rs.getObject("patient_user_id", UUID.class),
                    displayName(rs.getString("first_name"), rs.getString("last_name")),
                    appointmentId,
                    consultationId,
                    overdue ? "Follow-up overdue" : "Follow-up due",
                    "Doctor-recommended follow-up has no future appointment booked.",
                    null,
                    followUp,
                    "/doctor/patients/" + rs.getObject("patient_user_id", UUID.class)
                );
            },
            doctorId,
            java.sql.Date.valueOf(today.plusDays(7))
        ));

        items.sort(Comparator
            .comparingInt((ClinicalInboxItem item) -> priorityRank(item.priority()))
            .thenComparing(item -> item.dueAt() == null ? Instant.MAX : item.dueAt())
            .thenComparing(item -> item.dueDate() == null ? LocalDate.MAX : item.dueDate()));

        int inProgress = countType(items, "IN_PROGRESS");
        int evidenceReady = countType(items, "EVIDENCE_READY");
        int followUp = countType(items, "FOLLOW_UP");
        return new ClinicalInboxView(inProgress, evidenceReady, followUp, items.size(), List.copyOf(items));
    }

    @Transactional(readOnly = true)
    public List<DoctorPatientListItem> patients(UUID doctorId) {
        access.requireActiveDoctor(doctorId);
        return jdbc.query(
            """
            WITH latest_completed AS (
                SELECT DISTINCT ON (c.patient_user_id)
                       c.patient_user_id, c.id AS consultation_id, c.completed_at, c.assessment, c.plan
                  FROM doctor_consultations c
                 WHERE c.doctor_user_id = ? AND c.status = 'COMPLETED'
                 ORDER BY c.patient_user_id, c.completed_at DESC, c.id DESC
            ), in_progress AS (
                SELECT DISTINCT ON (c.patient_user_id)
                       c.patient_user_id, c.appointment_id, c.started_at
                  FROM doctor_consultations c
                 WHERE c.doctor_user_id = ? AND c.status = 'IN_PROGRESS'
                 ORDER BY c.patient_user_id, c.started_at DESC, c.id DESC
            ), next_appointment AS (
                SELECT DISTINCT ON (a.patient_user_id)
                       a.patient_user_id, a.id AS appointment_id, a.scheduled_start,
                       a.booking_timezone, a.consultation_mode, a.reason_for_visit
                  FROM appointments a
                 WHERE a.doctor_user_id = ? AND a.status = 'BOOKED'
                   AND a.scheduled_start >= CURRENT_TIMESTAMP
                 ORDER BY a.patient_user_id, a.scheduled_start ASC, a.id ASC
            )
            SELECT u.id AS patient_id, u.first_name, u.last_name,
                   lc.completed_at AS latest_consultation_at,
                   lc.assessment AS latest_assessment,
                   lc.plan AS latest_plan,
                   EXISTS (SELECT 1 FROM in_progress ip WHERE ip.patient_user_id = u.id) AS consultation_in_progress,
                   (SELECT COUNT(*)::int
                      FROM consultation_investigations i
                     WHERE i.consultation_id = lc.consultation_id) AS requested_investigation_count,
                   (SELECT f.recommended_date
                      FROM consultation_follow_ups f
                     WHERE f.consultation_id = lc.consultation_id) AS follow_up_date,
                   na.scheduled_start AS next_appointment_at,
                   COALESCE(ip.appointment_id, na.appointment_id) AS context_appointment_id,
                   COALESCE(ipa.scheduled_start, na.scheduled_start) AS context_appointment_at,
                   COALESCE(ipa.booking_timezone, na.booking_timezone) AS context_appointment_timezone,
                   COALESCE(ipa.consultation_mode, na.consultation_mode) AS context_appointment_mode,
                   COALESCE(ipa.reason_for_visit, na.reason_for_visit) AS context_appointment_reason,
                   (SELECT COUNT(*)::int
                      FROM appointment_report_shares s
                      JOIN appointments a3 ON a3.id = s.appointment_id
                     WHERE a3.doctor_user_id = ? AND a3.patient_user_id = u.id
                       AND a3.status = 'BOOKED' AND s.revoked_at IS NULL) AS shared_report_count
              FROM users u
              LEFT JOIN latest_completed lc ON lc.patient_user_id = u.id
              LEFT JOIN in_progress ip ON ip.patient_user_id = u.id
              LEFT JOIN appointments ipa ON ipa.id = ip.appointment_id
              LEFT JOIN next_appointment na ON na.patient_user_id = u.id
             WHERE u.role = 'PATIENT'
               AND (
                   EXISTS (
                       SELECT 1 FROM appointments rel
                        WHERE rel.doctor_user_id = ? AND rel.patient_user_id = u.id AND rel.status = 'BOOKED'
                   )
                   OR EXISTS (
                       SELECT 1 FROM doctor_consultations relc
                        WHERE relc.doctor_user_id = ? AND relc.patient_user_id = u.id
                          AND relc.status IN ('IN_PROGRESS', 'COMPLETED')
                   )
               )
             ORDER BY consultation_in_progress DESC, next_appointment_at NULLS LAST,
                      latest_consultation_at DESC NULLS LAST,
                      lower(u.first_name), lower(u.last_name)
             LIMIT 200
            """,
            (rs, rowNum) -> {
                boolean inProgress = rs.getBoolean("consultation_in_progress");
                LocalDate followUp = rs.getDate("follow_up_date") == null
                    ? null
                    : rs.getDate("follow_up_date").toLocalDate();
                Instant latest = instant(rs.getTimestamp("latest_consultation_at"));
                return new DoctorPatientListItem(
                    rs.getObject("patient_id", UUID.class),
                    displayName(rs.getString("first_name"), rs.getString("last_name")),
                    careState(latest, inProgress, followUp),
                    inProgress,
                    latest,
                    rs.getString("latest_assessment"),
                    rs.getString("latest_plan"),
                    rs.getInt("requested_investigation_count"),
                    followUp,
                    instant(rs.getTimestamp("next_appointment_at")),
                    rs.getObject("context_appointment_id", UUID.class),
                    instant(rs.getTimestamp("context_appointment_at")),
                    rs.getString("context_appointment_timezone"),
                    rs.getString("context_appointment_mode"),
                    rs.getString("context_appointment_reason"),
                    rs.getInt("shared_report_count")
                );
            },
            doctorId, doctorId, doctorId, doctorId, doctorId, doctorId
        );
    }

    @Transactional(readOnly = true)
    public DoctorPatientDetail patient(UUID doctorId, UUID patientId) {
        access.requireActiveDoctor(doctorId);
        if (!hasCareRelationship(doctorId, patientId)) {
            throw new DoctorApiException(HttpStatus.NOT_FOUND, "DOCTOR_PATIENT_NOT_FOUND", "That Patient is not in your care history.");
        }

        String patientName = jdbc.queryForObject(
            "SELECT concat_ws(' ', first_name, last_name) FROM users WHERE id = ? AND role = 'PATIENT'",
            String.class,
            patientId
        );

        DoctorPatientCurrentCare currentCare = currentCare(doctorId, patientId);

        List<PatientAppointmentLink> upcoming = jdbc.query(
            """
            SELECT a.id, a.scheduled_start, a.scheduled_end, a.booking_timezone, a.consultation_mode,
                   (SELECT COUNT(*)::int FROM appointment_report_shares s
                     WHERE s.appointment_id = a.id AND s.revoked_at IS NULL) AS shared_count
              FROM appointments a
             WHERE a.doctor_user_id = ? AND a.patient_user_id = ?
               AND a.status = 'BOOKED' AND a.scheduled_end >= CURRENT_TIMESTAMP
             ORDER BY a.scheduled_start ASC
             LIMIT 20
            """,
            (rs, rowNum) -> new PatientAppointmentLink(
                rs.getObject("id", UUID.class),
                instant(rs.getTimestamp("scheduled_start")),
                instant(rs.getTimestamp("scheduled_end")),
                rs.getString("booking_timezone"),
                rs.getString("consultation_mode"),
                rs.getInt("shared_count")
            ),
            doctorId,
            patientId
        );

        List<PatientCareEpisode> history = jdbc.query(
            """
            SELECT c.id, c.appointment_id, c.status, c.started_at, c.completed_at,
                   CASE WHEN c.status = 'COMPLETED' THEN c.assessment END AS assessment,
                   CASE WHEN c.status = 'COMPLETED' THEN c.plan END AS plan,
                   CASE WHEN c.status = 'COMPLETED' THEN
                       (SELECT COUNT(*)::int FROM consultation_prescriptions p WHERE p.consultation_id = c.id)
                       ELSE 0 END AS prescription_count,
                   CASE WHEN c.status = 'COMPLETED' THEN
                       (SELECT COUNT(*)::int FROM consultation_prescription_documents d WHERE d.consultation_id = c.id)
                       ELSE 0 END AS prescription_document_count,
                   CASE WHEN c.status = 'COMPLETED' THEN
                       (SELECT COUNT(*)::int FROM consultation_investigations i WHERE i.consultation_id = c.id)
                       ELSE 0 END AS requested_investigation_count,
                   CASE WHEN c.status = 'COMPLETED' THEN
                       (SELECT f.recommended_date FROM consultation_follow_ups f WHERE f.consultation_id = c.id)
                       ELSE NULL END AS follow_up_date
              FROM doctor_consultations c
             WHERE c.doctor_user_id = ? AND c.patient_user_id = ?
               AND c.status IN ('IN_PROGRESS', 'COMPLETED')
             ORDER BY c.started_at DESC
             LIMIT 50
            """,
            (rs, rowNum) -> new PatientCareEpisode(
                rs.getObject("id", UUID.class),
                rs.getObject("appointment_id", UUID.class),
                rs.getString("status"),
                instant(rs.getTimestamp("started_at")),
                instant(rs.getTimestamp("completed_at")),
                rs.getString("assessment"),
                rs.getString("plan"),
                rs.getInt("prescription_count"),
                rs.getInt("prescription_document_count"),
                rs.getInt("requested_investigation_count"),
                rs.getDate("follow_up_date") == null ? null : rs.getDate("follow_up_date").toLocalDate()
            ),
            doctorId,
            patientId
        );

        return new DoctorPatientDetail(
            patientId,
            patientName == null ? "Patient" : patientName.trim(),
            currentCare,
            List.copyOf(upcoming),
            List.copyOf(history)
        );
    }

    private DoctorPatientCurrentCare currentCare(UUID doctorId, UUID patientId) {
        return jdbc.queryForObject(
            """
            WITH latest_completed AS (
                SELECT c.id, c.completed_at, c.assessment, c.plan
                  FROM doctor_consultations c
                 WHERE c.doctor_user_id = ? AND c.patient_user_id = ? AND c.status = 'COMPLETED'
                 ORDER BY c.completed_at DESC, c.id DESC
                 LIMIT 1
            )
            SELECT lc.id AS consultation_id, lc.completed_at, lc.assessment, lc.plan,
                   EXISTS (
                       SELECT 1 FROM doctor_consultations ip
                        WHERE ip.doctor_user_id = ? AND ip.patient_user_id = ? AND ip.status = 'IN_PROGRESS'
                   ) AS consultation_in_progress,
                   (SELECT COUNT(*)::int FROM consultation_prescriptions p WHERE p.consultation_id = lc.id) AS prescription_count,
                   (SELECT COUNT(*)::int FROM consultation_prescription_documents d WHERE d.consultation_id = lc.id) AS prescription_document_count,
                   (SELECT COUNT(*)::int FROM consultation_investigations i WHERE i.consultation_id = lc.id) AS requested_investigation_count,
                   (SELECT f.recommended_date FROM consultation_follow_ups f WHERE f.consultation_id = lc.id) AS follow_up_date
              FROM (SELECT 1) seed
              LEFT JOIN latest_completed lc ON TRUE
            """,
            (rs, rowNum) -> {
                boolean inProgress = rs.getBoolean("consultation_in_progress");
                Instant latest = instant(rs.getTimestamp("completed_at"));
                LocalDate followUp = rs.getDate("follow_up_date") == null
                    ? null
                    : rs.getDate("follow_up_date").toLocalDate();
                return new DoctorPatientCurrentCare(
                    careState(latest, inProgress, followUp),
                    inProgress,
                    latest,
                    rs.getString("assessment"),
                    rs.getString("plan"),
                    rs.getInt("prescription_count"),
                    rs.getInt("prescription_document_count"),
                    rs.getInt("requested_investigation_count"),
                    followUp
                );
            },
            doctorId, patientId, doctorId, patientId
        );
    }

    private boolean hasCareRelationship(UUID doctorId, UUID patientId) {
        Integer count = jdbc.queryForObject(
            """
            SELECT COUNT(*)
              FROM users u
             WHERE u.id = ? AND u.role = 'PATIENT'
               AND (
                   EXISTS (SELECT 1 FROM appointments a
                            WHERE a.doctor_user_id = ? AND a.patient_user_id = u.id AND a.status = 'BOOKED')
                   OR EXISTS (SELECT 1 FROM doctor_consultations c
                              WHERE c.doctor_user_id = ? AND c.patient_user_id = u.id
                                AND c.status IN ('IN_PROGRESS', 'COMPLETED'))
               )
            """,
            Integer.class,
            patientId,
            doctorId,
            doctorId
        );
        return count != null && count == 1;
    }

    private static String careState(Instant latestCompleted, boolean inProgress, LocalDate followUpDate) {
        if (latestCompleted == null && !inProgress) return "NEW_PATIENT";
        if (followUpDate != null) return "FOLLOW_UP";
        return "ACTIVE_CARE";
    }

    private static int countType(List<ClinicalInboxItem> items, String type) {
        return (int) items.stream().filter(item -> type.equals(item.type())).count();
    }

    private static int priorityRank(String priority) {
        return "HIGH".equals(priority) ? 0 : "NORMAL".equals(priority) ? 1 : 2;
    }

    private static String displayName(String firstName, String lastName) {
        return ((firstName == null ? "" : firstName.trim()) + " " + (lastName == null ? "" : lastName.trim())).trim();
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }
}
