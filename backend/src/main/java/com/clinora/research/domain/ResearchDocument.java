package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "research_documents")
public class ResearchDocument {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 64)
    private ResearchDocumentType documentType;

    @Column(name = "content_json", nullable = false, columnDefinition = "TEXT")
    private String contentJson;

    @Column(name = "crdt_state")
    private byte[] crdtState;

    @Column(name = "created_by_user_id", nullable = false, updatable = false)
    private UUID createdByUserId;

    @Column(name = "last_edited_by_user_id", nullable = false)
    private UUID lastEditedByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    protected ResearchDocument() {}

    public ResearchDocument(
            UUID id,
            UUID projectId,
            String title,
            ResearchDocumentType documentType,
            String contentJson,
            byte[] crdtState,
            UUID createdByUserId
    ) {
        this.id = Objects.requireNonNull(id, "Document ID required");
        this.projectId = Objects.requireNonNull(projectId, "Project ID required");
        this.title = Objects.requireNonNull(title, "Title required").trim();
        this.documentType = documentType != null ? documentType : ResearchDocumentType.GENERAL;
        this.contentJson = (contentJson != null && !contentJson.isBlank())
                ? contentJson
                : "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}";
        this.crdtState = crdtState;
        this.createdByUserId = Objects.requireNonNull(createdByUserId, "Created by user ID required");
        this.lastEditedByUserId = createdByUserId;
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void updateContent(String title, ResearchDocumentType documentType, String contentJson, byte[] crdtState, UUID editorUserId) {
        if (title != null && !title.isBlank()) {
            this.title = title.trim();
        }
        if (documentType != null) {
            this.documentType = documentType;
        }
        if (contentJson != null && !contentJson.isBlank()) {
            this.contentJson = contentJson;
        }
        if (crdtState != null) {
            this.crdtState = crdtState;
        }
        this.lastEditedByUserId = Objects.requireNonNull(editorUserId, "Editor user ID required");
        this.updatedAt = Instant.now();
    }

    public void rename(String title, UUID editorUserId) {
        if (title != null && !title.isBlank()) {
            this.title = title.trim();
            this.lastEditedByUserId = Objects.requireNonNull(editorUserId, "Editor user ID required");
            this.updatedAt = Instant.now();
        }
    }

    public void archive(UUID editorUserId) {
        this.archivedAt = Instant.now();
        this.lastEditedByUserId = Objects.requireNonNull(editorUserId, "Editor user ID required");
        this.updatedAt = Instant.now();
    }

    public boolean isArchived() {
        return archivedAt != null;
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public String getTitle() { return title; }
    public ResearchDocumentType getDocumentType() { return documentType; }
    public String getContentJson() { return contentJson; }
    public byte[] getCrdtState() { return crdtState; }
    public UUID getCreatedByUserId() { return createdByUserId; }
    public UUID getLastEditedByUserId() { return lastEditedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getArchivedAt() { return archivedAt; }
}
