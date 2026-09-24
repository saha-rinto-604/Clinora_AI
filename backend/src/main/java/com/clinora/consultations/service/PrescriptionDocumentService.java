package com.clinora.consultations.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.config.PatientReportSecurityProperties;
import com.clinora.config.PatientReportStorageProperties;
import com.clinora.consultations.service.ConsultationModels.PrescriptionDocumentView;
import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.security.PatientReportMalwareScanner;
import com.clinora.patients.security.PatientReportMalwareScanner.ScanResult;
import com.clinora.patients.storage.PatientReportStoragePort;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PrescriptionDocumentService {
    private static final int MAX_DOCUMENTS = 5;
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("application/pdf", "image/jpeg", "image/png");

    private final JdbcTemplate jdbc;
    private final DoctorClinicalAccessService access;
    private final PatientReportStoragePort storage;
    private final PatientReportStorageProperties storageProperties;
    private final PatientReportMalwareScanner malwareScanner;
    private final PatientReportSecurityProperties securityProperties;
    private final AuthAuditService audit;
    private final Clock clock;

    public PrescriptionDocumentService(
        JdbcTemplate jdbc,
        DoctorClinicalAccessService access,
        PatientReportStoragePort storage,
        PatientReportStorageProperties storageProperties,
        PatientReportMalwareScanner malwareScanner,
        PatientReportSecurityProperties securityProperties,
        AuthAuditService audit,
        Clock clock
    ) {
        this.jdbc = jdbc;
        this.access = access;
        this.storage = storage;
        this.storageProperties = storageProperties;
        this.malwareScanner = malwareScanner;
        this.securityProperties = securityProperties;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<PrescriptionDocumentView> doctorList(UUID doctorId, UUID consultationId) {
        access.requireActiveDoctor(doctorId);
        requireDoctorConsultation(doctorId, consultationId, false);
        return listForConsultation(consultationId);
    }

    @Transactional
    public PrescriptionDocumentView upload(
        UUID doctorId,
        UUID consultationId,
        MultipartFile file,
        String ipAddress,
        String userAgent
    ) {
        access.requireActiveDoctor(doctorId);
        LockedConsultation consultation = lockDoctorConsultation(doctorId, consultationId);
        if (!"IN_PROGRESS".equals(consultation.status())) {
            throw doctorConflict("PRESCRIPTION_DOCUMENT_FINALIZED", "Completed consultation prescriptions are read-only.");
        }

        byte[] bytes = read(file);
        String mimeType = validateFile(file, bytes);
        String originalFilename = safeFilename(file.getOriginalFilename(), mimeType);
        if (!extensionCompatible(originalFilename, mimeType)) {
            throw doctorBadRequest(
                "PRESCRIPTION_DOCUMENT_EXTENSION_INVALID",
                "The filename extension does not match the prescription document."
            );
        }

        ScanResult scanResult = malwareScanner.scan(file);
        if (scanResult == ScanResult.INFECTED) {
            throw doctorBadRequest(
                "PRESCRIPTION_DOCUMENT_UNSAFE",
                "This prescription document could not be accepted because it failed the security scan."
            );
        }
        if (scanResult == ScanResult.UNAVAILABLE && securityProperties.isFailClosed()) {
            throw new DoctorApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "PRESCRIPTION_DOCUMENT_SCAN_UNAVAILABLE",
                "Prescription document security scanning is temporarily unavailable. Try again shortly."
            );
        }

        String checksum = sha256(bytes);
        List<PrescriptionDocumentView> duplicate = jdbc.query(
            """
            SELECT id, consultation_id, original_filename, mime_type, size_bytes, created_at
              FROM consultation_prescription_documents
             WHERE consultation_id = ? AND sha256_checksum = ?
            """,
            (rs, rowNum) -> mapView(rs),
            consultationId,
            checksum
        );
        if (!duplicate.isEmpty()) {
            return duplicate.getFirst();
        }

        List<Integer> usedPositions = jdbc.query(
            "SELECT position FROM consultation_prescription_documents WHERE consultation_id = ? ORDER BY position",
            (rs, rowNum) -> rs.getInt("position"),
            consultationId
        );
        if (usedPositions.size() >= MAX_DOCUMENTS) {
            throw doctorConflict(
                "PRESCRIPTION_DOCUMENT_LIMIT",
                "A consultation can contain up to five prescription documents."
            );
        }
        int position = firstFreePosition(usedPositions);

        Instant now = clock.instant();
        UUID documentId = UUID.randomUUID();
        String objectKey = objectKey(consultation.patientId(), consultationId, documentId, mimeType);
        putSecurely(objectKey, bytes, mimeType);
        deleteObjectIfTransactionRollsBack(objectKey);

        jdbc.update(
            """
            INSERT INTO consultation_prescription_documents (
                id, consultation_id, doctor_user_id, patient_user_id, position,
                original_filename, object_key, mime_type, size_bytes, sha256_checksum, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            documentId,
            consultationId,
            doctorId,
            consultation.patientId(),
            position,
            originalFilename,
            objectKey,
            mimeType,
            bytes.length,
            checksum,
            Timestamp.from(now)
        );

        audit.record(
            doctorId,
            AuthAuditAction.DOCTOR_PRESCRIPTION_DOCUMENT_UPLOADED,
            AuthAuditOutcome.SUCCESS,
            ipAddress,
            userAgent,
            documentId.toString(),
            "consultation=" + consultationId
        );
        return requireDocumentView(documentId, consultationId);
    }

    @Transactional
    public void remove(
        UUID doctorId,
        UUID consultationId,
        UUID documentId,
        String ipAddress,
        String userAgent
    ) {
        access.requireActiveDoctor(doctorId);
        LockedConsultation consultation = lockDoctorConsultation(doctorId, consultationId);
        if (!"IN_PROGRESS".equals(consultation.status())) {
            throw doctorConflict("PRESCRIPTION_DOCUMENT_FINALIZED", "Completed consultation prescriptions are read-only.");
        }

        List<DocumentRow> rows = documentRows(
            "WHERE d.id = ? AND d.consultation_id = ? AND d.doctor_user_id = ?",
            documentId,
            consultationId,
            doctorId
        );
        if (rows.isEmpty()) {
            throw new DoctorApiException(
                HttpStatus.NOT_FOUND,
                "PRESCRIPTION_DOCUMENT_NOT_FOUND",
                "That prescription document could not be found."
            );
        }
        DocumentRow document = rows.getFirst();
        int changed = jdbc.update(
            "DELETE FROM consultation_prescription_documents WHERE id = ? AND consultation_id = ? AND doctor_user_id = ?",
            documentId,
            consultationId,
            doctorId
        );
        if (changed != 1) {
            throw doctorConflict("PRESCRIPTION_DOCUMENT_CHANGED", "That prescription document changed. Reload and try again.");
        }
        deleteObjectAfterCommit(document.objectKey());
        audit.record(
            doctorId,
            AuthAuditAction.DOCTOR_PRESCRIPTION_DOCUMENT_REMOVED,
            AuthAuditOutcome.SUCCESS,
            ipAddress,
            userAgent,
            documentId.toString(),
            "consultation=" + consultationId
        );
    }

    @Transactional(readOnly = true)
    public DocumentContent doctorContent(
        UUID doctorId,
        UUID consultationId,
        UUID documentId,
        boolean download,
        String ipAddress,
        String userAgent
    ) {
        access.requireActiveDoctor(doctorId);
        requireDoctorConsultation(doctorId, consultationId, false);
        List<DocumentRow> rows = documentRows(
            "WHERE d.id = ? AND d.consultation_id = ? AND d.doctor_user_id = ?",
            documentId,
            consultationId,
            doctorId
        );
        if (rows.isEmpty()) {
            throw new DoctorApiException(
                HttpStatus.NOT_FOUND,
                "PRESCRIPTION_DOCUMENT_NOT_FOUND",
                "That prescription document could not be found."
            );
        }
        DocumentRow row = rows.getFirst();
        byte[] bytes = verifiedBytes(row, true);
        audit.record(
            doctorId,
            download ? AuthAuditAction.DOCTOR_PRESCRIPTION_DOCUMENT_DOWNLOADED : AuthAuditAction.DOCTOR_PRESCRIPTION_DOCUMENT_VIEWED,
            AuthAuditOutcome.SUCCESS,
            ipAddress,
            userAgent,
            documentId.toString(),
            "consultation=" + consultationId
        );
        return new DocumentContent(row.originalFilename(), row.mimeType(), bytes);
    }

    @Transactional(readOnly = true)
    public DocumentContent patientContent(
        UUID patientId,
        UUID consultationId,
        UUID documentId,
        boolean download,
        String ipAddress,
        String userAgent
    ) {
        requireActivePatient(patientId);
        List<DocumentRow> rows = documentRows(
            """
            WHERE d.id = ? AND d.consultation_id = ? AND d.patient_user_id = ?
              AND c.status = 'COMPLETED'
            """,
            documentId,
            consultationId,
            patientId
        );
        if (rows.isEmpty()) {
            throw new PatientApiException(
                HttpStatus.NOT_FOUND,
                "PRESCRIPTION_DOCUMENT_NOT_FOUND",
                "That prescription document could not be found."
            );
        }
        DocumentRow row = rows.getFirst();
        byte[] bytes = verifiedBytes(row, false);
        audit.record(
            patientId,
            download ? AuthAuditAction.PATIENT_PRESCRIPTION_DOCUMENT_DOWNLOADED : AuthAuditAction.PATIENT_PRESCRIPTION_DOCUMENT_VIEWED,
            AuthAuditOutcome.SUCCESS,
            ipAddress,
            userAgent,
            documentId.toString(),
            "consultation=" + consultationId
        );
        return new DocumentContent(row.originalFilename(), row.mimeType(), bytes);
    }

    List<PrescriptionDocumentView> listForConsultation(UUID consultationId) {
        return jdbc.query(
            """
            SELECT id, consultation_id, original_filename, mime_type, size_bytes, created_at
              FROM consultation_prescription_documents
             WHERE consultation_id = ?
             ORDER BY position, created_at
            """,
            (rs, rowNum) -> mapView(rs),
            consultationId
        );
    }

    private PrescriptionDocumentView requireDocumentView(UUID documentId, UUID consultationId) {
        List<PrescriptionDocumentView> rows = jdbc.query(
            """
            SELECT id, consultation_id, original_filename, mime_type, size_bytes, created_at
              FROM consultation_prescription_documents
             WHERE id = ? AND consultation_id = ?
            """,
            (rs, rowNum) -> mapView(rs),
            documentId,
            consultationId
        );
        if (rows.isEmpty()) {
            throw new IllegalStateException("Prescription document was not persisted.");
        }
        return rows.getFirst();
    }

    private static PrescriptionDocumentView mapView(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new PrescriptionDocumentView(
            rs.getObject("id", UUID.class),
            rs.getObject("consultation_id", UUID.class),
            rs.getString("original_filename"),
            rs.getString("mime_type"),
            rs.getLong("size_bytes"),
            rs.getTimestamp("created_at").toInstant()
        );
    }

    private LockedConsultation lockDoctorConsultation(UUID doctorId, UUID consultationId) {
        List<LockedConsultation> rows = jdbc.query(
            """
            SELECT id, patient_user_id, status
              FROM doctor_consultations
             WHERE id = ? AND doctor_user_id = ?
             FOR UPDATE
            """,
            (rs, rowNum) -> new LockedConsultation(
                rs.getObject("id", UUID.class),
                rs.getObject("patient_user_id", UUID.class),
                rs.getString("status")
            ),
            consultationId,
            doctorId
        );
        if (rows.isEmpty()) {
            throw new DoctorApiException(
                HttpStatus.NOT_FOUND,
                "CONSULTATION_NOT_FOUND",
                "That consultation could not be found."
            );
        }
        return rows.getFirst();
    }

    private void requireDoctorConsultation(UUID doctorId, UUID consultationId, boolean inProgressOnly) {
        String sql = "SELECT COUNT(*) FROM doctor_consultations WHERE id = ? AND doctor_user_id = ?"
            + (inProgressOnly ? " AND status = 'IN_PROGRESS'" : "");
        Integer count = jdbc.queryForObject(sql, Integer.class, consultationId, doctorId);
        if (count == null || count != 1) {
            throw new DoctorApiException(
                HttpStatus.NOT_FOUND,
                "CONSULTATION_NOT_FOUND",
                "That consultation could not be found."
            );
        }
    }

    private List<DocumentRow> documentRows(String where, Object... params) {
        return jdbc.query(
            """
            SELECT d.id, d.consultation_id, d.doctor_user_id, d.patient_user_id,
                   d.original_filename, d.object_key, d.mime_type, d.size_bytes,
                   d.sha256_checksum, d.created_at
              FROM consultation_prescription_documents d
              JOIN doctor_consultations c ON c.id = d.consultation_id
            """ + where,
            (rs, rowNum) -> new DocumentRow(
                rs.getObject("id", UUID.class),
                rs.getObject("consultation_id", UUID.class),
                rs.getObject("doctor_user_id", UUID.class),
                rs.getObject("patient_user_id", UUID.class),
                rs.getString("original_filename"),
                rs.getString("object_key"),
                rs.getString("mime_type"),
                rs.getLong("size_bytes"),
                rs.getString("sha256_checksum"),
                rs.getTimestamp("created_at").toInstant()
            ),
            params
        );
    }

    private byte[] verifiedBytes(DocumentRow row, boolean doctorRequest) {
        PatientReportStoragePort.StoredObject stored;
        try {
            stored = storage.get(row.objectKey());
        } catch (RuntimeException exception) {
            if (doctorRequest) {
                throw new DoctorApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "PRESCRIPTION_DOCUMENT_STORAGE_UNAVAILABLE",
                    "This prescription document is temporarily unavailable."
                );
            }
            throw new PatientApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "PRESCRIPTION_DOCUMENT_STORAGE_UNAVAILABLE",
                "This prescription document is temporarily unavailable."
            );
        }
        if (!sha256(stored.bytes()).equals(row.sha256Checksum())) {
            if (doctorRequest) {
                throw new DoctorApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "PRESCRIPTION_DOCUMENT_INTEGRITY_FAILED",
                    "This prescription document could not be verified."
                );
            }
            throw new PatientApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "PRESCRIPTION_DOCUMENT_INTEGRITY_FAILED",
                "This prescription document could not be verified."
            );
        }
        return stored.bytes();
    }

    private byte[] read(MultipartFile file) {
        if (file == null) {
            throw doctorBadRequest("PRESCRIPTION_DOCUMENT_REQUIRED", "Choose a prescription document.");
        }
        try {
            return file.getBytes();
        } catch (IOException exception) {
            throw doctorBadRequest("PRESCRIPTION_DOCUMENT_READ_FAILED", "The selected prescription document could not be read.");
        }
    }

    private String validateFile(MultipartFile file, byte[] bytes) {
        long maxBytes = storageProperties.getMaxFileSize().toBytes();
        if (bytes.length == 0) {
            throw doctorBadRequest("PRESCRIPTION_DOCUMENT_EMPTY", "Choose a non-empty prescription document.");
        }
        if (bytes.length > maxBytes) {
            throw doctorBadRequest("PRESCRIPTION_DOCUMENT_TOO_LARGE", "Prescription documents must be 20 MB or smaller.");
        }
        String detectedMime = detectMime(bytes);
        if (!ALLOWED_MIME_TYPES.contains(detectedMime) || !hasValidTerminator(detectedMime, bytes)) {
            throw doctorBadRequest("PRESCRIPTION_DOCUMENT_INVALID", "Choose a valid PDF, JPG, JPEG, or PNG prescription document.");
        }
        String suppliedMime = file.getContentType();
        if (suppliedMime != null && !suppliedMime.isBlank() && !compatibleMime(suppliedMime, detectedMime)) {
            throw doctorBadRequest("PRESCRIPTION_DOCUMENT_TYPE_MISMATCH", "The selected prescription document content does not match its type.");
        }
        return detectedMime;
    }

    private static String detectMime(byte[] bytes) {
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

    private static boolean hasValidTerminator(String mimeType, byte[] bytes) {
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

    private static boolean compatibleMime(String supplied, String detected) {
        return supplied.equalsIgnoreCase(detected)
            || (detected.equals("image/jpeg") && supplied.equalsIgnoreCase("image/jpg"));
    }

    private static boolean extensionCompatible(String filename, String mimeType) {
        String lower = filename.toLowerCase(Locale.ROOT);
        return switch (mimeType) {
            case "application/pdf" -> lower.endsWith(".pdf");
            case "image/jpeg" -> lower.endsWith(".jpg") || lower.endsWith(".jpeg");
            case "image/png" -> lower.endsWith(".png");
            default -> false;
        };
    }

    private static String extensionFor(String mimeType) {
        return switch (mimeType) {
            case "application/pdf" -> ".pdf";
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            default -> "";
        };
    }

    private static String safeFilename(String value, String mimeType) {
        if (value == null || value.isBlank()) return "prescription-document" + extensionFor(mimeType);
        String normalized = value.replace('\\', '/');
        String filename = normalized.substring(normalized.lastIndexOf('/') + 1)
            .replaceAll("[\\r\\n\\u0000-\\u001f\\u007f]", "")
            .trim();
        if (filename.isEmpty()) return "prescription-document" + extensionFor(mimeType);
        return filename.substring(0, Math.min(255, filename.length()));
    }

    private static int firstFreePosition(List<Integer> usedPositions) {
        Set<Integer> used = new HashSet<>(usedPositions);
        for (int position = 0; position < MAX_DOCUMENTS; position++) {
            if (!used.contains(position)) return position;
        }
        throw doctorConflict("PRESCRIPTION_DOCUMENT_LIMIT", "A consultation can contain up to five prescription documents.");
    }

    private static String objectKey(UUID patientId, UUID consultationId, UUID documentId, String mimeType) {
        return "consultation-prescriptions/" + patientId + "/" + consultationId + "/" + documentId + extensionFor(mimeType);
    }

    private void putSecurely(String objectKey, byte[] bytes, String mimeType) {
        try {
            storage.put(objectKey, bytes, mimeType);
        } catch (RuntimeException exception) {
            throw new DoctorApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "PRESCRIPTION_DOCUMENT_STORAGE_UNAVAILABLE",
                "Secure prescription storage is temporarily unavailable. Try again."
            );
        }
    }

    private void deleteObjectIfTransactionRollsBack(String objectKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == TransactionSynchronization.STATUS_COMMITTED) return;
                try {
                    storage.delete(objectKey);
                } catch (RuntimeException ignored) {
                    // Do not mask the transaction result. Cleanup is best-effort and idempotent.
                }
            }
        });
    }

    private void deleteObjectAfterCommit(String objectKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            try {
                storage.delete(objectKey);
            } catch (RuntimeException ignored) {
                // Database authorization state remains authoritative; orphan cleanup can be retried operationally.
            }
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    storage.delete(objectKey);
                } catch (RuntimeException ignored) {
                    // Avoid reintroducing a DB reference to an object whose logical deletion already committed.
                }
            }
        });
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void requireActivePatient(UUID patientId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'PATIENT' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            patientId
        );
        if (count == null || count != 1) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "ACTIVE_PATIENT_REQUIRED", "An active Patient account is required.");
        }
    }

    private static DoctorApiException doctorBadRequest(String code, String message) {
        return new DoctorApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private static DoctorApiException doctorConflict(String code, String message) {
        return new DoctorApiException(HttpStatus.CONFLICT, code, message);
    }

    private record LockedConsultation(UUID id, UUID patientId, String status) {}

    private record DocumentRow(
        UUID id,
        UUID consultationId,
        UUID doctorId,
        UUID patientId,
        String originalFilename,
        String objectKey,
        String mimeType,
        long sizeBytes,
        String sha256Checksum,
        Instant createdAt
    ) {}

    public record DocumentContent(String filename, String contentType, byte[] bytes) {}
}
