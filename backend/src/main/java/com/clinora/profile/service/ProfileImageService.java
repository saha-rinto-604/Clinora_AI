package com.clinora.profile.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.config.PatientReportSecurityProperties;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.security.PatientReportMalwareScanner;
import com.clinora.profile.storage.ProfileImageStoragePort;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
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
public class ProfileImageService {
    private static final long MAX_BYTES = 5L * 1024L * 1024L;
    private static final Set<String> SUPPORTED_DECLARED_TYPES = Set.of(
        "image/jpeg", "image/jpg", "image/png", "image/webp", "application/octet-stream"
    );

    private final JdbcTemplate jdbc;
    private final ProfileImageStoragePort storage;
    private final ProfileImageSanitizer sanitizer;
    private final PatientReportMalwareScanner malwareScanner;
    private final PatientReportSecurityProperties malwareProperties;
    private final DoctorClinicalAccessService doctorAccess;
    private final AuthAuditService audit;
    private final Clock clock;

    public ProfileImageService(
        JdbcTemplate jdbc,
        ProfileImageStoragePort storage,
        ProfileImageSanitizer sanitizer,
        PatientReportMalwareScanner malwareScanner,
        PatientReportSecurityProperties malwareProperties,
        DoctorClinicalAccessService doctorAccess,
        AuthAuditService audit,
        Clock clock
    ) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.sanitizer = sanitizer;
        this.malwareScanner = malwareScanner;
        this.malwareProperties = malwareProperties;
        this.doctorAccess = doctorAccess;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<ProfileImageView> metadata(UUID userId) {
        requireSelfServiceRole(userId);
        return imageRow(userId).map(ProfileImageService::view);
    }

    @Transactional(readOnly = true)
    public Optional<ProfileImageContent> selfContent(UUID userId) {
        requireSelfServiceRole(userId);
        return content(userId);
    }

    @Transactional(readOnly = true)
    public Optional<ProfileImageContent> patientVisibleDoctorContent(UUID patientId, UUID doctorId) {
        requireActiveUser(patientId, "PATIENT");
        Integer count = jdbc.queryForObject(
            """
            SELECT COUNT(*)::int
            FROM doctor_booking_profiles p
            JOIN users u ON u.id = p.doctor_user_id
            JOIN access_applications a ON a.id = p.application_id
            WHERE p.doctor_user_id = ?
              AND p.booking_enabled = TRUE
              AND a.application_type = 'DOCTOR'
              AND a.status = 'ACTIVATED'
              AND u.role = 'DOCTOR'
              AND u.account_status = 'ACTIVE'
              AND u.email_verified_at IS NOT NULL
              AND (p.registration_valid_until IS NULL OR p.registration_valid_until >= CURRENT_DATE)
            """,
            Integer.class,
            doctorId
        );
        if (count == null || count != 1) return Optional.empty();
        return content(doctorId);
    }

    @Transactional(readOnly = true)
    public Optional<ProfileImageContent> doctorVisiblePatientContent(UUID doctorId, UUID appointmentId) {
        DoctorClinicalAccessService.AppointmentAccess appointment = doctorAccess.requireActiveOwnedAppointment(doctorId, appointmentId).appointment();
        return content(appointment.patientId());
    }

    @Transactional
    public ProfileImageView replace(UUID userId, MultipartFile file, String ip, String userAgent) {
        requireSelfServiceRole(userId);
        if (file == null || file.isEmpty()) {
            throw badRequest("PROFILE_IMAGE_EMPTY", "Choose an image to upload.");
        }
        if (file.getSize() <= 0 || file.getSize() > MAX_BYTES) {
            throw badRequest("PROFILE_IMAGE_SIZE_INVALID", "Profile images must be 5 MB or smaller.");
        }
        String declaredType = file.getContentType();
        if (declaredType != null && !declaredType.isBlank()
            && !SUPPORTED_DECLARED_TYPES.contains(declaredType.toLowerCase(Locale.ROOT))) {
            throw badRequest("PROFILE_IMAGE_TYPE_INVALID", "Choose a JPEG, PNG, or WebP image.");
        }

        PatientReportMalwareScanner.ScanResult scan = malwareScanner.scan(file);
        if (scan == PatientReportMalwareScanner.ScanResult.INFECTED) {
            throw badRequest("PROFILE_IMAGE_UNSAFE", "That image could not be accepted.");
        }
        if (scan == PatientReportMalwareScanner.ScanResult.UNAVAILABLE && malwareProperties.isFailClosed()) {
            throw new PatientApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "PROFILE_IMAGE_SCAN_UNAVAILABLE",
                "Image safety scanning is temporarily unavailable. Please try again shortly."
            );
        }

