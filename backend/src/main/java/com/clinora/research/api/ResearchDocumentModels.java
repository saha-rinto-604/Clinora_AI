package com.clinora.research.api;

import com.clinora.research.domain.ResearchDocumentType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ResearchDocumentModels {

    private ResearchDocumentModels() {}

    public record ContributorDto(
            UUID userId,
            String name,
            String email,
            String profileImageUrl
    ) {}

    public record DocumentSummaryDto(
            UUID id,
            UUID projectId,
            String title,
            ResearchDocumentType documentType,
            UUID createdByUserId,
            String createdByName,
            String createdByProfileImageUrl,
            UUID lastEditedByUserId,
            String lastEditedByName,
            String lastEditedByProfileImageUrl,
            Instant createdAt,
            Instant updatedAt,
            Instant archivedAt,
            boolean archived,
            List<ContributorDto> contributors,
            long revisionCount
    ) {}

    public record DocumentDetailDto(
            UUID id,
            UUID projectId,
            String title,
            ResearchDocumentType documentType,
            String contentJson,
            String crdtStateBase64,
            UUID createdByUserId,
            String createdByName,
            String createdByProfileImageUrl,
            UUID lastEditedByUserId,
            String lastEditedByName,
            String lastEditedByProfileImageUrl,
            Instant createdAt,
            Instant updatedAt,
            Instant archivedAt,
            boolean archived,
            List<ContributorDto> contributors,
            int currentRevisionNumber,
            long revisionCount
    ) {}

    public record DocumentRevisionDto(
            UUID id,
            UUID documentId,
            int revisionNumber,
            UUID editedByUserId,
            String editorName,
            String editorProfileImageUrl,
            String title,
            String contentJson,
            String changeSummary,
            Instant createdAt
    ) {}

    public record DocumentCommentDto(
            UUID id,
            UUID documentId,
            UUID authorUserId,
            String authorName,
            String authorProfileImageUrl,
            String content,
            String selectedText,
            boolean resolved,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record CreateDocumentRequest(
            @NotBlank(message = "Document title is required")
            @Size(max = 255, message = "Document title must not exceed 255 characters")
            String title,

            @NotNull(message = "Document type is required")
            ResearchDocumentType documentType,

            String contentJson,
            String crdtStateBase64
    ) {}

    public record UpdateDocumentRequest(
            @Size(max = 255, message = "Document title must not exceed 255 characters")
            String title,

            ResearchDocumentType documentType,
            String contentJson,
            String crdtUpdateBase64,
            String changeSummary,
            Integer expectedRevisionNumber
    ) {}

    public record RenameDocumentRequest(
            @NotBlank(message = "Document title is required")
            @Size(max = 255, message = "Document title must not exceed 255 characters")
            String title
    ) {}

    public record AddDocumentCommentRequest(
            @NotBlank(message = "Comment content is required")
            String content,

            String selectedText
    ) {}

    public record SafeDatasetReferenceDto(
            UUID id,
            String name,
            String status,
            Instant createdAt
    ) {}

    public record SafeAIEvaluationReferenceDto(
            UUID id,
            String modelId,
            String modelVersion,
            String taskType,
            String status
    ) {}
}
