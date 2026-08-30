package com.clinora.patients.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "patient_medical_reports")
public class PatientMedicalReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "patient_user_id", nullable = false)
    private UUID patientUserId;

    @Column(name = "report_name", nullable = false, length = 160)
    private String reportName;

    @Enumerated(EnumType.STRING)
    @Column(name = "report_type", nullable = false, length = 40)
    private PatientReportType reportType;

    @Column(name = "report_date")
    private LocalDate reportDate;

    @Column(name = "provider_laboratory", length = 200)
    private String providerLaboratory;

    @Column(name = "object_key", nullable = false, unique = true, length = 700)
    private String objectKey;

    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    @Column(name = "mime_type", nullable = false, length = 120)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "sha256_checksum", nullable = false, length = 64)
    private String sha256Checksum;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected PatientMedicalReport() {
    }

    public PatientMedicalReport(
        UUID patientUserId,
        String reportName,
        PatientReportType reportType,
        LocalDate reportDate,
        String providerLaboratory,
        String objectKey,
        String originalFilename,
        String mimeType,
        long sizeBytes,
        String sha256Checksum,
        Instant now
    ) {
        this.patientUserId = patientUserId;
        this.reportName = reportName;
        this.reportType = reportType;
        this.reportDate = reportDate;
        this.providerLaboratory = providerLaboratory;
        this.objectKey = objectKey;
        this.originalFilename = originalFilename;
        this.mimeType = mimeType;
        this.sizeBytes = sizeBytes;
        this.sha256Checksum = sha256Checksum;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void updateMetadata(
        String reportName,
        PatientReportType reportType,
        LocalDate reportDate,
        String providerLaboratory,
        Instant now
    ) {
        this.reportName = reportName;
        this.reportType = reportType;
        this.reportDate = reportDate;
        this.providerLaboratory = providerLaboratory;
        this.updatedAt = now;
    }

    public boolean archive(Instant now) {
        if (archivedAt != null) {
            return false;
        }
        archivedAt = now;
        updatedAt = now;
        return true;
    }

    public boolean restore(Instant now) {
        if (archivedAt == null) {
            return false;
        }
        archivedAt = null;
        updatedAt = now;
        return true;
    }

    public UUID getId() { return id; }
    public UUID getPatientUserId() { return patientUserId; }
    public String getReportName() { return reportName; }
    public PatientReportType getReportType() { return reportType; }
    public LocalDate getReportDate() { return reportDate; }
    public String getProviderLaboratory() { return providerLaboratory; }
    public String getObjectKey() { return objectKey; }
    public String getOriginalFilename() { return originalFilename; }
    public String getMimeType() { return mimeType; }
    public long getSizeBytes() { return sizeBytes; }
    public String getSha256Checksum() { return sha256Checksum; }
    public Instant getArchivedAt() { return archivedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
