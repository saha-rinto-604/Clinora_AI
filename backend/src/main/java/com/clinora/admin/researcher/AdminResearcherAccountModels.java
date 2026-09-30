package com.clinora.admin.researcher;

import com.clinora.access.domain.ApplicationDocumentType;
import com.clinora.access.domain.ApplicationStatus;
import com.clinora.research.domain.DatasetFormat;
import com.clinora.research.domain.DatasetRequestStatus;
import com.clinora.research.domain.EvaluationRunStatus;
import com.clinora.research.domain.EvaluationTaskType;
import com.clinora.research.domain.PublicationType;
import com.clinora.research.domain.ResearchProjectStatus;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserRole;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class AdminResearcherAccountModels {

    private AdminResearcherAccountModels() {}

    public record ResearcherSummaryView(
            UUID id,
            String firstName,
            String lastName,
            String email,
            UserRole role,
            AccountStatus accountStatus,
            boolean emailVerified,
            Instant createdAt,
            Instant lastLoginAt,
            Instant deactivatedAt,
            UUID applicationId,
            ApplicationStatus applicationStatus,
            String institution,
            String department,
            String professionalTitle,
            String researchField,
            boolean hasProfileImage,
            com.clinora.research.domain.CredentialVerificationStatus credentialVerificationStatus
    ) {
        public ResearcherSummaryView(
                UUID id,
                String firstName,
                String lastName,
                String email,
                UserRole role,
                AccountStatus accountStatus,
                boolean emailVerified,
                Instant createdAt,
                Instant lastLoginAt,
                Instant deactivatedAt,
                UUID applicationId,
                ApplicationStatus applicationStatus,
                String institution,
                String department,
                String professionalTitle,
                String researchField,
                boolean hasProfileImage
        ) {
            this(id, firstName, lastName, email, role, accountStatus, emailVerified, createdAt, lastLoginAt,
                    deactivatedAt, applicationId, applicationStatus, institution, department, professionalTitle,
                    researchField, hasProfileImage, null);
        }
    }

    public record ResearcherAccountView(
            UUID id,
            String firstName,
            String lastName,
            String email,
            UserRole role,
            AccountStatus accountStatus,
            boolean emailVerified,
            Instant createdAt,
            Instant updatedAt,
            Instant lastLoginAt,
            Instant deactivatedAt,
            boolean hasProfileImage
    ) {}

    public record ResearcherApplicationView(
            UUID applicationId,
            ApplicationStatus status,
            Instant submittedAt,
            Instant emailVerifiedAt,
            Instant attestedAt,
            Instant createdAt,
            Instant updatedAt,
            String phone,
            String countryCode,
            String institution,
            String department,
            String professionalTitle,
            String institutionalProfileUrl,
            String researchField,
            String researchPurpose,
            String researchSummary,
            String orcid,
            String researchProfileUrl,
            String publicationProfileUrl,
            String ethicsReference,
            String projectApprovalReference
    ) {}

    public record ResearcherSecuritySummaryView(
            int activeSessionsCount,
            Instant lastLoginAt,
            AccountStatus accountStatus,
            boolean emailVerified
    ) {}

    public record ResearcherDetailView(
            ResearcherAccountView account,
            ResearcherApplicationView application,
            ResearcherSecuritySummaryView securitySummary
    ) {}

    public record ResearcherDocumentView(
            UUID id,
            UUID applicationId,
            ApplicationDocumentType documentType,
            String originalFilename,
            String mimeType,
            long sizeBytes,
            Instant createdAt
    ) {}

    public record ProjectSummaryItem(
            UUID id,
            String title,
            String researchField,
            ResearchProjectStatus status,
            Instant createdAt,
            Instant submittedAt,
            Instant approvedAt
    ) {}

    public record CollaborationSummaryItem(
            UUID projectId,
            String projectTitle,
            String role,
            Instant joinedAt
    ) {}

    public record DatasetRequestSummaryItem(
            UUID id,
            UUID projectId,
            String projectTitle,
            String name,
            DatasetRequestStatus status,
            DatasetFormat requestedFormat,
            Instant createdAt
    ) {}

    public record DatasetSummaryItem(
            UUID id,
            UUID projectId,
            String projectTitle,
            String name,
            String status,
            Instant createdAt,
            Instant expiresAt
    ) {}

    public record EvaluationRunSummaryItem(
            UUID id,
            UUID projectId,
            String projectTitle,
            String modelId,
            String modelVersion,
            EvaluationTaskType taskType,
            EvaluationRunStatus status,
            Instant startedAt,
            Instant completedAt
    ) {}

    public record PublicationSummaryItem(
            UUID id,
            UUID projectId,
            String projectTitle,
            String title,
            PublicationType publicationType,
            String doi,
            String journal,
            LocalDate publicationDate
    ) {}

    public record ResearcherActivityView(
            List<ProjectSummaryItem> ownedProjects,
            List<CollaborationSummaryItem> collaborations,
            List<DatasetRequestSummaryItem> datasetRequests,
            List<DatasetSummaryItem> generatedDatasets,
            List<EvaluationRunSummaryItem> aiEvaluationRuns,
            List<PublicationSummaryItem> publications
    ) {}

    public record ResearcherAuditEventView(
            UUID id,
            String action,
            String outcome,
            Instant occurredAt,
            UUID actorUserId,
            String ipAddress,
            String userAgent,
            String resourceId,
            String metadata
    ) {}

    public record SecurityActionRequest(
            @Size(max = 500, message = "Reason must not exceed 500 characters")
            String reason
    ) {}

    public record ResearcherPageResponse<T>(
            List<T> items,
            int page,
            int size,
            long totalItems,
            int totalPages
    ) {}
}
