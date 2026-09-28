package com.clinora.research.api;

import com.clinora.research.domain.CredentialVerificationStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class ResearcherCredentialModels {

    private ResearcherCredentialModels() {}

    public record ResearcherCredentialView(
            UUID id,
            UUID userId,
            CredentialVerificationStatus verificationStatus,
            boolean hasStudentId,
            String studentIdFilename,
            Long studentIdSizeBytes,
            String studentIdMimeType,
            boolean hasCertificate,
            String certificateFilename,
            Long certificateSizeBytes,
            String certificateMimeType,
            String institutionName,
            String degreeProgram,
            String credentialIdNumber,
            Instant submissionDeadline,
            long secondsRemaining,
            Instant submittedAt,
            Instant reviewedAt,
            UUID reviewedByUserId,
            String rejectionReason,
            String adminNotes,
            boolean isExpired,
            boolean isSuspendedRisk
    ) {}

    public record SubmitCredentialsRequest(
            @NotBlank(message = "Institution name is required.")
            @Size(max = 255, message = "Institution name must not exceed 255 characters.")
            String institutionName,

            @NotBlank(message = "Degree or research program is required.")
            @Size(max = 255, message = "Degree program must not exceed 255 characters.")
            String degreeProgram,

            @NotBlank(message = "Student ID or faculty credential number is required.")
            @Size(max = 100, message = "Credential ID number must not exceed 100 characters.")
            String credentialIdNumber
    ) {}

    public record AdminVerifyActionRequest(
            @NotBlank(message = "Action must be APPROVE or REJECT.")
            String action, // "APPROVE" or "REJECT"

            @Size(max = 2000, message = "Rejection reason must not exceed 2000 characters.")
            String rejectionReason,

            @Size(max = 2000, message = "Admin notes must not exceed 2000 characters.")
            String adminNotes
    ) {}

    public record AdminExtendDeadlineRequest(
            @Min(value = 1, message = "Must extend by at least 1 day.")
            @Max(value = 90, message = "Cannot extend by more than 90 days at a time.")
            int additionalDays,

            @Size(max = 500, message = "Reason must not exceed 500 characters.")
            String reason
    ) {}
}
