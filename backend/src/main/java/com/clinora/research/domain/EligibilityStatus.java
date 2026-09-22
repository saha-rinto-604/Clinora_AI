package com.clinora.research.domain;

/**
 * Outcome status of a research data eligibility evaluation.
 */
public enum EligibilityStatus {
    /**
     * Observation satisfies all subject boundaries, clinical verification,
     * hygiene, and informed consent requirements.
     */
    ELIGIBLE,

    /**
     * Observation is legally, clinically, or governance-wise excluded from the dataset.
     */
    INELIGIBLE
}
