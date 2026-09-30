package com.clinora.research.api;

import com.clinora.research.domain.InvitationStatus;
import com.clinora.research.domain.ProjectMemberRole;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class ResearchCollaborationModels {

    private ResearchCollaborationModels() {}

    // ─── Researcher Directory ────────────────────────────────────────────────

    /** Safe professional profile returned by the researcher search endpoint. Never exposes login email. */
    public record ResearcherDirectoryEntry(
            UUID userId,
            String displayName,
            String initials
    ) {}

    // ─── Invitations ─────────────────────────────────────────────────────────

    public record SendInvitationRequest(
            @NotNull UUID inviteeUserId,
            @NotNull ProjectMemberRole proposedRole,
            @Size(max = 500) String message
    ) {}

    public record InvitationResponse(
            UUID id,
            UUID projectId,
            String projectTitle,
            UUID inviteeUserId,
            String inviteeDisplayName,
            UUID invitedBy,
            String invitedByDisplayName,
            ProjectMemberRole proposedRole,
            InvitationStatus status,
            String message,
            Instant invitedAt,
            Instant expiresAt,
            Instant respondedAt
    ) {}

    // ─── Members ─────────────────────────────────────────────────────────────

    /** @deprecated Use invitation flow. Kept for internal owner-self-add at project creation. */
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
            String userDisplayName,
            ProjectMemberRole role,
            UUID addedBy,
            Instant joinedAt,
            Instant updatedAt
    ) {}
}

