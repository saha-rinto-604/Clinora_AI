package com.clinora.research.deid;

import java.util.List;
import java.util.UUID;

public record DeidentificationResult(
        UUID datasetRequestId,
        UUID projectId,
        long totalEligibleRecords,
        long uniqueSubjectsCount,
        String deidentificationProfileVersion,
        List<DeidentifiedRecord> records,
        byte[] serializedPayload,
        String sha256Checksum,
        String format
) {}
