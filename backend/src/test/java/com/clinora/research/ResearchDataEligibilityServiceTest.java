package com.clinora.research;

import com.clinora.research.domain.*;
import com.clinora.research.service.DefaultResearchDataEligibilityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ResearchDataEligibilityServiceTest {

    private DefaultResearchDataEligibilityService eligibilityService;
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        eligibilityService = new DefaultResearchDataEligibilityService(jdbcTemplate);
    }

    private EligibilityCandidate createBaseValidCandidate() {
        return new EligibilityCandidate(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "SELF",
                null,
                null,
                "DOCTOR_VERIFIED",
                false,
                new BigDecimal("0.98"),
                "HbA1c Glycated Hemoglobin",
                "HbA1c",
                "HbA1c",
                "NUMERIC",
                new BigDecimal("5.8"),
                null,
                "%",
                new BigDecimal("4.0"),
                new BigDecimal("5.6"),
                ResearchConsentStatus.CONSENTED
        );
    }

    @Test
    @DisplayName("Eligible when observation is from SELF report, doctor verified, clinical hygiene passes, and consented")
    void testValidObservationEligible() {
        EligibilityCandidate candidate = createBaseValidCandidate();

        EligibilityDecision decision = eligibilityService.evaluate(candidate);

        assertThat(decision.isEligible()).isTrue();
        assertThat(decision.status()).isEqualTo(EligibilityStatus.ELIGIBLE);
        assertThat(decision.reasons()).isEmpty();
    }

    @Test
    @DisplayName("Patient-confirmed and patient-corrected observations are also trusted")
    void testPatientConfirmedEligible() {
        EligibilityCandidate patientConfirmed = new EligibilityCandidate(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "SELF",
                null,
                null,
                "PATIENT_CONFIRMED",
                false,
                new BigDecimal("0.95"),
                "Fasting Blood Glucose",
                "Fasting Blood Glucose",
                "Fasting Blood Glucose",
                "NUMERIC",
                new BigDecimal("95.0"),
                null,
                "mg/dL",
                new BigDecimal("70.0"),
                new BigDecimal("99.0"),
                ResearchConsentStatus.CONSENTED
        );

        EligibilityDecision decision = eligibilityService.evaluate(patientConfirmed);

        assertThat(decision.isEligible()).isTrue();
    }

    @Test
    @DisplayName("UNKNOWN consent status fails closed: UNKNOWN ELIGIBILITY = NOT EXPORTABLE")
    void testUnknownConsentFailsClosed() {
        EligibilityCandidate candidate = new EligibilityCandidate(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "SELF",
                null,
                null,
                "DOCTOR_VERIFIED",
                false,
                new BigDecimal("0.98"),
                "HbA1c",
                "HbA1c",
                "HbA1c",
                "NUMERIC",
                new BigDecimal("5.8"),
                null,
                "%",
                new BigDecimal("4.0"),
                new BigDecimal("5.6"),
                ResearchConsentStatus.UNKNOWN // UNKNOWN CONSENT
        );

        EligibilityDecision decision = eligibilityService.evaluate(candidate);

        assertThat(decision.isEligible()).isFalse();
        assertThat(decision.reasons()).contains(EligibilityIneligibilityReason.EXCLUDED_UNKNOWN_CONSENT);
    }

    @Test
    @DisplayName("Withheld or revoked consent excludes observation")
    void testWithheldConsentExcludes() {
        EligibilityCandidate candidate = new EligibilityCandidate(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "SELF",
                null,
                null,
                "DOCTOR_VERIFIED",
                false,
                new BigDecimal("0.98"),
                "HbA1c",
                "HbA1c",
                "HbA1c",
                "NUMERIC",
                new BigDecimal("5.8"),
                null,
                "%",
                new BigDecimal("4.0"),
                new BigDecimal("5.6"),
                ResearchConsentStatus.WITHHELD
        );

        EligibilityDecision decision = eligibilityService.evaluate(candidate);

        assertThat(decision.isEligible()).isFalse();
        assertThat(decision.reasons()).contains(EligibilityIneligibilityReason.EXCLUDED_CONSENT_WITHHELD);
    }

    @Test
    @DisplayName("OTHER subject reports are strictly isolated from research contributions")
    void testOtherSubjectReportsExcluded() {
        EligibilityCandidate candidate = new EligibilityCandidate(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "OTHER", // UPLOADED FOR MOTHER / CHILD
                "Mother",
                null,
                "DOCTOR_VERIFIED",
                false,
                new BigDecimal("0.98"),
                "HbA1c",
                "HbA1c",
                "HbA1c",
                "NUMERIC",
                new BigDecimal("6.2"),
                null,
                "%",
                new BigDecimal("4.0"),
                new BigDecimal("5.6"),
                ResearchConsentStatus.CONSENTED
        );

        EligibilityDecision decision = eligibilityService.evaluate(candidate);

        assertThat(decision.isEligible()).isFalse();
        assertThat(decision.reasons()).contains(EligibilityIneligibilityReason.EXCLUDED_OTHER_SUBJECT);
    }

    @Test
    @DisplayName("Raw OCR unreviewed extraction is not automatically eligible")
    void testRawOcrUnreviewedExcluded() {
        EligibilityCandidate candidate = new EligibilityCandidate(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "SELF",
                null,
                null,
                "UNREVIEWED", // RAW OCR
                false,
                new BigDecimal("0.85"),
                "Total Cholesterol",
                "Total Cholesterol",
                "Total Cholesterol",
                "NUMERIC",
                new BigDecimal("190"),
                null,
                "mg/dL",
                null,
                new BigDecimal("200"),
                ResearchConsentStatus.CONSENTED
        );

        EligibilityDecision decision = eligibilityService.evaluate(candidate);

        assertThat(decision.isEligible()).isFalse();
        assertThat(decision.reasons()).contains(EligibilityIneligibilityReason.EXCLUDED_UNREVIEWED_RAW_OCR);
    }

    @Test
    @DisplayName("Observation with review_required == true is excluded")
    void testReviewRequiredExcluded() {
        EligibilityCandidate candidate = new EligibilityCandidate(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "SELF",
                null,
                null,
                "PATIENT_CONFIRMED",
                true, // REQUIRES REVIEW
                new BigDecimal("0.70"),
                "Serum Creatinine",
                "Serum Creatinine",
                "Serum Creatinine",
                "NUMERIC",
                new BigDecimal("1.1"),
                null,
                "mg/dL",
                new BigDecimal("0.7"),
                new BigDecimal("1.3"),
                ResearchConsentStatus.CONSENTED
        );

        EligibilityDecision decision = eligibilityService.evaluate(candidate);

        assertThat(decision.isEligible()).isFalse();
        assertThat(decision.reasons()).contains(EligibilityIneligibilityReason.EXCLUDED_REVIEW_REQUIRED);
    }

    @Test
    @DisplayName("Administrative barcodes and invoice metadata are filtered out")
    void testAdministrativeMetadataExcluded() {
        EligibilityCandidate candidate = new EligibilityCandidate(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "SELF",
                null,
                null,
                "DOCTOR_VERIFIED",
                false,
                new BigDecimal("0.99"),
                "Sample Barcode ID #829104",
                "Sample Barcode ID",
                "Sample Barcode ID",
                "TEXT",
                null,
                "BC-984210",
                null,
                null,
                null,
                ResearchConsentStatus.CONSENTED
        );

        EligibilityDecision decision = eligibilityService.evaluate(candidate);

        assertThat(decision.isEligible()).isFalse();
        assertThat(decision.reasons()).contains(EligibilityIneligibilityReason.EXCLUDED_ADMINISTRATIVE_METADATA);
    }

    @Test
    @DisplayName("Report section headers like 'Reference Range' are filtered out")
    void testNonClinicalHeadersExcluded() {
        EligibilityCandidate candidate = new EligibilityCandidate(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "SELF",
                null,
                null,
                "DOCTOR_VERIFIED",
                false,
                new BigDecimal("0.99"),
                "Reference Range",
                "Reference Range",
                "Reference Range",
                "TEXT",
                null,
                "Normal",
                null,
                null,
                null,
                ResearchConsentStatus.CONSENTED
        );

        EligibilityDecision decision = eligibilityService.evaluate(candidate);

        assertThat(decision.isEligible()).isFalse();
        assertThat(decision.reasons()).contains(EligibilityIneligibilityReason.EXCLUDED_NON_CLINICAL_LABEL);
    }

    @Test
    @DisplayName("Inverted reference ranges (low > high) are rejected")
    void testInvertedReferenceRangeRejected() {
        EligibilityCandidate candidate = new EligibilityCandidate(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "SELF",
                null,
                null,
                "DOCTOR_VERIFIED",
                false,
                new BigDecimal("0.99"),
                "Serum Calcium",
                "Serum Calcium",
                "Serum Calcium",
                "NUMERIC",
                new BigDecimal("9.5"),
                null,
                "mg/dL",
                new BigDecimal("12.0"), // Low 12.0 > High 8.0!
                new BigDecimal("8.0"),
                ResearchConsentStatus.CONSENTED
        );

        EligibilityDecision decision = eligibilityService.evaluate(candidate);

        assertThat(decision.isEligible()).isFalse();
        assertThat(decision.reasons()).contains(EligibilityIneligibilityReason.EXCLUDED_INVALID_REFERENCE_RANGE);
    }

    @Test
    @DisplayName("Cohort evaluation aggregates statistics and exclusion breakdowns accurately")
    void testCohortEvaluation() {
        EligibilityCandidate eligible = createBaseValidCandidate();

        EligibilityCandidate otherSubject = new EligibilityCandidate(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "OTHER", "Father", null, "DOCTOR_VERIFIED", false, new BigDecimal("0.95"),
                "Cholesterol", "Cholesterol", "Cholesterol", "NUMERIC", new BigDecimal("180"),
                null, "mg/dL", null, new BigDecimal("200"), ResearchConsentStatus.CONSENTED
        );

        EligibilityCandidate rawOcr = new EligibilityCandidate(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "SELF", null, null, "UNREVIEWED", false, new BigDecimal("0.85"),
                "Platelet Count", "Platelet Count", "Platelet Count", "NUMERIC", new BigDecimal("250"),
                null, "10^3/uL", new BigDecimal("150"), new BigDecimal("450"), ResearchConsentStatus.CONSENTED
        );

        EligibilityCandidate unknownConsent = new EligibilityCandidate(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "SELF", null, null, "DOCTOR_VERIFIED", false, new BigDecimal("0.95"),
                "Vitamin D", "Vitamin D", "Vitamin D", "NUMERIC", new BigDecimal("32"),
                null, "ng/mL", new BigDecimal("30"), new BigDecimal("100"), ResearchConsentStatus.UNKNOWN
        );

        List<EligibilityCandidate> cohort = List.of(eligible, otherSubject, rawOcr, unknownConsent);

        CohortEligibilityReport report = eligibilityService.evaluateCohort(cohort);

        assertThat(report.totalExamined()).isEqualTo(4);
        assertThat(report.eligibleCount()).isEqualTo(1);
        assertThat(report.ineligibleCount()).isEqualTo(3);
        assertThat(report.eligibleObservationIds()).containsExactly(eligible.observationId());
        assertThat(report.exclusionBreakdown())
                .containsEntry(EligibilityIneligibilityReason.EXCLUDED_OTHER_SUBJECT, 1)
                .containsEntry(EligibilityIneligibilityReason.EXCLUDED_UNREVIEWED_RAW_OCR, 1)
                .containsEntry(EligibilityIneligibilityReason.EXCLUDED_UNKNOWN_CONSENT, 1);
    }
}
