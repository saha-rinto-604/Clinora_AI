package com.clinora.research.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "ai_evaluation_runs")
public class AIEvaluationRun {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "dataset_version_id", nullable = false)
    private UUID datasetVersionId;

    @Column(name = "model_id", nullable = false, length = 100)
    private String modelId;

    @Column(name = "model_version", nullable = false, length = 50)
    private String modelVersion;

    @Column(name = "prompt_version", nullable = false, length = 50)
    private String promptVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "task_type", nullable = false, length = 50)
    private EvaluationTaskType taskType;

    @Column(name = "ground_truth_definition", nullable = false, length = 255)
    private String groundTruthDefinition;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private EvaluationRunStatus status;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String configuration;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String metrics;

    @Column(name = "failure_reason", columnDefinition = "TEXT")
    private String failureReason;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AIEvaluationRun() {}

    public AIEvaluationRun(
            UUID id,
            UUID projectId,
            UUID datasetVersionId,
            String modelId,
            String modelVersion,
            String promptVersion,
            EvaluationTaskType taskType,
            String groundTruthDefinition,
            String configuration,
            UUID createdBy
    ) {
        this.id = Objects.requireNonNull(id, "Run ID required");
        this.projectId = Objects.requireNonNull(projectId, "Project ID required");
        this.datasetVersionId = Objects.requireNonNull(datasetVersionId, "Dataset version ID required");
        this.modelId = Objects.requireNonNull(modelId, "Model ID required");
        this.modelVersion = Objects.requireNonNull(modelVersion, "Model version required");
        this.promptVersion = Objects.requireNonNull(promptVersion, "Prompt version required");
        this.taskType = Objects.requireNonNull(taskType, "Task type required");
        this.groundTruthDefinition = Objects.requireNonNull(groundTruthDefinition, "Ground truth definition required");
        this.configuration = (configuration == null || configuration.isBlank()) ? "{}" : configuration;
        this.createdBy = Objects.requireNonNull(createdBy, "Created by required");
        this.status = EvaluationRunStatus.QUEUED;
        this.createdAt = Instant.now();
    }

    public void markRunning() {
        if (this.status != EvaluationRunStatus.QUEUED) {
            throw new IllegalStateException("Run can only transition to RUNNING from QUEUED, currently: " + this.status);
        }
        this.status = EvaluationRunStatus.RUNNING;
        this.startedAt = Instant.now();
    }

    public void markCompleted(String metricsJson) {
        if (this.status != EvaluationRunStatus.RUNNING) {
            throw new IllegalStateException("Run can only transition to COMPLETED from RUNNING, currently: " + this.status);
        }
        this.status = EvaluationRunStatus.COMPLETED;
        this.completedAt = Instant.now();
        this.metrics = metricsJson;
    }

    public void markFailed(String reason) {
        this.status = EvaluationRunStatus.FAILED;
        this.completedAt = Instant.now();
        this.failureReason = reason;
    }

    public void markCancelled() {
        if (this.status == EvaluationRunStatus.COMPLETED) {
            throw new IllegalStateException("Cannot cancel an already completed run");
        }
        this.status = EvaluationRunStatus.CANCELLED;
        this.completedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getDatasetVersionId() { return datasetVersionId; }
    public String getModelId() { return modelId; }
    public String getModelVersion() { return modelVersion; }
    public String getPromptVersion() { return promptVersion; }
    public EvaluationTaskType getTaskType() { return taskType; }
    public String getGroundTruthDefinition() { return groundTruthDefinition; }
    public EvaluationRunStatus getStatus() { return status; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public String getConfiguration() { return configuration; }
    public String getMetrics() { return metrics; }
    public String getFailureReason() { return failureReason; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
