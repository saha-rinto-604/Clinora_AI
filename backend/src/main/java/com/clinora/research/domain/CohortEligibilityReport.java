package com.clinora.research.domain;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Summary report of an eligibility evaluation across an entire candidate cohort.
 */
public record CohortEligibilityReport(
        int totalExamined,
        int eligibleCount,
        int ineligibleCount,
        Map<EligibilityIneligibilityReason, Integer> exclusionBreakdown,
        List<UUID> eligibleObservationIds,
        List<EligibilityDecision> decisions
) {
    public static CohortEligibilityReport fromDecisions(List<EligibilityDecision> decisions) {
        if (decisions == null || decisions.isEmpty()) {
            return new CohortEligibilityReport(0, 0, 0, Collections.emptyMap(), Collections.emptyList(), Collections.emptyList());
        }

        int eligible = 0;
        int ineligible = 0;
        List<UUID> eligibleIds = new java.util.ArrayList<>();
        Map<EligibilityIneligibilityReason, Integer> breakdown = new java.util.EnumMap<>(EligibilityIneligibilityReason.class);

        for (EligibilityDecision d : decisions) {
            if (d.isEligible()) {
                eligible++;
                eligibleIds.add(d.observationId());
            } else {
                ineligible++;
                for (EligibilityIneligibilityReason r : d.reasons()) {
                    breakdown.merge(r, 1, Integer::sum);
                }
            }
        }

        return new CohortEligibilityReport(
                decisions.size(),
                eligible,
                ineligible,
                Collections.unmodifiableMap(breakdown),
                Collections.unmodifiableList(eligibleIds),
                Collections.unmodifiableList(decisions)
        );
    }
}
