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
        Provenance provenance
    ) {}

    public record Provenance(
        List<UUID> reportIds,
        List<UUID> observationIds,
        String evidenceSnapshotHash,
        String modelName,
        String modelRevision,
        String quantization,
        String promptVersion,
        String schemaVersion,
        String groundingStatus
    ) {
        public Provenance {
            reportIds = List.copyOf(reportIds);
            observationIds = List.copyOf(observationIds);
        }
    }

    public record CandidateReport(UUID reportId, String reportType, java.time.LocalDate clinicalDate) {}
}
