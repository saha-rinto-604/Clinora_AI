package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(
        name = "research_project_members",
        uniqueConstraints = @UniqueConstraint(name = "uq_project_member_user", columnNames = {"project_id", "user_id"})
)
public class ResearchProjectMember {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ProjectMemberRole role;

    @Column(name = "added_by", nullable = false)
    private UUID addedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ResearchProjectMember() {}

    public ResearchProjectMember(
            UUID id,
            UUID projectId,
            UUID userId,
            ProjectMemberRole role,
            UUID addedBy
    ) {
        this.id = Objects.requireNonNull(id, "Member ID required");
        this.projectId = Objects.requireNonNull(projectId, "Project ID required");
        this.userId = Objects.requireNonNull(userId, "User ID required");
        this.role = Objects.requireNonNull(role, "Member role required");
        this.addedBy = Objects.requireNonNull(addedBy, "Added by required");
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void updateRole(ProjectMemberRole newRole) {
        this.role = Objects.requireNonNull(newRole, "New role required");
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getUserId() { return userId; }
    public ProjectMemberRole getRole() { return role; }
    public UUID getAddedBy() { return addedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
