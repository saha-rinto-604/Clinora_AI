package com.clinora.doctors.support;

import com.clinora.ai.client.MedGemmaClient;
import com.clinora.doctors.api.DoctorApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Synchronous today, with job-compatible IDs/statuses and process-local duplicate suppression. */
@Service
public class DoctorSupportExecutionService {
    private static final EnumSet<DoctorSupportTask> EXECUTABLE = EnumSet.of(
        DoctorSupportTask.CONNECT_EVIDENCE,
        DoctorSupportTask.COMPARE_EVIDENCE,
        DoctorSupportTask.CROSS_CHECK_ASSESSMENT,
        DoctorSupportTask.FIND_GAPS
    );

    private final DoctorSupportTaskRegistry registry;
    private final DoctorSupportEvidenceAssembler evidenceAssembler;
    private final MedGemmaClient ai;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final Map<String, CachedExecution> idempotency = new ConcurrentHashMap<>();
    private final Map<String, Object> executionLocks = new ConcurrentHashMap<>();

    public DoctorSupportExecutionService(
        DoctorSupportTaskRegistry registry,
        DoctorSupportEvidenceAssembler evidenceAssembler,
        MedGemmaClient ai,
        ObjectMapper objectMapper,
        Clock clock
    ) {
        this.registry = registry;
        this.evidenceAssembler = evidenceAssembler;
        this.ai = ai;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public DoctorSupportExecutionResponse execute(
        UUID doctorId, UUID appointmentId, DoctorSupportExecutionRequest request
    ) {
        String cacheKey = request.clientExecutionKey() == null || request.clientExecutionKey().isBlank()
            ? null : doctorId + ":" + appointmentId + ":" + request.clientExecutionKey();
        if (cacheKey == null) return executeSerialized(doctorId, appointmentId, request);

        Object lock = executionLocks.computeIfAbsent(cacheKey, ignored -> new Object());
        synchronized (lock) {
            try {
                return executeSerialized(doctorId, appointmentId, request);
            } finally {
                executionLocks.remove(cacheKey, lock);
            }
        }
    }

    private DoctorSupportExecutionResponse executeSerialized(
        UUID doctorId, UUID appointmentId, DoctorSupportExecutionRequest request
    ) {
        List<DoctorSupportTask> tasks = registry.ordered(request.taskIds());
        if (tasks.size() != request.taskIds().size()) {
            throw badRequest("DUPLICATE_TASK_IDS", "Each clinical support task may be requested only once.");
        }
        if (!EXECUTABLE.containsAll(tasks)) {
            throw badRequest("TASK_NOT_EXECUTABLE", "One or more tasks are not executable in this phase.");
        }
        if (tasks.contains(DoctorSupportTask.CROSS_CHECK_ASSESSMENT)
            && (request.doctorAssessment() == null || request.doctorAssessment().isBlank())) {
            throw badRequest("DOCTOR_ASSESSMENT_REQUIRED", "A Doctor-authored assessment is required for cross-checking.");
        }

        String cacheKey = request.clientExecutionKey() == null || request.clientExecutionKey().isBlank()
            ? null : doctorId + ":" + appointmentId + ":" + request.clientExecutionKey();
        String fingerprint = requestFingerprint(request);
        if (cacheKey != null) {
            CachedExecution cached = idempotency.get(cacheKey);
            if (cached != null) {
                if (!cached.fingerprint().equals(fingerprint)) {
                    throw new DoctorApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED",
                        "That execution key was already used for a different request.");
                }
                return cached.response();
            }
        }

        UUID executionId = UUID.randomUUID();
        Instant started = clock.instant();
        DoctorSupportEvidenceAssembler.Assembly assembly = evidenceAssembler.assemble(doctorId, appointmentId, request);
        var snapshot = assembly.snapshot();
        List<DoctorSupportExecutionResponse.TaskResult> results = new ArrayList<>();
        List<DoctorSupportTask> runnable = new ArrayList<>();

        for (DoctorSupportTask task : tasks) {
            if (task == DoctorSupportTask.COMPARE_EVIDENCE
                && snapshot.reports().stream().filter(report -> report.clinicalDate() != null).count() < 2) {
                var spec = registry.require(task);
                boolean selectionPossible = !assembly.selectionCandidates().isEmpty();
                results.add(new DoctorSupportExecutionResponse.TaskResult(
                    task, selectionPossible ? DoctorSupportTaskExecutionStatus.EVIDENCE_SELECTION_REQUIRED
                        : DoctorSupportTaskExecutionStatus.FAILED_SAFE,
                    null, selectionPossible ? "EVIDENCE_SELECTION_REQUIRED" : "RELIABLE_COMPARABLE_EVIDENCE_REQUIRED",
                    provenance(snapshot, spec, null)
                ));
            } else {
                runnable.add(task);
            }
        }

        if (!runnable.isEmpty()) {
            List<MedGemmaClient.DoctorSupportTaskExecutionRequest> aiTasks = runnable.stream().map(task -> {
                var spec = registry.require(task);
                return new MedGemmaClient.DoctorSupportTaskExecutionRequest(
                    task.name(), spec.promptVersion(), spec.responseSchemaVersion()
                );
            }).toList();
            var aiResponse = ai.executeDoctorSupport(new MedGemmaClient.DoctorSupportExecutionRequest(
                executionId, request.originalQuestion(), request.doctorAssessment(), objectMapper.valueToTree(modelEvidence(snapshot)), aiTasks
            ));
            Set<String> expectedTasks = runnable.stream().map(Enum::name).collect(java.util.stream.Collectors.toSet());
            Set<String> returnedTasks = aiResponse.taskResults().stream()
                .map(MedGemmaClient.DoctorSupportTaskExecutionResponse::taskId)
                .collect(java.util.stream.Collectors.toSet());
            boolean invalidContract = returnedTasks.size() != aiResponse.taskResults().size()
                || !returnedTasks.equals(expectedTasks)
                || aiResponse.taskResults().stream().anyMatch(item -> {
                    DoctorSupportTaskSpec spec = registry.require(DoctorSupportTask.valueOf(item.taskId()));
                    return !("SUCCEEDED".equals(item.status()) || "FAILED_SAFE".equals(item.status()))
                        || !spec.promptVersion().equals(item.promptVersion())
                        || !spec.responseSchemaVersion().equals(item.schemaVersion())
                        || ("SUCCEEDED".equals(item.status()) && (item.result() == null
                            || !item.taskId().equals(item.result().path("taskId").asText())
                            || !"PASSED".equals(item.groundingStatus()) || item.safeFailureCode() != null))
                        || ("FAILED_SAFE".equals(item.status())
                            && (item.result() != null || item.safeFailureCode() == null || item.safeFailureCode().isBlank()));
                });
            if (invalidContract) {
                throw new DoctorApiException(HttpStatus.BAD_GATEWAY, "CLINICAL_SUPPORT_EXECUTION_INVALID",
                    "The clinical support response did not pass Clinora validation.");
            }
            Map<String, MedGemmaClient.DoctorSupportTaskExecutionResponse> byTask = aiResponse.taskResults().stream()
                .collect(java.util.stream.Collectors.toMap(MedGemmaClient.DoctorSupportTaskExecutionResponse::taskId, item -> item));
            for (DoctorSupportTask task : runnable) {
                var item = byTask.get(task.name());
                if (item == null) {
                    results.add(new DoctorSupportExecutionResponse.TaskResult(
                        task, DoctorSupportTaskExecutionStatus.FAILED_SAFE, null, "MISSING_TASK_RESULT",
                        provenance(snapshot, registry.require(task), null)
                    ));
                    continue;
                }
                DoctorSupportTaskExecutionStatus taskStatus = "SUCCEEDED".equals(item.status())
                    ? DoctorSupportTaskExecutionStatus.SUCCEEDED : DoctorSupportTaskExecutionStatus.FAILED_SAFE;
                results.add(new DoctorSupportExecutionResponse.TaskResult(
                    task, taskStatus, taskStatus == DoctorSupportTaskExecutionStatus.SUCCEEDED ? item.result() : null,
                    item.safeFailureCode(), provenance(snapshot, registry.require(task), item)
                ));
            }
        }
        results.sort(java.util.Comparator.comparingInt(item -> item.taskId().ordinal()));
        long success = results.stream().filter(item -> item.status() == DoctorSupportTaskExecutionStatus.SUCCEEDED).count();
        DoctorSupportExecutionStatus status = success == results.size()
            ? DoctorSupportExecutionStatus.SUCCEEDED
            : success > 0 ? DoctorSupportExecutionStatus.PARTIAL_SUCCESS : DoctorSupportExecutionStatus.FAILED_SAFE;
        DoctorSupportExecutionResponse response = new DoctorSupportExecutionResponse(
            executionId, doctorId, appointmentId, status, snapshot.snapshotHash(), snapshot.reports(), snapshot.observations(),
            results, assembly.selectionCandidates(), started, clock.instant()
        );
        if (cacheKey != null) {
            if (idempotency.size() >= 1000) idempotency.keySet().stream().findFirst().ifPresent(idempotency::remove);
            idempotency.putIfAbsent(cacheKey, new CachedExecution(fingerprint, response));
        }
        return cacheKey == null ? response : idempotency.get(cacheKey).response();
    }

