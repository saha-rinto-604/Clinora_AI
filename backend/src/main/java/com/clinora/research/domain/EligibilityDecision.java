package com.clinora.research.domain;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Result of evaluating a candidate observation against the research eligibility policy.
 */
public record EligibilityDecision(
        UUID observationId,
        EligibilityStatus status,
        List<EligibilityIneligibilityReason> reasons,
        String explanation
) {
    public boolean isEligible() {
        return status == EligibilityStatus.ELIGIBLE;
    }

    public static EligibilityDecision allow(UUID observationId) {
        return new EligibilityDecision(
                observationId,
                EligibilityStatus.ELIGIBLE,
                Collections.emptyList(),
                "Observation satisfies all subject boundaries, verification, hygiene, and research consent criteria."
        );
    }

    public static EligibilityDecision reject(
            UUID observationId,
            EligibilityIneligibilityReason reason,
            String explanation
    ) {
        return new EligibilityDecision(
                observationId,
                EligibilityStatus.INELIGIBLE,
                List.of(reason),
                explanation
        );
    }

    public static EligibilityDecision rejectMultiple(
            UUID observationId,
            List<EligibilityIneligibilityReason> reasons,
            String explanation
    ) {
        return new EligibilityDecision(
                observationId,
                EligibilityStatus.INELIGIBLE,
                reasons,
                explanation
        );
    }
}
