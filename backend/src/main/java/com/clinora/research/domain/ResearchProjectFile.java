package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "research_project_files")
public class ResearchProjectFile {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "display_name", nullable = false, length = 255)
    private String displayName;

    @Column(name = "content_type", nullable = false, length = 128)
    private String contentType;

    @Column(name = "uploaded_by_user_id", nullable = false)
    private UUID uploadedByUserId;

    @Column(name = "current_version_number", nullable = false)
    private int currentVersionNumber;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    protected ResearchProjectFile() {}

    public ResearchProjectFile(
            UUID id,
            UUID projectId,
            String displayName,
            String contentType,
            UUID uploadedByUserId
    ) {
        this.id = Objects.requireNonNull(id, "File ID required");
        this.projectId = Objects.requireNonNull(projectId, "Project ID required");
        this.displayName = Objects.requireNonNull(displayName, "Display name required").trim();
        this.contentType = Objects.requireNonNull(contentType, "Content type required");
        this.uploadedByUserId = Objects.requireNonNull(uploadedByUserId, "Uploader required");
        this.currentVersionNumber = 1;
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void incrementVersion() {
        this.currentVersionNumber++;
        this.updatedAt = Instant.now();
    }

    public void archive() {
        this.archivedAt = Instant.now();
        this.updatedAt = this.archivedAt;
    }

    public boolean isArchived() {
        return this.archivedAt != null;
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public String getDisplayName() { return displayName; }
    public String getContentType() { return contentType; }
    public UUID getUploadedByUserId() { return uploadedByUserId; }
    public int getCurrentVersionNumber() { return currentVersionNumber; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getArchivedAt() { return archivedAt; }
}