    private DoctorSupportExecutionResponse.Provenance provenance(
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorSupportTaskSpec spec,
        MedGemmaClient.DoctorSupportTaskExecutionResponse aiResult
    ) {
        return new DoctorSupportExecutionResponse.Provenance(
            snapshot.reports().stream().map(DoctorSupportEvidenceSnapshot.ReportEvidence::reportId).toList(),
            snapshot.observations().stream().map(DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId).toList(),
            snapshot.snapshotHash(), aiResult == null ? null : aiResult.modelName(),
            aiResult == null ? null : aiResult.modelRevision(), aiResult == null ? null : aiResult.quantization(),
            spec.promptVersion(), spec.responseSchemaVersion(), aiResult == null ? "NOT_RUN" : aiResult.groundingStatus()
        );
    }

    private String requestFingerprint(DoctorSupportExecutionRequest request) {
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(request);
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception exc) {
            throw new IllegalStateException("Could not fingerprint Doctor support request.", exc);
        }
    }

    private ModelEvidenceSnapshot modelEvidence(DoctorSupportEvidenceSnapshot snapshot) {
        return new ModelEvidenceSnapshot(
            snapshot.snapshotHash(),
            snapshot.reports().stream().map(report -> new ModelReportEvidence(
                report.reportId(), report.reportType(), report.clinicalDate(), report.dateReliability()
            )).toList(),
            snapshot.observations(), snapshot.comparisonFacts()
        );
    }

    private static DoctorApiException badRequest(String code, String message) {
        return new DoctorApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private record CachedExecution(String fingerprint, DoctorSupportExecutionResponse response) {}
    private record ModelEvidenceSnapshot(
        String snapshotHash,
        List<ModelReportEvidence> reports,
        List<DoctorSupportEvidenceSnapshot.ObservationEvidence> observations,
        List<DoctorSupportEvidenceSnapshot.ComparisonFact> comparisonFacts
    ) {}
    private record ModelReportEvidence(UUID reportId, String reportType, java.time.LocalDate clinicalDate, String dateReliability) {}
}
