package com.clinora.research.api;

import com.clinora.research.domain.EvaluationRunStatus;
import com.clinora.research.domain.EvaluationTaskType;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class AIEvaluationModels {

    private AIEvaluationModels() {}

    public record CreateEvaluationRunRequest(
            @NotNull UUID datasetVersionId,
            @NotBlank String modelId,
            @NotBlank String modelVersion,
            @NotBlank String promptVersion,
            @NotNull EvaluationTaskType taskType,
            @NotBlank String groundTruthDefinition,
            Map<String, Object> configuration
    ) {}

    public record ConfusionMatrix(
            long truePositives,
            long falsePositives,
            long trueNegatives,
            long falseNegatives
    ) {}

    public record EvaluationMetrics(
            double accuracy,
            double precision,
            double recall,
            double f1,
            @JsonProperty("balancedAccuracy")
            @JsonAlias({"rocAuc", "balancedAccuracy"})
            double balancedAccuracy,
            ConfusionMatrix confusionMatrix,
            double falsePositiveRate,
            double falseNegativeRate,
            long sampleCount
    ) {
        public double rocAuc() {
            return balancedAccuracy;
        }
    }

    public record AIEvaluationRunResponse(
            UUID id,
            UUID projectId,
            UUID datasetVersionId,
            String modelId,
            String modelVersion,
            String promptVersion,
            EvaluationTaskType taskType,
            String groundTruthDefinition,
            EvaluationRunStatus status,
            Instant startedAt,
            Instant completedAt,
            String configuration,
            EvaluationMetrics metrics,
            String failureReason,
            UUID createdBy,
            Instant createdAt
    ) {}
}
