package com.clinora.research.service;

import com.clinora.research.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Standard implementation of the research data eligibility boundary.
 */
@Service
@Transactional(readOnly = true)
public class DefaultResearchDataEligibilityService implements ResearchDataEligibilityService {

    private static final Set<String> TRUSTED_VERIFICATION_STATUSES = Set.of(
            "PATIENT_CONFIRMED",
            "PATIENT_CORRECTED",
            "DOCTOR_VERIFIED"
    );

    private static final Pattern ADMINISTRATIVE_METADATA_PATTERN = Pattern.compile(
            "\\b(track|tracking|barcode|accession|lab\\s*(?:no|number|id)|patient\\s*(?:id|name|no|number)|sample\\s*(?:id|no|number)|receipt|invoice|registration|bill|address|phone|mobile|doctor|physician)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern NON_RESULT_HEADING_PATTERN = Pattern.compile(
            "^(?:test\\s*name|result|results|investigation|investigations|reference\\s*range|normal\\s*range|unit|units|method|remarks?|profile)$",
            Pattern.CASE_INSENSITIVE
    );

    private final JdbcTemplate jdbcTemplate;

    public DefaultResearchDataEligibilityService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public EligibilityDecision evaluate(EligibilityCandidate candidate) {
        if (candidate == null) {
            return EligibilityDecision.reject(
                    null,
                    EligibilityIneligibilityReason.EXCLUDED_MISSING_VALUE,
                    "Candidate observation is null."
            );
        }

        UUID observationId = candidate.observationId();
        List<EligibilityIneligibilityReason> reasons = new ArrayList<>();

        // Gate 1: Fail-Closed Consent Boundary
        ResearchConsentStatus consent = candidate.consentStatus();
        if (consent == null || consent == ResearchConsentStatus.UNKNOWN) {
            return EligibilityDecision.reject(
                    observationId,
                    EligibilityIneligibilityReason.EXCLUDED_UNKNOWN_CONSENT,
                    "Research consent/data-use policy is unfinalized; UNKNOWN eligibility is NOT exportable."
            );
        }
        if (consent == ResearchConsentStatus.WITHHELD || consent == ResearchConsentStatus.REVOKED) {
            return EligibilityDecision.reject(
                    observationId,
                    EligibilityIneligibilityReason.EXCLUDED_CONSENT_WITHHELD,
                    "Patient has explicitly declined or revoked research data participation."
            );
        }

        // Gate 2: Subject Boundary Isolation ('SELF' vs 'OTHER')
        String subject = candidate.subjectType() == null ? "" : candidate.subjectType().trim().toUpperCase(Locale.ROOT);
        if (!"SELF".equals(subject)) {
            return EligibilityDecision.reject(
                    observationId,
                    EligibilityIneligibilityReason.EXCLUDED_OTHER_SUBJECT,
                    "Report belongs to a third party ('OTHER') and must remain strictly isolated from research contributions."
            );
        }

        if (candidate.reportArchivedAt() != null) {
            return EligibilityDecision.reject(
                    observationId,
                    EligibilityIneligibilityReason.EXCLUDED_ARCHIVED_REPORT,
                    "The source medical report has been archived or removed."
            );
        }

        // Gate 3: Clinical Trustworthiness & Verification Boundary
        if (candidate.reviewRequired()) {
            reasons.add(EligibilityIneligibilityReason.EXCLUDED_REVIEW_REQUIRED);
        }

        String verification = candidate.verificationStatus() == null ? "UNREVIEWED" : candidate.verificationStatus().trim().toUpperCase(Locale.ROOT);
        if ("UNREVIEWED".equals(verification)) {
            reasons.add(EligibilityIneligibilityReason.EXCLUDED_UNREVIEWED_RAW_OCR);
        } else if (!TRUSTED_VERIFICATION_STATUSES.contains(verification)) {
            reasons.add(EligibilityIneligibilityReason.EXCLUDED_UNREVIEWED_RAW_OCR);
        }

        // Gate 4: Clinical Hygiene & Label Filtering
        String label = candidate.bestLabel();
        if (label.isBlank()) {
            reasons.add(EligibilityIneligibilityReason.EXCLUDED_LABEL_MISSING);
        } else {
            String normalizedLabel = normalizeText(label);
            if (NON_RESULT_HEADING_PATTERN.matcher(normalizedLabel).matches()) {
                reasons.add(EligibilityIneligibilityReason.EXCLUDED_NON_CLINICAL_LABEL);
            }
            if (ADMINISTRATIVE_METADATA_PATTERN.matcher(normalizedLabel).find()) {
                reasons.add(EligibilityIneligibilityReason.EXCLUDED_ADMINISTRATIVE_METADATA);
            }
        }

        // Gate 5: Value Integrity & Reference Bounds
        String valueType = candidate.effectiveValueType() == null ? "NUMERIC" : candidate.effectiveValueType().trim().toUpperCase(Locale.ROOT);
        if ("NUMERIC".equals(valueType)) {
            if (candidate.effectiveNumericValue() == null) {
                reasons.add(EligibilityIneligibilityReason.EXCLUDED_MISSING_VALUE);
            }
            if (candidate.referenceLow() != null && candidate.referenceHigh() != null
                    && candidate.referenceLow().compareTo(candidate.referenceHigh()) > 0) {
                reasons.add(EligibilityIneligibilityReason.EXCLUDED_INVALID_REFERENCE_RANGE);
            }
        } else {
            if (candidate.effectiveTextValue() == null || candidate.effectiveTextValue().isBlank()) {
                reasons.add(EligibilityIneligibilityReason.EXCLUDED_MISSING_VALUE);
            }
        }

        if (!reasons.isEmpty()) {
            return EligibilityDecision.rejectMultiple(
                    observationId,
                    reasons,
                    "Observation excluded due to governance or clinical hygiene policies: " + reasons
            );
        }

        return EligibilityDecision.allow(observationId);
    }

