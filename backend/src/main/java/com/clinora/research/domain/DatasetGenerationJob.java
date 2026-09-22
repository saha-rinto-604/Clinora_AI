package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "dataset_generation_jobs")
public class DatasetGenerationJob {

    @Id
    private UUID id;

    @Column(name = "dataset_request_id", nullable = false)
    private UUID datasetRequestId;

    @Column(nullable = false, length = 32)
    private String status; // PENDING, PROCESSING, SUCCEEDED, FAILED

    @Column(name = "failure_reason", length = 1000)
    private String failureReason;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected DatasetGenerationJob() {}

    public DatasetGenerationJob(UUID id, UUID datasetRequestId, Instant createdAt) {
        this.id = Objects.requireNonNull(id, "Job ID required");
        this.datasetRequestId = Objects.requireNonNull(datasetRequestId, "Request ID required");
        this.status = "PENDING";
        this.createdAt = Objects.requireNonNull(createdAt, "CreatedAt required");
        this.updatedAt = this.createdAt;
    }

    public UUID getId() { return id; }
    public UUID getDatasetRequestId() { return datasetRequestId; }
    public String getStatus() { return status; }
    public String getFailureReason() { return failureReason; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void markProcessing(Instant startedAt) {
        this.status = "PROCESSING";
        this.startedAt = startedAt != null ? startedAt : Instant.now();
        this.updatedAt = this.startedAt;
    }

    public void markSucceeded(Instant completedAt) {
        this.status = "SUCCEEDED";
        this.completedAt = completedAt != null ? completedAt : Instant.now();
        this.updatedAt = this.completedAt;
    }

    public void markFailed(String reason, Instant failedAt) {
        this.status = "FAILED";
        this.failureReason = reason != null && reason.length() > 1000 ? reason.substring(0, 1000) : reason;
        this.completedAt = failedAt != null ? failedAt : Instant.now();
        this.updatedAt = this.completedAt;
    }
}
