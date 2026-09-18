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
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Synchronous today, with job-compatible IDs/statuses and process-local duplicate suppression. */
@Service
public class DoctorSupportExecutionService {
    private static final Logger LOGGER = LoggerFactory.getLogger(DoctorSupportExecutionService.class);
    private static final EnumSet<DoctorSupportTask> EXECUTABLE = EnumSet.allOf(DoctorSupportTask.class);

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
        if (tasks.contains(DoctorSupportTask.STRUCTURE_NOTES)
            && (request.doctorNotes() == null || request.doctorNotes().isBlank())) {
            throw badRequest("DOCTOR_NOTES_REQUIRED", "Doctor-authored notes are required for structuring.");
        }

        String cacheKey = request.clientExecutionKey() == null || request.clientExecutionKey().isBlank()
            ? null : doctorId + ":" + appointmentId + ":" + request.clientExecutionKey();
        String fingerprint = requestFingerprint(request);
        CachedExecution cached = null;
        if (cacheKey != null) {
            cached = idempotency.get(cacheKey);
            if (cached != null) {
                if (!cached.fingerprint().equals(fingerprint)) {
                    throw new DoctorApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED",
                        "That execution key was already used for a different request.");
                }
            }
        }

        UUID executionId = UUID.randomUUID();
        Instant started = clock.instant();
        DoctorSupportEvidenceAssembler.Assembly assembly = evidenceAssembler.assemble(doctorId, appointmentId, request);
        var snapshot = assembly.snapshot();
        if (cached != null && cached.response().evidenceSnapshotHash().equals(snapshot.snapshotHash())
            && knowledgeSnapshotIsCurrent(tasks, cached.response())) {
            return cached.response();
        }
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
                    provenance(snapshot, spec, null), List.of()
                ));
            } else {
                runnable.add(task);
            }
        }

        if (!runnable.isEmpty()) {
            List<MedGemmaClient.DoctorSupportTaskExecutionRequest> aiTasks = runnable.stream().map(task -> {
                var spec = registry.require(task);
                return new MedGemmaClient.DoctorSupportTaskExecutionRequest(
                    task.name(), spec.promptVersion(), spec.responseSchemaVersion(), spec.ragPolicy().name()
                );
            }).toList();
            MedGemmaClient.DoctorSupportExecutionResponse aiResponse;
            try {
                aiResponse = ai.executeDoctorSupport(new MedGemmaClient.DoctorSupportExecutionRequest(
                    executionId, request.originalQuestion(), request.doctorAssessment(), request.doctorNotes(),
                    objectMapper.valueToTree(assembly.appointmentContext()), objectMapper.valueToTree(modelEvidence(snapshot)), aiTasks
                ));
            } catch (RestClientException exception) {
                String code = exception instanceof RestClientResponseException responseException
                    && responseException.getResponseBodyAsString().toLowerCase(java.util.Locale.ROOT).contains("busy")
                    ? "MODEL_BUSY" : "MODEL_UNAVAILABLE";
                for (DoctorSupportTask task : runnable) {
                    results.add(new DoctorSupportExecutionResponse.TaskResult(
                        task, DoctorSupportTaskExecutionStatus.FAILED_SAFE, null, code,
                        provenance(snapshot, registry.require(task), null), List.of()
                    ));
                }
                aiResponse = null;
            }
            if (aiResponse == null) {
                runnable.clear();
            }
            if (aiResponse != null) {
                Set<String> expectedTasks = runnable.stream().map(Enum::name).collect(java.util.stream.Collectors.toSet());
                Set<String> returnedTasks = aiResponse.taskResults().stream()
                    .map(MedGemmaClient.DoctorSupportTaskExecutionResponse::taskId)
                    .collect(java.util.stream.Collectors.toSet());
                String invalidContract = executionContractFailure(expectedTasks, returnedTasks, aiResponse);
                if (invalidContract != null) {
                    LOGGER.warn(
                        "doctor_execution_contract_rejected execution_id={} category={} expected_task_count={} returned_task_count={}",
                        executionId, invalidContract, expectedTasks.size(), aiResponse.taskResults().size()
                    );
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
                            provenance(snapshot, registry.require(task), null), List.of()
                        ));
                        continue;
                    }
                    DoctorSupportTaskExecutionStatus taskStatus = "SUCCEEDED".equals(item.status())
                        ? DoctorSupportTaskExecutionStatus.SUCCEEDED : DoctorSupportTaskExecutionStatus.FAILED_SAFE;
                    results.add(new DoctorSupportExecutionResponse.TaskResult(
                        task, taskStatus, taskStatus == DoctorSupportTaskExecutionStatus.SUCCEEDED ? item.result() : null,
                        item.safeFailureCode(), provenance(snapshot, registry.require(task), item), references(item)
                    ));
                }
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
            idempotency.put(cacheKey, new CachedExecution(fingerprint, response));
        }
        return response;
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
            spec.promptVersion(), spec.responseSchemaVersion(), aiResult == null ? "NOT_RUN" : aiResult.groundingStatus(),
            aiResult != null && aiResult.ragUsed(), spec.ragPolicy(),
            aiResult == null ? "NOT_REQUIRED" : aiResult.retrievalStatus(),
            aiResult == null ? null : aiResult.knowledgeIndexVersion(),
            aiResult == null ? List.of() : aiResult.retrievedChunkIds(),
            aiResult == null ? List.of() : aiResult.citedChunkIds(),
            aiResult == null ? 0 : aiResult.retrievalDurationMs()
        );
    }

    private boolean validRetrievalContract(
        DoctorSupportTaskSpec spec, MedGemmaClient.DoctorSupportTaskExecutionResponse item
    ) {
        Set<String> validStatuses = Set.of(
            "NOT_REQUIRED", "USED", "NO_RELEVANT_REFERENCE", "KNOWLEDGE_UNAVAILABLE", "RETRIEVAL_FAILED_SAFE"
        );
        if (!validStatuses.contains(item.retrievalStatus()) || item.retrievalDurationMs() < 0) return false;
        if (item.ragUsed() != "USED".equals(item.retrievalStatus())) return false;
        if (item.ragUsed() && (item.retrievedChunkIds().isEmpty()
            || item.knowledgeIndexVersion() == null || item.knowledgeIndexVersion().isBlank())) return false;
        if (!item.ragUsed() && !item.retrievedChunkIds().isEmpty()) return false;
        if (spec.ragPolicy() == DoctorSupportRagPolicy.DISABLED
            && (item.ragUsed() || !"NOT_REQUIRED".equals(item.retrievalStatus()))) return false;
        if ("SUCCEEDED".equals(item.status()) && spec.ragPolicy() == DoctorSupportRagPolicy.REQUIRED_WHEN_AVAILABLE
            && !item.ragUsed()) return false;
        if (item.retrievedChunkIds().size() != Set.copyOf(item.retrievedChunkIds()).size()
            || item.citedChunkIds().size() != Set.copyOf(item.citedChunkIds()).size()
            || !item.retrievedChunkIds().containsAll(item.citedChunkIds())) return false;
        return item.references().stream().map(MedGemmaClient.ClinicalReference::chunkId).toList()
            .equals(item.citedChunkIds());
    }

    private String executionContractFailure(
        Set<String> expectedTasks, Set<String> returnedTasks, MedGemmaClient.DoctorSupportExecutionResponse response
    ) {
        if (returnedTasks.size() != response.taskResults().size()) return "DUPLICATE_TASK_RESULT";
        if (!returnedTasks.equals(expectedTasks)) return "TASK_SET_MISMATCH";
        for (var item : response.taskResults()) {
            if (!("SUCCEEDED".equals(item.status()) || "FAILED_SAFE".equals(item.status()))) return "INVALID_STATUS";
            DoctorSupportTask task;
            try {
                task = DoctorSupportTask.valueOf(item.taskId());
            } catch (RuntimeException exception) {
                return "UNKNOWN_TASK";
            }
            DoctorSupportTaskSpec spec = registry.require(task);
            if (!spec.promptVersion().equals(item.promptVersion())) return "PROMPT_VERSION_MISMATCH";
            if (!spec.responseSchemaVersion().equals(item.schemaVersion())) return "SCHEMA_VERSION_MISMATCH";
            if (!spec.ragPolicy().name().equals(item.ragPolicy())) return "RAG_POLICY_MISMATCH";
            if (!validRetrievalContract(spec, item)) return "INVALID_RETRIEVAL_CONTRACT";
            boolean hasResult = item.result() != null && !item.result().isNull();
            if ("SUCCEEDED".equals(item.status())) {
                if (!hasResult) return "MISSING_SUCCESS_RESULT";
                if (!item.taskId().equals(item.result().path("taskId").asText())) return "INNER_TASK_MISMATCH";
                if (!"PASSED".equals(item.groundingStatus())) return "SUCCESS_NOT_GROUNDED";
                if (item.safeFailureCode() != null) return "SUCCESS_WITH_FAILURE_CODE";
            } else if (hasResult || item.safeFailureCode() == null || item.safeFailureCode().isBlank()) {
                return "INVALID_FAILED_SAFE_RESULT";
            }
        }
        return null;
    }

    private List<DoctorSupportExecutionResponse.ClinicalReference> references(
        MedGemmaClient.DoctorSupportTaskExecutionResponse item
    ) {
        return item.references().stream().map(reference -> new DoctorSupportExecutionResponse.ClinicalReference(
            reference.chunkId(), reference.sourceId(), reference.documentId(), reference.title(), reference.publisher(),
            reference.sourceType(), reference.clinicalDomain(), reference.publicationDate(), reference.version(),
            reference.jurisdiction(), reference.sourceReference(), reference.sectionPath()
        )).toList();
    }

    private String requestFingerprint(DoctorSupportExecutionRequest request) {
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(request);
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception exc) {
            throw new IllegalStateException("Could not fingerprint Doctor support request.", exc);
        }
    }

    private boolean knowledgeSnapshotIsCurrent(
        List<DoctorSupportTask> tasks, DoctorSupportExecutionResponse cachedResponse
    ) {
        Set<DoctorSupportTask> ragTasks = tasks.stream()
            .filter(task -> registry.require(task).ragPolicy() != DoctorSupportRagPolicy.DISABLED)
            .collect(java.util.stream.Collectors.toSet());
        if (ragTasks.isEmpty()) return true;
        try {
            String currentVersion = ai.clinicalKnowledgeHealth().indexVersion();
            return cachedResponse.taskResults().stream()
                .filter(result -> ragTasks.contains(result.taskId()))
                .allMatch(result -> java.util.Objects.equals(result.provenance().knowledgeIndexVersion(), currentVersion));
        } catch (RestClientException | IllegalStateException exception) {
            return false;
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
