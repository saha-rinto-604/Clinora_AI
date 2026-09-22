package com.clinora.doctors.support;

import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Resolves the evidence target once and reuses the same rules for routing and execution.
 * APPOINTMENT_AUTHORIZED never means the Patient's whole record: only active reports
 * explicitly shared to this Doctor for this appointment can enter the scope.
 */
final class DoctorSupportEvidenceScopeResolver {
    private final JdbcTemplate jdbc;
    private final DoctorClinicalAccessService access;

    DoctorSupportEvidenceScopeResolver(JdbcTemplate jdbc, DoctorClinicalAccessService access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    ResolvedScope resolve(
        UUID doctorId,
        UUID appointmentId,
        UUID patientId,
        UUID currentReportId,
        List<UUID> selectedReportIds,
        List<UUID> selectedObservationIds
    ) {
        DoctorSupportEvidenceScope scope = DoctorSupportEvidenceScope.resolve(
            currentReportId, selectedReportIds, selectedObservationIds
        );
        List<UUID> safeSelectedReports = selectedReportIds == null ? List.of() : selectedReportIds;
        List<UUID> safeSelectedObservations = selectedObservationIds == null ? List.of() : selectedObservationIds;
        LinkedHashSet<UUID> reportIds = new LinkedHashSet<>();

        // Explicit report IDs must pass the same opaque access check even if no
        // eligible extraction exists. They never cause appointment-wide fallback.
        LinkedHashSet<UUID> explicitReports = new LinkedHashSet<>(safeSelectedReports);
        if (explicitReports.isEmpty() && currentReportId != null) explicitReports.add(currentReportId);
        explicitReports.forEach(id -> access.requireSharedReport(doctorId, appointmentId, id));
        List<UUID> eligibleReports = authorizedReportIds(appointmentId, doctorId, patientId);
        if (scope == DoctorSupportEvidenceScope.APPOINTMENT_AUTHORIZED) {
            reportIds.addAll(eligibleReports);
        } else if (scope != DoctorSupportEvidenceScope.SELECTED_OBSERVATIONS) {
            explicitReports.stream().filter(eligibleReports::contains).forEach(reportIds::add);
        }
        List<UUID> observationIds = List.copyOf(new LinkedHashSet<>(safeSelectedObservations));
        for (UUID observationId : observationIds) {
            UUID reportId = reportForObservation(doctorId, appointmentId, patientId, observationId);
            if (!eligibleReports.contains(reportId)
                || (!explicitReports.isEmpty() && !explicitReports.contains(reportId))) {
                throw unavailableObservation();
            }
            reportIds.add(reportId);
        }

        return new ResolvedScope(
            scope,
            List.copyOf(reportIds),
            observationIds,
            selectionType(scope, reportIds.size(), !safeSelectedReports.isEmpty())
        );
    }

    private List<UUID> authorizedReportIds(UUID appointmentId, UUID doctorId, UUID patientId) {
        return jdbc.queryForList(
            """
            SELECT r.id
            FROM appointment_report_shares s
            JOIN patient_medical_reports r
              ON r.id = s.report_id
             AND r.patient_user_id = s.patient_user_id
            WHERE s.appointment_id = ?
              AND s.doctor_user_id = ?
              AND s.patient_user_id = ?
              AND s.revoked_at IS NULL
              AND r.patient_user_id = ?
              AND r.archived_at IS NULL
              AND r.subject_type = 'SELF'
              AND EXISTS (
                  SELECT 1
                  FROM medical_report_extraction_results er
                  JOIN medical_report_extraction_jobs ej ON ej.id = er.job_id AND ej.report_id = er.report_id
                  JOIN medical_report_observations o ON o.extraction_result_id = er.id
                  WHERE er.report_id = r.id
                    AND ej.patient_user_id = r.patient_user_id
                    AND er.id = (
                        SELECT latest.id FROM medical_report_extraction_results latest
                        JOIN medical_report_extraction_jobs job ON job.id = latest.job_id
                        WHERE latest.report_id = r.id AND latest.review_status = 'VERIFIED'
                          AND job.status = 'SUCCEEDED' AND job.report_id = r.id
                          AND job.patient_user_id = r.patient_user_id
                        ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1
                    )
                    AND er.review_status = 'VERIFIED'
                    AND ej.status = 'SUCCEEDED'
                    AND o.verification_status IN ('PATIENT_CONFIRMED','PATIENT_CORRECTED','DOCTOR_VERIFIED')
              )
            ORDER BY r.report_date NULLS LAST, r.id
            """,
            UUID.class,
            appointmentId, doctorId, patientId, patientId
        );
    }

    private UUID reportForObservation(UUID doctorId, UUID appointmentId, UUID patientId, UUID observationId) {
        List<UUID> rows = jdbc.query(
            """
            SELECT DISTINCT er.report_id
            FROM medical_report_observations o
            JOIN medical_report_extraction_results er ON er.id = o.extraction_result_id
            JOIN medical_report_extraction_jobs ej ON ej.id = er.job_id AND ej.report_id = er.report_id
            JOIN appointment_report_shares s
              ON s.report_id = er.report_id
             AND s.patient_user_id = ej.patient_user_id
            JOIN patient_medical_reports r
              ON r.id = s.report_id
             AND r.patient_user_id = s.patient_user_id
            WHERE o.id = ?
              AND s.appointment_id = ?
              AND s.doctor_user_id = ?
              AND s.patient_user_id = ?
              AND s.revoked_at IS NULL
              AND r.archived_at IS NULL
              AND r.subject_type = 'SELF'
              AND ej.status = 'SUCCEEDED'
              AND er.review_status = 'VERIFIED'
              AND er.id = (
                  SELECT latest.id FROM medical_report_extraction_results latest
                  JOIN medical_report_extraction_jobs job ON job.id = latest.job_id
                  WHERE latest.report_id = r.id AND latest.review_status = 'VERIFIED'
                    AND job.status = 'SUCCEEDED' AND job.report_id = r.id
                    AND job.patient_user_id = r.patient_user_id
                  ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1
              )
              AND o.verification_status IN ('PATIENT_CONFIRMED','PATIENT_CORRECTED','DOCTOR_VERIFIED')
            """,
            (rs, rowNum) -> rs.getObject("report_id", UUID.class),
            observationId, appointmentId, doctorId, patientId
        );
        if (rows.size() != 1) throw unavailableObservation();
        return rows.getFirst();
    }

    String currentReportType(ResolvedScope scope, UUID reportId) {
        if (reportId == null || !scope.reportIds().contains(reportId)) return null;
        return reportDescriptors(scope).stream().filter(r -> r.id().equals(reportId))
            .map(ReportDescriptor::type).filter(java.util.Objects::nonNull).findFirst().orElse(null);
    }

    boolean comparableReportsAvailable(ResolvedScope scope) {
        var reports = reportDescriptors(scope);
        return reports.stream().anyMatch(a -> a.date() != null && a.type() != null && !a.type().isBlank()
            && reports.stream().anyMatch(b -> a.type().equals(b.type()) && b.date() != null
                && a.date().isBefore(b.date())));
    }

    List<DoctorSupportExecutionResponse.CandidateReport> comparisonCandidates(
        UUID doctorId, UUID appointmentId, UUID patientId, java.util.Set<UUID> selected
    ) {
        var authorized = resolve(doctorId, appointmentId, patientId, null, List.of(), List.of());
        return reportDescriptors(authorized).stream()
            .filter(report -> !selected.contains(report.id()) && report.date() != null)
            .map(report -> new DoctorSupportExecutionResponse.CandidateReport(report.id(), report.type(), report.date()))
            .toList();
    }

    private List<ReportDescriptor> reportDescriptors(ResolvedScope scope) {
        if (scope.reportIds().isEmpty()) return List.of();
        String placeholders = String.join(",", java.util.Collections.nCopies(scope.reportIds().size(), "?"));
        return jdbc.query("SELECT id, report_type, report_date FROM patient_medical_reports WHERE id IN ("
            + placeholders + ")", (rs, n) -> new ReportDescriptor(rs.getObject("id", UUID.class),
                rs.getString("report_type"), rs.getObject("report_date", java.time.LocalDate.class)),
            scope.reportIds().toArray());
    }

    private record ReportDescriptor(UUID id, String type, java.time.LocalDate date) {}

    private static DoctorSupportSelectionType selectionType(
        DoctorSupportEvidenceScope scope,
        int reportCount,
        boolean selectedReportsPresent
    ) {
        return switch (scope) {
            case APPOINTMENT_AUTHORIZED -> DoctorSupportSelectionType.NONE;
            case CURRENT_REPORT -> DoctorSupportSelectionType.REPORT;
            case SELECTED_REPORTS -> reportCount > 1
                ? DoctorSupportSelectionType.REPORTS : DoctorSupportSelectionType.REPORT;
            case SELECTED_OBSERVATIONS -> selectedReportsPresent
                ? DoctorSupportSelectionType.MIXED : DoctorSupportSelectionType.OBSERVATIONS;
        };
    }

    private static DoctorApiException unavailableObservation() {
        return new DoctorApiException(
            HttpStatus.NOT_FOUND,
            "REPORT_OBSERVATION_NOT_AVAILABLE",
            "That structured result is not available in the shared evidence."
        );
    }

    record ResolvedScope(
        DoctorSupportEvidenceScope scope,
        List<UUID> reportIds,
        List<UUID> observationIds,
        DoctorSupportSelectionType selectionType
    ) {}
}
