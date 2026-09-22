package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "dataset_access_grants")
public class DatasetAccessGrant {

    @Id
    private UUID id;

    @Column(name = "dataset_id", nullable = false)
    private UUID datasetId;

    @Column(name = "researcher_user_id", nullable = false)
    private UUID researcherUserId;

    @Column(name = "granted_by", nullable = false)
    private UUID grantedBy;

    @Column(name = "granted_at", nullable = false, updatable = false)
    private Instant grantedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected DatasetAccessGrant() {}

    public DatasetAccessGrant(UUID id, UUID datasetId, UUID researcherUserId, UUID grantedBy, Instant grantedAt, Instant expiresAt) {
        this.id = Objects.requireNonNull(id, "Grant ID required");
        this.datasetId = Objects.requireNonNull(datasetId, "Dataset ID required");
        this.researcherUserId = Objects.requireNonNull(researcherUserId, "Researcher user ID required");
        this.grantedBy = Objects.requireNonNull(grantedBy, "GrantedBy required");
        this.grantedAt = Objects.requireNonNull(grantedAt, "GrantedAt required");
        this.expiresAt = expiresAt;
    }

    public UUID getId() { return id; }
    public UUID getDatasetId() { return datasetId; }
    public UUID getResearcherUserId() { return researcherUserId; }
    public UUID getGrantedBy() { return grantedBy; }
    public Instant getGrantedAt() { return grantedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }

    public boolean isActive() {
        return revokedAt == null && (expiresAt == null || Instant.now().isBefore(expiresAt));
    }

    public void revoke(Instant revokedAt) {
        this.revokedAt = revokedAt != null ? revokedAt : Instant.now();
    }
}
