package com.clinora.research.api;

import com.clinora.research.domain.ResearchNoteStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class ResearchWorkspaceModels {

    private ResearchWorkspaceModels() {}

    // ─── Research Notes ────────────────────────────────────────────────────────

    public record CreateNoteRequest(
            @NotBlank(message = "Note title is required")
            @Size(max = 255, message = "Note title cannot exceed 255 characters")
            String title,

            @NotBlank(message = "Note content is required")
            String content,

            boolean pinned
    ) {}

    public record UpdateNoteRequest(
            @Size(max = 255, message = "Note title cannot exceed 255 characters")
            String title,

            String content,

            ResearchNoteStatus status,

            Boolean pinned
    ) {}

    public record NoteResponse(
            UUID id,
            UUID projectId,
            UUID authorUserId,
            String authorDisplayName,
            String authorInitials,
            String title,
            String content,
            ResearchNoteStatus status,
            boolean pinned,
            Instant createdAt,
            Instant updatedAt,
            UUID lastEditedBy,
            int commentCount
    ) {}

    // ─── Note Comments ─────────────────────────────────────────────────────────

    public record AddCommentRequest(
            @NotBlank(message = "Comment content is required")
            String content
    ) {}

    public record CommentResponse(
            UUID id,
            UUID noteId,
            UUID authorUserId,
            String authorDisplayName,
            String authorInitials,
            String content,
            Instant createdAt,
            Instant updatedAt
    ) {}

    // ─── Project Files ─────────────────────────────────────────────────────────

    public record FileResponse(
            UUID id,
            UUID projectId,
            String displayName,
            String contentType,
            UUID uploadedByUserId,
            String uploaderDisplayName,
            int currentVersionNumber,
            long currentSizeBytes,
            Instant createdAt,
            Instant updatedAt,
            Instant archivedAt
    ) {}

    public record FileVersionResponse(
            UUID id,
            UUID projectFileId,
            int versionNumber,
            String checksum,
            long sizeBytes,
            UUID uploadedByUserId,
            String uploaderDisplayName,
            Instant uploadedAt
    ) {}

    // ─── Project Activity ──────────────────────────────────────────────────────

    public record ProjectActivityItem(
            UUID id,
            UUID actorUserId,
            String actorDisplayName,
            String actorInitials,
            String action,
            String description,
            Instant timestamp
    ) {}
}
