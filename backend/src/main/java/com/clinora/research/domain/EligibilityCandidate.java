package com.clinora.research.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Encapsulates a candidate clinical observation and its provenance context
 * for eligibility evaluation.
 */
public record EligibilityCandidate(
        UUID observationId,
        UUID reportId,
        UUID patientUserId,
        String subjectType,           // "SELF" or "OTHER"
        String subjectLabel,          // Private label for OTHER, e.g. "Mother"
        Instant reportArchivedAt,     // null if active
        String verificationStatus,    // "UNREVIEWED", "PATIENT_CONFIRMED", "PATIENT_CORRECTED", "DOCTOR_VERIFIED"
        boolean reviewRequired,
        BigDecimal ocrConfidence,
        String sourceLabel,
        String normalizedLabel,
        String effectiveLabel,
        String effectiveValueType,    // "NUMERIC", "TEXT", "QUALITATIVE"
        BigDecimal effectiveNumericValue,
        String effectiveTextValue,
        String effectiveUnit,
        BigDecimal referenceLow,
        BigDecimal referenceHigh,
        ResearchConsentStatus consentStatus
) {
    public String bestLabel() {
        if (effectiveLabel != null && !effectiveLabel.isBlank()) return effectiveLabel.trim();
        if (normalizedLabel != null && !normalizedLabel.isBlank()) return normalizedLabel.trim();
        if (sourceLabel != null && !sourceLabel.isBlank()) return sourceLabel.trim();
        return "";
    }
}
