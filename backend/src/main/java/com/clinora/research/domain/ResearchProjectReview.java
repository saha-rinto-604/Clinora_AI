package com.clinora.research.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "research_project_reviews")
public class ResearchProjectReview {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "reviewer_user_id", nullable = false)
    private UUID reviewerUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ResearchProjectReviewAction action;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ResearchProjectReview() {}

    public ResearchProjectReview(
            UUID id,
            UUID projectId,
            UUID reviewerUserId,
            ResearchProjectReviewAction action,
            String comment,
            Instant createdAt
    ) {
        this.id = Objects.requireNonNull(id, "Review ID cannot be null");
        this.projectId = Objects.requireNonNull(projectId, "Project ID cannot be null");
        this.reviewerUserId = Objects.requireNonNull(reviewerUserId, "Reviewer user ID cannot be null");
        this.action = Objects.requireNonNull(action, "Review action cannot be null");
        this.comment = comment;
        this.createdAt = Objects.requireNonNull(createdAt, "CreatedAt cannot be null");
    }

    public static ResearchProjectReview record(
            UUID projectId,
            UUID reviewerUserId,
            ResearchProjectReviewAction action,
            String comment,
            Instant createdAt
    ) {
        return new ResearchProjectReview(
                UUID.randomUUID(),
                projectId,
                reviewerUserId,
                action,
                comment,
                createdAt
        );
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getReviewerUserId() { return reviewerUserId; }
    public ResearchProjectReviewAction getAction() { return action; }
    public String getComment() { return comment; }
    public Instant getCreatedAt() { return createdAt; }
}