    @Override
    public List<EligibilityDecision> evaluateAll(List<EligibilityCandidate> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return Collections.emptyList();
        }
        return candidates.stream().map(this::evaluate).toList();
    }

    @Override
    public CohortEligibilityReport evaluateCohort(List<EligibilityCandidate> candidates) {
        List<EligibilityDecision> decisions = evaluateAll(candidates);
        return CohortEligibilityReport.fromDecisions(decisions);
    }

    @Override
    public List<EligibilityCandidate> fetchCandidatesForPatient(UUID patientUserId, ResearchConsentStatus consentStatus) {
        String sql = """
            SELECT 
                obs.id AS observation_id,
                rep.id AS report_id,
                rep.patient_user_id,
                rep.subject_type,
                rep.subject_label,
                rep.archived_at,
                obs.verification_status,
                obs.review_required,
                obs.ocr_confidence,
                obs.source_label,
                obs.normalized_label,
                obs.effective_label,
                obs.effective_value_type,
                obs.effective_numeric_value,
                obs.effective_text_value,
                obs.effective_unit,
                obs.reference_low,
                obs.reference_high
            FROM medical_report_observations obs
            JOIN medical_report_extraction_results res ON obs.extraction_result_id = res.id
            JOIN patient_medical_reports rep ON res.report_id = rep.id
            WHERE rep.patient_user_id = ?
            ORDER BY obs.created_at ASC
            """;

        return jdbcTemplate.query(sql, new CandidateRowMapper(consentStatus), patientUserId);
    }

    @Override
    public CohortEligibilityReport evaluatePatientEligibility(UUID patientUserId, ResearchConsentStatus consentStatus) {
        List<EligibilityCandidate> candidates = fetchCandidatesForPatient(patientUserId, consentStatus);
        return evaluateCohort(candidates);
    }

    private static String normalizeText(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFKC)
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static class CandidateRowMapper implements RowMapper<EligibilityCandidate> {
        private final ResearchConsentStatus consentStatus;

        CandidateRowMapper(ResearchConsentStatus consentStatus) {
            this.consentStatus = consentStatus;
        }

        @Override
        public EligibilityCandidate mapRow(ResultSet rs, int rowNum) throws SQLException {
            Timestamp archivedTs = rs.getTimestamp("archived_at");
            Instant archivedAt = archivedTs == null ? null : archivedTs.toInstant();

            return new EligibilityCandidate(
                    rs.getObject("observation_id", UUID.class),
                    rs.getObject("report_id", UUID.class),
                    rs.getObject("patient_user_id", UUID.class),
                    rs.getString("subject_type"),
                    rs.getString("subject_label"),
                    archivedAt,
                    rs.getString("verification_status"),
                    rs.getBoolean("review_required"),
                    rs.getBigDecimal("ocr_confidence"),
                    rs.getString("source_label"),
                    rs.getString("normalized_label"),
                    rs.getString("effective_label"),
                    rs.getString("effective_value_type"),
                    rs.getBigDecimal("effective_numeric_value"),
                    rs.getString("effective_text_value"),
                    rs.getString("effective_unit"),
                    rs.getBigDecimal("reference_low"),
                    rs.getBigDecimal("reference_high"),
                    consentStatus
            );
        }
    }
}
