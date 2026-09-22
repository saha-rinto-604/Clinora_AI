package com.clinora.research.api;

import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ResearchProjectModels {

    private ResearchProjectModels() {}

    public record CreateProjectRequest(
            @NotBlank(message = "Title is required")
            @Size(max = 255, message = "Title cannot exceed 255 characters")
            String title,

            @NotBlank(message = "Objective is required")
            String objective,

            String description,

            @NotBlank(message = "Research field is required")
            @Size(max = 120, message = "Research field cannot exceed 120 characters")
            String researchField,

            String methodologySummary,

            @Size(max = 255, message = "Institution name cannot exceed 255 characters")
            String institutionName,

            @Size(max = 120, message = "Ethics reference cannot exceed 120 characters")
            String ethicsReference
    ) {}

    public record UpdateProjectRequest(
            @NotBlank(message = "Title is required")
            @Size(max = 255, message = "Title cannot exceed 255 characters")
            String title,

            @NotBlank(message = "Objective is required")
            String objective,

            String description,

            @NotBlank(message = "Research field is required")
            @Size(max = 120, message = "Research field cannot exceed 120 characters")
            String researchField,

            String methodologySummary,

            @Size(max = 255, message = "Institution name cannot exceed 255 characters")
            String institutionName,

            @Size(max = 120, message = "Ethics reference cannot exceed 120 characters")
            String ethicsReference
    ) {}

    public record ProjectResponse(
            UUID id,
            UUID ownerUserId,
            String title,
            String objective,
            String description,
            String researchField,
            String methodologySummary,
            String institutionName,
            String ethicsReference,
            ResearchProjectStatus status,
            boolean editable,
            boolean submittable,
            boolean withdrawable,
            Instant submittedAt,
            Instant reviewedAt,
            Instant approvedAt,
            Instant completedAt,
            Instant archivedAt,
            UUID reviewedBy,
            String reviewDecisionReason,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
        public static ProjectResponse from(ResearchProject project) {
            return new ProjectResponse(
                    project.getId(),
                    project.getOwnerUserId(),
                    project.getTitle(),
                    project.getObjective(),
                    project.getDescription(),
                    project.getResearchField(),
                    project.getMethodologySummary(),
                    project.getInstitutionName(),
                    project.getEthicsReference(),
                    project.getStatus(),
                    project.getStatus().isEditableByResearcher(),
                    project.getStatus().canBeSubmitted(),
                    project.getStatus().canBeWithdrawn(),
                    project.getSubmittedAt(),
                    project.getReviewedAt(),
                    project.getApprovedAt(),
                    project.getCompletedAt(),
                    project.getArchivedAt(),
                    project.getReviewedBy(),
                    project.getReviewDecisionReason(),
                    project.getCreatedAt(),
                    project.getUpdatedAt(),
                    project.getVersion()
            );
        }
    }

    public record ProjectPageResponse(
            List<ProjectResponse> items,
            int page,
            int size,
            long totalItems,
            int totalPages,
            boolean hasPrevious,
            boolean hasNext
    ) {}
}
