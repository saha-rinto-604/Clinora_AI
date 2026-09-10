package com.clinora.doctors.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.doctors.api.DoctorApiException;
import com.clinora.patients.service.PatientReportDisplayName;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DoctorReportReviewService {
    private static final Set<String> REVIEW_DECISIONS = Set.of("CONFIRMED", "DISAGREES", "NEEDS_SOURCE_REVIEW");

    private final JdbcTemplate jdbc;
    private final DoctorClinicalAccessService access;
    private final AuthAuditService audit;
    private final Clock clock;

    public DoctorReportReviewService(
        JdbcTemplate jdbc,
        DoctorClinicalAccessService access,
        AuthAuditService audit,
        Clock clock
    ) {
        this.jdbc = jdbc;
        this.access = access;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public DoctorWorkspaceModels.ReportReviewView review(
        UUID doctorId,
        UUID appointmentId,
        UUID reportId,
        String ip,
        String userAgent
    ) {
        DoctorClinicalAccessService.SharedReportAccess grant = access.requireSharedReport(doctorId, appointmentId, reportId);
        DoctorWorkspaceModels.ReportReviewView view = buildReview(grant);
        recordReportReviewActivity(grant, false);
        audit.record(
            doctorId,
            AuthAuditAction.DOCTOR_SHARED_REPORT_STRUCTURED_VIEWED,
            AuthAuditOutcome.SUCCESS,
            ip,
            userAgent,
            reportId.toString(),
            "appointmentId=" + appointmentId
        );
        return view;
    }

    @Transactional
    public DoctorWorkspaceModels.ReportComparisonView compare(
        UUID doctorId,
        UUID appointmentId,
        UUID leftReportId,
        UUID rightReportId,
        String ip,
        String userAgent
    ) {
        if (leftReportId == null || rightReportId == null || leftReportId.equals(rightReportId)) {
            throw new DoctorApiException(
                HttpStatus.BAD_REQUEST,
                "REPORT_COMPARE_SELECTION_INVALID",
                "Choose two different shared reports to compare."
            );
        }
        DoctorClinicalAccessService.SharedReportAccess left = access.requireSharedReport(doctorId, appointmentId, leftReportId);
        DoctorClinicalAccessService.SharedReportAccess right = access.requireSharedReport(doctorId, appointmentId, rightReportId);
        recordReportReviewActivity(left, false);
        recordReportReviewActivity(right, false);
        audit.record(
            doctorId,
            AuthAuditAction.DOCTOR_SHARED_REPORT_STRUCTURED_VIEWED,
            AuthAuditOutcome.SUCCESS,
            ip,
            userAgent,
            appointmentId.toString(),
            "comparison=" + leftReportId + "," + rightReportId
        );
        return new DoctorWorkspaceModels.ReportComparisonView(buildReview(left), buildReview(right));
    }

    @Transactional
    public DoctorWorkspaceModels.ObservationReviewView reviewObservation(
        UUID doctorId,
        UUID appointmentId,
        UUID reportId,
        UUID observationId,
        DoctorWorkspaceModels.ObservationReviewRequest request,
        String ip,
        String userAgent
    ) {
        DoctorClinicalAccessService.SharedReportAccess grant = access.requireSharedReport(doctorId, appointmentId, reportId);
        String decision = normalizeDecision(request == null ? null : request.decision());
        String comment = trimToNull(request == null ? null : request.comment(), 1200);
        UUID resultId = verifiedExtractionResult(reportId, grant.appointment().patientId());
        if (resultId == null || !observationBelongsToResult(observationId, resultId)) {
            throw new DoctorApiException(
                HttpStatus.NOT_FOUND,
                "REPORT_OBSERVATION_NOT_AVAILABLE",
                "That structured result is not available in this shared report."
            );
        }

        Instant now = clock.instant();
        UUID reviewId = UUID.nameUUIDFromBytes(
            ("clinora-doctor-observation-review:" + observationId + ":" + doctorId + ":" + appointmentId)
                .getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
        jdbc.update(
            """
            INSERT INTO medical_report_observation_doctor_reviews
                (id, observation_id, extraction_result_id, appointment_id, report_id, patient_user_id, doctor_user_id,
                 decision, comment, reviewed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (observation_id, doctor_user_id, appointment_id) DO UPDATE SET
                decision = EXCLUDED.decision,
                comment = EXCLUDED.comment,
                reviewed_at = EXCLUDED.reviewed_at,
                updated_at = EXCLUDED.updated_at
            """,
            reviewId,
            observationId,
            resultId,
            appointmentId,
            reportId,
            grant.appointment().patientId(),
            doctorId,
            decision,
            comment,
            Timestamp.from(now),
            Timestamp.from(now),
            Timestamp.from(now)
        );
        recordReportReviewActivity(grant, true);
        audit.record(
            doctorId,
            AuthAuditAction.DOCTOR_REPORT_OBSERVATION_REVIEWED,
            AuthAuditOutcome.SUCCESS,
            ip,
            userAgent,
            reportId.toString(),
            "appointmentId=" + appointmentId + ";observationId=" + observationId + ";decision=" + decision
        );
        return new DoctorWorkspaceModels.ObservationReviewView(observationId, decision, comment, now);
    }

    private DoctorWorkspaceModels.ReportReviewView buildReview(DoctorClinicalAccessService.SharedReportAccess grant) {
        ReportMetadata metadata = reportMetadata(grant.reportId(), grant.appointment().patientId());
        ExtractionSelection extraction = extractionSelection(grant.reportId(), grant.appointment().patientId());
        List<DoctorWorkspaceModels.ObservationView> observations = extraction.resultId() == null
            ? List.of()
            : observations(extraction.resultId(), grant.appointment().doctorId(), grant.appointment().appointmentId());
        return new DoctorWorkspaceModels.ReportReviewView(
            grant.appointment().appointmentId(),
            grant.reportId(),
            metadata.reportName(),
            metadata.reportType(),
            metadata.reportDate(),
            metadata.providerLaboratory(),
            metadata.mimeType(),
            extraction.reviewStatus(),
            grant.sharedAt(),
            observations
        );
    }

    private ReportMetadata reportMetadata(UUID reportId, UUID patientId) {
        var rows = jdbc.query(
            """
            SELECT report_name, report_type, report_date, provider_laboratory, original_filename, mime_type
            FROM patient_medical_reports
            WHERE id = ? AND patient_user_id = ? AND archived_at IS NULL
            """,
            (rs, rowNum) -> {
                java.time.LocalDate reportDate = rs.getDate("report_date") == null
                    ? null
                    : rs.getDate("report_date").toLocalDate();
                return new ReportMetadata(
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
                    rs.getString("mime_type")
                );
            },
            reportId,
            patientId
        );
        if (rows.isEmpty()) {
            throw new DoctorApiException(HttpStatus.NOT_FOUND, "SHARED_REPORT_NOT_AVAILABLE", "That report is not available for this appointment.");
        }
        return rows.getFirst();
    }

    private ExtractionSelection extractionSelection(UUID reportId, UUID patientId) {
        var rows = jdbc.query(
            """
            SELECT er.id, er.review_status
            FROM medical_report_extraction_results er
            JOIN medical_report_extraction_jobs ej ON ej.id = er.job_id
            WHERE er.report_id = ?
              AND ej.report_id = er.report_id
              AND ej.patient_user_id = ?
              AND ej.status = 'SUCCEEDED'
            ORDER BY er.updated_at DESC, er.created_at DESC
            LIMIT 1
            """,
            (rs, rowNum) -> new ExtractionSelection(
                rs.getObject("id", UUID.class),
                rs.getString("review_status")
            ),
            reportId,
            patientId
        );
        if (rows.isEmpty()) return new ExtractionSelection(null, "NOT_AVAILABLE");
        ExtractionSelection latest = rows.getFirst();
        return "VERIFIED".equals(latest.reviewStatus())
            ? latest
            : new ExtractionSelection(null, "NOT_VERIFIED");
    }

    private UUID verifiedExtractionResult(UUID reportId, UUID patientId) {
        ExtractionSelection selection = extractionSelection(reportId, patientId);
        return "VERIFIED".equals(selection.reviewStatus()) ? selection.resultId() : null;
    }

    private List<DoctorWorkspaceModels.ObservationView> observations(UUID resultId, UUID doctorId, UUID appointmentId) {
        return jdbc.query(
            """
            SELECT o.id,
                   o.effective_label,
                   o.effective_value_type,
                   o.effective_numeric_value,
                   o.effective_text_value,
                   o.effective_comparator,
                   o.effective_unit,
                   o.reference_range_raw,
                   o.reference_low,
                   o.reference_high,
                   o.source_flag,
                   o.derived_range_flag,
                   o.page_number,
                   o.verification_status,
                   dr.decision AS doctor_decision,
                   dr.comment AS doctor_comment
            FROM medical_report_observations o
            LEFT JOIN medical_report_observation_doctor_reviews dr
              ON dr.observation_id = o.id
             AND dr.doctor_user_id = ?
             AND dr.appointment_id = ?
            WHERE o.extraction_result_id = ?
            ORDER BY o.page_number, o.normalized_label, o.id
            """,
            (rs, rowNum) -> {
                BigDecimal numericValue = rs.getBigDecimal("effective_numeric_value");
                String textValue = rs.getString("effective_text_value");
                String valueType = rs.getString("effective_value_type");
                String sourceFlag = rs.getString("source_flag");
                String derivedRangeFlag = rs.getString("derived_range_flag");
                String referenceRangeRaw = rs.getString("reference_range_raw");
                BigDecimal referenceLow = rs.getBigDecimal("reference_low");
                BigDecimal referenceHigh = rs.getBigDecimal("reference_high");
                return new DoctorWorkspaceModels.ObservationView(
                    rs.getObject("id", UUID.class),
                    rs.getString("effective_label"),
                    valueType,
                    displayValue(valueType, numericValue, textValue),
                    rs.getString("effective_comparator"),
                    rs.getString("effective_unit"),
                    referenceRange(referenceRangeRaw, referenceLow, referenceHigh),
                    sourceFlag,
                    derivedRangeFlag,
                    rs.getInt("page_number"),
                    rs.getString("verification_status"),
                    rs.getString("doctor_decision"),
                    rs.getString("doctor_comment"),
                    resultStatus(derivedRangeFlag, sourceFlag)
                );
            },
            doctorId,
            appointmentId,
            resultId
        );
    }

    private boolean observationBelongsToResult(UUID observationId, UUID resultId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM medical_report_observations WHERE id = ? AND extraction_result_id = ?",
            Integer.class,
            observationId,
            resultId
        );
        return count != null && count == 1;
    }

    private void recordReportReviewActivity(DoctorClinicalAccessService.SharedReportAccess grant, boolean observationReviewed) {
        Instant now = clock.instant();
        UUID id = UUID.nameUUIDFromBytes(
            ("clinora-doctor-report-review:" + grant.appointment().appointmentId() + ":" + grant.reportId() + ":" + grant.appointment().doctorId())
                .getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
        jdbc.update(
            """
            INSERT INTO doctor_report_reviews
                (id, appointment_id, report_id, patient_user_id, doctor_user_id,
                 first_viewed_at, last_viewed_at, last_observation_reviewed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (appointment_id, report_id, doctor_user_id) DO UPDATE SET
                last_viewed_at = EXCLUDED.last_viewed_at,
                last_observation_reviewed_at = COALESCE(EXCLUDED.last_observation_reviewed_at, doctor_report_reviews.last_observation_reviewed_at),
                updated_at = EXCLUDED.updated_at
            """,
            id,
            grant.appointment().appointmentId(),
            grant.reportId(),
            grant.appointment().patientId(),
            grant.appointment().doctorId(),
            Timestamp.from(now),
            Timestamp.from(now),
            observationReviewed ? Timestamp.from(now) : null,
            Timestamp.from(now),
            Timestamp.from(now)
        );
    }

    private static String displayValue(String valueType, BigDecimal numericValue, String textValue) {
        if ("NUMERIC".equals(valueType) && numericValue != null) return numericValue.stripTrailingZeros().toPlainString();
        if (textValue != null && !textValue.isBlank()) return textValue;
        return "—";
    }

    private static String referenceRange(String raw, BigDecimal low, BigDecimal high) {
        if (raw != null && !raw.isBlank()) return raw.trim();
        if (low != null && high != null) return low.stripTrailingZeros().toPlainString() + " – " + high.stripTrailingZeros().toPlainString();
        if (low != null) return "≥ " + low.stripTrailingZeros().toPlainString();
        if (high != null) return "≤ " + high.stripTrailingZeros().toPlainString();
        return null;
    }

    static String resultStatus(String derivedRangeFlag, String sourceFlag) {
        if (derivedRangeFlag != null) {
            return switch (derivedRangeFlag) {
                case "BELOW_REPORTED_RANGE", "ABOVE_REPORTED_RANGE" -> "OUTSIDE_RANGE";
                case "WITHIN_REPORTED_RANGE" -> "WITHIN_RANGE";
                default -> "NOT_CLASSIFIED";
            };
        }
        if (sourceFlag == null || sourceFlag.isBlank()) return "NOT_CLASSIFIED";
        String flag = sourceFlag.toUpperCase(Locale.ROOT);
        if (flag.equals("H") || flag.equals("L") || flag.contains("HIGH") || flag.contains("LOW") || flag.contains("ABNORMAL") || flag.contains("CRITICAL") || flag.contains("POSITIVE")) {
            return "OUTSIDE_RANGE";
        }
        if (flag.contains("NORMAL") || flag.contains("WITHIN") || flag.contains("NEGATIVE")) return "WITHIN_RANGE";
        return "NOT_CLASSIFIED";
    }

    private static String normalizeDecision(String raw) {
        if (raw == null) {
            throw new DoctorApiException(HttpStatus.BAD_REQUEST, "DOCTOR_REVIEW_REQUIRED", "Choose how this result compares with the source report.");
        }
        String decision = raw.trim().toUpperCase(Locale.ROOT);
        if (!REVIEW_DECISIONS.contains(decision)) {
            throw new DoctorApiException(HttpStatus.BAD_REQUEST, "DOCTOR_REVIEW_INVALID", "Choose a valid review option.");
        }
        return decision;
    }

    private static String trimToNull(String raw, int max) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        return value.length() <= max ? value : value.substring(0, max);
    }

    private record ReportMetadata(
        String reportName,
        String reportType,
        LocalDate reportDate,
        String providerLaboratory,
        String mimeType
    ) {}

    private record ExtractionSelection(UUID resultId, String reviewStatus) {}
}
