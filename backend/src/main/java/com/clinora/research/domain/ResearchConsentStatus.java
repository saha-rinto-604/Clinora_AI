package com.clinora.research.domain;

/**
 * Patient consent state for research data utilization.
 * Clinora follows a strict fail-closed policy: UNKNOWN consent means
 * the observation is NOT exportable.
 */
public enum ResearchConsentStatus {
    /**
     * Patient has provided explicit, legally valid informed consent for research usage.
     */
    CONSENTED,

    /**
     * Patient has explicitly declined or opted out of research data usage.
     */
    WITHHELD,

    /**
     * Patient previously consented but has since revoked research authorization.
     */
    REVOKED,

    /**
     * No finalized research consent or data-use policy is recorded on file.
     * In accordance with governance rules: UNKNOWN ELIGIBILITY = NOT EXPORTABLE.
     */
    UNKNOWN
}
