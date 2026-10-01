package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "research_document_comments")
public class ResearchDocumentComment {

    @Id
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "author_user_id", nullable = false, updatable = false)
    private UUID authorUserId;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "selected_text", length = 1000)
    private String selectedText;

    @Column(name = "resolved", nullable = false)
    private boolean resolved;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ResearchDocumentComment() {}

    public ResearchDocumentComment(
            UUID id,
            UUID documentId,
            UUID authorUserId,
            String content,
            String selectedText
    ) {
        this.id = Objects.requireNonNull(id, "Comment ID required");
        this.documentId = Objects.requireNonNull(documentId, "Document ID required");
        this.authorUserId = Objects.requireNonNull(authorUserId, "Author user ID required");
        this.content = Objects.requireNonNull(content, "Content required").trim();
        this.selectedText = selectedText;
        this.resolved = false;
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void setResolved(boolean resolved) {
        this.resolved = resolved;
        this.updatedAt = Instant.now();
    }

    public void updateContent(String content) {
        if (content != null && !content.isBlank()) {
            this.content = content.trim();
            this.updatedAt = Instant.now();
        }
    }

    public UUID getId() { return id; }
    public UUID getDocumentId() { return documentId; }
    public UUID getAuthorUserId() { return authorUserId; }
    public String getContent() { return content; }
    public String getSelectedText() { return selectedText; }
    public boolean isResolved() { return resolved; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
