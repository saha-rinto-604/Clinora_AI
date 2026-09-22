package com.clinora.consultations.service;

import com.clinora.consultations.service.ConsultationModels.ClinicalInboxItem;
import com.clinora.consultations.service.ConsultationModels.ClinicalInboxView;
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
                "Resume documentation and complete the care plan when ready.",
                instant(rs.getTimestamp("scheduled_end")),
                "/doctor/appointments/" + rs.getObject("appointment_id", UUID.class) + "/consultation"
            ),
            doctorId
        ));

        items.addAll(jdbc.query(
            """
            SELECT a.id AS appointment_id, a.patient_user_id, u.first_name, u.last_name,
                   a.scheduled_start, a.consultation_mode,
                   (SELECT COUNT(*)::int
                      FROM appointment_report_shares s
                     WHERE s.appointment_id = a.id AND s.revoked_at IS NULL) AS shared_count
              FROM appointments a
              JOIN users u ON u.id = a.patient_user_id
             WHERE a.doctor_user_id = ?
               AND a.status = 'BOOKED'
               AND a.scheduled_start >= ?
               AND a.scheduled_start <= ?
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
                String mode = rs.getString("consultation_mode");
                return new ClinicalInboxItem(
                    "appointment:" + appointmentId,
                    shared > 0 ? "EVIDENCE_READY" : "UPCOMING",
                    shared > 0 ? "NORMAL" : "LOW",
                    rs.getObject("patient_user_id", UUID.class),
                    displayName(rs.getString("first_name"), rs.getString("last_name")),
                    appointmentId,
                    null,
                    shared > 0 ? "Shared evidence ready" : "Upcoming consultation",
                    shared > 0
                        ? shared + " Patient-shared report" + (shared == 1 ? " is" : "s are") + " ready for review."
                        : ("ONLINE".equals(mode) ? "Online" : "IN_PERSON".equals(mode) ? "In-person" : "Booked") + " consultation approaching.",
                    instant(rs.getTimestamp("scheduled_start")),
                    "/doctor/appointments/" + appointmentId
                );
            },
            doctorId,
            Timestamp.from(now),
            Timestamp.from(upcomingCutoff)
        ));

        items.addAll(jdbc.query(
            """
            SELECT f.consultation_id, c.appointment_id, c.patient_user_id,
                   u.first_name, u.last_name, f.recommended_date
              FROM consultation_follow_ups f
              JOIN doctor_consultations c ON c.id = f.consultation_id
              JOIN users u ON u.id = c.patient_user_id
             WHERE c.doctor_user_id = ?
               AND c.status = 'COMPLETED'
               AND f.recommended_date <= CURRENT_DATE + 7
               AND NOT EXISTS (
                   SELECT 1
                     FROM appointments next_a
                    WHERE next_a.doctor_user_id = c.doctor_user_id
                      AND next_a.patient_user_id = c.patient_user_id
                      AND next_a.status = 'BOOKED'
                      AND next_a.scheduled_start >= CURRENT_TIMESTAMP
               )
             ORDER BY f.recommended_date ASC
             LIMIT 30
            """,
            (rs, rowNum) -> {
                LocalDate followUp = rs.getDate("recommended_date").toLocalDate();
                UUID appointmentId = rs.getObject("appointment_id", UUID.class);
                UUID consultationId = rs.getObject("consultation_id", UUID.class);
                return new ClinicalInboxItem(
                    "follow-up:" + consultationId,
                    "FOLLOW_UP",
                    followUp.isBefore(LocalDate.now(clock)) || followUp.isEqual(LocalDate.now(clock)) ? "HIGH" : "NORMAL",
                    rs.getObject("patient_user_id", UUID.class),
                    displayName(rs.getString("first_name"), rs.getString("last_name")),
                    appointmentId,
                    consultationId,
                    "Follow-up " + (followUp.isBefore(LocalDate.now(clock)) ? "overdue" : "due"),
                    "Recommended follow-up: " + followUp + ". No future appointment is currently booked.",
                    followUp.atStartOfDay(java.time.ZoneOffset.UTC).toInstant(),
                    "/doctor/patients/" + rs.getObject("patient_user_id", UUID.class)
                );
            },
            doctorId
        ));

        items.sort(Comparator
            .comparingInt((ClinicalInboxItem item) -> priorityRank(item.priority()))
            .thenComparing(item -> item.dueAt() == null ? Instant.MAX : item.dueAt()));

        int inProgress = countType(items, "IN_PROGRESS");
        int evidenceReady = countType(items, "EVIDENCE_READY");
        int followUp = countType(items, "FOLLOW_UP");
        int upcoming = countType(items, "UPCOMING") + evidenceReady;
        return new ClinicalInboxView(inProgress, evidenceReady, followUp, upcoming, List.copyOf(items));
    }

    @Transactional(readOnly = true)
    public List<DoctorPatientListItem> patients(UUID doctorId) {
        access.requireActiveDoctor(doctorId);
        return jdbc.query(
            """
            SELECT u.id AS patient_id, u.first_name, u.last_name,
                   (SELECT MAX(c.completed_at)
                      FROM doctor_consultations c
                     WHERE c.doctor_user_id = ? AND c.patient_user_id = u.id AND c.status = 'COMPLETED') AS last_consultation_at,
                   (SELECT MIN(a2.scheduled_start)
                      FROM appointments a2
                     WHERE a2.doctor_user_id = ? AND a2.patient_user_id = u.id
                       AND a2.status = 'BOOKED' AND a2.scheduled_start >= CURRENT_TIMESTAMP) AS next_appointment_at,
                   (SELECT COUNT(*)::int
                      FROM consultation_investigations i
                      JOIN doctor_consultations c2 ON c2.id = i.consultation_id
                     WHERE c2.doctor_user_id = ? AND c2.patient_user_id = u.id AND c2.status = 'COMPLETED') AS investigation_count,
                   (SELECT COUNT(*)::int
                      FROM appointment_report_shares s
                      JOIN appointments a3 ON a3.id = s.appointment_id
                     WHERE a3.doctor_user_id = ? AND a3.patient_user_id = u.id
                       AND a3.status = 'BOOKED' AND s.revoked_at IS NULL) AS shared_report_count
              FROM users u
             WHERE EXISTS (
                 SELECT 1 FROM appointments rel
                  WHERE rel.doctor_user_id = ? AND rel.patient_user_id = u.id
             )
             ORDER BY next_appointment_at NULLS LAST, last_consultation_at DESC NULLS LAST, lower(u.first_name), lower(u.last_name)
             LIMIT 200
            """,
            (rs, rowNum) -> new DoctorPatientListItem(
                rs.getObject("patient_id", UUID.class),
                displayName(rs.getString("first_name"), rs.getString("last_name")),
                instant(rs.getTimestamp("last_consultation_at")),
                instant(rs.getTimestamp("next_appointment_at")),
                rs.getInt("investigation_count"),
                rs.getInt("shared_report_count")
            ),
            doctorId, doctorId, doctorId, doctorId, doctorId
        );
    }

    @Transactional(readOnly = true)
    public DoctorPatientDetail patient(UUID doctorId, UUID patientId) {
        access.requireActiveDoctor(doctorId);
        Integer relationship = jdbc.queryForObject(
            "SELECT COUNT(*) FROM appointments WHERE doctor_user_id = ? AND patient_user_id = ?",
            Integer.class,
            doctorId,
            patientId
        );
        if (relationship == null || relationship == 0) {
            throw new DoctorApiException(HttpStatus.NOT_FOUND, "DOCTOR_PATIENT_NOT_FOUND", "That Patient is not in your care history.");
        }

        String patientName = jdbc.queryForObject(
            "SELECT concat_ws(' ', first_name, last_name) FROM users WHERE id = ? AND role = 'PATIENT'",
            String.class,
            patientId
        );

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
            SELECT c.id, c.appointment_id, c.status, c.started_at, c.completed_at, c.assessment, c.plan,
                   (SELECT COUNT(*)::int FROM consultation_prescriptions p WHERE p.consultation_id = c.id) AS prescription_count,
                   (SELECT COUNT(*)::int FROM consultation_investigations i WHERE i.consultation_id = c.id) AS investigation_count,
                   (SELECT f.recommended_date FROM consultation_follow_ups f WHERE f.consultation_id = c.id) AS follow_up_date
              FROM doctor_consultations c
             WHERE c.doctor_user_id = ? AND c.patient_user_id = ?
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
                rs.getInt("investigation_count"),
                rs.getDate("follow_up_date") == null ? null : rs.getDate("follow_up_date").toLocalDate()
            ),
            doctorId,
            patientId
        );

        return new DoctorPatientDetail(patientId, patientName == null ? "Patient" : patientName.trim(), List.copyOf(upcoming), List.copyOf(history));
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
