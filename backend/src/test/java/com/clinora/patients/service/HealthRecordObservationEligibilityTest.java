package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class HealthRecordObservationEligibilityTest {

    @Test
    void addressAndTrackingMetadataNeverEnterHealthRecord() {
        assertFalse(decision("secretariat Road, shahbagh, Dhaka", "TEXT", null, "Dhaka", null, false).eligible());
        assertFalse(decision("Track", "TEXT", null, "ABCD-1234", null, false).eligible());
        assertFalse(decision("Collection Date", "TEXT", null, "12/09/2026", null, false).eligible());
    }

    @Test
    void malformedValueContainingDemographicRangeIsRejected() {
        assertFalse(decision("TC of RBC", "TEXT", null, "6.11 Female:3.8-4.8 mil/cmm", "6.11 Female:3.8-4.8 mil/cmm", false).eligible());
    }

    @Test
    void reviewRequiredObservationIsExcluded() {
        assertFalse(decision("Hemoglobin", "NUMERIC", new BigDecimal("13.8"), null, "13.8", true).eligible());
    }

    @Test
    void validNumericKnownAndUnknownClinicalResultsCanRemainEligible() {
        assertTrue(decision("Hemoglobin", "NUMERIC", new BigDecimal("13.8"), null, "13.8", false).eligible());
        assertTrue(decision("Novel Enzyme Marker", "NUMERIC", new BigDecimal("4.2"), null, "4.2", false).eligible());
    }

    private HealthRecordObservationEligibility.Decision decision(
        String label,
        String valueType,
        BigDecimal numeric,
        String text,
        String raw,
        boolean reviewRequired
    ) {
        HealthRecordLabTaxonomy.Concept concept = HealthRecordLabTaxonomy.resolve(label, label);
        return HealthRecordObservationEligibility.evaluate(
            new HealthRecordObservationEligibility.Candidate(
                label, label, label, valueType, numeric, text, raw, null, null, reviewRequired
            ),
            concept
        );
    }
}
