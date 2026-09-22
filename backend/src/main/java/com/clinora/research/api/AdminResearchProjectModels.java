package com.clinora.research.api;

import com.clinora.research.api.ResearchProjectModels.ProjectResponse;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectReview;
import com.clinora.research.domain.ResearchProjectReviewAction;
import com.clinora.research.domain.ResearchProjectStatus;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AdminResearchProjectModels {

    private AdminResearchProjectModels() {}

    public record ReviewActionRequest(
            @Size(max = 2000, message = "Comment cannot exceed 2000 characters")
            String comment
    ) {}

    public record ProjectReviewRecord(
            UUID id,
            UUID projectId,
            UUID reviewerUserId,
            ResearchProjectReviewAction action,
            String comment,
            Instant createdAt
    ) {
        public static ProjectReviewRecord from(ResearchProjectReview review) {
            return new ProjectReviewRecord(
                    review.getId(),
                    review.getProjectId(),
                    review.getReviewerUserId(),
                    review.getAction(),
                    review.getComment(),
                    review.getCreatedAt()
            );
        }
    }

    public record AdminProjectQueueItem(
            UUID id,
            UUID ownerUserId,
            String ownerName,
            String ownerEmail,
            String title,
            String researchField,
            String institutionName,
            ResearchProjectStatus status,
            Instant submittedAt,
            Instant reviewedAt,
            Instant createdAt,
            long version
    ) {
        public static AdminProjectQueueItem of(ResearchProject project, String ownerName, String ownerEmail) {
            return new AdminProjectQueueItem(
                    project.getId(),
                    project.getOwnerUserId(),
                    ownerName,
                    ownerEmail,
                    project.getTitle(),
                    project.getResearchField(),
                    project.getInstitutionName(),
                    project.getStatus(),
                    project.getSubmittedAt(),
                    project.getReviewedAt(),
                    project.getCreatedAt(),
                    project.getVersion()
            );
        }
    }

    public record AdminProjectDetailResponse(
            ProjectResponse project,
            String ownerName,
            String ownerEmail,
            List<ProjectReviewRecord> reviewHistory
    ) {}

    public record AdminProjectPageResponse(
            List<AdminProjectQueueItem> items,
            int page,
            int size,
            long totalItems,
            int totalPages,
            boolean hasPrevious,
            boolean hasNext
    ) {}
}
