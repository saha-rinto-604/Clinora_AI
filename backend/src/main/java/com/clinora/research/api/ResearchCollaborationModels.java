package com.clinora.research.api;

import com.clinora.research.domain.ProjectMemberRole;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public final class ResearchCollaborationModels {

    private ResearchCollaborationModels() {}

    public record AddMemberRequest(
            @NotNull UUID userId,
            @NotNull ProjectMemberRole role
    ) {}

    public record UpdateMemberRoleRequest(
            @NotNull ProjectMemberRole role
    ) {}

    public record ProjectMemberResponse(
            UUID id,
            UUID projectId,
            UUID userId,
            String userEmail,
            String userDisplayName,
            ProjectMemberRole role,
            UUID addedBy,
            Instant createdAt,
            Instant updatedAt
    ) {}
}
