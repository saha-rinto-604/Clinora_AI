package com.clinora.research.api;

import com.clinora.research.domain.LibraryVisibility;
import com.clinora.research.domain.PublicationStatus;
import com.clinora.research.domain.PublicationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ResearchPublicationModels {

    private ResearchPublicationModels() {}

    public record CitationFormatsResponse(
            String apa,
            String ieee,
            String bibtex
    ) {}

    public record LibraryDatasetProvenance(
            UUID datasetVersionId,
            String datasetDisplayName,
            int versionNumber,
            Instant generatedAt
    ) {}

    public record LibraryEvaluationProvenance(
            UUID evaluationRunId,
            String modelName,
            String modelVersion,
            String taskType,
            String status
    ) {}

    public record LibraryPublicationSummary(
            UUID id,
            String title,
            String authors,
            String venue,
            Integer publicationYear,
            LocalDate publicationDate,
            PublicationType publicationType,
            String researchField,
            String keywords,
            String methodologySummary,
            String doi,
            String publishedUrl,
            UUID projectId,
            String projectTitle,
            List<LibraryDatasetProvenance> datasetProvenance,
            List<LibraryEvaluationProvenance> evaluationProvenance
    ) {}

    public record LibraryPublicationsPageResponse(
            List<LibraryPublicationSummary> items,
            int page,
            int size,
            long totalItems,
            int totalPages,
            boolean hasPrevious,
            boolean hasNext
    ) {}

    public record LibraryPublicationDetail(
            UUID id,
            UUID projectId,
            String projectTitle,
            String title,
            String abstractText,
            String methodologySummary,
            String studyDesign,
            String analysisSummary,
            String authors,
            PublicationType publicationType,
            PublicationStatus status,
            LibraryVisibility libraryVisibility,
            String researchField,
            String keywords,
            String journal,
            String conference,
            String venue,
            LocalDate publicationDate,
            Integer publicationYear,
            String doi,
            String publishedUrl,
            CitationFormatsResponse citations,
            List<LibraryDatasetProvenance> datasetProvenance,
            List<LibraryEvaluationProvenance> evaluationProvenance,
            UUID createdBy,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record MyResearchOutputSummary(
            UUID id,
            UUID projectId,
            String projectTitle,
            String title,
            PublicationType publicationType,
            PublicationStatus status,
            LibraryVisibility libraryVisibility,
            String authors,
            String venue,
            LocalDate publicationDate,
            Instant updatedAt,
            Instant createdAt
    ) {}

    public record RegisterResearchOutputRequest(
            @NotNull UUID projectId,
            @NotBlank String title,
            String abstractText,
            @NotNull PublicationType publicationType,
            @NotNull PublicationStatus status,
            LibraryVisibility libraryVisibility,
            @NotBlank String methodologySummary,
            String studyDesign,
            String analysisSummary,
            String keywords,
            @NotBlank String authors,
            String researchField,
            String doi,
            String journal,
            String conference,
            LocalDate publicationDate,
            String publishedUrl,
            List<UUID> linkedDatasetVersionIds,
            List<UUID> linkedEvaluationRunIds,
            Map<String, Object> citationMetadata
    ) {}

    public record UpdateResearchOutputRequest(
            @NotBlank String title,
            String abstractText,
            @NotNull PublicationType publicationType,
            @NotNull PublicationStatus status,
            LibraryVisibility libraryVisibility,
            @NotBlank String methodologySummary,
            String studyDesign,
            String analysisSummary,
            String keywords,
            @NotBlank String authors,
            String researchField,
            String doi,
            String journal,
            String conference,
            LocalDate publicationDate,
            String publishedUrl,
            List<UUID> linkedDatasetVersionIds,
            List<UUID> linkedEvaluationRunIds,
            Map<String, Object> citationMetadata
    ) {}

    public record ProjectSelectOption(
            UUID id,
            String title,
            String status,
            List<DatasetVersionSelectOption> datasetVersions,
            List<EvaluationRunSelectOption> evaluationRuns
    ) {}

    public record DatasetVersionSelectOption(
            UUID id,
            String datasetName,
            int versionNumber,
            Instant generatedAt
    ) {}

    public record EvaluationRunSelectOption(
            UUID id,
            String modelId,
            String modelVersion,
            String taskType
    ) {}

    // Legacy / Project-scoped DTOs
    public record CreatePublicationRequest(
            @NotBlank String title,
            String abstractText,
            @NotNull PublicationType publicationType,
            String doi,
            String journal,
            String conference,
            LocalDate publicationDate,
            String externalUrl,
            Map<String, Object> citationMetadata
    ) {}

    public record UpdatePublicationRequest(
            @NotBlank String title,
            String abstractText,
            @NotNull PublicationType publicationType,
            String doi,
            String journal,
            String conference,
            LocalDate publicationDate,
            String externalUrl,
            Map<String, Object> citationMetadata
    ) {}

    public record PublicationResponse(
            UUID id,
            UUID projectId,
            String title,
            String abstractText,
            PublicationType publicationType,
            String doi,
            String journal,
            String conference,
            LocalDate publicationDate,
            String externalUrl,
            String citationMetadata,
            CitationFormatsResponse citations,
            UUID createdBy,
            Instant createdAt,
            Instant updatedAt
    ) {}
}
