package com.clinora.research.domain;

import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

@Entity
@Table(name = "research_dataset_requests")
public class DatasetRequest {

    private static final Pattern RAW_SQL_PATTERN = Pattern.compile(
            "\\b(select\\s+.+\\s+from|insert\\s+into|update\\s+.+\\s+set|delete\\s+from|drop\\s+table|truncate\\s+table|union\\s+select)\\b",
            Pattern.CASE_INSENSITIVE
    );

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String purpose;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "requested_population", columnDefinition = "jsonb", nullable = false)
    private String requestedPopulation;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "requested_variables", columnDefinition = "jsonb", nullable = false)
    private String requestedVariables;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "requested_filters", columnDefinition = "jsonb", nullable = false)
    private String requestedFilters;

    @Enumerated(EnumType.STRING)
    @Column(name = "requested_format", nullable = false, length = 32)
    private DatasetFormat requestedFormat;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 48)
    private DatasetRequestStatus status;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected DatasetRequest() {}

    public DatasetRequest(
            UUID id,
            UUID projectId,
            String name,
            String purpose,
            String requestedPopulation,
            String requestedVariables,
            String requestedFilters,
            DatasetFormat requestedFormat,
            Instant now
    ) {
        this.id = Objects.requireNonNull(id, "Dataset request ID cannot be null");
        this.projectId = Objects.requireNonNull(projectId, "Project ID cannot be null");
        this.name = validateName(name);
        this.purpose = validatePurpose(purpose);
        this.requestedPopulation = validateStructuredJson(requestedPopulation, "requestedPopulation", "{}");
        this.requestedVariables = validateStructuredJson(requestedVariables, "requestedVariables", "[]");
        this.requestedFilters = validateStructuredJson(requestedFilters, "requestedFilters", "{}");
        this.requestedFormat = Objects.requireNonNull(requestedFormat, "Requested format cannot be null");
        this.status = DatasetRequestStatus.DRAFT;
        this.createdAt = Objects.requireNonNull(now, "CreatedAt cannot be null");
        this.updatedAt = now;
        this.version = 0L;
    }

    public static DatasetRequest createDraft(
            UUID projectId,
            String name,
            String purpose,
            String requestedPopulation,
            String requestedVariables,
            String requestedFilters,
            DatasetFormat requestedFormat,
            Instant now
    ) {
        return new DatasetRequest(
                UUID.randomUUID(),
                projectId,
                name,
                purpose,
                requestedPopulation,
                requestedVariables,
                requestedFilters,
                requestedFormat,
                now
        );
    }

    public void updateDraft(
            String name,
            String purpose,
            String requestedPopulation,
            String requestedVariables,
            String requestedFilters,
            DatasetFormat requestedFormat,
            Instant now
    ) {
        if (!status.isEditable()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.PROJECT_NOT_EDITABLE,
                    "Dataset request cannot be edited when in status: " + status
            );
        }
        this.name = validateName(name);
        this.purpose = validatePurpose(purpose);
        this.requestedPopulation = validateStructuredJson(requestedPopulation, "requestedPopulation", "{}");
        this.requestedVariables = validateStructuredJson(requestedVariables, "requestedVariables", "[]");
        this.requestedFilters = validateStructuredJson(requestedFilters, "requestedFilters", "{}");
        if (requestedFormat != null) {
            this.requestedFormat = requestedFormat;
        }
        this.updatedAt = Objects.requireNonNull(now, "UpdatedAt cannot be null");
    }

    public void submit(Instant now) {
        if (!status.canBeSubmitted()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot submit dataset request in status: " + status
            );
        }
        this.status = DatasetRequestStatus.SUBMITTED;
        this.submittedAt = Objects.requireNonNull(now, "SubmittedAt cannot be null");
        this.updatedAt = now;
    }

    public void cancel(Instant now) {
        if (!status.canBeCancelled()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot cancel dataset request in status: " + status
            );
        }
        this.status = DatasetRequestStatus.CANCELLED;
        this.updatedAt = Objects.requireNonNull(now, "UpdatedAt cannot be null");
    }

    public void startReview(UUID adminUserId, Instant now) {
        if (!status.canUndergoReview()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot start review on dataset request in status: " + status
            );
        }
        this.status = DatasetRequestStatus.UNDER_REVIEW;
        this.reviewedBy = Objects.requireNonNull(adminUserId, "Reviewer cannot be null");
        this.reviewedAt = Objects.requireNonNull(now, "ReviewedAt cannot be null");
        this.updatedAt = now;
    }

    public void requestMoreInfo(UUID adminUserId, String notes, Instant now) {
        if (!status.canUndergoReview()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot request more info on dataset request in status: " + status
            );
        }
        this.status = DatasetRequestStatus.MORE_INFO_REQUIRED;
        this.reviewedBy = Objects.requireNonNull(adminUserId, "Reviewer cannot be null");
        this.reviewNotes = notes;
        this.reviewedAt = Objects.requireNonNull(now, "ReviewedAt cannot be null");
        this.updatedAt = now;
    }

    public void approve(UUID adminUserId, String notes, Instant expiresAt, Instant now) {
        if (!status.canUndergoReview()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot approve dataset request in status: " + status
            );
        }
        this.status = DatasetRequestStatus.APPROVED;
        this.reviewedBy = Objects.requireNonNull(adminUserId, "Reviewer cannot be null");
        this.reviewNotes = notes;
        this.approvedAt = Objects.requireNonNull(now, "ApprovedAt cannot be null");
        this.reviewedAt = now;
        this.expiresAt = expiresAt;
        this.updatedAt = now;
    }

    public void reject(UUID adminUserId, String reason, Instant now) {
        if (!status.canUndergoReview()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Cannot reject dataset request in status: " + status
            );
        }
        this.status = DatasetRequestStatus.REJECTED;
        this.reviewedBy = Objects.requireNonNull(adminUserId, "Reviewer cannot be null");
        this.reviewNotes = reason;
        this.reviewedAt = Objects.requireNonNull(now, "ReviewedAt cannot be null");
        this.updatedAt = now;
    }

    private static String validateName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Dataset request name cannot be blank.");
        }
        return name.trim();
    }

    private static String validatePurpose(String purpose) {
        if (purpose == null || purpose.isBlank()) {
            throw new IllegalArgumentException("Dataset request purpose cannot be blank.");
        }
        return purpose.trim();
    }

    private static String validateStructuredJson(String json, String fieldName, String defaultValue) {
        if (json == null || json.isBlank()) {
            return defaultValue;
        }
        String trimmed = json.trim();
        if (RAW_SQL_PATTERN.matcher(trimmed).find()) {
            throw new ResearchApiException(
                    HttpStatus.BAD_REQUEST,
                    ResearchErrorCode.INVALID_SUBMISSION,
                    fieldName + " contains prohibited raw SQL query. Only structured criteria are allowed."
            );
        }
        if (!(trimmed.startsWith("{") && trimmed.endsWith("}")) && !(trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            throw new ResearchApiException(
                    HttpStatus.BAD_REQUEST,
                    ResearchErrorCode.INVALID_SUBMISSION,
                    fieldName + " must be a valid structured JSON object or array."
            );
        }
        return trimmed;
    }

    // Getters
    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public String getName() { return name; }
    public String getPurpose() { return purpose; }
    public String getRequestedPopulation() { return requestedPopulation; }
    public String getRequestedVariables() { return requestedVariables; }
    public String getRequestedFilters() { return requestedFilters; }
    public DatasetFormat getRequestedFormat() { return requestedFormat; }
    public DatasetRequestStatus getStatus() { return status; }
    public Instant getSubmittedAt() { return submittedAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public Instant getApprovedAt() { return approvedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public UUID getReviewedBy() { return reviewedBy; }
    public String getReviewNotes() { return reviewNotes; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}
