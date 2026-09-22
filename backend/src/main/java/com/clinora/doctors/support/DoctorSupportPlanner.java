package com.clinora.doctors.support;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Converts a generalized Doctor semantic frame into the existing bounded Clinora task registry.
 * It never expands authorization and never invents a new clinical capability.
 */
@Component
public class DoctorSupportPlanner {
    private final DoctorSupportTaskRegistry registry;

    public DoctorSupportPlanner(DoctorSupportTaskRegistry registry) {
        this.registry = registry;
    }

    public Plan plan(DoctorClinicalQueryFrame frame, DoctorSupportContext context) {
        if (frame.frameStatus() == DoctorClinicalQueryFrame.FrameStatus.UNSUPPORTED) {
            return new Plan(DoctorSupportRoutingStatus.UNSUPPORTED, List.of(), List.of(), null, List.of());
        }

        List<DoctorSupportTask> mapped = mappedTasks(frame);
        if (frame.frameStatus() == DoctorClinicalQueryFrame.FrameStatus.CLARIFICATION_REQUIRED) {
            List<DoctorSupportTask> options = contextualOptions(mapped, context);
            return new Plan(
                DoctorSupportRoutingStatus.CLARIFICATION_REQUIRED,
                List.of(),
                options,
                DoctorSupportClarificationReason.AMBIGUOUS_INTENT,
                List.of()
            );
        }

        if (mapped.isEmpty()) {
            return new Plan(
                DoctorSupportRoutingStatus.CLARIFICATION_REQUIRED,
                List.of(),
                contextualOptions(List.of(), context),
                DoctorSupportClarificationReason.AMBIGUOUS_INTENT,
                List.of()
            );
        }

        Set<DoctorSupportRequiredContext> missing = EnumSet.noneOf(DoctorSupportRequiredContext.class);
        mapped.forEach(task -> registry.require(task).requiredContext().stream()
            .filter(required -> !has(required, context))
            .forEach(missing::add));
        if (!missing.isEmpty()) {
            return new Plan(
                DoctorSupportRoutingStatus.CLARIFICATION_REQUIRED,
                List.of(),
                mapped,
                DoctorSupportClarificationReason.MISSING_REQUIRED_CONTEXT,
                List.copyOf(missing)
            );
        }
        return new Plan(DoctorSupportRoutingStatus.ROUTED, mapped, List.of(), null, List.of());
    }

    private List<DoctorSupportTask> mappedTasks(DoctorClinicalQueryFrame frame) {
        Set<DoctorSupportTask> tasks = new LinkedHashSet<>();
        for (DoctorClinicalQueryFrame.InformationNeed need : frame.informationNeeds()) {
            switch (need) {
                case SUMMARIZE -> tasks.add(
                    frame.evidenceScope() == DoctorClinicalQueryFrame.EvidenceScope.APPOINTMENT_CONTEXT
                        ? DoctorSupportTask.BRIEF_PATIENT
                        : DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION
                );
                case INTERPRET_FINDING -> tasks.add(DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION);
                case RELATE_FINDINGS -> tasks.add(DoctorSupportTask.CONNECT_EVIDENCE);
                case EXPLAIN_POSSIBILITIES, DIFFERENTIATE -> tasks.add(DoctorSupportTask.EXPLORE_EXPLANATIONS);
                case COMPARE, TRACE_CHANGE -> tasks.add(DoctorSupportTask.COMPARE_EVIDENCE);
                case CHECK_ASSESSMENT, CHALLENGE_HYPOTHESIS -> tasks.add(DoctorSupportTask.CROSS_CHECK_ASSESSMENT);
                case IDENTIFY_GAPS -> tasks.add(DoctorSupportTask.FIND_GAPS);
                case ORGANIZE_NOTES -> tasks.add(DoctorSupportTask.STRUCTURE_NOTES);
            }
        }
        return registry.ordered(List.copyOf(tasks));
    }

    private List<DoctorSupportTask> contextualOptions(List<DoctorSupportTask> preferred, DoctorSupportContext context) {
        List<DoctorSupportTask> candidates = preferred.isEmpty()
            ? registry.all().stream().map(DoctorSupportTaskSpec::taskId).toList()
            : registry.ordered(preferred);
        List<DoctorSupportTask> available = new ArrayList<>();
        for (DoctorSupportTask task : candidates) {
            if (registry.require(task).requiredContext().stream().allMatch(required -> has(required, context))) {
                available.add(task);
            }
            if (available.size() == 4) break;
        }
        if (available.isEmpty()) available.add(DoctorSupportTask.BRIEF_PATIENT);
        return registry.ordered(available);
    }

    private boolean has(DoctorSupportRequiredContext required, DoctorSupportContext context) {
        return switch (required) {
            case APPOINTMENT -> true;
            case AUTHORIZED_EVIDENCE -> context.hasAuthorizedEvidence();
            case COMPARABLE_REPORTS -> context.comparableAuthorizedReportsAvailable();
            case DOCTOR_ASSESSMENT -> context.doctorAssessmentPresent();
            case DOCTOR_NOTES -> context.doctorNotesPresent();
        };
    }

    public record Plan(
        DoctorSupportRoutingStatus status,
        List<DoctorSupportTask> taskIds,
        List<DoctorSupportTask> clarificationTaskIds,
        DoctorSupportClarificationReason clarificationReason,
        List<DoctorSupportRequiredContext> missingRequiredContext
    ) {
        public Plan {
            taskIds = List.copyOf(taskIds == null ? List.of() : taskIds);
            clarificationTaskIds = List.copyOf(clarificationTaskIds == null ? List.of() : clarificationTaskIds);
            missingRequiredContext = List.copyOf(missingRequiredContext == null ? List.of() : missingRequiredContext);
        }
    }
}
