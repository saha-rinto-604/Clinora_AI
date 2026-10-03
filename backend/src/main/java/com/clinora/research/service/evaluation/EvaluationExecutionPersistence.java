package com.clinora.research.service.evaluation;

import com.clinora.audit.*;
import com.clinora.research.domain.*;
import com.clinora.research.repository.*;
import com.clinora.research.service.ResearchAccessGuard;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Short transactions make RUNNING visible and save failures independently of inference. */
@Service
public class EvaluationExecutionPersistence {
    private final AIEvaluationRunRepository runs;
    private final AIEvaluationResultRepository results;
    private final AbnormalityDetectionMetricsCalculator calculator;
    private final ObjectMapper mapper;
    private final AuthAuditService audit;
    private final ResearchAccessGuard access;
    private final DatasetVersionRepository versions;

    public EvaluationExecutionPersistence(AIEvaluationRunRepository runs, AIEvaluationResultRepository results,
            AbnormalityDetectionMetricsCalculator calculator, ObjectMapper mapper, AuthAuditService audit,
            ResearchAccessGuard access, DatasetVersionRepository versions) {
        this.runs = runs; this.results = results; this.calculator = calculator; this.mapper = mapper;
        this.audit = audit; this.access = access; this.versions = versions;
    }

    @Transactional
    public AIEvaluationRun start(AIEvaluationRun run, UUID user) {
        run.markRunning();
        AIEvaluationRun saved = runs.saveAndFlush(run); // optimistic revision prevents concurrent execution
        record(saved, user, AuthAuditAction.AI_EVALUATION_STARTED, AuthAuditOutcome.SUCCESS);
        return saved;
    }

    @Transactional(rollbackFor = Exception.class)
    public AIEvaluationRun complete(AIEvaluationRun run, List<AIEvaluationResult> pairs,
            Map<String, Object> provenance, UUID user) throws Exception {
        // Access may have expired or been revoked while inference was running.
        access.dataset(versions.findById(run.getDatasetVersionId()).orElseThrow().getDatasetId(), user);
        results.saveAllAndFlush(pairs);
        List<AIEvaluationResult> persisted = results.findByEvaluationRunId(run.getId());
        if (persisted.size() != pairs.size() || pairs.isEmpty()) throw new IllegalStateException("Incomplete results");
        long tp = 0, tn = 0, fp = 0, fn = 0;
        for (var pair : persisted) {
            boolean truth = "ABNORMAL".equals(pair.getGroundTruth());
            boolean prediction = "ABNORMAL".equals(pair.getPrediction());
            if (truth && prediction) tp++;
            else if (!truth && !prediction) tn++;
            else if (!truth) fp++;
            else fn++;
        }
        run.setConfiguration(mapper.writeValueAsString(provenance));
        run.markCompleted(mapper.writeValueAsString(calculator.calculate(tp, fp, tn, fn)));
        AIEvaluationRun saved = runs.saveAndFlush(run);
        record(saved, user, AuthAuditAction.AI_EVALUATION_COMPLETED, AuthAuditOutcome.SUCCESS);
        return saved;
    }

    @Transactional
    public AIEvaluationRun fail(UUID runId, String reason, UUID user) {
        AIEvaluationRun run = runs.findById(runId).orElseThrow();
        if (run.getStatus() != EvaluationRunStatus.RUNNING) return run;
        run.markFailed(reason);
        AIEvaluationRun saved = runs.saveAndFlush(run);
        record(saved, user, AuthAuditAction.AI_EVALUATION_FAILED, AuthAuditOutcome.FAILURE);
        return saved;
    }

    private void record(AIEvaluationRun run, UUID user, AuthAuditAction action, AuthAuditOutcome outcome) {
        audit.record(user, action, outcome, "api", "workspace", run.getId().toString(),
            "datasetVersion=" + run.getDatasetVersionId());
    }
}
