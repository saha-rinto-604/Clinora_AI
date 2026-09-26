package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Represents a collaboration invitation from a project owner to another approved Researcher.
 *
 * <p>Invitation lifecycle:
 * PENDING → ACCEPTED (member created), DECLINED, REVOKED (by owner), EXPIRED (TTL passed)
 *
 * <p>PROJECT MEMBERSHIP ≠ DATASET ACCESS.
 * Accepting an invitation grants project access only. Clinical dataset downloads require a
 * separate explicit DatasetAccessGrant.
 */
@Entity
@Table(name = "research_project_invitations")
public class ResearchProjectInvitation {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "invitee_user_id", nullable = false)
    private UUID inviteeUserId;

    @Column(name = "invited_by", nullable = false)
    private UUID invitedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "proposed_role", nullable = false, length = 32)
    private ProjectMemberRole proposedRole;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private InvitationStatus status;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "invited_at", nullable = false, updatable = false)
    private Instant invitedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ResearchProjectInvitation() {}

    public ResearchProjectInvitation(
            UUID id,
            UUID projectId,
            UUID inviteeUserId,
            UUID invitedBy,
            ProjectMemberRole proposedRole,
            String message,
            Instant expiresAt
    ) {
        this.id = Objects.requireNonNull(id, "Invitation ID required");
        this.projectId = Objects.requireNonNull(projectId, "Project ID required");
        this.inviteeUserId = Objects.requireNonNull(inviteeUserId, "Invitee user ID required");
        this.invitedBy = Objects.requireNonNull(invitedBy, "InvitedBy required");
        this.proposedRole = Objects.requireNonNull(proposedRole, "Proposed role required");
        this.message = message;
        this.expiresAt = Objects.requireNonNull(expiresAt, "ExpiresAt required");
        this.status = InvitationStatus.PENDING;
        Instant now = Instant.now();
        this.invitedAt = now;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void accept() {
        requirePending();
        this.status = InvitationStatus.ACCEPTED;
        Instant now = Instant.now();
        this.respondedAt = now;
        this.updatedAt = now;
    }

    public void decline() {
        requirePending();
        this.status = InvitationStatus.DECLINED;
        Instant now = Instant.now();
        this.respondedAt = now;
        this.updatedAt = now;
    }

    public void revoke() {
        if (this.status != InvitationStatus.PENDING) {
            throw new IllegalStateException("Only PENDING invitations can be revoked. Current: " + status);
        }
        Instant now = Instant.now();
        this.status = InvitationStatus.REVOKED;
        this.revokedAt = now;
        this.updatedAt = now;
    }

    public void expire() {
        if (this.status == InvitationStatus.PENDING) {
            this.status = InvitationStatus.EXPIRED;
            this.updatedAt = Instant.now();
        }
    }

    public boolean isExpiredByTime() {
        return status == InvitationStatus.PENDING && Instant.now().isAfter(expiresAt);
    }

    private void requirePending() {
        if (status == InvitationStatus.EXPIRED || isExpiredByTime()) {
            throw new IllegalStateException("Invitation has expired");
        }
        if (status != InvitationStatus.PENDING) {
            throw new IllegalStateException("Invitation is not pending. Current: " + status);
        }
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getInviteeUserId() { return inviteeUserId; }
    public UUID getInvitedBy() { return invitedBy; }
    public ProjectMemberRole getProposedRole() { return proposedRole; }
    public InvitationStatus getStatus() { return status; }
    public String getMessage() { return message; }
    public Instant getInvitedAt() { return invitedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRespondedAt() { return respondedAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
