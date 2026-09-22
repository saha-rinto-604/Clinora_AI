package com.clinora.research.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "research_publications")
public class ResearchPublication {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(name = "abstract_text", columnDefinition = "TEXT")
    private String abstractText;

    @Enumerated(EnumType.STRING)
    @Column(name = "publication_type", nullable = false, length = 50)
    private PublicationType publicationType;

    @Column(length = 100)
    private String doi;

    @Column(length = 255)
    private String journal;

    @Column(length = 255)
    private String conference;

    @Column(name = "publication_date")
    private LocalDate publicationDate;

    @Column(name = "external_url", length = 1000)
    private String externalUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "citation_metadata", columnDefinition = "jsonb", nullable = false)
    private String citationMetadata;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ResearchPublication() {}

    public ResearchPublication(
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
            UUID createdBy
    ) {
        this.id = Objects.requireNonNull(id, "Publication ID required");
        this.projectId = Objects.requireNonNull(projectId, "Project ID required");
        this.title = Objects.requireNonNull(title, "Title required").trim();
        this.abstractText = abstractText;
        this.publicationType = Objects.requireNonNull(publicationType, "Publication type required");
        this.doi = doi != null ? doi.trim() : null;
        this.journal = journal != null ? journal.trim() : null;
        this.conference = conference != null ? conference.trim() : null;
        this.publicationDate = publicationDate;
        this.externalUrl = externalUrl != null ? externalUrl.trim() : null;
        this.citationMetadata = (citationMetadata == null || citationMetadata.isBlank()) ? "{}" : citationMetadata;
        this.createdBy = Objects.requireNonNull(createdBy, "Created by required");
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(
            String title,
            String abstractText,
            PublicationType publicationType,
            String doi,
            String journal,
            String conference,
            LocalDate publicationDate,
            String externalUrl,
            String citationMetadata
    ) {
        this.title = Objects.requireNonNull(title, "Title required").trim();
        this.abstractText = abstractText;
        this.publicationType = Objects.requireNonNull(publicationType, "Publication type required");
        this.doi = doi != null ? doi.trim() : null;
        this.journal = journal != null ? journal.trim() : null;
        this.conference = conference != null ? conference.trim() : null;
        this.publicationDate = publicationDate;
        this.externalUrl = externalUrl != null ? externalUrl.trim() : null;
        if (citationMetadata != null && !citationMetadata.isBlank()) {
            this.citationMetadata = citationMetadata;
        }
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public String getTitle() { return title; }
    public String getAbstractText() { return abstractText; }
    public PublicationType getPublicationType() { return publicationType; }
    public String getDoi() { return doi; }
    public String getJournal() { return journal; }
    public String getConference() { return conference; }
    public LocalDate getPublicationDate() { return publicationDate; }
    public String getExternalUrl() { return externalUrl; }
    public String getCitationMetadata() { return citationMetadata; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
