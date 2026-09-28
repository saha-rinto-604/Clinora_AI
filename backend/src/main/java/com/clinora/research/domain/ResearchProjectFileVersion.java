package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(
        name = "research_project_file_versions",
        uniqueConstraints = @UniqueConstraint(name = "uq_file_version", columnNames = {"project_file_id", "version_number"})
)
public class ResearchProjectFileVersion {

    @Id
    private UUID id;

    @Column(name = "project_file_id", nullable = false)
    private UUID projectFileId;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    @Column(name = "storage_object_key", nullable = false, length = 512)
    private String storageObjectKey;

    @Column(name = "checksum", nullable = false, length = 128)
    private String checksum;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "uploaded_by_user_id", nullable = false)
    private UUID uploadedByUserId;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private Instant uploadedAt;

    protected ResearchProjectFileVersion() {}

    public ResearchProjectFileVersion(
            UUID id,
            UUID projectFileId,
            int versionNumber,
            String storageObjectKey,
            String checksum,
            long sizeBytes,
            UUID uploadedByUserId
    ) {
        this.id = Objects.requireNonNull(id, "Version ID required");
        this.projectFileId = Objects.requireNonNull(projectFileId, "Project file ID required");
        this.versionNumber = versionNumber;
        this.storageObjectKey = Objects.requireNonNull(storageObjectKey, "Storage key required");
        this.checksum = Objects.requireNonNull(checksum, "Checksum required");
        this.sizeBytes = sizeBytes;
        this.uploadedByUserId = Objects.requireNonNull(uploadedByUserId, "Uploader required");
        this.uploadedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getProjectFileId() { return projectFileId; }
    public int getVersionNumber() { return versionNumber; }
    public String getStorageObjectKey() { return storageObjectKey; }
    public String getChecksum() { return checksum; }
    public long getSizeBytes() { return sizeBytes; }
    public UUID getUploadedByUserId() { return uploadedByUserId; }
    public Instant getUploadedAt() { return uploadedAt; }
}
