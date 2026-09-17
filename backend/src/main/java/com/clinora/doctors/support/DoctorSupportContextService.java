package com.clinora.doctors.support;

import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DoctorSupportContextService {
    private final JdbcTemplate jdbc;
    private final DoctorClinicalAccessService access;

    public DoctorSupportContextService(JdbcTemplate jdbc, DoctorClinicalAccessService access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    public DoctorSupportContext build(UUID doctorId, UUID appointmentId, DoctorSupportRoutingRequest request) {
        DoctorClinicalAccessService.AppointmentAccess appointment =
            access.requireActiveOwnedAppointment(doctorId, appointmentId).appointment();

        Set<UUID> requestedReportIds = new LinkedHashSet<>();
        if (request.currentReportId() != null) requestedReportIds.add(request.currentReportId());
        requestedReportIds.addAll(request.selectedReportIds());
        requestedReportIds.forEach(reportId -> access.requireSharedReport(doctorId, appointmentId, reportId));

        List<UUID> authorizedReportIds = List.copyOf(requestedReportIds);
        for (UUID observationId : new LinkedHashSet<>(request.selectedObservationIds())) {
            if (!observationIsInAuthorizedEvidence(observationId, appointment.patientId(), authorizedReportIds)) {
                throw new DoctorApiException(
                    HttpStatus.NOT_FOUND,
                    "REPORT_OBSERVATION_NOT_AVAILABLE",
                    "That structured result is not available in the shared evidence."
                );
            }
        }

        String currentReportType = request.currentReportId() == null
            ? null
            : reportType(request.currentReportId(), appointment.patientId());
        boolean comparable = comparableReportExists(
            appointmentId,
            doctorId,
            appointment.patientId(),
            request.currentReportId(),
            currentReportType,
            authorizedReportIds
        );
        List<UUID> observationIds = List.copyOf(new LinkedHashSet<>(request.selectedObservationIds()));

        return new DoctorSupportContext(
            doctorId,
            appointmentId,
            request.currentScreen(),
            request.currentReportId(),
            currentReportType,
            authorizedReportIds,
            observationIds,
            request.doctorAssessmentPresent(),
            request.doctorNotesPresent(),
            comparable,
            selectionType(authorizedReportIds.size(), observationIds.size())
        );
    }

    private boolean observationIsInAuthorizedEvidence(UUID observationId, UUID patientId, List<UUID> reportIds) {
        for (UUID reportId : reportIds) {
            Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM medical_report_observations o
                JOIN medical_report_extraction_results er ON er.id = o.extraction_result_id
                JOIN medical_report_extraction_jobs ej ON ej.id = er.job_id AND ej.report_id = er.report_id
                WHERE o.id = ?
                  AND er.report_id = ?
                  AND ej.patient_user_id = ?
                  AND ej.status = 'SUCCEEDED'
                  AND er.review_status = 'VERIFIED'
                """,
                Integer.class,
                observationId,
                reportId,
                patientId
            );
            if (count != null && count == 1) return true;
        }
        return false;
    }

    private String reportType(UUID reportId, UUID patientId) {
        List<String> rows = jdbc.query(
            """
            SELECT report_type
            FROM patient_medical_reports
            WHERE id = ? AND patient_user_id = ? AND archived_at IS NULL AND subject_type = 'SELF'
            """,
            (rs, rowNum) -> rs.getString("report_type"),
            reportId,
            patientId
        );
        if (rows.isEmpty()) {
            throw new DoctorApiException(
                HttpStatus.NOT_FOUND,
                "SHARED_REPORT_NOT_AVAILABLE",
                "That report is not available for this appointment."
            );
        }
        return rows.getFirst();
    }

    private boolean comparableReportExists(
        UUID appointmentId,
        UUID doctorId,
        UUID patientId,
        UUID currentReportId,
        String currentReportType,
        List<UUID> selectedReportIds
    ) {
        if (selectedReportIds.size() >= 2) return true;
        if (currentReportId == null) return false;
        Integer count = jdbc.queryForObject(
            """
            SELECT COUNT(DISTINCT s.report_id)
            FROM appointment_report_shares s
            JOIN patient_medical_reports r ON r.id = s.report_id AND r.patient_user_id = s.patient_user_id
            WHERE s.appointment_id = ?
              AND s.doctor_user_id = ?
              AND s.patient_user_id = ?
              AND s.report_id <> ?
              AND s.revoked_at IS NULL
              AND r.archived_at IS NULL
              AND r.subject_type = 'SELF'
              AND ((? IS NULL AND r.report_type IS NULL) OR r.report_type = ?)
            """,
            Integer.class,
            appointmentId,
            doctorId,
            patientId,
            currentReportId,
            currentReportType,
            currentReportType
        );
        return count != null && count > 0;
    }

    private static DoctorSupportSelectionType selectionType(int reportCount, int observationCount) {
        if (reportCount > 0 && observationCount > 0) return DoctorSupportSelectionType.MIXED;
        if (observationCount > 0) return DoctorSupportSelectionType.OBSERVATIONS;
        if (reportCount > 1) return DoctorSupportSelectionType.REPORTS;
        if (reportCount == 1) return DoctorSupportSelectionType.REPORT;
        return DoctorSupportSelectionType.NONE;
    }
}
