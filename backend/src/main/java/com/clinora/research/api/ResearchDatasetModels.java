package com.clinora.research.api;

import com.clinora.research.domain.DatasetGenerationJob;
import com.clinora.research.domain.DatasetVersion;
import com.clinora.research.domain.ResearchDataset;

import java.time.Instant;
import java.util.UUID;

public final class ResearchDatasetModels {

    private ResearchDatasetModels() {}

    public record ResearchDatasetResponse(
            UUID id,
            UUID projectId,
            UUID datasetRequestId,
            String name,
            String status,
            Instant createdAt,
            Instant expiresAt,
            Instant revokedAt
    ) {
        public static ResearchDatasetResponse from(ResearchDataset d) {
            return new ResearchDatasetResponse(
                    d.getId(),
                    d.getProjectId(),
                    d.getDatasetRequestId(),
                    d.getName(),
                    d.getStatus(),
                    d.getCreatedAt(),
                    d.getExpiresAt(),
                    d.getRevokedAt()
            );
        }
    }

    public record DatasetVersionResponse(
            UUID id,
            UUID datasetId,
            int versionNumber,
            String schemaVersion,
            long recordCount,
            String checksum,
            String format,
            String deidentificationProfileVersion,
            Instant generatedAt,
            boolean immutable
    ) {
        public static DatasetVersionResponse from(DatasetVersion v) {
            return new DatasetVersionResponse(
                    v.getId(),
                    v.getDatasetId(),
                    v.getVersionNumber(),
                    v.getSchemaVersion(),
                    v.getRecordCount(),
                    v.getChecksum(),
                    v.getFormat(),
                    v.getDeidentificationProfileVersion(),
                    v.getGeneratedAt(),
                    v.isImmutable()
            );
        }
    }

    public record DatasetGenerationJobResponse(
            UUID id,
            UUID datasetRequestId,
            String status,
            String failureReason,
            Instant startedAt,
            Instant completedAt,
            Instant createdAt
    ) {
        public static DatasetGenerationJobResponse from(DatasetGenerationJob j) {
            return new DatasetGenerationJobResponse(
                    j.getId(),
                    j.getDatasetRequestId(),
                    j.getStatus(),
                    j.getFailureReason(),
                    j.getStartedAt(),
                    j.getCompletedAt(),
                    j.getCreatedAt()
            );
        }
    }
}
