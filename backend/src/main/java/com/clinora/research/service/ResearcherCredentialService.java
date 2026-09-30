package com.clinora.research.service;

import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.ResearcherCredentialModels.*;
import com.clinora.research.domain.CredentialVerificationStatus;
import com.clinora.research.domain.ResearcherCredentialVerification;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.repository.ResearcherCredentialVerificationRepository;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class ResearcherCredentialService {

    private static final long MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    private final ResearcherCredentialVerificationRepository credentialRepository;
    private final UserAccountRepository userRepository;
    private final ApplicationDocumentStoragePort storagePort;
    private final AuthAuditService auditService;
    private final Clock clock;
    private final ResearchAccessGuard accessGuard;

    public ResearcherCredentialService(
            ResearcherCredentialVerificationRepository credentialRepository,
            UserAccountRepository userRepository,
            ApplicationDocumentStoragePort storagePort,
            AuthAuditService auditService,
            Clock clock, ResearchAccessGuard accessGuard
    ) {
        this.credentialRepository = credentialRepository;
        this.userRepository = userRepository;
        this.storagePort = storagePort;
        this.auditService = auditService;
        this.clock = clock;
        this.accessGuard = accessGuard;
    }

    @Transactional
    public ResearcherCredentialView getOrCreateVerification(UUID userId) {
        UserAccount user = requireResearcher(userId);
        Instant now = clock.instant();

        ResearcherCredentialVerification verification = credentialRepository.findByUserId(userId)
                .orElseGet(() -> {
                    // Default 30-day deadline from user creation or now
                    Instant deadline = user.getCreatedAt() != null
                            ? user.getCreatedAt().plus(Duration.ofDays(30))
                            : now.plus(Duration.ofDays(30));
                    // If deadline has already passed for an existing account, grant 30 days from now
                    if (deadline.isBefore(now)) {
                        deadline = now.plus(Duration.ofDays(30));
                    }
                    return credentialRepository.save(new ResearcherCredentialVerification(userId, deadline, now));
                });

        // Check if deadline expired
        checkAndEnforceDeadline(user, verification, now);

        return toView(verification, now);
    }

    @Transactional
    public ResearcherCredentialView submitCredentials(
            UUID userId,
            SubmitCredentialsRequest request,
            MultipartFile studentIdFile,
            MultipartFile certFile,
            String ipAddress,
            String userAgent
    ) {
        UserAccount user = requireResearcher(userId);
        Instant now = clock.instant();

        if (studentIdFile == null || studentIdFile.isEmpty()) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST, "STUDENT_ID_FILE_REQUIRED", "Student or Faculty ID card is required.");
        }
        if (certFile == null || certFile.isEmpty()) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST, "CERTIFICATE_FILE_REQUIRED", "Educational certificate is required.");
        }

        validateFile(studentIdFile, "Student ID");
        validateFile(certFile, "Educational Certificate");

        ResearcherCredentialVerification verification = credentialRepository.findByUserId(userId)
                .orElseGet(() -> {
                    Instant deadline = user.getCreatedAt() != null
                            ? user.getCreatedAt().plus(Duration.ofDays(30))
                            : now.plus(Duration.ofDays(30));
                    return new ResearcherCredentialVerification(userId, deadline, now);
                });

        String studentIdExt = extractExtension(studentIdFile.getOriginalFilename());
        String certExt = extractExtension(certFile.getOriginalFilename());

        String studentIdKey = "credentials/" + userId + "/student-id-" + UUID.randomUUID() + "." + studentIdExt;
        String certKey = "credentials/" + userId + "/certificate-" + UUID.randomUUID() + "." + certExt;

        try {
            storagePort.put(studentIdKey, studentIdFile.getBytes(), detectMime(studentIdFile));
            storagePort.put(certKey, certFile.getBytes(), detectMime(certFile));
        } catch (IOException e) {
            throw new ResearchApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "Failed to store credential document.");
        }

        verification.submitCredentials(
                studentIdKey,
                studentIdFile.getOriginalFilename(),
                detectMime(studentIdFile),
                studentIdFile.getSize(),
                certKey,
                certFile.getOriginalFilename(),
                detectMime(certFile),
                certFile.getSize(),
                request.institutionName().trim(),
                request.degreeProgram().trim(),
                request.credentialIdNumber().trim(),
                now
        );

        // If user was previously suspended due to overdue verification, re-activate
        if (user.getAccountStatus() == AccountStatus.SUSPENDED) {
            user.reactivate(now);
            userRepository.save(user);
        }

        credentialRepository.save(verification);

        auditService.record(
                userId,
                AuthAuditAction.RESEARCHER_CREDENTIALS_SUBMITTED,
                AuthAuditOutcome.SUCCESS,
                ipAddress,
                userAgent,
                verification.getId().toString(),
                "Institution=" + request.institutionName()
        );

        return toView(verification, now);
    }

    @Transactional(readOnly = true)
    public ApplicationDocumentStoragePort.StoredObject downloadDocument(
            UUID targetUserId,
            String docType,
            UUID callerUserId,
            boolean isAdmin,
            String ipAddress,
            String userAgent
    ) {
        if (!isAdmin && !targetUserId.equals(callerUserId)) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You are not authorized to view this document.");
        }

        ResearcherCredentialVerification verification = credentialRepository.findByUserId(targetUserId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND, "VERIFICATION_NOT_FOUND", "No credential verification record exists."));

        String key;
        String filename;
        if ("student-id".equalsIgnoreCase(docType)) {
            key = verification.getStudentIdDocumentKey();
            filename = verification.getStudentIdFilename();
        } else if ("certificate".equalsIgnoreCase(docType)) {
            key = verification.getCertificateDocumentKey();
            filename = verification.getCertificateFilename();
        } else {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST, "INVALID_DOC_TYPE", "Invalid document type: " + docType);
        }

        if (key == null) {
            throw new ResearchApiException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "The requested document has not been uploaded.");
        }

        return storagePort.get(key);
    }

    @Transactional
    public ResearcherCredentialView adminVerify(
            UUID targetUserId,
            UUID adminUserId,
            AdminVerifyActionRequest request,
            String ipAddress,
            String userAgent
    ) {
        UserAccount user = requireResearcher(targetUserId);
        Instant now = clock.instant();

        ResearcherCredentialVerification verification = credentialRepository.findByUserId(targetUserId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND, "VERIFICATION_NOT_FOUND", "No verification found for user."));

        String action = request.action().trim().toUpperCase(Locale.ROOT);
        if ("APPROVE".equals(action)) {
            verification.verify(adminUserId, request.adminNotes(), now);
            if (user.getAccountStatus() == AccountStatus.SUSPENDED) {
                user.reactivate(now);
                userRepository.save(user);
            }
            auditService.record(
                    adminUserId,
                    AuthAuditAction.ADMIN_RESEARCHER_CREDENTIALS_VERIFIED,
                    AuthAuditOutcome.SUCCESS,
                    ipAddress,
                    userAgent,
                    targetUserId.toString(),
                    "Approved by admin"
            );
        } else if ("REJECT".equals(action)) {
            if (request.rejectionReason() == null || request.rejectionReason().isBlank()) {
                throw new ResearchApiException(HttpStatus.BAD_REQUEST, "REJECTION_REASON_REQUIRED", "Rejection reason must be provided.");
            }
            verification.reject(adminUserId, request.rejectionReason().trim(), request.adminNotes(), now);
            auditService.record(
                    adminUserId,
                    AuthAuditAction.ADMIN_RESEARCHER_CREDENTIALS_REJECTED,
                    AuthAuditOutcome.SUCCESS,
                    ipAddress,
                    userAgent,
                    targetUserId.toString(),
                    "Reason: " + request.rejectionReason()
            );
        } else {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST, "INVALID_ACTION", "Action must be APPROVE or REJECT.");
        }

        credentialRepository.save(verification);
        return toView(verification, now);
    }

    @Transactional
    public ResearcherCredentialView adminExtendDeadline(
            UUID targetUserId,
            UUID adminUserId,
            AdminExtendDeadlineRequest request,
            String ipAddress,
            String userAgent
    ) {
        UserAccount user = requireResearcher(targetUserId);
        Instant now = clock.instant();

        ResearcherCredentialVerification verification = credentialRepository.findByUserId(targetUserId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND, "VERIFICATION_NOT_FOUND", "No verification found for user."));

        Instant newDeadline = verification.getSubmissionDeadline().isAfter(now)
                ? verification.getSubmissionDeadline().plus(Duration.ofDays(request.additionalDays()))
                : now.plus(Duration.ofDays(request.additionalDays()));

        verification.extendDeadline(newDeadline, now);

        if (user.getAccountStatus() == AccountStatus.SUSPENDED) {
            user.reactivate(now);
            userRepository.save(user);
        }

        credentialRepository.save(verification);

        auditService.record(
                adminUserId,
                AuthAuditAction.ADMIN_RESEARCHER_DEADLINE_EXTENDED,
                AuthAuditOutcome.SUCCESS,
                ipAddress,
                userAgent,
                targetUserId.toString(),
                "Extended by " + request.additionalDays() + " days. Reason: " + request.reason()
        );

        return toView(verification, now);
    }

    @Scheduled(cron = "0 0 * * * *") // Run hourly
    @Transactional
    public void enforceOverdueDeadlines() {
        Instant now = clock.instant();
        List<ResearcherCredentialVerification> overdue = credentialRepository
                .findAllByVerificationStatusInAndSubmissionDeadlineBefore(
                        List.of(CredentialVerificationStatus.PENDING_SUBMISSION, CredentialVerificationStatus.REJECTED),
                        now
                );

        for (ResearcherCredentialVerification record : overdue) {
            record.markExpired(now);
            credentialRepository.save(record);

            userRepository.findById(record.getUserId()).ifPresent(user -> {
                if (user.getAccountStatus() == AccountStatus.ACTIVE) {
                    user.suspend(now);
                    accessGuard.revokeTokens(user.getId());
                    userRepository.save(user);
                    auditService.record(
                            null,
                            AuthAuditAction.RESEARCHER_ACCOUNT_AUTO_SUSPENDED_OVERDUE,
                            AuthAuditOutcome.SUCCESS,
                            "SYSTEM",
                            "ClinoraScheduler",
                            user.getId().toString(),
                            "Suspended due to overdue credential verification deadline"
                    );
                }
            });
        }
    }

    private void checkAndEnforceDeadline(UserAccount user, ResearcherCredentialVerification verification, Instant now) {
        if (verification.getVerificationStatus() == CredentialVerificationStatus.PENDING_SUBMISSION
                || verification.getVerificationStatus() == CredentialVerificationStatus.REJECTED) {
            if (now.isAfter(verification.getSubmissionDeadline())) {
                verification.markExpired(now);
                credentialRepository.save(verification);

                if (user.getAccountStatus() == AccountStatus.ACTIVE) {
                    user.suspend(now);
                    accessGuard.revokeTokens(user.getId());
                    userRepository.save(user);
                    auditService.record(
                            null,
                            AuthAuditAction.RESEARCHER_ACCOUNT_AUTO_SUSPENDED_OVERDUE,
                            AuthAuditOutcome.SUCCESS,
                            "SYSTEM",
                            "AutoCheck",
                            user.getId().toString(),
                            "Suspended due to overdue credential verification deadline"
                    );
                }
            }
        }
    }

    private void validateFile(MultipartFile file, String name) {
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", name + " exceeds maximum allowed size of 15MB.");
        }
        String mime = detectMime(file);
        if (!ALLOWED_MIME_TYPES.contains(mime)) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE_TYPE", name + " must be a PDF, JPEG, or PNG document.");
        }
    }

    private String detectMime(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()) {
            return contentType.toLowerCase(Locale.ROOT);
        }
        String filename = file.getOriginalFilename();
        if (filename != null && filename.toLowerCase(Locale.ROOT).endsWith(".pdf")) return "application/pdf";
        if (filename != null && (filename.toLowerCase(Locale.ROOT).endsWith(".jpg") || filename.toLowerCase(Locale.ROOT).endsWith(".jpeg"))) return "image/jpeg";
        if (filename != null && filename.toLowerCase(Locale.ROOT).endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    private String extractExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "bin";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    private UserAccount requireResearcher(UUID userId) {
        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found."));
        if (user.getRole() != UserRole.RESEARCHER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "User is not a researcher.");
        }
        return user;
    }

    private ResearcherCredentialView toView(ResearcherCredentialVerification v, Instant now) {
        long secondsRemaining = Math.max(0, Duration.between(now, v.getSubmissionDeadline()).toSeconds());
        boolean isExpired = v.getVerificationStatus() == CredentialVerificationStatus.EXPIRED || (now.isAfter(v.getSubmissionDeadline()) && v.getVerificationStatus() != CredentialVerificationStatus.VERIFIED && v.getVerificationStatus() != CredentialVerificationStatus.SUBMITTED);
        boolean isSuspendedRisk = (v.getVerificationStatus() == CredentialVerificationStatus.PENDING_SUBMISSION || v.getVerificationStatus() == CredentialVerificationStatus.REJECTED);

        return new ResearcherCredentialView(
                v.getId(),
                v.getUserId(),
                v.getVerificationStatus(),
                v.getStudentIdDocumentKey() != null,
                v.getStudentIdFilename(),
                v.getStudentIdSizeBytes(),
                v.getStudentIdMimeType(),
                v.getCertificateDocumentKey() != null,
                v.getCertificateFilename(),
                v.getCertificateSizeBytes(),
                v.getCertificateMimeType(),
                v.getInstitutionName(),
                v.getDegreeProgram(),
                v.getCredentialIdNumber(),
                v.getSubmissionDeadline(),
                secondsRemaining,
                v.getSubmittedAt(),
                v.getReviewedAt(),
                v.getReviewedByUserId(),
                v.getRejectionReason(),
                v.getAdminNotes(),
                isExpired,
                isSuspendedRisk
        );
    }
}
