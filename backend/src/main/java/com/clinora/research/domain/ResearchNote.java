package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "research_notes")
public class ResearchNote {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "author_user_id", nullable = false)
    private UUID authorUserId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ResearchNoteStatus status;

    @Column(name = "pinned", nullable = false)
    private boolean pinned;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "last_edited_by")
    private UUID lastEditedBy;

    protected ResearchNote() {}

    public ResearchNote(
            UUID id,
            UUID projectId,
            UUID authorUserId,
            String title,
            String content,
            ResearchNoteStatus status,
            boolean pinned
    ) {
        this.id = Objects.requireNonNull(id, "Note ID required");
        this.projectId = Objects.requireNonNull(projectId, "Project ID required");
        this.authorUserId = Objects.requireNonNull(authorUserId, "Author user ID required");
        this.title = Objects.requireNonNull(title, "Title required").trim();
        this.content = Objects.requireNonNull(content, "Content required");
        this.status = status != null ? status : ResearchNoteStatus.DRAFT;
        this.pinned = pinned;
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
        this.lastEditedBy = authorUserId;
    }

    public void update(String title, String content, ResearchNoteStatus status, UUID editorUserId) {
        if (title != null && !title.isBlank()) {
            this.title = title.trim();
        }
        if (content != null) {
            this.content = content;
        }
        if (status != null) {
            this.status = status;
        }
        this.lastEditedBy = editorUserId;
        this.updatedAt = Instant.now();
    }

    public void setPinned(boolean pinned, UUID editorUserId) {
        this.pinned = pinned;
        this.lastEditedBy = editorUserId;
        this.updatedAt = Instant.now();
    }

    public void archive(UUID editorUserId) {
        this.status = ResearchNoteStatus.ARCHIVED;
        this.lastEditedBy = editorUserId;
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getAuthorUserId() { return authorUserId; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public ResearchNoteStatus getStatus() { return status; }
    public boolean isPinned() { return pinned; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public UUID getLastEditedBy() { return lastEditedBy; }
}
