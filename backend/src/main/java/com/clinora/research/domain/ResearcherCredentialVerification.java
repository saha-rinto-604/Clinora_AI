package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "researcher_credential_verifications")
public class ResearcherCredentialVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 40)
    private CredentialVerificationStatus verificationStatus;

    @Column(name = "student_id_document_key", length = 500)
    private String studentIdDocumentKey;

    @Column(name = "student_id_filename", length = 255)
    private String studentIdFilename;

    @Column(name = "student_id_mime_type", length = 100)
    private String studentIdMimeType;

    @Column(name = "student_id_size_bytes")
    private Long studentIdSizeBytes;

    @Column(name = "certificate_document_key", length = 500)
    private String certificateDocumentKey;

    @Column(name = "certificate_filename", length = 255)
    private String certificateFilename;

    @Column(name = "certificate_mime_type", length = 100)
    private String certificateMimeType;

    @Column(name = "certificate_size_bytes")
    private Long certificateSizeBytes;

    @Column(name = "institution_name", length = 255)
    private String institutionName;

    @Column(name = "degree_program", length = 255)
    private String degreeProgram;

    @Column(name = "credential_id_number", length = 100)
    private String credentialIdNumber;

    @Column(name = "submission_deadline", nullable = false)
    private Instant submissionDeadline;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reviewed_by_user_id")
    private UUID reviewedByUserId;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "admin_notes", columnDefinition = "TEXT")
    private String adminNotes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ResearcherCredentialVerification() {}

    public ResearcherCredentialVerification(UUID userId, Instant submissionDeadline, Instant now) {
        this.userId = userId;
        this.verificationStatus = CredentialVerificationStatus.PENDING_SUBMISSION;
        this.submissionDeadline = submissionDeadline;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void submitCredentials(
            String studentIdKey,
            String studentIdFilename,
            String studentIdMimeType,
            long studentIdSizeBytes,
            String certKey,
            String certFilename,
            String certMimeType,
            long certSizeBytes,
            String institutionName,
            String degreeProgram,
            String credentialIdNumber,
            Instant now
    ) {
        this.studentIdDocumentKey = studentIdKey;
        this.studentIdFilename = studentIdFilename;
        this.studentIdMimeType = studentIdMimeType;
        this.studentIdSizeBytes = studentIdSizeBytes;

        this.certificateDocumentKey = certKey;
        this.certificateFilename = certFilename;
        this.certificateMimeType = certMimeType;
        this.certificateSizeBytes = certSizeBytes;

        this.institutionName = institutionName;
        this.degreeProgram = degreeProgram;
        this.credentialIdNumber = credentialIdNumber;

        this.verificationStatus = CredentialVerificationStatus.SUBMITTED;
        this.submittedAt = now;
        this.updatedAt = now;
        this.rejectionReason = null; // Clear previous rejection reason on resubmission
    }

    public void verify(UUID reviewerUserId, String notes, Instant now) {
        this.verificationStatus = CredentialVerificationStatus.VERIFIED;
        this.reviewedAt = now;
        this.reviewedByUserId = reviewerUserId;
        this.adminNotes = notes;
        this.updatedAt = now;
    }

    public void reject(UUID reviewerUserId, String reason, String notes, Instant now) {
        this.verificationStatus = CredentialVerificationStatus.REJECTED;
        this.reviewedAt = now;
        this.reviewedByUserId = reviewerUserId;
        this.rejectionReason = reason;
        this.adminNotes = notes;
        this.updatedAt = now;
    }

    public void extendDeadline(Instant newDeadline, Instant now) {
        this.submissionDeadline = newDeadline;
        if (this.verificationStatus == CredentialVerificationStatus.EXPIRED) {
            this.verificationStatus = CredentialVerificationStatus.PENDING_SUBMISSION;
        }
        this.updatedAt = now;
    }

    public void markExpired(Instant now) {
        this.verificationStatus = CredentialVerificationStatus.EXPIRED;
        this.updatedAt = now;
    }

    // Getters
    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public CredentialVerificationStatus getVerificationStatus() { return verificationStatus; }
    public String getStudentIdDocumentKey() { return studentIdDocumentKey; }
    public String getStudentIdFilename() { return studentIdFilename; }
    public String getStudentIdMimeType() { return studentIdMimeType; }
    public Long getStudentIdSizeBytes() { return studentIdSizeBytes; }
    public String getCertificateDocumentKey() { return certificateDocumentKey; }
    public String getCertificateFilename() { return certificateFilename; }
    public String getCertificateMimeType() { return certificateMimeType; }
    public Long getCertificateSizeBytes() { return certificateSizeBytes; }
    public String getInstitutionName() { return institutionName; }
    public String getDegreeProgram() { return degreeProgram; }
    public String getCredentialIdNumber() { return credentialIdNumber; }
    public Instant getSubmissionDeadline() { return submissionDeadline; }
    public Instant getSubmittedAt() { return submittedAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public UUID getReviewedByUserId() { return reviewedByUserId; }
    public String getRejectionReason() { return rejectionReason; }
    public String getAdminNotes() { return adminNotes; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
