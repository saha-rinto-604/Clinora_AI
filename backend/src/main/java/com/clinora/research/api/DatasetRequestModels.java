package com.clinora.research.api;

import com.clinora.research.domain.DatasetFormat;
import com.clinora.research.domain.DatasetRequest;
import com.clinora.research.domain.DatasetRequestStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class DatasetRequestModels {

    private DatasetRequestModels() {}

    public record CreateDatasetRequestInput(
            @NotBlank(message = "Dataset request name is required")
            @Size(max = 255, message = "Name cannot exceed 255 characters")
            String name,

            @NotBlank(message = "Research purpose explanation is required")
            String purpose,

            String requestedPopulation,
            String requestedVariables,
            String requestedFilters,

            @NotNull(message = "Requested format is required")
            DatasetFormat requestedFormat
    ) {}

    public record UpdateDatasetRequestInput(
            @NotBlank(message = "Dataset request name is required")
            @Size(max = 255, message = "Name cannot exceed 255 characters")
            String name,

            @NotBlank(message = "Research purpose explanation is required")
            String purpose,

            String requestedPopulation,
            String requestedVariables,
            String requestedFilters,

            DatasetFormat requestedFormat
    ) {}

    public record DatasetRequestResponse(
            UUID id,
            UUID projectId,
            String name,
            String purpose,
            String requestedPopulation,
            String requestedVariables,
            String requestedFilters,
            DatasetFormat requestedFormat,
            DatasetRequestStatus status,
            boolean editable,
            boolean submittable,
            boolean cancellable,
            Instant submittedAt,
            Instant reviewedAt,
            Instant approvedAt,
            Instant expiresAt,
            UUID reviewedBy,
            String reviewNotes,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
        public static DatasetRequestResponse from(DatasetRequest request) {
            return new DatasetRequestResponse(
                    request.getId(),
                    request.getProjectId(),
                    request.getName(),
                    request.getPurpose(),
                    request.getRequestedPopulation(),
                    request.getRequestedVariables(),
                    request.getRequestedFilters(),
                    request.getRequestedFormat(),
                    request.getStatus(),
                    request.getStatus().isEditable(),
                    request.getStatus().canBeSubmitted(),
                    request.getStatus().canBeCancelled(),
                    request.getSubmittedAt(),
                    request.getReviewedAt(),
                    request.getApprovedAt(),
                    request.getExpiresAt(),
                    request.getReviewedBy(),
                    request.getReviewNotes(),
                    request.getCreatedAt(),
                    request.getUpdatedAt(),
                    request.getVersion()
            );
        }
    }

    public record DatasetRequestPageResponse(
            List<DatasetRequestResponse> items,
            int page,
            int size,
            long totalItems,
            int totalPages,
            boolean hasPrevious,
            boolean hasNext
    ) {}

    public record AdminDatasetRequestQueueItem(
            UUID id,
            UUID projectId,
            String projectTitle,
            String researcherName,
            String researcherEmail,
            String name,
            DatasetFormat requestedFormat,
            DatasetRequestStatus status,
            Instant submittedAt,
            Instant createdAt
    ) {}

    public record AdminDatasetRequestDetailResponse(
            DatasetRequestResponse request,
            String projectTitle,
            String researcherName,
            String researcherEmail
    ) {}

    public record DatasetReviewDecisionInput(
            String reviewNotes,
            Instant expiresAt
    ) {}
}
