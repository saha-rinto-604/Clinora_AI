package com.clinora.doctors.support;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record DoctorSupportExecutionResponse(
    UUID executionId,
    UUID doctorId,
    UUID appointmentId,
    DoctorSupportExecutionStatus status,
    String evidenceSnapshotHash,
    List<DoctorSupportEvidenceSnapshot.ReportEvidence> reports,
    List<DoctorSupportEvidenceSnapshot.ObservationEvidence> evidence,
    List<TaskResult> taskResults,
    List<CandidateReport> selectionCandidates,
    Instant startedAt,
    Instant completedAt
) {
    public DoctorSupportExecutionResponse {
        reports = List.copyOf(reports);
        evidence = List.copyOf(evidence);
        taskResults = List.copyOf(taskResults);
        selectionCandidates = List.copyOf(selectionCandidates);
    }

    public record TaskResult(
        DoctorSupportTask taskId,
        DoctorSupportTaskExecutionStatus status,
        JsonNode result,
        String safeFailureCode,
        Provenance provenance,
        List<ClinicalReference> references
    ) {
        public TaskResult { references = references == null ? List.of() : List.copyOf(references); }
    }

    public record ClinicalReference(
        String chunkId, String sourceId, String documentId, String title, String publisher,
        String sourceType, String clinicalDomain, String publicationDate, String version,
        String jurisdiction, String sourceReference, String sectionPath
    ) {}

    public record Provenance(
        List<UUID> reportIds,
        List<UUID> observationIds,
        String evidenceSnapshotHash,
        String executionProvider,
        String modelName,
        String modelRevision,
        String quantization,
        String promptVersion,
        String schemaVersion,
        String groundingStatus,
        boolean ragUsed,
        DoctorSupportRagPolicy ragPolicy,
        String retrievalStatus,
        String knowledgeIndexVersion,
        List<String> retrievedChunkIds,
        List<String> citedChunkIds,
        long retrievalDurationMs,
        long inferenceDurationMs,
        long repairDurationMs,
        long groundingDurationMs,
        int generationCallCount,
        int providerAttempts,
        int successfulGenerations,
        List<SnapshotProvenance> reasoningSnapshots,
        Instant generatedAt
    ) {
        public Provenance {
            reportIds = List.copyOf(reportIds);
            observationIds = List.copyOf(observationIds);
            retrievedChunkIds = retrievedChunkIds == null ? List.of() : List.copyOf(retrievedChunkIds);
            citedChunkIds = citedChunkIds == null ? List.of() : List.copyOf(citedChunkIds);
            reasoningSnapshots = reasoningSnapshots == null ? List.of() : List.copyOf(reasoningSnapshots);
        }
    }

    public record SnapshotProvenance(
        UUID snapshotId,
        UUID jobId,
        UUID reportId,
        String evidenceVersion,
        String status,
        String modelName,
        String modelRevision,
        String promptVersion,
        String schemaVersion,
        Instant generatedAt
    ) {}

    public record CandidateReport(UUID reportId, String reportType, java.time.LocalDate clinicalDate) {}
}
