package com.clinora.doctors.support;

import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Opt-in comparison helper for Phase 6D-R1..R3. It is intentionally not invoked
 * by the production routing path, so the new interpreter cannot add live latency yet.
 */
@Service
public class DoctorQueryShadowEvaluationService {
    private final DoctorQueryInterpreter interpreter;
    private final DoctorSupportPlanner planner;

    public DoctorQueryShadowEvaluationService(DoctorQueryInterpreter interpreter, DoctorSupportPlanner planner) {
        this.interpreter = interpreter;
        this.planner = planner;
    }

    public ShadowEvaluation evaluate(
        String doctorMessage,
        DoctorSupportContext context,
        DoctorSupportRoutingDecision productionDecision
    ) {
        DoctorQueryInterpreter.Interpretation interpretation = interpreter.interpret(doctorMessage, context);
        DoctorSupportPlanner.Plan candidate = planner.plan(interpretation.frame(), context);
        List<DoctorSupportTask> productionTasks = productionDecision.taskIds();
        boolean agreement = productionDecision.status() == candidate.status()
            && productionTasks.equals(candidate.taskIds());
        return new ShadowEvaluation(
            productionDecision.status(),
            productionTasks,
            candidate.status(),
            candidate.taskIds(),
            candidate.clarificationTaskIds(),
            candidate.clarificationReason(),
            candidate.missingRequiredContext(),
            interpretation.promptVersion(),
            interpretation.schemaVersion(),
            interpretation.finishReason(),
            interpretation.promptTokens(),
            interpretation.completionTokens(),
            interpretation.durationMs(),
            agreement
        );
    }

    /** Contains no raw Doctor message, Patient values, IDs, or model prose. */
    public record ShadowEvaluation(
        DoctorSupportRoutingStatus productionStatus,
        List<DoctorSupportTask> productionTasks,
        DoctorSupportRoutingStatus candidateStatus,
        List<DoctorSupportTask> candidateTasks,
        List<DoctorSupportTask> candidateClarificationTasks,
        DoctorSupportClarificationReason candidateClarificationReason,
        List<DoctorSupportRequiredContext> candidateMissingContext,
        String promptVersion,
        String schemaVersion,
        String finishReason,
        Integer promptTokens,
        Integer completionTokens,
        long interpretationDurationMs,
        boolean agreement
    ) {}
}
