package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "ai_evaluation_results")
public class AIEvaluationResult {

    @Id
    private UUID id;

    @Column(name = "evaluation_run_id", nullable = false)
    private UUID evaluationRunId;

    @Column(name = "sample_key", nullable = false, length = 100)
    private String sampleKey;

    @Column(name = "variable_code", nullable = false, length = 100)
    private String variableCode;

    @Column(name = "ground_truth", nullable = false, length = 50)
    private String groundTruth;

    @Column(name = "prediction", nullable = false, length = 50)
    private String prediction;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AIEvaluationResult() {}

    public AIEvaluationResult(
            UUID id,
            UUID evaluationRunId,
            String sampleKey,
            String variableCode,
            String groundTruth,
            String prediction
    ) {
        this.id = Objects.requireNonNull(id, "ID required");
        this.evaluationRunId = Objects.requireNonNull(evaluationRunId, "EvaluationRunId required");
        this.sampleKey = Objects.requireNonNull(sampleKey, "SampleKey required");
        this.variableCode = Objects.requireNonNull(variableCode, "VariableCode required");
        this.groundTruth = Objects.requireNonNull(groundTruth, "GroundTruth required");
        this.prediction = Objects.requireNonNull(prediction, "Prediction required");
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getEvaluationRunId() { return evaluationRunId; }
    public String getSampleKey() { return sampleKey; }
    public String getVariableCode() { return variableCode; }
    public String getGroundTruth() { return groundTruth; }
    public String getPrediction() { return prediction; }
    public Instant getCreatedAt() { return createdAt; }
}
