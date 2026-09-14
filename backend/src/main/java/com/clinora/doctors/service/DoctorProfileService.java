package com.clinora.doctors.service;

import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.doctors.api.DoctorApiException;
import java.net.URI;
import java.net.URISyntaxException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DoctorProfileService {
    private static final int BIO_MAX = 2000;
    private static final int URL_MAX = 500;

    private final JdbcTemplate jdbc;
    private final DoctorClinicalAccessService access;
    private final ApplicationDocumentStoragePort applicationStorage;
    private final AuthAuditService audit;
    private final Clock clock;

    public DoctorProfileService(
        JdbcTemplate jdbc,
        DoctorClinicalAccessService access,
        ApplicationDocumentStoragePort applicationStorage,
        AuthAuditService audit,
        Clock clock
    ) {
        this.jdbc = jdbc;
        this.access = access;
        this.applicationStorage = applicationStorage;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DoctorProfileModels.ProfileView profile(UUID doctorId) {
        access.requireActiveDoctorAccount(doctorId);
        List<ProfileRow> rows = jdbc.query(
            """
            SELECT p.doctor_user_id, p.application_id, p.display_name,
                   p.professional_bio, p.professional_profile_url, p.display_title,
                   p.current_organization, p.current_position, p.preferred_timezone,
                   p.default_consultation_minutes, p.profile_version, p.updated_at,
                   a.first_name, a.last_name,
                   d.professional_title AS verified_professional_title,
                   d.specialization AS verified_specialization,
                   d.years_experience AS verified_years_experience,
                   d.current_organization AS verified_current_organization,
                   d.current_position AS verified_current_position,
                   d.registration_jurisdiction, d.registration_authority, d.registration_number,
                   d.registration_type, d.registration_issued_at, d.registration_valid_until
            FROM doctor_booking_profiles p
            JOIN access_applications a ON a.id = p.application_id
            JOIN doctor_application_details d ON d.application_id = p.application_id
            WHERE p.doctor_user_id = ?
              AND a.application_type = 'DOCTOR'
              AND a.status = 'ACTIVATED'
            """,
            (rs, rowNum) -> new ProfileRow(
                rs.getObject("doctor_user_id", UUID.class),
                rs.getObject("application_id", UUID.class),
                rs.getString("display_name"),
                rs.getString("first_name"),
                rs.getString("last_name"),
                rs.getString("verified_specialization"),
                integer(rs.getObject("verified_years_experience")),
                rs.getString("professional_bio"),
                rs.getString("professional_profile_url"),
                rs.getString("display_title"),
                rs.getString("current_organization"),
                rs.getString("current_position"),
                rs.getString("preferred_timezone"),
                integer(rs.getObject("default_consultation_minutes")),
                rs.getLong("profile_version"),
                rs.getTimestamp("updated_at").toInstant(),
                rs.getString("verified_professional_title"),
                rs.getString("verified_current_organization"),
                rs.getString("verified_current_position"),
                rs.getString("registration_jurisdiction"),
                rs.getString("registration_authority"),
                rs.getString("registration_number"),
                rs.getString("registration_type"),
                localDate(rs.getDate("registration_issued_at")),
                localDate(rs.getDate("registration_valid_until"))
            ),
            doctorId
        );
        if (rows.isEmpty()) throw notFound("DOCTOR_PROFILE_NOT_FOUND", "Your Doctor profile is not available.");
        ProfileRow row = rows.getFirst();
        List<DoctorProfileModels.QualificationView> qualifications = qualifications(row.applicationId());
        List<DoctorProfileModels.CredentialDocumentView> documents = documents(row.applicationId());
        return view(row, qualifications, documents, readiness(doctorId, row));
    }

    @Transactional
    public DoctorProfileModels.ProfileView update(
        UUID doctorId,
        DoctorProfileModels.UpdateProfileCommand command,
        String ip,
        String userAgent
    ) {
        access.requireActiveDoctorAccount(doctorId);
        if (command == null) throw badRequest("DOCTOR_PROFILE_INVALID", "Profile details are required.");
        String bio = multilineText(command.professionalBio(), BIO_MAX, "Professional bio");
        String profileUrl = url(command.professionalProfileUrl());
        String displayTitle = text(command.displayTitle(), 160, "Display title");
        String organization = text(command.currentOrganization(), 220, "Current organization");
        String position = text(command.currentPosition(), 180, "Current position");
        String timezone = timezone(command.preferredTimezone());
        Integer duration = duration(command.defaultConsultationMinutes());
        Instant now = clock.instant();

        int changed = jdbc.update(
            """
            UPDATE doctor_booking_profiles
            SET professional_bio = ?,
                professional_profile_url = ?,
                display_title = ?,
                current_organization = ?,
                current_position = ?,
                preferred_timezone = ?,
                default_consultation_minutes = ?,
                profile_version = profile_version + 1,
                updated_at = ?
            WHERE doctor_user_id = ? AND profile_version = ?
            """,
            bio,
            profileUrl,
            displayTitle,
            organization,
            position,
            timezone,
            duration,
            Timestamp.from(now),
            doctorId,
            command.version()
        );
        if (changed != 1) {
            throw new DoctorApiException(
                HttpStatus.CONFLICT,
                "DOCTOR_PROFILE_STALE",
                "Your profile changed in another session. Reload it before saving again."
            );
        }
        audit.record(doctorId, AuthAuditAction.DOCTOR_PROFILE_UPDATED, AuthAuditOutcome.SUCCESS, ip, userAgent, doctorId.toString(), null);
        return profile(doctorId);
    }

    @Transactional(readOnly = true)
    public DoctorProfileModels.PatientFacingProfile patientFacingProfile(UUID patientId, UUID doctorId) {
        requireActivePatient(patientId);
        List<DoctorProfileModels.PatientFacingProfile> rows = jdbc.query(
            """
            SELECT p.doctor_user_id, p.display_name, COALESCE(p.display_title, p.professional_title) AS display_title,
                   p.specialization, p.years_experience, p.current_organization, p.current_position,
                   p.professional_bio, p.professional_profile_url, p.preferred_timezone,
                   p.default_consultation_minutes,
                   (SELECT MIN(s.starts_at) FROM doctor_availability_slots s
                    WHERE s.doctor_user_id = p.doctor_user_id
                      AND s.status = 'AVAILABLE' AND s.starts_at > CURRENT_TIMESTAMP) AS next_available_at
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
            (rs, rowNum) -> new DoctorProfileModels.PatientFacingProfile(
                rs.getObject("doctor_user_id", UUID.class),
                rs.getString("display_name"),
                rs.getString("display_title"),
                rs.getString("specialization"),
                integer(rs.getObject("years_experience")),
                rs.getString("current_organization"),
                rs.getString("current_position"),
                rs.getString("professional_bio"),
                rs.getString("professional_profile_url"),
                rs.getString("preferred_timezone"),
                integer(rs.getObject("default_consultation_minutes")),
                instant(rs.getTimestamp("next_available_at")),
                true
            ),
            doctorId
        );
        if (rows.isEmpty()) throw notFound("DOCTOR_NOT_AVAILABLE", "That Clinora Doctor is not available for booking.");
        return rows.getFirst();
    }

    @Transactional(readOnly = true)
    public DoctorProfileModels.CredentialContent credentialContent(
        UUID doctorId,
        UUID documentId,
        String ip,
        String userAgent
    ) {
        access.requireActiveDoctorAccount(doctorId);
        List<DocumentRow> rows = jdbc.query(
            """
            SELECT d.application_id, d.object_key, d.original_filename, d.mime_type, d.sha256_checksum
            FROM application_documents d
            JOIN doctor_booking_profiles p ON p.application_id = d.application_id
            WHERE p.doctor_user_id = ? AND d.id = ?
            """,
            (rs, rowNum) -> new DocumentRow(
                rs.getObject("application_id", UUID.class),
                rs.getString("object_key"),
                rs.getString("original_filename"),
                rs.getString("mime_type"),
                rs.getString("sha256_checksum")
            ),
            doctorId,
            documentId
        );
        if (rows.isEmpty()) throw notFound("CREDENTIAL_DOCUMENT_NOT_FOUND", "That credential document is not available.");
        DocumentRow document = rows.getFirst();
        ApplicationDocumentStoragePort.StoredObject stored;
        try {
            stored = applicationStorage.get(document.objectKey());
        } catch (RuntimeException exception) {
            throw new DoctorApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "CREDENTIAL_DOCUMENT_UNAVAILABLE",
                "That credential document is temporarily unavailable."
            );
        }
        if (!sha256(stored.bytes()).equalsIgnoreCase(document.checksum())) {
            throw new DoctorApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "CREDENTIAL_DOCUMENT_INTEGRITY_FAILED",
                "That credential document could not be verified."
            );
        }
        audit.record(
            doctorId,
            AuthAuditAction.ACCESS_APPLICATION_DOCUMENT_VIEWED,
            AuthAuditOutcome.SUCCESS,
            ip,
            userAgent,
            document.applicationId().toString(),
            "documentId=" + documentId
        );
        return new DoctorProfileModels.CredentialContent(document.filename(), document.mimeType(), stored.bytes());
    }

    public DoctorProfileModels.ProfileReadiness readiness(UUID doctorId) {
        access.requireActiveDoctorAccount(doctorId);
        List<ReadinessRow> rows = jdbc.query(
            """
            SELECT professional_bio, professional_profile_url, display_title, preferred_timezone,
                   default_consultation_minutes,
                   EXISTS (
                       SELECT 1 FROM doctor_availability_slots s
                       WHERE s.doctor_user_id = p.doctor_user_id
                         AND s.status = 'AVAILABLE' AND s.starts_at > CURRENT_TIMESTAMP
                   ) AS has_availability
            FROM doctor_booking_profiles p
            WHERE doctor_user_id = ?
            """,
            (rs, rowNum) -> new ReadinessRow(
                rs.getString("professional_bio"),
                rs.getString("professional_profile_url"),
                rs.getString("display_title"),
                rs.getString("preferred_timezone"),
                integer(rs.getObject("default_consultation_minutes")),
                rs.getBoolean("has_availability")
            ),
            doctorId
        );
        if (rows.isEmpty()) return new DoctorProfileModels.ProfileReadiness(60, 0, 6, List.of());
        return readiness(rows.getFirst());
    }

    private DoctorProfileModels.ProfileReadiness readiness(UUID doctorId, ProfileRow row) {
        Boolean hasAvailability = jdbc.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM doctor_availability_slots WHERE doctor_user_id = ? AND status = 'AVAILABLE' AND starts_at > CURRENT_TIMESTAMP)",
            Boolean.class,
            doctorId
        );
        return readiness(new ReadinessRow(
            row.professionalBio(), row.professionalProfileUrl(), row.displayTitle(), row.preferredTimezone(),
            row.defaultConsultationMinutes(), Boolean.TRUE.equals(hasAvailability)
        ));
    }

    private DoctorProfileModels.ProfileReadiness readiness(ReadinessRow row) {
        List<DoctorProfileModels.MissingSetupItem> missing = new ArrayList<>();
        int score = 60;
        int completed = 0;
        if (notBlank(row.professionalProfileUrl())) { score += 10; completed++; }
        else missing.add(item("professionalProfileUrl", "Professional profile URL", "/doctor/profile"));
        if (notBlank(row.professionalBio())) { score += 10; completed++; }
        else missing.add(item("professionalBio", "Professional bio", "/doctor/profile"));
        if (notBlank(row.displayTitle())) { score += 5; completed++; }
        else missing.add(item("displayTitle", "Display title", "/doctor/profile"));
        if (notBlank(row.preferredTimezone())) { score += 5; completed++; }
        else missing.add(item("preferredTimezone", "Preferred timezone", "/doctor/profile"));
        if (row.defaultConsultationMinutes() != null) { score += 5; completed++; }
        else missing.add(item("defaultConsultationMinutes", "Default consultation duration", "/doctor/profile"));
        if (row.hasAvailability()) { score += 5; completed++; }
        else missing.add(item("availability", "Future availability", "/doctor/availability"));
        return new DoctorProfileModels.ProfileReadiness(Math.min(100, score), completed, 6, List.copyOf(missing));
    }

    private List<DoctorProfileModels.QualificationView> qualifications(UUID applicationId) {
        return jdbc.query(
            """
            SELECT id, qualification_name, institution, country_code, completion_year
            FROM doctor_qualifications
            WHERE application_id = ?
            ORDER BY completion_year DESC, qualification_name
            """,
            (rs, rowNum) -> new DoctorProfileModels.QualificationView(
                rs.getObject("id", UUID.class),
                rs.getString("qualification_name"),
                rs.getString("institution"),
                rs.getString("country_code"),
                rs.getInt("completion_year")
            ),
            applicationId
        );
    }

    private List<DoctorProfileModels.CredentialDocumentView> documents(UUID applicationId) {
        return jdbc.query(
            """
            SELECT id, document_type, original_filename, mime_type, size_bytes, created_at
            FROM application_documents
            WHERE application_id = ?
            ORDER BY created_at, document_type
            """,
            (rs, rowNum) -> new DoctorProfileModels.CredentialDocumentView(
                rs.getObject("id", UUID.class),
                rs.getString("document_type"),
                rs.getString("original_filename"),
                rs.getString("mime_type"),
                rs.getLong("size_bytes"),
                rs.getTimestamp("created_at").toInstant()
            ),
            applicationId
        );
    }

    private DoctorProfileModels.ProfileView view(
        ProfileRow row,
        List<DoctorProfileModels.QualificationView> qualifications,
        List<DoctorProfileModels.CredentialDocumentView> documents,
        DoctorProfileModels.ProfileReadiness readiness
    ) {
        return new DoctorProfileModels.ProfileView(
            row.doctorId(),
            row.displayName(),
            row.firstName(),
            row.lastName(),
            row.specialization(),
            row.yearsExperience(),
            new DoctorProfileModels.EditableProfile(
                row.professionalBio(),
                row.professionalProfileUrl(),
                row.displayTitle(),
                row.currentOrganization(),
                row.currentPosition(),
                row.preferredTimezone(),
                row.defaultConsultationMinutes()
            ),
            new DoctorProfileModels.VerifiedCredentials(
                row.verifiedProfessionalTitle(),
                row.verifiedCurrentOrganization(),
                row.verifiedCurrentPosition(),
                row.registrationJurisdiction(),
                row.registrationAuthority(),
                row.registrationNumber(),
                row.registrationType(),
                row.registrationIssuedAt(),
                row.registrationValidUntil(),
                qualifications,
                documents
            ),
            readiness,
            row.version(),
            row.updatedAt()
        );
    }

    private void requireActivePatient(UUID patientId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM users WHERE id = ? AND role = 'PATIENT' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            patientId
        );
        if (count == null || count != 1) {
            throw new DoctorApiException(HttpStatus.FORBIDDEN, "PATIENT_ACCESS_REQUIRED", "Patient access is required.");
        }
    }

    private static String url(String value) {
        String cleaned = text(value, URL_MAX, "Professional profile URL");
        if (cleaned == null) return null;
        try {
            URI uri = new URI(cleaned);
            String scheme = uri.getScheme();
            if (uri.getHost() == null || scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
                throw new URISyntaxException(cleaned, "URL must use http or https");
            }
            return uri.toASCIIString();
        } catch (URISyntaxException exception) {
            throw badRequest("DOCTOR_PROFILE_URL_INVALID", "Enter a valid http or https professional profile URL.");
        }
    }

    private static String timezone(String value) {
        String cleaned = text(value, 80, "Preferred timezone");
        if (cleaned == null) return null;
        try {
            return ZoneId.of(cleaned).getId();
        } catch (java.time.DateTimeException exception) {
            throw badRequest("DOCTOR_PROFILE_TIMEZONE_INVALID", "Choose a valid timezone.");
        }
    }

    private static Integer duration(Integer value) {
        if (value == null) return null;
        if (value < 15 || value > 120 || value % 5 != 0) {
            throw badRequest("DOCTOR_PROFILE_DURATION_INVALID", "Consultation duration must be 15 to 120 minutes in 5-minute steps.");
        }
        return value;
    }

    private static String text(String value, int max, String label) {
        if (value == null || value.isBlank()) return null;
        String cleaned = value.trim().replaceAll("\\s+", " ");
        if (cleaned.length() > max) throw badRequest("DOCTOR_PROFILE_FIELD_TOO_LONG", label + " is too long.");
        return cleaned;
    }

    private static String multilineText(String value, int max, String label) {
        if (value == null || value.isBlank()) return null;
        String cleaned = value.replace("\r\n", "\n").replace('\r', '\n').trim();
        if (cleaned.length() > max) throw badRequest("DOCTOR_PROFILE_FIELD_TOO_LONG", label + " is too long.");
        return cleaned;
    }

    private static DoctorProfileModels.MissingSetupItem item(String key, String label, String destination) {
        return new DoctorProfileModels.MissingSetupItem(key, label, destination);
    }

    private static DoctorApiException badRequest(String code, String message) {
        return new DoctorApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private static DoctorApiException notFound(String code, String message) {
        return new DoctorApiException(HttpStatus.NOT_FOUND, code, message);
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static Integer integer(Object value) {
        return value == null ? null : ((Number) value).intValue();
    }

    private static java.time.LocalDate localDate(Date value) {
        return value == null ? null : value.toLocalDate();
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record ProfileRow(
        UUID doctorId,
        UUID applicationId,
        String displayName,
        String firstName,
        String lastName,
        String specialization,
        Integer yearsExperience,
        String professionalBio,
        String professionalProfileUrl,
        String displayTitle,
        String currentOrganization,
        String currentPosition,
        String preferredTimezone,
        Integer defaultConsultationMinutes,
        long version,
        Instant updatedAt,
        String verifiedProfessionalTitle,
        String verifiedCurrentOrganization,
        String verifiedCurrentPosition,
        String registrationJurisdiction,
        String registrationAuthority,
        String registrationNumber,
        String registrationType,
        java.time.LocalDate registrationIssuedAt,
        java.time.LocalDate registrationValidUntil
    ) {}

    private record ReadinessRow(
        String professionalBio,
        String professionalProfileUrl,
        String displayTitle,
        String preferredTimezone,
        Integer defaultConsultationMinutes,
        boolean hasAvailability
    ) {}

    private record DocumentRow(UUID applicationId, String objectKey, String filename, String mimeType, String checksum) {}
}
