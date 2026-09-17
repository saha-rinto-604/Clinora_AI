package com.clinora.doctors.support;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class DoctorSupportTaskRegistry {
    private final Map<DoctorSupportTask, DoctorSupportTaskSpec> specs = new EnumMap<>(DoctorSupportTask.class);

    public DoctorSupportTaskRegistry() {
        register(new DoctorSupportTaskSpec(
            DoctorSupportTask.BRIEF_PATIENT,
            "Prepare a pre-visit or encounter briefing from authorized context.",
            "Use for requests to brief or prepare the Doctor for the current Patient encounter.",
            List.of("Brief me before this visit.", "Prepare a patient briefing."),
            Set.of(DoctorSupportRequiredContext.APPOINTMENT), false,
            "Brief this Patient", "Prepare an encounter briefing from the authorized care context.",
            false, null, null, DoctorSupportRagPolicy.DISABLED
        ));
        register(new DoctorSupportTaskSpec(
            DoctorSupportTask.CONNECT_EVIDENCE,
            "Explain relationships among selected or current clinical findings.",
            "Use when the Doctor asks how findings relate, matter together, or form a pattern.",
            List.of("How are these values related?", "Do MCV, MCH and RBC form a pattern?"),
            Set.of(DoctorSupportRequiredContext.AUTHORIZED_EVIDENCE), false,
            "Connect the findings", "Explain how the selected authorized findings relate.",
            true, "doctor_connect_evidence_v1", "doctor-support-connect-v1", DoctorSupportRagPolicy.DISABLED
        ));
        register(new DoctorSupportTaskSpec(
            DoctorSupportTask.COMPARE_EVIDENCE,
            "Compare authorized clinical evidence across reports or time.",
            "Use for change, persistence, prior-result, previous-report, or longitudinal comparison requests.",
            List.of("Compare this CBC with the previous one.", "Has the MCV stayed low?", "Was this pattern present before?"),
            Set.of(DoctorSupportRequiredContext.AUTHORIZED_EVIDENCE, DoctorSupportRequiredContext.COMPARABLE_REPORTS), false,
            "Compare with previous results", "Compare authorized evidence across reports or time.",
            true, "doctor_compare_evidence_v1", "doctor-support-compare-v1", DoctorSupportRagPolicy.DISABLED
        ));
        register(new DoctorSupportTaskSpec(
            DoctorSupportTask.CROSS_CHECK_ASSESSMENT,
            "Check a Doctor-authored assessment against authorized evidence.",
            "Use when the Doctor asks whether evidence supports or contradicts their assessment or impression.",
            List.of("Does my iron-deficiency assessment fit?", "Anything contradict my assessment?"),
            Set.of(DoctorSupportRequiredContext.AUTHORIZED_EVIDENCE, DoctorSupportRequiredContext.DOCTOR_ASSESSMENT), false,
            "Cross-check my assessment", "Check the Doctor-authored assessment against authorized evidence.",
            true, "doctor_cross_check_assessment_v1", "doctor-support-cross-check-v1", DoctorSupportRagPolicy.DISABLED
        ));
        register(new DoctorSupportTaskSpec(
            DoctorSupportTask.FIND_GAPS,
            "Identify relevant information absent from available authorized evidence.",
            "Use when the Doctor asks what is missing, unavailable, or would help distinguish possibilities.",
            List.of("What information am I missing?", "What else would help?"),
            Set.of(DoctorSupportRequiredContext.AUTHORIZED_EVIDENCE), false,
            "Find missing information", "Identify gaps in the currently available authorized evidence.",
            true, "doctor_find_gaps_v1", "doctor-support-gaps-v1", DoctorSupportRagPolicy.DISABLED
        ));
        register(new DoctorSupportTaskSpec(
            DoctorSupportTask.EXPLORE_EXPLANATIONS,
            "Explore non-ranked possible explanations for an evidence pattern.",
            "Use for non-ranked possibilities that could explain the current evidence pattern.",
            List.of("What could explain this pattern?", "Could this fit iron deficiency or thalassemia trait?"),
            Set.of(DoctorSupportRequiredContext.AUTHORIZED_EVIDENCE), false,
            "Explore possible explanations", "Explore non-ranked explanations for the authorized evidence pattern.",
            false, null, null, DoctorSupportRagPolicy.DISABLED
        ));
        register(new DoctorSupportTaskSpec(
            DoctorSupportTask.STRUCTURE_NOTES,
            "Structure Doctor-authored notes without adding facts.",
            "Use when the Doctor asks to organize or format their own notes.",
            List.of("Turn these notes into a structured consultation note."),
            Set.of(DoctorSupportRequiredContext.DOCTOR_NOTES), false,
            "Structure my notes", "Organize Doctor-authored notes without adding facts.",
            false, null, null, DoctorSupportRagPolicy.DISABLED
        ));
        register(new DoctorSupportTaskSpec(
            DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION,
            "Handle a focused question about authorized evidence not covered by a specialized task.",
            "Fallback only for a focused evidence question when no specialized task adequately represents it.",
            List.of("What does this authorized finding mean in this evidence set?"),
            Set.of(DoctorSupportRequiredContext.AUTHORIZED_EVIDENCE), false,
            "Ask about this evidence", "Handle a focused question about the current authorized evidence.",
            false, null, null, DoctorSupportRagPolicy.DISABLED
        ));
        if (specs.size() != DoctorSupportTask.values().length) {
            throw new IllegalStateException("Every Doctor support task must have exactly one registry entry.");
        }
    }

    private void register(DoctorSupportTaskSpec spec) {
        if (specs.put(spec.taskId(), spec) != null) {
            throw new IllegalStateException("Duplicate Doctor support task registration: " + spec.taskId());
        }
    }

    public DoctorSupportTaskSpec require(DoctorSupportTask task) {
        DoctorSupportTaskSpec spec = specs.get(task);
        if (spec == null) throw new IllegalArgumentException("Unknown Doctor support task.");
        return spec;
    }

    public List<DoctorSupportTaskSpec> all() {
        return Arrays.stream(DoctorSupportTask.values()).map(this::require).toList();
    }

    public List<DoctorSupportTask> ordered(List<DoctorSupportTask> tasks) {
        Set<DoctorSupportTask> selected = Set.copyOf(tasks);
        return Arrays.stream(DoctorSupportTask.values()).filter(selected::contains).toList();
    }
}
