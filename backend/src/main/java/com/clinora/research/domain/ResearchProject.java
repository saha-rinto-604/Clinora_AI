package com.clinora.research.domain;

import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import jakarta.persistence.*;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "research_projects")
public class ResearchProject {

    @Id
    private UUID id;

    @Column(name = "owner_user_id", nullable = false)
    private UUID ownerUserId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String objective;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "research_field", nullable = false, length = 120)
    private String researchField;

    @Column(name = "methodology_summary", columnDefinition = "TEXT")
    private String methodologySummary;

    @Column(name = "institution_name", length = 255)
    private String institutionName;

    @Column(name = "ethics_reference", length = 120)
    private String ethicsReference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 48)
    private ResearchProjectStatus status;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @Column(name = "review_decision_reason", columnDefinition = "TEXT")
    private String reviewDecisionReason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected ResearchProject() {}

    public ResearchProject(
            UUID id,
            UUID ownerUserId,
            String title,
            String objective,
            String description,
            String researchField,
            String methodologySummary,
            String institutionName,
            String ethicsReference,
            Instant now
    ) {
        this.id = Objects.requireNonNull(id, "Project ID cannot be null");
        this.ownerUserId = Objects.requireNonNull(ownerUserId, "Owner user ID cannot be null");
        this.title = validateTitle(title);
        this.objective = validateObjective(objective);
        this.description = description;
        this.researchField = validateResearchField(researchField);
        this.methodologySummary = methodologySummary;
        this.institutionName = institutionName;
        this.ethicsReference = ethicsReference;
        this.status = ResearchProjectStatus.DRAFT;
        this.createdAt = Objects.requireNonNull(now, "createdAt cannot be null");
        this.updatedAt = now;
        this.version = 0L;
    }

    public static ResearchProject createDraft(
            UUID ownerUserId,
            String title,
            String objective,
            String description,
            String researchField,
            String methodologySummary,
            String institutionName,
            String ethicsReference,
            Instant now
    ) {
        return new ResearchProject(
                UUID.randomUUID(),
                ownerUserId,
                title,
                objective,
                description,
                researchField,
                methodologySummary,
                institutionName,
                ethicsReference,
                now
        );
    }

    public void updateDraft(
            String title,
            String objective,
            String description,
            String researchField,
            String methodologySummary,
            String institutionName,
            String ethicsReference,
            Instant now
    ) {
        if (!status.isEditableByResearcher()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.PROJECT_NOT_EDITABLE,
                    "Research project cannot be edited when in status: " + status
            );
        }
        this.title = validateTitle(title);
        this.objective = validateObjective(objective);
        this.description = description;
        this.researchField = validateResearchField(researchField);
        this.methodologySummary = methodologySummary;
        this.institutionName = institutionName;
        this.ethicsReference = ethicsReference;
        this.updatedAt = Objects.requireNonNull(now, "updatedAt cannot be null");
    }

    public void submit(Instant now) {
        if (!status.canBeSubmitted()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot submit research project in status: " + status
            );
        }
        if (title == null || title.isBlank() || objective == null || objective.isBlank() || researchField == null || researchField.isBlank()) {
            throw new ResearchApiException(
                    HttpStatus.BAD_REQUEST,
                    ResearchErrorCode.INVALID_SUBMISSION,
                    "Title, objective, and research field are required for project submission."
            );
        }
        this.status = ResearchProjectStatus.SUBMITTED;
        this.submittedAt = Objects.requireNonNull(now, "submittedAt cannot be null");
        this.updatedAt = now;
    }

    public void withdraw(Instant now) {
        if (!status.canBeWithdrawn()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot withdraw research project in status: " + status
            );
        }
        this.status = ResearchProjectStatus.WITHDRAWN;
        this.updatedAt = Objects.requireNonNull(now, "updatedAt cannot be null");
    }

    public void startReview(UUID adminUserId, Instant now) {
        if (this.status != ResearchProjectStatus.SUBMITTED && this.status != ResearchProjectStatus.UNDER_REVIEW) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot start review on research project in status: " + status
            );
        }
        this.status = ResearchProjectStatus.UNDER_REVIEW;
        this.reviewedBy = Objects.requireNonNull(adminUserId, "Reviewer user ID cannot be null");
        this.reviewedAt = Objects.requireNonNull(now, "reviewedAt cannot be null");
        this.updatedAt = now;
    }

    public void requestMoreInfo(UUID adminUserId, String reason, Instant now) {
        if (!status.canUndergoReview()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot request more info on project in status: " + status
            );
        }
        this.status = ResearchProjectStatus.MORE_INFO_REQUIRED;
        this.reviewedBy = Objects.requireNonNull(adminUserId, "Reviewer user ID cannot be null");
        this.reviewDecisionReason = reason;
        this.reviewedAt = Objects.requireNonNull(now, "reviewedAt cannot be null");
        this.updatedAt = now;
    }

    public void approve(UUID adminUserId, String reviewNote, Instant now) {
        if (!status.canUndergoReview()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot approve research project in status: " + status
            );
        }
        this.status = ResearchProjectStatus.APPROVED;
        this.reviewedBy = Objects.requireNonNull(adminUserId, "Reviewer user ID cannot be null");
        this.reviewDecisionReason = reviewNote;
        this.reviewedAt = Objects.requireNonNull(now, "reviewedAt cannot be null");
        this.approvedAt = now;
        this.updatedAt = now;
    }

    public void reject(UUID adminUserId, String reason, Instant now) {
        if (!status.canUndergoReview()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot reject research project in status: " + status
            );
        }
        this.status = ResearchProjectStatus.REJECTED;
        this.reviewedBy = Objects.requireNonNull(adminUserId, "Reviewer user ID cannot be null");
        this.reviewDecisionReason = reason;
        this.reviewedAt = Objects.requireNonNull(now, "reviewedAt cannot be null");
        this.updatedAt = now;
    }

    public void activate(Instant now) {
        if (this.status != ResearchProjectStatus.APPROVED) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot activate research project that is not in APPROVED status. Current: " + status
            );
        }
        this.status = ResearchProjectStatus.ACTIVE;
        this.updatedAt = Objects.requireNonNull(now, "updatedAt cannot be null");
    }

    public void complete(Instant now) {
        if (this.status != ResearchProjectStatus.ACTIVE && this.status != ResearchProjectStatus.APPROVED) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot mark research project as completed unless it is APPROVED or ACTIVE. Current: " + status
            );
        }
        this.status = ResearchProjectStatus.COMPLETED;
        this.completedAt = Objects.requireNonNull(now, "completedAt cannot be null");
        this.updatedAt = now;
    }

    public void archive(Instant now) {
        if (this.status == ResearchProjectStatus.ARCHIVED) {
            return;
        }
        if (this.status == ResearchProjectStatus.UNDER_REVIEW || this.status == ResearchProjectStatus.SUBMITTED) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot archive research project that is actively pending review."
            );
        }
        this.status = ResearchProjectStatus.ARCHIVED;
        this.archivedAt = Objects.requireNonNull(now, "archivedAt cannot be null");
        this.updatedAt = now;
    }

    private static String validateTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Project title cannot be blank.");
        }
        return title.trim();
    }

    private static String validateObjective(String objective) {
        if (objective == null || objective.isBlank()) {
            throw new IllegalArgumentException("Project objective cannot be blank.");
        }
        return objective.trim();
    }

    private static String validateResearchField(String field) {
        if (field == null || field.isBlank()) {
            throw new IllegalArgumentException("Research field cannot be blank.");
        }
        return field.trim();
    }

    // Getters
    public UUID getId() { return id; }
    public UUID getOwnerUserId() { return ownerUserId; }
    public String getTitle() { return title; }
    public String getObjective() { return objective; }
    public String getDescription() { return description; }
    public String getResearchField() { return researchField; }
    public String getMethodologySummary() { return methodologySummary; }
    public String getInstitutionName() { return institutionName; }
    public String getEthicsReference() { return ethicsReference; }
    public ResearchProjectStatus getStatus() { return status; }
    public Instant getSubmittedAt() { return submittedAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public Instant getApprovedAt() { return approvedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getArchivedAt() { return archivedAt; }
    public UUID getReviewedBy() { return reviewedBy; }
    public String getReviewDecisionReason() { return reviewDecisionReason; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}
