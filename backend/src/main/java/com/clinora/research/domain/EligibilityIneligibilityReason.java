package com.clinora.research.domain;

/**
 * Specific audit-grade reasons why a clinical observation is ineligible
 * for participation in a research dataset.
 */
public enum EligibilityIneligibilityReason {
    /**
     * Report was uploaded for another subject ('OTHER', e.g. Mother, child).
     * Must remain isolated from the account holder's clinical history and research contributions.
     */
    EXCLUDED_OTHER_SUBJECT,

    /**
     * Source medical report has been archived or soft-deleted.
     */
    EXCLUDED_ARCHIVED_REPORT,

    /**
     * Observation is raw OCR extraction without patient confirmation or clinician verification.
     */
    EXCLUDED_UNREVIEWED_RAW_OCR,

    /**
     * Observation was flagged by OCR / AI pipeline as requiring human review.
     */
    EXCLUDED_REVIEW_REQUIRED,

    /**
     * Unfinalized consent policy on file. Safe backend default: UNKNOWN ELIGIBILITY = NOT EXPORTABLE.
     */
    EXCLUDED_UNKNOWN_CONSENT,

    /**
     * Patient has explicitly withheld or revoked consent for research data usage.
     */
    EXCLUDED_CONSENT_WITHHELD,

    /**
     * Extracted item is administrative metadata (e.g. barcode, accession number, address, invoice).
     */
    EXCLUDED_ADMINISTRATIVE_METADATA,

    /**
     * Extracted item is a report section header or column label (e.g. 'Test Name', 'Normal Range').
     */
    EXCLUDED_NON_CLINICAL_LABEL,

    /**
     * Observation does not contain a valid clinical measurement value.
     */
    EXCLUDED_MISSING_VALUE,

    /**
     * Reference range bounds are contradictory or inverted (low > high).
     */
    EXCLUDED_INVALID_REFERENCE_RANGE,

    /**
     * Observation label is missing or blank.
     */
    EXCLUDED_LABEL_MISSING
}