        byte[] source;
        try {
            source = file.getBytes();
        } catch (Exception exception) {
            throw badRequest("PROFILE_IMAGE_READ_FAILED", "The image could not be read.");
        }
        if (source.length == 0 || source.length > MAX_BYTES) {
            throw badRequest("PROFILE_IMAGE_SIZE_INVALID", "Profile images must be 5 MB or smaller.");
        }
        ProfileImageSanitizer.SanitizedImage sanitized = sanitizer.sanitize(source);
        if (sanitized.bytes().length == 0 || sanitized.bytes().length > MAX_BYTES) {
            throw badRequest("PROFILE_IMAGE_SIZE_INVALID", "Profile images must remain 5 MB or smaller after safe processing.");
        }
        if (declaredType != null && !declaredType.isBlank() && !"application/octet-stream".equalsIgnoreCase(declaredType)
            && !declaredCompatible(declaredType, sanitized.contentType())) {
            throw badRequest("PROFILE_IMAGE_TYPE_INVALID", "The image content does not match its declared type.");
        }

        // Lock the user, not only the optional image row. This serializes first upload and replacement from multiple sessions.
        jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, userId);
        Optional<ProfileImageRow> previous = imageRow(userId);
        long version = previous.map(row -> row.version() + 1).orElse(1L);
        Instant now = clock.instant();
        String objectKey = "profile-images/" + userId + "/" + UUID.randomUUID() + "." + sanitized.extension();
        String checksum = sha256(sanitized.bytes());
        storage.put(objectKey, sanitized.bytes(), sanitized.contentType());

        try {
            jdbc.update(
                """
                INSERT INTO user_profile_images
                    (user_id, object_key, content_type, size_bytes, sha256_checksum, width_px, height_px,
                     version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_id) DO UPDATE SET
                    object_key = EXCLUDED.object_key,
                    content_type = EXCLUDED.content_type,
                    size_bytes = EXCLUDED.size_bytes,
                    sha256_checksum = EXCLUDED.sha256_checksum,
                    width_px = EXCLUDED.width_px,
                    height_px = EXCLUDED.height_px,
                    version = EXCLUDED.version,
                    updated_at = EXCLUDED.updated_at
                """,
                userId,
                objectKey,
                sanitized.contentType(),
                sanitized.bytes().length,
                checksum,
                sanitized.width(),
                sanitized.height(),
                version,
                Timestamp.from(previous.map(ProfileImageRow::createdAt).orElse(now)),
                Timestamp.from(now)
            );
        } catch (RuntimeException exception) {
            safeDelete(objectKey);
            throw exception;
        }

        afterCompletion(
            () -> previous.filter(row -> !row.objectKey().equals(objectKey)).ifPresent(row -> safeDelete(row.objectKey())),
            () -> safeDelete(objectKey)
        );
        audit.record(userId, AuthAuditAction.PROFILE_IMAGE_UPDATED, AuthAuditOutcome.SUCCESS, ip, userAgent, userId.toString(), null);
        return new ProfileImageView(sanitized.contentType(), sanitized.width(), sanitized.height(), version, now);
    }

    @Transactional
    public void remove(UUID userId, String ip, String userAgent) {
        requireSelfServiceRole(userId);
        jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, userId);
        Optional<ProfileImageRow> existing = imageRow(userId);
        if (existing.isEmpty()) return;
        jdbc.update("DELETE FROM user_profile_images WHERE user_id = ?", userId);
        afterCommit(() -> safeDelete(existing.get().objectKey()));
        audit.record(userId, AuthAuditAction.PROFILE_IMAGE_REMOVED, AuthAuditOutcome.SUCCESS, ip, userAgent, userId.toString(), null);
    }

    private Optional<ProfileImageContent> content(UUID userId) {
        Optional<ProfileImageRow> row = imageRow(userId);
        if (row.isEmpty()) return Optional.empty();
        ProfileImageStoragePort.StoredObject stored;
        try {
            stored = storage.get(row.get().objectKey());
        } catch (RuntimeException exception) {
            throw new PatientApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "PROFILE_IMAGE_UNAVAILABLE",
                "The profile image is temporarily unavailable."
            );
        }
        if (!sha256(stored.bytes()).equalsIgnoreCase(row.get().checksum())) {
            throw new PatientApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "PROFILE_IMAGE_INTEGRITY_FAILED",
                "The profile image could not be verified."
            );
        }
        return Optional.of(new ProfileImageContent(
            stored.bytes(), row.get().contentType(), row.get().checksum(), row.get().version(), row.get().updatedAt()
        ));
    }

    private Optional<ProfileImageRow> imageRow(UUID userId) {
        List<ProfileImageRow> rows = jdbc.query(
            """
            SELECT object_key, content_type, size_bytes, sha256_checksum, width_px, height_px,
                   version, created_at, updated_at
            FROM user_profile_images
            WHERE user_id = ?
            """,
            (rs, rowNum) -> new ProfileImageRow(
                rs.getString("object_key"),
                rs.getString("content_type"),
                rs.getLong("size_bytes"),
                rs.getString("sha256_checksum"),
                rs.getInt("width_px"),
                rs.getInt("height_px"),
                rs.getLong("version"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
            ),
            userId
        );
        return rows.stream().findFirst();
    }

    private void requireSelfServiceRole(UUID userId) {
        Integer count = jdbc.queryForObject(
            """
            SELECT COUNT(*)::int FROM users
            WHERE id = ? AND role IN ('PATIENT','DOCTOR')
              AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL
            """,
            Integer.class,
            userId
        );
        if (count == null || count != 1) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "PROFILE_IMAGE_ACCESS_DENIED", "Profile image access is unavailable.");
        }
    }

    private void requireActiveUser(UUID userId, String role) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM users WHERE id = ? AND role = ? AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            userId,
            role
        );
        if (count == null || count != 1) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "PROFILE_IMAGE_ACCESS_DENIED", "Profile image access is unavailable.");
        }
    }

    private static boolean declaredCompatible(String declared, String detected) {
        if (declared.equalsIgnoreCase(detected)) return true;
        return "image/jpeg".equals(detected) && "image/jpg".equalsIgnoreCase(declared);
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static PatientApiException badRequest(String code, String message) {
        return new PatientApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private void safeDelete(String objectKey) {
        try {
            storage.delete(objectKey);
        } catch (RuntimeException ignored) {
            // The DB remains authoritative for access. A later storage cleanup can remove an orphaned private object.
        }
    }

    private static void afterCommit(Runnable committed) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            committed.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                committed.run();
            }
        });
    }

    private static void afterCompletion(Runnable committed, Runnable rolledBack) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == TransactionSynchronization.STATUS_COMMITTED) committed.run();
                else rolledBack.run();
            }
        });
    }

    private static ProfileImageView view(ProfileImageRow row) {
        return new ProfileImageView(row.contentType(), row.width(), row.height(), row.version(), row.updatedAt());
    }

    private record ProfileImageRow(
        String objectKey,
        String contentType,
        long sizeBytes,
        String checksum,
        int width,
        int height,
        long version,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record ProfileImageView(String contentType, int width, int height, long version, Instant updatedAt) {}
    public record ProfileImageContent(byte[] bytes, String contentType, String checksum, long version, Instant updatedAt) {}
}
