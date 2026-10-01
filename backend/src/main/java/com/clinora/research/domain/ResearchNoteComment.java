package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "research_note_comments")
public class ResearchNoteComment {

    @Id
    private UUID id;

    @Column(name = "note_id", nullable = false)
    private UUID noteId;

    @Column(name = "author_user_id", nullable = false)
    private UUID authorUserId;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "removed_at")
    private Instant removedAt;

    protected ResearchNoteComment() {}

    public ResearchNoteComment(UUID id, UUID noteId, UUID authorUserId, String content) {
        this.id = Objects.requireNonNull(id, "Comment ID required");
        this.noteId = Objects.requireNonNull(noteId, "Note ID required");
        this.authorUserId = Objects.requireNonNull(authorUserId, "Author user ID required");
        this.content = Objects.requireNonNull(content, "Comment content required").trim();
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void remove() {
        this.removedAt = Instant.now();
        this.updatedAt = this.removedAt;
    }

    public boolean isRemoved() {
        return this.removedAt != null;
    }

    public UUID getId() { return id; }
    public UUID getNoteId() { return noteId; }
    public UUID getAuthorUserId() { return authorUserId; }
    public String getContent() { return content; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getRemovedAt() { return removedAt; }
}
