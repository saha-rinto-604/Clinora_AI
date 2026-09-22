package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "research_datasets")
public class ResearchDataset {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "dataset_request_id", nullable = false)
    private UUID datasetRequestId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 32)
    private String status; // ACTIVE, REVOKED, EXPIRED

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected ResearchDataset() {}

    public ResearchDataset(UUID id, UUID projectId, UUID datasetRequestId, String name, Instant createdAt, Instant expiresAt) {
        this.id = Objects.requireNonNull(id, "Dataset ID required");
        this.projectId = Objects.requireNonNull(projectId, "Project ID required");
        this.datasetRequestId = Objects.requireNonNull(datasetRequestId, "Dataset Request ID required");
        this.name = Objects.requireNonNull(name, "Name required");
        this.status = "ACTIVE";
        this.createdAt = Objects.requireNonNull(createdAt, "CreatedAt required");
        this.expiresAt = expiresAt;
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getDatasetRequestId() { return datasetRequestId; }
    public String getName() { return name; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public long getVersion() { return version; }

    public boolean isActive() {
        return "ACTIVE".equalsIgnoreCase(status) && (expiresAt == null || Instant.now().isBefore(expiresAt));
    }

    public void revoke(Instant revokedAt) {
        this.status = "REVOKED";
        this.revokedAt = revokedAt != null ? revokedAt : Instant.now();
    }
}
