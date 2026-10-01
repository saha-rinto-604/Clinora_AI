package com.clinora.research.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Architectural Policy Guardrail for Phase R12: Disease Analytics.
 *
 * <p>CLINICAL BOUNDARY RULE:
 * AI-suggested conditions (e.g., from MedGemma or automated report analysis) are strictly
 * ADVISORY and remain under physician review per SRS governance.
 *
 * <p>They must NEVER be equated with confirmed clinical diagnoses, and disease prevalence
 * (e.g., "Diabetes prevalence = 28%") must NEVER be computed from advisory AI outputs.
 *
 * <p>Disease analytics is deferred until an authoritative clinical diagnosis / physician-confirmed
 * outcome source is integrated into the clinical data store.
 */
@Component
public class DiseaseAnalyticsPolicy {

    private static final Logger log = LoggerFactory.getLogger(DiseaseAnalyticsPolicy.class);

    public enum DiagnosisSourceType {
        PHYSICIAN_CONFIRMED,
        DISCHARGE_SUMMARY_ICD10,
        HISTOPATHOLOGY_VERIFIED,
        AI_SUGGESTED_ADVISORY
    }

    /**
     * Asserts whether a given diagnosis source is legally and medically authoritative for
     * epidemiological research or disease prevalence calculations.
     *
     * @param sourceType the source of the diagnosis
     * @throws IllegalStateException if an advisory AI suggestion is used for disease prevalence
     */
    public void validateDiagnosisSourceForPrevalence(DiagnosisSourceType sourceType) {
        if (sourceType == DiagnosisSourceType.AI_SUGGESTED_ADVISORY) {
            log.warn("Security/Clinical violation: Attempted to compute disease prevalence from AI advisory suggestions");
            throw new IllegalStateException(
                    "Phase R12 Guardrail: AI suggestions are advisory and cannot be used for disease prevalence or cohort diagnosis analytics. " +
                    "An authoritative physician-confirmed diagnosis is required."
            );
        }
    }

    /**
     * Checks if disease prevalence analytics is currently permitted.
     * Always returns false until an authoritative clinical diagnosis pipeline is operational.
     */
    public boolean isDiseasePrevalenceEnabled() {
        return false;
    }
}
