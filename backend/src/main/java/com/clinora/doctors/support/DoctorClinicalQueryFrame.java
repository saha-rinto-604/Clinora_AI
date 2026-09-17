package com.clinora.doctors.support;

import java.util.List;
import java.util.Objects;

/**
 * Semantic representation of what the Doctor is asking Clinora to do.
 * This is Doctor-authored/query context, never Patient evidence or a diagnosis.
 */
public record DoctorClinicalQueryFrame(
    FrameStatus frameStatus,
    List<InformationNeed> informationNeeds,
    List<ClinicalFocus> clinicalFocus,
    List<DoctorAssertion> doctorAssertions,
    RelationshipMode relationshipMode,
    TemporalIntent temporalIntent,
    EvidenceScope evidenceScope,
    List<DiscourseReferent> referents,
    List<QueryAmbiguity> ambiguities
) {
    public DoctorClinicalQueryFrame {
        Objects.requireNonNull(frameStatus, "frameStatus");
        informationNeeds = immutableUnique(informationNeeds, "informationNeeds");
        clinicalFocus = List.copyOf(clinicalFocus == null ? List.of() : clinicalFocus);
        doctorAssertions = List.copyOf(doctorAssertions == null ? List.of() : doctorAssertions);
        relationshipMode = relationshipMode == null ? RelationshipMode.NONE : relationshipMode;
        temporalIntent = temporalIntent == null ? TemporalIntent.NONE : temporalIntent;
        evidenceScope = evidenceScope == null ? EvidenceScope.UNSPECIFIED : evidenceScope;
        referents = immutableUnique(referents, "referents");
        ambiguities = immutableUnique(ambiguities, "ambiguities");

        if (frameStatus == FrameStatus.INTERPRETED && informationNeeds.isEmpty()) {
            throw new IllegalArgumentException("INTERPRETED requires at least one information need.");
        }
        if (frameStatus == FrameStatus.INTERPRETED && !ambiguities.isEmpty()) {
            throw new IllegalArgumentException("INTERPRETED cannot contain unresolved ambiguities.");
        }
        if (frameStatus == FrameStatus.CLARIFICATION_REQUIRED && ambiguities.isEmpty()) {
            throw new IllegalArgumentException("CLARIFICATION_REQUIRED requires an ambiguity.");
        }
        if (frameStatus == FrameStatus.UNSUPPORTED && !informationNeeds.isEmpty()) {
            throw new IllegalArgumentException("UNSUPPORTED cannot contain information needs.");
        }
    }

    private static <T> List<T> immutableUnique(List<T> values, String name) {
        List<T> copy = List.copyOf(values == null ? List.of() : values);
        if (copy.stream().distinct().count() != copy.size()) {
            throw new IllegalArgumentException(name + " contains duplicates.");
        }
        return copy;
    }

    public record ClinicalFocus(String text, String normalizedConcept, ConceptType conceptType) {
        public ClinicalFocus {
            if (text == null || text.isBlank()) throw new IllegalArgumentException("Clinical focus text is required.");
            Objects.requireNonNull(conceptType, "conceptType");
        }
    }

    public record DoctorAssertion(String concept, DoctorStance stance) {
        public DoctorAssertion {
            if (concept == null || concept.isBlank()) throw new IllegalArgumentException("Assertion concept is required.");
            Objects.requireNonNull(stance, "stance");
        }
    }

    public enum FrameStatus {
        INTERPRETED,
        CLARIFICATION_REQUIRED,
        UNSUPPORTED
    }

    public enum InformationNeed {
        SUMMARIZE,
        INTERPRET_FINDING,
        RELATE_FINDINGS,
        EXPLAIN_POSSIBILITIES,
        COMPARE,
        TRACE_CHANGE,
        CHECK_ASSESSMENT,
        CHALLENGE_HYPOTHESIS,
        DIFFERENTIATE,
        IDENTIFY_GAPS,
        ORGANIZE_NOTES
    }

    public enum ConceptType {
        LAB_OBSERVATION,
        CLINICAL_FINDING,
        CONDITION_OR_HYPOTHESIS,
        SYMPTOM_OR_HISTORY,
        REPORT_OR_PANEL,
        OTHER
    }

    public enum DoctorStance {
        AFFIRMED,
        SUSPECTED,
        QUESTIONED,
        DOUBTFUL,
        NEGATED,
        RULE_OUT,
        DIFFERENTIAL_CONSIDERATION,
        HISTORICAL,
        UNKNOWN
    }

    public enum RelationshipMode {
        NONE,
        SINGLE_FINDING,
        MULTI_FINDING_PATTERN,
        DISCORDANT_FINDINGS,
        TEMPORAL_PATTERN,
        PERSISTENT_PATTERN,
        HYPOTHESIS_EVIDENCE_FIT,
        COMPETING_EXPLANATIONS
    }

    public enum TemporalIntent {
        NONE,
        CURRENT,
        PREVIOUS,
        BASELINE,
        LONGITUDINAL,
        PERSISTENCE,
        CHANGE,
        UNKNOWN
    }

    public enum EvidenceScope {
        CURRENT_REPORT,
        SELECTED_OBSERVATIONS,
        COMPARABLE_REPORTS,
        APPOINTMENT_CONTEXT,
        DOCTOR_NOTES,
        UNSPECIFIED
    }

    public enum DiscourseReferent {
        CURRENT_REPORT,
        SELECTED_EVIDENCE,
        PREVIOUS_COMPARABLE_EVIDENCE,
        DOCTOR_ASSESSMENT,
        DOCTOR_NOTES,
        ACTIVE_PATTERN,
        UNSPECIFIED
    }

    public enum QueryAmbiguity {
        UNRESOLVED_REFERENT,
        MISSING_CONTEXT,
        MULTIPLE_PLAUSIBLE_NEEDS,
        AMBIGUOUS_ABBREVIATION,
        AMBIGUOUS_SCOPE
    }
}
