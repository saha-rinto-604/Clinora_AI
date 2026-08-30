package com.clinora.patients.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.config.PatientReportStorageProperties;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.domain.PatientMedicalReport;
import com.clinora.patients.domain.PatientReportType;
import com.clinora.patients.repository.PatientMedicalReportRepository;
import com.clinora.patients.storage.PatientReportStoragePort;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PatientReportService {
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("application/pdf", "image/jpeg", "image/png");

    private final UserAccountRepository users;
    private final PatientMedicalReportRepository reports;
    private final PatientReportStoragePort storage;
    private final PatientReportStorageProperties properties;
    private final AuthAuditService audit;
    private final Clock clock;

    public PatientReportService(
        UserAccountRepository users,
        PatientMedicalReportRepository reports,
        PatientReportStoragePort storage,
        PatientReportStorageProperties properties,
        AuthAuditService audit,
        Clock clock
    ) {
        this.users = users;
        this.reports = reports;
        this.storage = storage;
        this.properties = properties;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public ReportView upload(
        UUID patientUserId,
        UploadReportCommand command,
        MultipartFile file,
        String ipAddress,
        String userAgent
    ) {
        requireActivePatient(patientUserId);
        String reportName = requiredText(command.reportName(), 160, "REPORT_NAME_INVALID", "Enter a report name.");
        PatientReportType reportType = requiredReportType(command.reportType());
        String provider = optionalText(command.providerLaboratory(), 200, "REPORT_PROVIDER_INVALID");
        validateReportDate(command.reportDate());

        byte[] bytes = read(file);
        String detectedMime = validateFile(file, bytes);
        String originalFilename = safeFilename(file.getOriginalFilename());
        if (!extensionCompatible(originalFilename, detectedMime)) {
            throw badRequest(
                "REPORT_FILE_EXTENSION_INVALID",
                "The filename extension does not match the selected document."
            );
        }

        Instant now = clock.instant();
        String objectKey = objectKey(patientUserId, now, detectedMime);
        putSecurely(objectKey, bytes, detectedMime);
        deleteObjectIfTransactionRollsBack(objectKey);

        PatientMedicalReport report = new PatientMedicalReport(
            patientUserId,
            reportName,
            reportType,
            command.reportDate(),
            provider,
            objectKey,
            originalFilename,
            detectedMime,
            bytes.length,
            sha256(bytes),
            now
        );

        try {
            report = reports.save(report);
        } catch (RuntimeException exception) {
            try {
                storage.delete(objectKey);
            } catch (RuntimeException cleanupFailure) {
                exception.addSuppressed(cleanupFailure);
            }
            throw exception;
        }

        audit.record(
            patientUserId,
            AuthAuditAction.PATIENT_REPORT_UPLOADED,
            AuthAuditOutcome.SUCCESS,
            ipAddress,
            userAgent,
            report.getId().toString(),
            null
        );
        return view(report);
    }

    @Transactional(readOnly = true)
    public ReportPageView list(
        UUID patientUserId,
        String query,
        PatientReportType reportType,
        ReportCollection collection,
        int page,
        int size
    ) {
        requireActivePatient(patientUserId);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(50, Math.max(1, size));
        String searchText = optionalText(query, 100, "REPORT_SEARCH_INVALID");
        if (searchText == null) {
            searchText = "";
        }
        Page<PatientMedicalReport> result = reports.search(
            patientUserId,
            collection == ReportCollection.ARCHIVED,
            reportType,
            searchText,
            PageRequest.of(safePage - 1, safeSize)
        );
        return new ReportPageView(
            result.getContent().stream().map(this::view).toList(),
            safePage,
            safeSize,
            result.getTotalElements(),
            result.getTotalPages(),
            result.hasPrevious(),
            result.hasNext(),
            reports.countByPatientUserIdAndArchivedAtIsNull(patientUserId),
            reports.countByPatientUserIdAndArchivedAtIsNotNull(patientUserId)
        );
    }

    @Transactional(readOnly = true)
    public ReportView detail(UUID patientUserId, UUID reportId) {
        requireActivePatient(patientUserId);
        return view(requireOwnedReport(patientUserId, reportId));
    }

    @Transactional
    public ReportContent content(
        UUID patientUserId,
        UUID reportId,
        ContentAccess access,
        String ipAddress,
        String userAgent
    ) {
        requireActivePatient(patientUserId);
        PatientMedicalReport report = requireOwnedReport(patientUserId, reportId);
        PatientReportStoragePort.StoredObject stored;
        try {
            stored = storage.get(report.getObjectKey());
        } catch (RuntimeException exception) {
            throw new PatientApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "REPORT_STORAGE_UNAVAILABLE",
                "This report is temporarily unavailable. Please try again."
            );
        }
        if (!sha256(stored.bytes()).equals(report.getSha256Checksum())) {
            throw new PatientApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "REPORT_CONTENT_INTEGRITY_FAILED",
                "This report could not be verified and is temporarily unavailable."
            );
        }

        audit.record(
            patientUserId,
            access == ContentAccess.DOWNLOAD
                ? AuthAuditAction.PATIENT_REPORT_DOWNLOADED
                : AuthAuditAction.PATIENT_REPORT_VIEWED,
            AuthAuditOutcome.SUCCESS,
            ipAddress,
            userAgent,
            reportId.toString(),
            null
        );
        return new ReportContent(report.getOriginalFilename(), report.getMimeType(), stored.bytes());
    }

    @Transactional
    public ReportView updateMetadata(
        UUID patientUserId,
        UUID reportId,
        UpdateReportCommand command,
        String ipAddress,
        String userAgent
    ) {
        requireActivePatient(patientUserId);
        PatientMedicalReport report = requireOwnedReport(patientUserId, reportId);
        String reportName = requiredText(command.reportName(), 160, "REPORT_NAME_INVALID", "Enter a report name.");
        PatientReportType reportType = requiredReportType(command.reportType());
        String provider = optionalText(command.providerLaboratory(), 200, "REPORT_PROVIDER_INVALID");
        validateReportDate(command.reportDate());
        report.updateMetadata(reportName, reportType, command.reportDate(), provider, clock.instant());
        reports.save(report);
        audit.record(
            patientUserId,
            AuthAuditAction.PATIENT_REPORT_METADATA_UPDATED,
            AuthAuditOutcome.SUCCESS,
            ipAddress,
            userAgent,
            reportId.toString(),
            null
        );
        return view(report);
    }

    @Transactional
    public ReportView archive(UUID patientUserId, UUID reportId, String ipAddress, String userAgent) {
        requireActivePatient(patientUserId);
        PatientMedicalReport report = requireOwnedReport(patientUserId, reportId);
        if (report.archive(clock.instant())) {
            reports.save(report);
            audit.record(
                patientUserId,
                AuthAuditAction.PATIENT_REPORT_ARCHIVED,
                AuthAuditOutcome.SUCCESS,
                ipAddress,
                userAgent,
                reportId.toString(),
                null
            );
        }
        return view(report);
    }

    @Transactional
    public ReportView restore(UUID patientUserId, UUID reportId, String ipAddress, String userAgent) {
        requireActivePatient(patientUserId);
        PatientMedicalReport report = requireOwnedReport(patientUserId, reportId);
        if (report.restore(clock.instant())) {
            reports.save(report);
            audit.record(
                patientUserId,
                AuthAuditAction.PATIENT_REPORT_RESTORED,
                AuthAuditOutcome.SUCCESS,
                ipAddress,
                userAgent,
                reportId.toString(),
                null
            );
        }
        return view(report);
    }

    private UserAccount requireActivePatient(UUID userId) {
        UserAccount user = users.findById(userId).orElseThrow(() -> new PatientApiException(
            HttpStatus.UNAUTHORIZED,
            "PATIENT_ACCOUNT_NOT_FOUND",
            "The authenticated Patient account is unavailable."
        ));
        if (user.getRole() != UserRole.PATIENT) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "PATIENT_ROLE_REQUIRED", "Patient access is required.");
        }
        if (!user.isLoginAllowed()) {
            throw new PatientApiException(
                HttpStatus.FORBIDDEN,
                "PATIENT_ACCOUNT_INACTIVE",
                "This Patient account is not currently active."
            );
        }
        return user;
    }

    private PatientMedicalReport requireOwnedReport(UUID patientUserId, UUID reportId) {
        return reports.findByIdAndPatientUserId(reportId, patientUserId).orElseThrow(() -> new PatientApiException(
            HttpStatus.NOT_FOUND,
            "PATIENT_REPORT_NOT_FOUND",
            "That medical report could not be found."
        ));
    }

    private byte[] read(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException exception) {
            throw badRequest("REPORT_FILE_READ_FAILED", "The selected file could not be read.");
        }
    }

    private String validateFile(MultipartFile file, byte[] bytes) {
        long maxBytes = properties.getMaxFileSize().toBytes();
        if (bytes.length == 0) {
            throw badRequest("REPORT_FILE_EMPTY", "Choose a non-empty medical report.");
        }
        if (bytes.length > maxBytes) {
            throw badRequest("REPORT_FILE_TOO_LARGE", "Medical reports must be 20 MB or smaller.");
        }
        String detectedMime = detectMime(bytes);
        if (!ALLOWED_MIME_TYPES.contains(detectedMime) || !hasValidTerminator(detectedMime, bytes)) {
            throw badRequest("REPORT_FILE_INVALID", "Choose a valid PDF, JPG, JPEG, or PNG medical report.");
        }
        String suppliedMime = file.getContentType();
        if (suppliedMime != null && !suppliedMime.isBlank() && !compatibleMime(suppliedMime, detectedMime)) {
            throw badRequest("REPORT_FILE_TYPE_MISMATCH", "The selected file content does not match its type.");
        }
        return detectedMime;
    }

    private String detectMime(byte[] bytes) {
        if (bytes.length >= 5
            && bytes[0] == '%'
            && bytes[1] == 'P'
            && bytes[2] == 'D'
            && bytes[3] == 'F'
            && bytes[4] == '-') return "application/pdf";
        if (bytes.length >= 3
            && (bytes[0] & 0xff) == 0xff
            && (bytes[1] & 0xff) == 0xd8
            && (bytes[2] & 0xff) == 0xff) return "image/jpeg";
        if (bytes.length >= 8
            && (bytes[0] & 0xff) == 0x89
            && bytes[1] == 'P'
            && bytes[2] == 'N'
            && bytes[3] == 'G'
            && (bytes[4] & 0xff) == 0x0d
            && (bytes[5] & 0xff) == 0x0a
            && (bytes[6] & 0xff) == 0x1a
            && (bytes[7] & 0xff) == 0x0a) return "image/png";
        return "application/octet-stream";
    }

    private boolean hasValidTerminator(String mimeType, byte[] bytes) {
        return switch (mimeType) {
            case "application/pdf" -> {
                int start = Math.max(0, bytes.length - 2048);
                String tail = new String(Arrays.copyOfRange(bytes, start, bytes.length), StandardCharsets.US_ASCII);
                yield tail.contains("%%EOF");
            }
            case "image/jpeg" -> bytes.length >= 4
                && (bytes[bytes.length - 2] & 0xff) == 0xff
                && (bytes[bytes.length - 1] & 0xff) == 0xd9;
            case "image/png" -> {
                int start = Math.max(0, bytes.length - 32);
                String tail = new String(Arrays.copyOfRange(bytes, start, bytes.length), StandardCharsets.ISO_8859_1);
                yield tail.contains("IEND");
            }
            default -> false;
        };
    }

    private boolean compatibleMime(String supplied, String detected) {
        return supplied.equalsIgnoreCase(detected)
            || (detected.equals("image/jpeg") && supplied.equalsIgnoreCase("image/jpg"));
    }

    private boolean extensionCompatible(String filename, String mimeType) {
        String lower = filename.toLowerCase(Locale.ROOT);
        return switch (mimeType) {
            case "application/pdf" -> lower.endsWith(".pdf");
            case "image/jpeg" -> lower.endsWith(".jpg") || lower.endsWith(".jpeg");
            case "image/png" -> lower.endsWith(".png");
            default -> false;
        };
    }

    private String extensionFor(String mimeType) {
        return switch (mimeType) {
            case "application/pdf" -> ".pdf";
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            default -> "";
        };
    }

    private String safeFilename(String value) {
        if (value == null || value.isBlank()) return "medical-report";
        String normalized = value.replace('\\', '/');
        String filename = normalized.substring(normalized.lastIndexOf('/') + 1)
            .replaceAll("[\\r\\n\\u0000-\\u001f\\u007f]", "")
            .trim();
        if (filename.isEmpty()) return "medical-report";
        return filename.substring(0, Math.min(255, filename.length()));
    }

    private String objectKey(UUID patientUserId, Instant now, String mimeType) {
        var date = now.atZone(ZoneOffset.UTC);
        return "patient-reports/" + patientUserId + "/" + date.getYear() + "/"
            + String.format(Locale.ROOT, "%02d", date.getMonthValue()) + "/"
            + UUID.randomUUID() + extensionFor(mimeType);
    }

    private void putSecurely(String objectKey, byte[] bytes, String mimeType) {
        try {
            storage.put(objectKey, bytes, mimeType);
        } catch (RuntimeException exception) {
            throw new PatientApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "REPORT_STORAGE_UNAVAILABLE",
                "Secure report storage is temporarily unavailable. Please try again."
            );
        }
    }

    private void deleteObjectIfTransactionRollsBack(String objectKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == TransactionSynchronization.STATUS_COMMITTED) {
                    return;
                }
                try {
                    storage.delete(objectKey);
                } catch (RuntimeException ignored) {
                    // Do not mask the original transaction result; object deletion is idempotent and best-effort here.
                }
            }
        });
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void validateReportDate(LocalDate reportDate) {
        if (reportDate != null && reportDate.isAfter(LocalDate.now(clock))) {
            throw badRequest("REPORT_DATE_INVALID", "The date on the report cannot be in the future.");
        }
    }

    private PatientReportType requiredReportType(PatientReportType reportType) {
        if (reportType == null) {
            throw badRequest("REPORT_TYPE_INVALID", "Choose a report type.");
        }
        return reportType;
    }

    private String requiredText(String value, int maxLength, String code, String message) {
        String cleaned = optionalText(value, maxLength, code);
        if (cleaned == null) throw badRequest(code, message);
        return cleaned;
    }

    private String optionalText(String value, int maxLength, String code) {
        if (value == null) return null;
        String cleaned = value.trim().replaceAll("\\s+", " ");
        if (cleaned.isEmpty()) return null;
        if (cleaned.length() > maxLength) throw badRequest(code, "The supplied report information is too long.");
        return cleaned;
    }

    private PatientApiException badRequest(String code, String message) {
        return new PatientApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private ReportView view(PatientMedicalReport report) {
        return new ReportView(
            report.getId(),
            report.getReportName(),
            report.getReportType(),
            report.getReportDate(),
            report.getProviderLaboratory(),
            report.getOriginalFilename(),
            report.getMimeType(),
            report.getSizeBytes(),
            report.getArchivedAt() != null,
            report.getArchivedAt(),
            report.getCreatedAt(),
            report.getUpdatedAt()
        );
    }

    public enum ReportCollection { ACTIVE, ARCHIVED }
    public enum ContentAccess { VIEW, DOWNLOAD }

    public record UploadReportCommand(
        String reportName,
        PatientReportType reportType,
        LocalDate reportDate,
        String providerLaboratory
    ) {
    }

    public record UpdateReportCommand(
        String reportName,
        PatientReportType reportType,
        LocalDate reportDate,
        String providerLaboratory
    ) {
    }

    public record ReportView(
        UUID id,
        String reportName,
        PatientReportType reportType,
        LocalDate reportDate,
        String providerLaboratory,
        String originalFilename,
        String mimeType,
        long sizeBytes,
        boolean archived,
        Instant archivedAt,
        Instant createdAt,
        Instant updatedAt
    ) {
    }

    public record ReportPageView(
        java.util.List<ReportView> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        boolean hasPrevious,
        boolean hasNext,
        long activeCount,
        long archivedCount
    ) {
    }

    public record ReportContent(String filename, String contentType, byte[] bytes) {
    }
}
