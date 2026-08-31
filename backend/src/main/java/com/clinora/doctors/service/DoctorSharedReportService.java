package com.clinora.doctors.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.storage.PatientReportStoragePort;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DoctorSharedReportService {
    private final JdbcTemplate jdbc;
    private final PatientReportStoragePort storage;
    private final AuthAuditService audit;

    public DoctorSharedReportService(JdbcTemplate jdbc, PatientReportStoragePort storage, AuthAuditService audit) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<SharedReportView> list(UUID doctorUserId, UUID appointmentId) {
        requireActiveDoctor(doctorUserId);
        requireActiveAppointment(doctorUserId, appointmentId);
        return jdbc.query(
            """
            SELECT r.id, r.report_name, r.report_type, r.report_date, r.provider_laboratory,
                   r.original_filename, r.mime_type, r.size_bytes, s.shared_at
            FROM appointment_report_shares s
            JOIN patient_medical_reports r ON r.id = s.report_id AND r.patient_user_id = s.patient_user_id
            WHERE s.appointment_id = ? AND s.doctor_user_id = ? AND s.revoked_at IS NULL
              AND r.archived_at IS NULL
            ORDER BY s.shared_at DESC, r.id DESC
            """,
            (rs, rowNum) -> new SharedReportView(
                rs.getObject("id", UUID.class), rs.getString("report_name"), rs.getString("report_type"),
                rs.getDate("report_date") == null ? null : rs.getDate("report_date").toLocalDate(),
                rs.getString("provider_laboratory"), rs.getString("original_filename"), rs.getString("mime_type"),
                rs.getLong("size_bytes"), rs.getTimestamp("shared_at").toInstant()
            ),
            appointmentId,
            doctorUserId
        );
    }

    @Transactional(readOnly = true)
    public SharedReportContent content(
        UUID doctorUserId,
        UUID appointmentId,
        UUID reportId,
        Access access,
        String ipAddress,
        String userAgent
    ) {
        requireActiveDoctor(doctorUserId);
        List<StoredReport> rows = jdbc.query(
            """
            SELECT r.object_key, r.original_filename, r.mime_type, r.sha256_checksum
            FROM appointment_report_shares s
            JOIN appointments a ON a.id = s.appointment_id
            JOIN patient_medical_reports r ON r.id = s.report_id AND r.patient_user_id = s.patient_user_id
            WHERE s.appointment_id = ? AND s.report_id = ? AND s.doctor_user_id = ?
              AND s.revoked_at IS NULL AND a.doctor_user_id = ? AND a.status = 'BOOKED'
              AND a.scheduled_end >= CURRENT_TIMESTAMP AND r.archived_at IS NULL
            """,
            (rs, rowNum) -> new StoredReport(
                rs.getString("object_key"), rs.getString("original_filename"), rs.getString("mime_type"),
                rs.getString("sha256_checksum")
            ),
            appointmentId,
            reportId,
            doctorUserId,
            doctorUserId
        );
        if (rows.isEmpty()) {
            throw new PatientApiException(
                HttpStatus.NOT_FOUND,
                "SHARED_REPORT_NOT_AVAILABLE",
                "That report is not available for this active appointment."
            );
        }
        StoredReport report = rows.getFirst();
        PatientReportStoragePort.StoredObject stored;
        try {
            stored = storage.get(report.objectKey());
        } catch (RuntimeException exception) {
            throw new PatientApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "REPORT_STORAGE_UNAVAILABLE",
                "This report is temporarily unavailable. Please try again."
            );
        }
        if (!sha256(stored.bytes()).equals(report.checksum())) {
            throw new PatientApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "REPORT_CONTENT_INTEGRITY_FAILED",
                "This report could not be verified and is temporarily unavailable."
            );
        }
        audit.record(
            doctorUserId,
            access == Access.DOWNLOAD
                ? AuthAuditAction.DOCTOR_SHARED_REPORT_DOWNLOADED
                : AuthAuditAction.DOCTOR_SHARED_REPORT_VIEWED,
            AuthAuditOutcome.SUCCESS,
            ipAddress,
            userAgent,
            reportId.toString(),
            "appointmentId=" + appointmentId
        );
        return new SharedReportContent(report.filename(), report.mimeType(), stored.bytes());
    }

    private void requireActiveAppointment(UUID doctorUserId, UUID appointmentId) {
        Integer count = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM appointments
            WHERE id = ? AND doctor_user_id = ? AND status = 'BOOKED' AND scheduled_end >= CURRENT_TIMESTAMP
            """,
            Integer.class,
            appointmentId,
            doctorUserId
        );
        if (count == null || count != 1) {
            throw new PatientApiException(
                HttpStatus.NOT_FOUND,
                "APPOINTMENT_NOT_FOUND",
                "That active appointment could not be found."
            );
        }
    }

    private void requireActiveDoctor(UUID doctorUserId) {
        Integer count = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM users
            WHERE id = ? AND role = 'DOCTOR' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL
            """,
            Integer.class,
            doctorUserId
        );
        if (count == null || count != 1) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "ACTIVE_DOCTOR_REQUIRED", "An active Doctor account is required.");
        }
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private record StoredReport(String objectKey, String filename, String mimeType, String checksum) {}

    public enum Access { VIEW, DOWNLOAD }

    public record SharedReportView(
        UUID id,
        String reportName,
        String reportType,
        LocalDate reportDate,
        String providerLaboratory,
        String originalFilename,
        String mimeType,
        long sizeBytes,
        Instant sharedAt
    ) {}

    public record SharedReportContent(String filename, String contentType, byte[] bytes) {}
}
