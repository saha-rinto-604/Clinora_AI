package com.clinora.research.api;

import com.clinora.research.domain.PublicationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public final class ResearchPublicationModels {

    private ResearchPublicationModels() {}

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

    public record CitationFormatsResponse(
            String apa,
            String ieee,
            String bibtex
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
