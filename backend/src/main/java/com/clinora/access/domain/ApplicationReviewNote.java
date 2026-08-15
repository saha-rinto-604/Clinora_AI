package com.clinora.access.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "application_review_notes")
public class ApplicationReviewNote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "application_id", nullable = false)
    private UUID applicationId;

    @Column(name = "reviewer_user_id", nullable = false)
    private UUID reviewerUserId;

    @Column(nullable = false, length = 2000)
    private String text;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ApplicationReviewNote() {
    }

    public ApplicationReviewNote(UUID applicationId, UUID reviewerUserId, String text, Instant createdAt) {
        this.applicationId = applicationId;
        this.reviewerUserId = reviewerUserId;
        this.text = text;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getApplicationId() { return applicationId; }
    public UUID getReviewerUserId() { return reviewerUserId; }
    public String getText() { return text; }
    public Instant getCreatedAt() { return createdAt; }
}
