package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "research_document_revisions")
public class ResearchDocumentRevision {

    @Id
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "revision_number", nullable = false)
    private int revisionNumber;

    @Column(name = "edited_by_user_id", nullable = false)
    private UUID editedByUserId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "content_json", nullable = false, columnDefinition = "TEXT")
    private String contentJson;

    @Column(name = "crdt_update")
    private byte[] crdtUpdate;

    @Column(name = "change_summary", length = 500)
    private String changeSummary;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ResearchDocumentRevision() {}

    public ResearchDocumentRevision(
            UUID id,
            UUID documentId,
            int revisionNumber,
            UUID editedByUserId,
            String title,
            String contentJson,
            byte[] crdtUpdate,
            String changeSummary
    ) {
        this.id = Objects.requireNonNull(id, "Revision ID required");
        this.documentId = Objects.requireNonNull(documentId, "Document ID required");
        this.revisionNumber = revisionNumber;
        this.editedByUserId = Objects.requireNonNull(editedByUserId, "Edited by user ID required");
        this.title = Objects.requireNonNull(title, "Title required").trim();
        this.contentJson = Objects.requireNonNull(contentJson, "Content JSON required");
        this.crdtUpdate = crdtUpdate;
        this.changeSummary = changeSummary;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getDocumentId() { return documentId; }
    public int getRevisionNumber() { return revisionNumber; }
    public UUID getEditedByUserId() { return editedByUserId; }
    public String getTitle() { return title; }
    public String getContentJson() { return contentJson; }
    public byte[] getCrdtUpdate() { return crdtUpdate; }
    public String getChangeSummary() { return changeSummary; }
    public Instant getCreatedAt() { return createdAt; }
}
