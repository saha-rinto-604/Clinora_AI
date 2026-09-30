package com.clinora.research.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "dataset_versions")
public class DatasetVersion {

    @Id
    private UUID id;

    @Column(name = "dataset_id", nullable = false)
    private UUID datasetId;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    @Column(name = "schema_version", nullable = false, length = 32)
    private String schemaVersion;

    @Column(name = "record_count", nullable = false)
    private long recordCount;

    @Column(name = "storage_object_key", nullable = false, length = 500)
    private String storageObjectKey;

    @Column(nullable = false, length = 64)
    private String checksum;

    @Column(nullable = false, length = 24)
    private String format;

    @Column(name = "deidentification_profile_version", nullable = false, length = 32)
    private String deidentificationProfileVersion;

    @Column(name = "generated_at", nullable = false, updatable = false)
    private Instant generatedAt;

    @Column(nullable = false, updatable = false)
    private boolean immutable;

    protected DatasetVersion() {}

    public DatasetVersion(
            UUID id,
            UUID datasetId,
            int versionNumber,
            String schemaVersion,
            long recordCount,
            String storageObjectKey,
            String checksum,
            String format,
            String deidentificationProfileVersion,
            Instant generatedAt
    ) {
        this.id = Objects.requireNonNull(id, "Version ID required");
        this.datasetId = Objects.requireNonNull(datasetId, "Dataset ID required");
        this.versionNumber = versionNumber;
        this.schemaVersion = Objects.requireNonNull(schemaVersion, "Schema version required");
        this.recordCount = recordCount;
        this.storageObjectKey = Objects.requireNonNull(storageObjectKey, "Storage key required");
        this.checksum = Objects.requireNonNull(checksum, "Checksum required");
        this.format = Objects.requireNonNull(format, "Format required");
        this.deidentificationProfileVersion = Objects.requireNonNull(deidentificationProfileVersion, "De-id profile required");
        this.generatedAt = Objects.requireNonNull(generatedAt, "GeneratedAt required");
        this.immutable = true; // Immutable by architecture
    }

    public UUID getId() { return id; }
    public UUID getDatasetId() { return datasetId; }
    public int getVersionNumber() { return versionNumber; }
    public String getSchemaVersion() { return schemaVersion; }
    public long getRecordCount() { return recordCount; }
    public String getStorageObjectKey() { return storageObjectKey; }
    public String getChecksum() { return checksum; }
    public String getFormat() { return format; }
    public String getDeidentificationProfileVersion() { return deidentificationProfileVersion; }
    public Instant getGeneratedAt() { return generatedAt; }
    public boolean isImmutable() { return immutable; }
}
