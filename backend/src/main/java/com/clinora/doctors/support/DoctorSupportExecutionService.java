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

/** Freshly authorized Doctor execution with deterministic fast paths and hosted live reasoning. */
@Service
public class DoctorSupportExecutionService {
    private static final Logger LOGGER = LoggerFactory.getLogger(DoctorSupportExecutionService.class);
    private static final EnumSet<DoctorSupportTask> EXECUTABLE = EnumSet.allOf(DoctorSupportTask.class);
    private static final EnumSet<DoctorSupportTask> SNAPSHOT_REQUIRED = EnumSet.of(
        DoctorSupportTask.CONNECT_EVIDENCE,
        DoctorSupportTask.CROSS_CHECK_ASSESSMENT,
        DoctorSupportTask.FIND_GAPS,
        DoctorSupportTask.EXPLORE_EXPLANATIONS,
        DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION
    );

    private final DoctorSupportTaskRegistry registry;
    private final DoctorSupportEvidenceAssembler evidenceAssembler;
    private final DoctorClinicalReasoningSnapshotService reasoningSnapshots;
    private final MedGemmaClient ai;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final Map<String, CachedExecution> idempotency = new ConcurrentHashMap<>();
    private final Map<String, Object> executionLocks = new ConcurrentHashMap<>();

    public DoctorSupportExecutionService(
        DoctorSupportTaskRegistry registry,
        DoctorSupportEvidenceAssembler evidenceAssembler,
        DoctorClinicalReasoningSnapshotService reasoningSnapshots,
        MedGemmaClient ai,
        ObjectMapper objectMapper,
        Clock clock
    ) {
        this.registry = registry;
        this.evidenceAssembler = evidenceAssembler;
        this.reasoningSnapshots = reasoningSnapshots;
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
        long totalStarted = System.nanoTime();
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
        long authorizationMs = assembly.timings().authorizationMs();
        long evidenceMs = assembly.timings().evidenceMs();
        var snapshot = assembly.snapshot();
        List<DoctorSupportExecutionResponse.TaskResult> results = new ArrayList<>();
        List<DoctorSupportTask> runnable = new ArrayList<>();

        DoctorClinicalReasoningSnapshotService.Resolution snapshotResolution = null;
        long snapshotLookupMs = 0;
        if (tasks.contains(DoctorSupportTask.BRIEF_PATIENT)
            || tasks.contains(DoctorSupportTask.COMPARE_EVIDENCE)) {
            long snapshotStarted = System.nanoTime();
            snapshotResolution = reasoningSnapshots.resolveAvailable(assembly.patientId(), snapshot);
            snapshotLookupMs += elapsedMillis(snapshotStarted);
        }

        for (DoctorSupportTask task : tasks) {
            if (task == DoctorSupportTask.BRIEF_PATIENT) {
                results.add(deterministicBrief(snapshot, assembly, snapshotResolution));
                continue;
            }
            if (task == DoctorSupportTask.COMPARE_EVIDENCE
                && snapshot.reports().size() < 2) {
                var spec = registry.require(task);
                boolean selectionPossible = !assembly.selectionCandidates().isEmpty();
                results.add(new DoctorSupportExecutionResponse.TaskResult(
                    task, selectionPossible ? DoctorSupportTaskExecutionStatus.EVIDENCE_SELECTION_REQUIRED
                        : DoctorSupportTaskExecutionStatus.FAILED_SAFE,
                    null, selectionPossible ? "EVIDENCE_SELECTION_REQUIRED" : "COMPARABLE_REPORTS_REQUIRED",
                    provenance(snapshot, spec, null, snapshotResolution), List.of()
                ));
            } else if (task == DoctorSupportTask.COMPARE_EVIDENCE) {
                results.add(deterministicCompare(snapshot, snapshotResolution));
            } else if (task == DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION
                && isDeterministicFindingQuestion(request.originalQuestion())) {
                results.add(deterministicFocusedFindings(snapshot, request.originalQuestion()));
            } else {
                runnable.add(task);
            }
        }

        List<DoctorSupportTask> snapshotTasks = runnable.stream().filter(SNAPSHOT_REQUIRED::contains).toList();
        if (!snapshotTasks.isEmpty()) {
            long snapshotStarted = System.nanoTime();
            snapshotResolution = reasoningSnapshots.resolve(assembly.patientId(), snapshot);
            snapshotLookupMs += elapsedMillis(snapshotStarted);
            if (snapshotResolution.availability() != DoctorClinicalReasoningSnapshotService.Availability.READY) {
                String code = switch (snapshotResolution.availability()) {
                    case FAILED -> "CLINICAL_REASONING_UNAVAILABLE";
                    case STALE -> "CLINICAL_REASONING_STALE";
                    default -> "CLINICAL_REASONING_PREPARING";
                };
                for (DoctorSupportTask task : snapshotTasks) {
                    results.add(new DoctorSupportExecutionResponse.TaskResult(
                        task, DoctorSupportTaskExecutionStatus.FAILED_SAFE, null, code,
                        provenance(snapshot, registry.require(task), null, snapshotResolution), List.of()
                    ));
                }
                runnable.removeAll(snapshotTasks);
            }
        }

        if (cached != null && cached.response().evidenceSnapshotHash().equals(snapshot.snapshotHash())
            && reasoningSnapshotIsCurrent(snapshotResolution, cached.response())
            && knowledgeSnapshotIsCurrent(tasks, cached.response())) {
            logPerformance(
                cached.response().executionId(), tasks, snapshot, snapshotResolution,
                authorizationMs, evidenceMs, snapshotLookupMs, 0, 0, 0, 0, 0,
                elapsedMillis(totalStarted), true
            );
            return cached.response();
        }

        long aiRoundTripMs = 0;
        if (!runnable.isEmpty()) {
            List<MedGemmaClient.DoctorSupportTaskExecutionRequest> aiTasks = runnable.stream().map(task -> {
                var spec = registry.require(task);
                return new MedGemmaClient.DoctorSupportTaskExecutionRequest(
                    task.name(), spec.promptVersion(), spec.responseSchemaVersion(), spec.ragPolicy().name()
                );
            }).toList();
            MedGemmaClient.DoctorSupportExecutionResponse aiResponse;
            long aiStarted = System.nanoTime();
            try {
                aiResponse = ai.executeDoctorSupport(new MedGemmaClient.DoctorSupportExecutionRequest(
                    executionId, request.originalQuestion(), request.doctorAssessment(), request.doctorNotes(),
                    objectMapper.valueToTree(assembly.appointmentContext()), objectMapper.valueToTree(modelEvidence(snapshot)),
                    objectMapper.valueToTree(snapshotResolution == null ? List.of() : snapshotResolution.snapshots()), aiTasks
                ));
            } catch (RestClientException exception) {
                GeminiProviderFailure failure = geminiFailure(exception);
                for (DoctorSupportTask task : runnable) {
                    LOGGER.warn(
                        "doctor_support_provider_failure execution_id={} task_id={} failure_stage=generation "
                            + "provider_code={} provider_attempts={} successful_generations={} rate_limit_category={} "
                            + "schema_status=NOT_RUN grounding_status=NOT_RUN",
                        executionId, task.name(), failure.code(), failure.providerAttempts(),
                        failure.successfulGenerations(), failure.rateLimitCategory()
                    );
                    DoctorSupportExecutionResponse.TaskResult degraded = degradedResult(
                        task, request, snapshot, snapshotResolution, failure
                    );
                    if (degraded != null) {
                        LOGGER.info(
                            "doctor_support_degraded execution_id={} task_id={} fallback_provider={} "
                                + "provider_code={} provider_attempts={} successful_generations={}",
                            executionId, task.name(), degraded.provenance().executionProvider(), failure.code(),
                            failure.providerAttempts(), failure.successfulGenerations()
                        );
                        results.add(degraded);
                    } else {
                        results.add(new DoctorSupportExecutionResponse.TaskResult(
                            task, DoctorSupportTaskExecutionStatus.FAILED_SAFE, null, failure.code(),
                            providerFailureProvenance(
                                snapshot, registry.require(task), snapshotResolution,
                                failure.providerAttempts(), failure.successfulGenerations()
                            ),
                            List.of()
                        ));
                    }
                }
                aiResponse = null;
            } finally {
                aiRoundTripMs = elapsedMillis(aiStarted);
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
                        "doctor_execution_contract_rejected execution_id={} task_id=CONTRACT "
                            + "failure_stage=response_contract validation_code={} invalid_handle=NONE "
                            + "invalid_type=contract invalid_field=taskResults expected_task_count={} returned_task_count={}",
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
                            provenance(snapshot, registry.require(task), null, snapshotResolution), List.of()
                        ));
                        continue;
                    }
                    DoctorSupportTaskExecutionStatus taskStatus = "SUCCEEDED".equals(item.status())
                        ? DoctorSupportTaskExecutionStatus.SUCCEEDED : DoctorSupportTaskExecutionStatus.FAILED_SAFE;
                    if (taskStatus == DoctorSupportTaskExecutionStatus.FAILED_SAFE) {
                        logValidationRejection(executionId, item);
                    }
                    results.add(new DoctorSupportExecutionResponse.TaskResult(
                        task, taskStatus, taskStatus == DoctorSupportTaskExecutionStatus.SUCCEEDED ? item.result() : null,
                        item.safeFailureCode(), provenance(snapshot, registry.require(task), item, snapshotResolution), references(item)
                    ));
                }
            }
        }
        results.sort(java.util.Comparator.comparingInt(item -> item.taskId().ordinal()));
        long success = results.stream().filter(item -> item.status() == DoctorSupportTaskExecutionStatus.SUCCEEDED).count();
        long degraded = results.stream().filter(item -> item.status() == DoctorSupportTaskExecutionStatus.DEGRADED).count();
        DoctorSupportExecutionStatus status;
        if (success == results.size()) {
            status = DoctorSupportExecutionStatus.SUCCEEDED;
        } else if (success + degraded == results.size() && degraded > 0) {
            status = DoctorSupportExecutionStatus.DEGRADED;
        } else if (success + degraded > 0) {
            status = DoctorSupportExecutionStatus.PARTIAL_SUCCESS;
        } else {
            status = DoctorSupportExecutionStatus.FAILED_SAFE;
        }
        DoctorSupportExecutionResponse response = new DoctorSupportExecutionResponse(
            executionId, doctorId, appointmentId, status, snapshot.snapshotHash(), snapshot.reports(), snapshot.observations(),
            results, assembly.selectionCandidates(), started, clock.instant()
        );
        if (cacheKey != null) {
            if (idempotency.size() >= 1000) idempotency.keySet().stream().findFirst().ifPresent(idempotency::remove);
            idempotency.put(cacheKey, new CachedExecution(fingerprint, response));
        }
        logPerformance(
            executionId, tasks, snapshot, snapshotResolution,
            authorizationMs, evidenceMs, snapshotLookupMs,
            results.stream().mapToLong(item -> item.provenance().retrievalDurationMs()).sum(),
            results.stream().mapToLong(item -> item.provenance().inferenceDurationMs()).sum(),
            results.stream().mapToLong(item -> item.provenance().repairDurationMs()).sum(),
            aiRoundTripMs,
            results.stream().mapToLong(item -> item.provenance().groundingDurationMs()).sum(),
            elapsedMillis(totalStarted), false
        );
        return response;
    }

    private DoctorSupportExecutionResponse.Provenance provenance(
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorSupportTaskSpec spec,
        MedGemmaClient.DoctorSupportTaskExecutionResponse aiResult
    ) {
        return provenance(snapshot, spec, aiResult, null);
    }

    private DoctorSupportExecutionResponse.Provenance provenance(
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorSupportTaskSpec spec,
        MedGemmaClient.DoctorSupportTaskExecutionResponse aiResult,
        DoctorClinicalReasoningSnapshotService.Resolution snapshotResolution
    ) {
        List<DoctorSupportExecutionResponse.SnapshotProvenance> snapshotProvenance = snapshotResolution == null
            ? List.of()
            : snapshotResolution.provenance().stream().map(item -> new DoctorSupportExecutionResponse.SnapshotProvenance(
                item.snapshotId(), item.jobId(), item.reportId(), item.evidenceVersion(), item.status(),
                item.modelName(), item.modelRevision(), item.promptVersion(), item.schemaVersion(), item.generatedAt()
            )).toList();
        return new DoctorSupportExecutionResponse.Provenance(
            snapshot.reports().stream().map(DoctorSupportEvidenceSnapshot.ReportEvidence::reportId).toList(),
            snapshot.observations().stream().map(DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId).toList(),
            snapshot.snapshotHash(), aiResult == null ? "DETERMINISTIC" : aiResult.executionProvider(),
            aiResult == null ? null : aiResult.modelName(),
            aiResult == null ? null : aiResult.modelRevision(), aiResult == null ? null : aiResult.quantization(),
            spec.promptVersion(), spec.responseSchemaVersion(), aiResult == null ? "NOT_RUN" : aiResult.groundingStatus(),
            aiResult != null && aiResult.ragUsed(), spec.ragPolicy(),
            aiResult == null ? "NOT_REQUIRED" : aiResult.retrievalStatus(),
            aiResult == null ? null : aiResult.knowledgeIndexVersion(),
            aiResult == null ? List.of() : aiResult.retrievedChunkIds(),
            aiResult == null ? List.of() : aiResult.citedChunkIds(),
            aiResult == null ? 0 : aiResult.retrievalDurationMs(),
            aiResult == null ? 0 : aiResult.inferenceDurationMs(),
            aiResult == null ? 0 : aiResult.repairDurationMs(),
            aiResult == null ? 0 : aiResult.groundingDurationMs(),
            aiResult == null ? 0 : aiResult.generationCallCount(),
            aiResult == null ? 0 : aiResult.providerAttempts(),
            aiResult == null ? 0 : aiResult.successfulGenerations(),
            snapshotProvenance,
            clock.instant()
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
        if ("SUCCEEDED".equals(item.status()) && "RETRIEVAL_FAILED_SAFE".equals(item.retrievalStatus())) return false;
        if ("SUCCEEDED".equals(item.status()) && spec.ragPolicy() == DoctorSupportRagPolicy.REQUIRED_WHEN_AVAILABLE) {
            if ("NOT_REQUIRED".equals(item.retrievalStatus())) return false;
            if (!item.ragUsed() && (item.result() == null || !item.result().path("limitations").toString()
                .contains("independent verification"))) return false;
        }
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
            if (!"GEMINI".equals(item.executionProvider())) return "EXECUTION_PROVIDER_MISMATCH";
            if (item.inferenceDurationMs() < 0 || item.repairDurationMs() < 0
                || item.groundingDurationMs() < 0 || item.generationCallCount() < 0
                || item.providerAttempts() < item.successfulGenerations()
                || item.successfulGenerations() != item.generationCallCount()) {
                return "INVALID_EXECUTION_TIMING";
            }
            if (!spec.ragPolicy().name().equals(item.ragPolicy())) return "RAG_POLICY_MISMATCH";
            if (!validRetrievalContract(spec, item)) return "INVALID_RETRIEVAL_CONTRACT";
            boolean hasResult = item.result() != null && !item.result().isNull();
            if ("SUCCEEDED".equals(item.status())) {
                if (item.generationCallCount() < 1) return "MISSING_GENERATION_CALL";
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

    private static void logValidationRejection(
        UUID executionId, MedGemmaClient.DoctorSupportTaskExecutionResponse item
    ) {
        LOGGER.warn(
            "doctor_support_validation_rejected execution_id={} task_id={} failure_stage={} "
                + "validation_code={} invalid_handle={} invalid_type={} invalid_field={}",
            executionId,
            diagnosticToken(item.taskId(), "UNKNOWN_TASK"),
            diagnosticToken(item.failureStage(), "UNKNOWN"),
            diagnosticToken(item.safeFailureCode(), "UNKNOWN_VALIDATION_FAILURE"),
            item.invalidHandle() != null && item.invalidHandle().matches("E\\d+") ? item.invalidHandle() : "NONE",
            diagnosticToken(item.invalidType(), "NONE"),
            diagnosticPath(item.invalidField())
        );
    }

    private static String diagnosticToken(String value, String fallback) {
        if (value == null || !value.matches("[A-Za-z0-9_.-]{1,96}")) return fallback;
        return value;
    }

    private static String diagnosticPath(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_.$-]{1,160}")) return "NONE";
        return value;
    }

    private DoctorSupportExecutionResponse.TaskResult deterministicFocusedFindings(
        DoctorSupportEvidenceSnapshot snapshot,
        String question
    ) {
        DoctorSupportTaskSpec spec = registry.require(DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION);
        String normalizedQuestion = question.toLowerCase(java.util.Locale.ROOT);
        boolean abnormalOnly = normalizedQuestion.matches(
            ".*\\b(abnormal|stand out|high|low|out of range|positive)\\b.*"
        );
        boolean countQuestion = normalizedQuestion.matches(".*\\b(how many|count|number of)\\b.*");
        boolean latestQuestion = normalizedQuestion.matches(".*\\b(latest|current|most recent|newest)\\b.*");
        List<DoctorSupportEvidenceSnapshot.ObservationEvidence> abnormal = snapshot.observations().stream()
            .filter(item -> Set.of("LOW", "HIGH", "POSITIVE").contains(item.authoritativeStatus()))
            .sorted(java.util.Comparator.comparingInt(DoctorSupportExecutionService::briefPriority)
                .thenComparing(item -> item.label().toLowerCase(java.util.Locale.ROOT)))
            .limit(10).toList();
        Map<UUID, java.time.LocalDate> reportDates = snapshot.reports().stream()
            .filter(item -> item.clinicalDate() != null).collect(
            java.util.stream.Collectors.toMap(
                DoctorSupportEvidenceSnapshot.ReportEvidence::reportId,
                DoctorSupportEvidenceSnapshot.ReportEvidence::clinicalDate,
                (left, right) -> left
            )
        );
        List<DoctorSupportEvidenceSnapshot.ObservationEvidence> matching = snapshot.observations().stream()
            .filter(item -> item.label().length() > 1
                && normalizedQuestion.contains(item.label().toLowerCase(java.util.Locale.ROOT)))
            .sorted(java.util.Comparator.comparing(
                (DoctorSupportEvidenceSnapshot.ObservationEvidence item) -> reportDates.get(item.reportId()),
                java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())
            )).toList();
        List<DoctorSupportEvidenceSnapshot.ObservationEvidence> selected;
        if (!matching.isEmpty()) {
            selected = matching.stream().limit(latestQuestion ? 1 : 10).toList();
        } else if (abnormalOnly && !abnormal.isEmpty()) {
            selected = abnormal;
        } else {
            selected = snapshot.observations().stream()
                .sorted(java.util.Comparator.comparingInt(DoctorSupportExecutionService::briefPriority)
                    .thenComparing(item -> item.label().toLowerCase(java.util.Locale.ROOT)))
                .limit(10).toList();
        }
        var result = objectMapper.createObjectNode();
        result.put("taskId", DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION.name());
        if (countQuestion) {
            result.put("answer", "There are " + snapshot.observations().size()
                + " currently authorized verified findings.");
        } else if (latestQuestion && !matching.isEmpty()) {
            result.put("answer", "The latest matching authorized verified finding is shown below.");
        } else if (abnormalOnly && abnormal.isEmpty()) {
            result.put("answer", "No high, low, or positive finding is present in the currently authorized verified evidence.");
        } else if (abnormalOnly) {
            result.put("answer", "The high, low, or positive findings in the currently authorized verified evidence are shown below.");
        } else {
            result.put("answer", "The currently authorized verified findings are shown below.");
        }
        var evidence = result.putArray("supportingEvidence");
        selected.forEach(item -> {
            var reference = evidence.addObject();
            reference.put("observationId", item.observationId().toString());
            reference.put("label", item.label());
        });
        result.putArray("referenceChunkIds");
        result.putArray("limitations");
        return new DoctorSupportExecutionResponse.TaskResult(
            DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION,
            DoctorSupportTaskExecutionStatus.SUCCEEDED,
            result,
            null,
            provenance(snapshot, spec, null),
            List.of()
        );
    }

    private static boolean isDeterministicFindingQuestion(String question) {
        if (question == null) return false;
        String normalized = question.toLowerCase(java.util.Locale.ROOT).replaceAll("\\s+", " ").trim();
        if (normalized.matches(".*\\b(mean|means|interpret|explain|why|cause|causes|relate|relationship|diagnos|treat)\\w*\\b.*")) {
            return false;
        }
        boolean factualNoun = normalized.matches(
            ".*\\b(finding|findings|result|results|observation|observations|value|values|unit|units|range|ranges|"
                + "status|statuses|date|dates|abnormal\\w*|high|low|positive|verified)\\b.*"
        );
        boolean factualVerb = normalized.matches(
            ".*\\b(what|which|show|list|find|stand out|are there|identify|describe|documented|"
                + "latest|current|most recent|newest|how many|count|number of)\\b.*"
        );
        return factualNoun && factualVerb;
    }

    private DoctorSupportExecutionResponse.TaskResult degradedResult(
        DoctorSupportTask task,
        DoctorSupportExecutionRequest request,
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorClinicalReasoningSnapshotService.Resolution reasoning,
        GeminiProviderFailure failure
    ) {
        if (reasoning == null
            || reasoning.availability() != DoctorClinicalReasoningSnapshotService.Availability.READY
            || reasoning.snapshots().isEmpty()) {
            return null;
        }
        com.fasterxml.jackson.databind.JsonNode result = switch (task) {
            case EXPLORE_EXPLANATIONS -> degradedExplore(snapshot, reasoning);
            case FIND_GAPS -> degradedGaps(snapshot, reasoning);
            case CROSS_CHECK_ASSESSMENT -> degradedCrossCheck(request.doctorAssessment(), snapshot, reasoning);
            default -> null;
        };
        if (result == null) return null;
        return new DoctorSupportExecutionResponse.TaskResult(
            task,
            DoctorSupportTaskExecutionStatus.DEGRADED,
            result,
            failure.code(),
            degradedProvenance(
                snapshot, registry.require(task), reasoning,
                failure.providerAttempts(), failure.successfulGenerations()
            ),
            List.of()
        );
    }

    private com.fasterxml.jackson.databind.JsonNode degradedExplore(
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorClinicalReasoningSnapshotService.Resolution reasoning
    ) {
        var result = objectMapper.createObjectNode();
        result.put("taskId", DoctorSupportTask.EXPLORE_EXPLANATIONS.name());
        result.put("summary", "Existing report analysis — live cross-report reasoning temporarily unavailable.");
        var explanations = result.putArray("explanations");
        Map<UUID, DoctorSupportEvidenceSnapshot.ObservationEvidence> observations = observationIndex(snapshot);
        Map<UUID, DoctorSupportEvidenceSnapshot.ReportEvidence> reports = snapshot.reports().stream().collect(
            java.util.stream.Collectors.toMap(
                DoctorSupportEvidenceSnapshot.ReportEvidence::reportId, item -> item, (left, right) -> left
            )
        );
        Set<String> seen = new java.util.LinkedHashSet<>();
        for (var reportAnalysis : reasoning.snapshots()) {
            for (var possibility : reportAnalysis.possibilities()) {
                addExistingExplanation(
                    explanations, seen, reportLabel(reports.get(reportAnalysis.reportId())), possibility.concept(),
                    possibility.support(), possibility.against(), possibility.missing(), observations
                );
            }
            for (var pattern : reportAnalysis.patterns()) {
                addExistingExplanation(
                    explanations, seen, reportLabel(reports.get(reportAnalysis.reportId())), pattern.concept(),
                    pattern.support(), pattern.against(), List.of(), observations
                );
            }
        }
        var limitations = result.putArray("limitations");
        limitations.add("This is advisory existing report-level analysis, not live cross-report reasoning.");
        limitations.add("Patient values, units, ranges, statuses, and dates shown here come only from current authorized database evidence.");
        result.putArray("summaryReferenceChunkIds");
        return result;
    }

    private void addExistingExplanation(
        com.fasterxml.jackson.databind.node.ArrayNode explanations,
        Set<String> seen,
        String reportLabel,
        String concept,
        List<UUID> support,
        List<UUID> against,
        List<String> missing,
        Map<UUID, DoctorSupportEvidenceSnapshot.ObservationEvidence> observations
    ) {
        if (concept == null || concept.isBlank()) return;
        String key = reportLabel + "\n" + normalizeConcept(concept);
        if (!seen.add(key)) return;
        List<UUID> authorizedSupport = authorizedIds(support, observations);
        if (authorizedSupport.isEmpty()) return;
        var item = explanations.addObject();
        item.put("clinicalCluster", reportLabel);
        item.put("name", concept);
        item.put("whyItMayFit", "This concept appears in an existing READY report analysis and is linked to the verified evidence shown.");
        putEvidenceReferences(item.putArray("supportingEvidence"), authorizedSupport, observations);
        putEvidenceReferences(item.putArray("limitingEvidence"), authorizedIds(against, observations), observations);
        var missingInformation = item.putArray("missingInformation");
        safeStrings(missing, 8).forEach(missingInformation::add);
        item.putArray("referenceChunkIds");
    }

    private com.fasterxml.jackson.databind.JsonNode degradedGaps(
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorClinicalReasoningSnapshotService.Resolution reasoning
    ) {
        var result = objectMapper.createObjectNode();
        result.put("taskId", DoctorSupportTask.FIND_GAPS.name());
        result.put("summary", "Showing gaps from existing READY report analysis; live cross-report reasoning is temporarily unavailable.");
        Map<UUID, DoctorSupportEvidenceSnapshot.ObservationEvidence> observations = observationIndex(snapshot);
        Map<String, GapSource> gaps = new java.util.LinkedHashMap<>();
        for (var reportAnalysis : reasoning.snapshots()) {
            List<UUID> reportEvidence = snapshot.observations().stream()
                .filter(item -> item.reportId().equals(reportAnalysis.reportId()))
                .sorted(java.util.Comparator.comparingInt(DoctorSupportExecutionService::briefPriority))
                .map(DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId)
                .limit(4).toList();
            for (String gap : safeStrings(reportAnalysis.gaps(), 12)) {
                gaps.putIfAbsent(normalizeConcept(gap), new GapSource(gap, reportEvidence));
            }
            for (var possibility : reportAnalysis.possibilities()) {
                List<UUID> related = new ArrayList<>();
                related.addAll(authorizedIds(possibility.support(), observations));
                related.addAll(authorizedIds(possibility.against(), observations));
                if (related.isEmpty()) related.addAll(reportEvidence);
                for (String missing : safeStrings(possibility.missing(), 12)) {
                    gaps.putIfAbsent(normalizeConcept(missing), new GapSource(missing, related));
                }
            }
        }
        var gapItems = result.putArray("gaps");
        gaps.values().stream().limit(12).forEach(gap -> {
            var item = gapItems.addObject();
            item.put("category", gap.text());
            item.put("whyRelevant", "This item was identified as missing in existing report-level analysis; Clinora has not inferred or ordered a test.");
            item.put("availability", "NOT_PRESENT_IN_AUTHORIZED_EVIDENCE");
            putEvidenceReferences(item.putArray("relatedEvidence"), authorizedIds(gap.evidence(), observations), observations);
            item.putArray("referenceChunkIds");
        });
        var limitations = result.putArray("limitations");
        if (gapItems.isEmpty()) {
            limitations.add("The current READY report analyses do not explicitly identify missing information.");
        }
        limitations.add("These are existing report-analysis gaps only; no new tests or recommendations were generated.");
        result.putArray("summaryReferenceChunkIds");
        return result;
    }

    private com.fasterxml.jackson.databind.JsonNode degradedCrossCheck(
        String doctorAssessment,
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorClinicalReasoningSnapshotService.Resolution reasoning
    ) {
        var result = objectMapper.createObjectNode();
        result.put("taskId", DoctorSupportTask.CROSS_CHECK_ASSESSMENT.name());
        Map<UUID, DoctorSupportEvidenceSnapshot.ObservationEvidence> observations = observationIndex(snapshot);
        String normalizedAssessment = normalizeHypothesis(doctorAssessment);
        List<MatchedConcept> matches = new ArrayList<>();
        for (var reportAnalysis : reasoning.snapshots()) {
            for (var possibility : reportAnalysis.possibilities()) {
                if (normalizeConcept(possibility.concept()).equals(normalizedAssessment)) {
                    matches.add(new MatchedConcept(
                        possibility.concept(), possibility.support(), possibility.against(), possibility.missing()
                    ));
                }
            }
            for (var pattern : reportAnalysis.patterns()) {
                if (normalizeConcept(pattern.concept()).equals(normalizedAssessment)) {
                    matches.add(new MatchedConcept(pattern.concept(), pattern.support(), pattern.against(), List.of()));
                }
            }
        }
        boolean explicitlyPresent = !matches.isEmpty();
        result.put("evidenceFit", explicitlyPresent ? "MIXED_OR_LIMITED_EVIDENCE" : "INSUFFICIENT_EVIDENCE");
        result.put(
            "summary",
            explicitlyPresent
                ? "Live cross-report hypothesis checking is unavailable; this is existing report-level analysis only."
                : "Live hypothesis checking is temporarily unavailable, and the existing report-level analysis does not explicitly evaluate this hypothesis."
        );
        var points = result.putArray("points");
        Set<String> seen = new java.util.LinkedHashSet<>();
        for (MatchedConcept match : matches) {
            String key = normalizeConcept(match.concept());
            if (!seen.add(key)) continue;
            addHypothesisPoint(
                points, "Existing report analysis lists “" + match.concept() + "” and links the verified evidence shown.",
                "SUPPORTS", match.support(), observations
            );
            addHypothesisPoint(
                points, "Existing report analysis records limiting evidence for “" + match.concept() + "”.",
                "CONTRADICTS", match.against(), observations
            );
        }
        var missingInformation = result.putArray("missingInformation");
        if (explicitlyPresent) {
            matches.stream().flatMap(item -> safeStrings(item.missing(), 8).stream()).distinct().limit(10)
                .forEach(missingInformation::add);
        } else {
            missingInformation.add("The existing READY report analysis does not explicitly evaluate this hypothesis.");
        }
        result.putArray("alternativeConsiderations");
        result.putArray("limitations").add(
            "No live cross-report hypothesis conclusion was generated; concept matching is exact after basic wording normalization and is not fuzzy diagnostic inference."
        );
        result.putArray("summaryReferenceChunkIds");
        return result;
    }

    private void addHypothesisPoint(
        com.fasterxml.jackson.databind.node.ArrayNode points,
        String statement,
        String relation,
        List<UUID> ids,
        Map<UUID, DoctorSupportEvidenceSnapshot.ObservationEvidence> observations
    ) {
        List<UUID> authorized = authorizedIds(ids, observations);
        if (authorized.isEmpty()) return;
        var point = points.addObject();
        point.put("statement", statement);
        point.put("relation", relation);
        putEvidenceReferences(point.putArray("evidence"), authorized, observations);
        point.putArray("referenceChunkIds");
    }

    private static Map<UUID, DoctorSupportEvidenceSnapshot.ObservationEvidence> observationIndex(
        DoctorSupportEvidenceSnapshot snapshot
    ) {
        return snapshot.observations().stream().collect(java.util.stream.Collectors.toMap(
            DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId,
            item -> item,
            (left, right) -> left
        ));
    }

    private static List<UUID> authorizedIds(
        List<UUID> ids,
        Map<UUID, DoctorSupportEvidenceSnapshot.ObservationEvidence> observations
    ) {
        if (ids == null) return List.of();
        return ids.stream().filter(observations::containsKey).distinct().limit(12).toList();
    }

    private static void putEvidenceReferences(
        com.fasterxml.jackson.databind.node.ArrayNode target,
        List<UUID> ids,
        Map<UUID, DoctorSupportEvidenceSnapshot.ObservationEvidence> observations
    ) {
        ids.stream().map(observations::get).filter(java.util.Objects::nonNull)
            .forEach(item -> addEvidenceReference(target, item));
    }

    private static List<String> safeStrings(List<String> values, int limit) {
        if (values == null) return List.of();
        return values.stream().filter(java.util.Objects::nonNull).map(value -> value.replaceAll("\\s+", " ").trim())
            .filter(value -> !value.isBlank()).distinct().limit(limit).toList();
    }

    private static String normalizeHypothesis(String value) {
        String normalized = normalizeConcept(value);
        return normalized.replaceFirst(
            "^(possible|possibly|possibility of|suspected|suspect|could this be|could it be|is this|does this support) ", ""
        ).trim();
    }

    private static String normalizeConcept(String value) {
        if (value == null) return "";
        return value.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+", " ")
            .replaceAll("\\s+", " ").trim();
    }

    private static String reportLabel(DoctorSupportEvidenceSnapshot.ReportEvidence report) {
        if (report == null) return "Authorized report";
        return report.reportType().replace('_', ' ') + (report.clinicalDate() == null ? "" : " · " + report.clinicalDate());
    }

    private DoctorSupportExecutionResponse.TaskResult deterministicCompare(
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorClinicalReasoningSnapshotService.Resolution reasoning
    ) {
        DoctorSupportTaskSpec spec = registry.require(DoctorSupportTask.COMPARE_EVIDENCE);
        var result = objectMapper.createObjectNode();
        result.put("taskId", DoctorSupportTask.COMPARE_EVIDENCE.name());
        Map<UUID, DoctorSupportEvidenceSnapshot.ObservationEvidence> byObservation = snapshot.observations().stream()
            .collect(java.util.stream.Collectors.toMap(
                DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId,
                item -> item,
                (left, right) -> left
            ));
        var comparisons = result.putArray("comparisons");
        snapshot.comparisonFacts().stream().limit(20).forEach(fact -> {
            var earlier = byObservation.get(fact.earlierObservationId());
            var later = byObservation.get(fact.laterObservationId());
            if (earlier == null || later == null) return;
            var comparison = comparisons.addObject();
            comparison.put("canonicalCode", fact.canonicalCode());
            comparison.put("direction", fact.direction());
            comparison.put("explanation", comparisonStatement(fact));
            var evidence = comparison.putArray("evidence");
            var first = evidence.addObject();
            first.put("observationId", earlier.observationId().toString());
            first.put("label", earlier.label());
            var second = evidence.addObject();
            second.put("observationId", later.observationId().toString());
            second.put("label", later.label());
        });
        result.put(
            "summary",
            comparisons.isEmpty()
                ? "No directly comparable repeated observations were available across these reports."
                : "Matched verified findings are compared below using reliable report dates and normalized values."
        );
        var nonComparable = result.putArray("nonComparable");
        if (comparisons.isEmpty()) {
            nonComparable.add("No directly comparable repeated observations were available across these reports.");
        }

        List<DoctorSupportEvidenceSnapshot.ReportEvidence> orderedReports = snapshot.reports().stream()
            .sorted(java.util.Comparator
                .comparing(
                    DoctorSupportEvidenceSnapshot.ReportEvidence::clinicalDate,
                    java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())
                )
                .thenComparing(item -> item.reportId().toString()))
            .toList();
        DoctorSupportEvidenceSnapshot.ReportEvidence earlierReport = orderedReports.getFirst();
        DoctorSupportEvidenceSnapshot.ReportEvidence laterReport = orderedReports.getLast();
        Map<UUID, DoctorClinicalReasoningSnapshotService.ClinicalReasoningSnapshot> reasoningByReport =
            reasoning == null ? Map.of() : reasoning.snapshots().stream().collect(
                java.util.stream.Collectors.toMap(
                    DoctorClinicalReasoningSnapshotService.ClinicalReasoningSnapshot::reportId,
                    item -> item,
                    (left, right) -> left
                )
            );
        var reportSummaries = result.putArray("reportSummaries");
        addReportSummary(reportSummaries, "Report A", earlierReport, snapshot, reasoningByReport.get(earlierReport.reportId()));
        addReportSummary(reportSummaries, "Report B", laterReport, snapshot, reasoningByReport.get(laterReport.reportId()));

        Map<String, DoctorSupportEvidenceSnapshot.ObservationEvidence> earlierByIdentity = observationsByIdentity(
            snapshot, earlierReport.reportId()
        );
        Map<String, DoctorSupportEvidenceSnapshot.ObservationEvidence> laterByIdentity = observationsByIdentity(
            snapshot, laterReport.reportId()
        );
        var onlyEarlier = result.putArray("findingsOnlyInEarlierReport");
        earlierByIdentity.forEach((identity, item) -> {
            if (!laterByIdentity.containsKey(identity)) addEvidenceReference(onlyEarlier, item);
        });
        var onlyLater = result.putArray("findingsOnlyInLaterReport");
        laterByIdentity.forEach((identity, item) -> {
            if (!earlierByIdentity.containsKey(identity)) addEvidenceReference(onlyLater, item);
        });
        var persistent = result.putArray("persistentFindings");
        earlierByIdentity.forEach((identity, earlier) -> {
            var later = laterByIdentity.get(identity);
            if (later == null) return;
            var item = persistent.addObject();
            item.put("canonicalCode", earlier.canonicalCode());
            item.put("label", earlier.label());
            var evidence = item.putArray("evidence");
            addEvidenceReference(evidence, earlier);
            addEvidenceReference(evidence, later);
        });
        var patternDifferences = result.putArray("patternDifferences");
        Set<String> earlierConcepts = reasoningConcepts(reasoningByReport.get(earlierReport.reportId()));
        Set<String> laterConcepts = reasoningConcepts(reasoningByReport.get(laterReport.reportId()));
        earlierConcepts.stream().filter(item -> !laterConcepts.contains(item)).limit(8)
            .forEach(item -> patternDifferences.add("Only Report A existing analysis: " + item));
        laterConcepts.stream().filter(item -> !earlierConcepts.contains(item)).limit(8)
            .forEach(item -> patternDifferences.add("Only Report B existing analysis: " + item));

        result.putArray("limitations").add(
            comparisons.isEmpty()
                ? "The side-by-side view does not imply a longitudinal change where observation identity, dates, or units are not reliably comparable."
                : "Only unambiguous matched numeric findings are assigned a direction; the side-by-side sections preserve other verified findings."
        );
        return new DoctorSupportExecutionResponse.TaskResult(
            DoctorSupportTask.COMPARE_EVIDENCE,
            DoctorSupportTaskExecutionStatus.SUCCEEDED,
            result,
            null,
            provenance(snapshot, spec, null, reasoning),
            List.of()
        );
    }

    private void addReportSummary(
        com.fasterxml.jackson.databind.node.ArrayNode summaries,
        String label,
        DoctorSupportEvidenceSnapshot.ReportEvidence report,
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorClinicalReasoningSnapshotService.ClinicalReasoningSnapshot reasoning
    ) {
        var summary = summaries.addObject();
        summary.put("label", label);
        summary.put("reportId", report.reportId().toString());
        summary.put("reportType", report.reportType());
        if (report.clinicalDate() == null) summary.putNull("clinicalDate");
        else summary.put("clinicalDate", report.clinicalDate().toString());
        var findings = summary.putArray("importantFindings");
        snapshot.observations().stream()
            .filter(item -> item.reportId().equals(report.reportId()))
            .sorted(java.util.Comparator.comparingInt(DoctorSupportExecutionService::briefPriority)
                .thenComparing(item -> item.label().toLowerCase(java.util.Locale.ROOT)))
            .limit(10)
            .forEach(item -> addEvidenceReference(findings, item));
        var analysis = summary.putArray("existingAnalysis");
        if (reasoning != null) reasoningConcepts(reasoning).stream().limit(8).forEach(analysis::add);
    }

    private static Map<String, DoctorSupportEvidenceSnapshot.ObservationEvidence> observationsByIdentity(
        DoctorSupportEvidenceSnapshot snapshot, UUID reportId
    ) {
        Map<String, DoctorSupportEvidenceSnapshot.ObservationEvidence> result = new java.util.LinkedHashMap<>();
        snapshot.observations().stream().filter(item -> item.reportId().equals(reportId)).forEach(item -> {
            String identity = item.canonicalCode() == null || item.canonicalCode().isBlank()
                ? item.label().toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim()
                : item.canonicalCode().toLowerCase(java.util.Locale.ROOT);
            result.putIfAbsent(identity, item);
        });
        return result;
    }

    private static Set<String> reasoningConcepts(
        DoctorClinicalReasoningSnapshotService.ClinicalReasoningSnapshot reasoning
    ) {
        if (reasoning == null) return Set.of();
        Set<String> concepts = new java.util.LinkedHashSet<>();
        reasoning.patterns().stream().map(DoctorClinicalReasoningSnapshotService.ReasoningPattern::concept)
            .filter(item -> item != null && !item.isBlank()).forEach(concepts::add);
        reasoning.possibilities().stream().map(DoctorClinicalReasoningSnapshotService.ReasoningPossibility::concept)
            .filter(item -> item != null && !item.isBlank()).forEach(concepts::add);
        return concepts;
    }

    private static void addEvidenceReference(
        com.fasterxml.jackson.databind.node.ArrayNode target,
        DoctorSupportEvidenceSnapshot.ObservationEvidence evidence
    ) {
        var reference = target.addObject();
        reference.put("observationId", evidence.observationId().toString());
        reference.put("label", evidence.label());
    }

    private DoctorSupportExecutionResponse.TaskResult deterministicBrief(
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorSupportEvidenceAssembler.Assembly assembly,
        DoctorClinicalReasoningSnapshotService.Resolution reasoning
    ) {
        DoctorSupportTaskSpec spec = registry.require(DoctorSupportTask.BRIEF_PATIENT);
        var result = objectMapper.createObjectNode();
        result.put("taskId", DoctorSupportTask.BRIEF_PATIENT.name());
        long abnormalCount = snapshot.observations().stream()
            .filter(item -> Set.of("LOW", "HIGH", "POSITIVE").contains(item.authoritativeStatus()))
            .count();
        result.put("reportCount", snapshot.reports().size());
        result.put("evidenceCount", snapshot.observations().size());
        result.put("abnormalCount", abnormalCount);
        if (snapshot.reports().isEmpty()) {
            result.put("summary", "Appointment context is available; no verified structured report evidence is currently shared.");
        } else {
            result.put("summary", "%d verified observations from %d currently shared reports, including %d important abnormal findings."
                .formatted(snapshot.observations().size(), snapshot.reports().size(), abnormalCount));
        }
        if (assembly.appointmentContext().reason() == null) result.putNull("appointmentReason");
        else result.put("appointmentReason", assembly.appointmentContext().reason());

        var highlights = result.putArray("evidenceHighlights");
        List<DoctorSupportEvidenceSnapshot.ObservationEvidence> abnormal = snapshot.observations().stream()
            .filter(item -> Set.of("LOW", "HIGH", "POSITIVE").contains(item.authoritativeStatus()))
            .sorted(java.util.Comparator
                .comparingInt(DoctorSupportExecutionService::briefPriority)
                .thenComparing(item -> item.label().toLowerCase(java.util.Locale.ROOT))
                .thenComparing(item -> item.observationId().toString()))
            .limit(12).toList();
        abnormal.forEach(item -> {
                var reference = highlights.addObject();
                reference.put("observationId", item.observationId().toString());
                reference.put("label", item.label());
            });

        Map<UUID, DoctorSupportEvidenceSnapshot.ObservationEvidence> byObservation = snapshot.observations().stream()
            .collect(java.util.stream.Collectors.toMap(
                DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId,
                item -> item,
                (left, right) -> left
            ));
        var chronology = result.putArray("chronology");
        snapshot.comparisonFacts().stream().limit(8).forEach(fact -> {
            var earlier = byObservation.get(fact.earlierObservationId());
            var later = byObservation.get(fact.laterObservationId());
            if (earlier == null || later == null) return;
            var item = chronology.addObject();
            item.put("kind", "CHANGE");
            item.put("statement", comparisonStatement(fact));
            var evidence = item.putArray("evidence");
            var first = evidence.addObject();
            first.put("observationId", earlier.observationId().toString());
            first.put("label", earlier.label());
            var second = evidence.addObject();
            second.put("observationId", later.observationId().toString());
            second.put("label", later.label());
        });

        var clinicalPatterns = result.putArray("clinicalPatterns");
        if (reasoning != null) {
            reasoning.snapshots().stream()
                .flatMap(item -> item.patterns().stream())
                .filter(pattern -> pattern.support() != null && !pattern.support().isEmpty())
                .distinct()
                .limit(8)
                .forEach(pattern -> {
                    var item = clinicalPatterns.addObject();
                    item.put("title", pattern.concept());
                    var support = item.putArray("supportingEvidence");
                    pattern.support().stream().map(byObservation::get).filter(java.util.Objects::nonNull).forEach(evidence -> {
                        var reference = support.addObject();
                        reference.put("observationId", evidence.observationId().toString());
                        reference.put("label", evidence.label());
                    });
                    var limiting = item.putArray("limitingEvidence");
                    pattern.against().stream().map(byObservation::get).filter(java.util.Objects::nonNull).forEach(evidence -> {
                        var reference = limiting.addObject();
                        reference.put("observationId", evidence.observationId().toString());
                        reference.put("label", evidence.label());
                    });
                });
        }

        var openQuestions = result.putArray("openQuestions");
        if (reasoning != null) {
            reasoning.snapshots().stream().flatMap(item -> item.gaps().stream()).distinct().limit(10)
                .forEach(openQuestions::add);
        }
        var limitations = result.putArray("limitations");
        if (snapshot.reports().isEmpty()) {
            limitations.add("No verified shared report evidence is currently available for this appointment.");
        } else if (snapshot.observations().isEmpty()) {
            limitations.add("The shared reports do not currently contain eligible verified structured findings.");
        } else if (reasoning != null && reasoning.snapshots().isEmpty()) {
            limitations.add("No current report-level clinical reasoning snapshot is available; the brief uses verified evidence only.");
        }

        return new DoctorSupportExecutionResponse.TaskResult(
            DoctorSupportTask.BRIEF_PATIENT,
            DoctorSupportTaskExecutionStatus.SUCCEEDED,
            result,
            null,
            provenance(snapshot, spec, null, reasoning),
            List.of()
        );
    }

    private static int briefPriority(DoctorSupportEvidenceSnapshot.ObservationEvidence item) {
        return switch (item.authoritativeStatus()) {
            case "LOW", "HIGH", "POSITIVE" -> 0;
            case "NEGATIVE" -> 1;
            case "REPORTED" -> 2;
            case "IN_RANGE" -> 3;
            default -> 4;
        };
    }

    private static String comparisonStatement(DoctorSupportEvidenceSnapshot.ComparisonFact fact) {
        String direction = switch (fact.direction()) {
            case "INCREASED" -> "increased";
            case "DECREASED" -> "decreased";
            default -> "was unchanged";
        };
        String unit = fact.unit() == null || fact.unit().isBlank() ? "" : " " + fact.unit();
        if ("UNCHANGED".equals(fact.direction())) {
            return "%s %s at %s%s between %s and %s.".formatted(
                fact.label(), direction, decimal(fact.laterValue()), unit, fact.earlierDate(), fact.laterDate()
            );
        }
        return "%s %s from %s to %s%s between %s and %s.".formatted(
            fact.label(), direction, decimal(fact.earlierValue()), decimal(fact.laterValue()), unit,
            fact.earlierDate(), fact.laterDate()
        );
    }

    private static String decimal(java.math.BigDecimal value) {
        return value == null ? "unknown" : value.stripTrailingZeros().toPlainString();
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

    private boolean reasoningSnapshotIsCurrent(
        DoctorClinicalReasoningSnapshotService.Resolution current,
        DoctorSupportExecutionResponse cached
    ) {
        Set<UUID> cachedIds = cached.taskResults().stream()
            .flatMap(result -> result.provenance().reasoningSnapshots().stream())
            .map(DoctorSupportExecutionResponse.SnapshotProvenance::snapshotId)
            .filter(java.util.Objects::nonNull)
            .collect(java.util.stream.Collectors.toSet());
        if (current == null) return cachedIds.isEmpty();
        if (current.availability() != DoctorClinicalReasoningSnapshotService.Availability.READY) return false;
        Set<UUID> currentIds = current.snapshots().stream()
            .map(DoctorClinicalReasoningSnapshotService.ClinicalReasoningSnapshot::snapshotId)
            .collect(java.util.stream.Collectors.toSet());
        return currentIds.equals(cachedIds);
    }

    private static GeminiProviderFailure geminiFailure(RestClientException exception) {
        int providerAttempts = 0;
        int successfulGenerations = 0;
        if (exception instanceof RestClientResponseException response) {
            int status = response.getStatusCode().value();
            providerAttempts = diagnosticHeader(response, "X-Clinora-Provider-Attempts");
            successfulGenerations = diagnosticHeader(response, "X-Clinora-Successful-Generations");
            if (status == 429) {
                return new GeminiProviderFailure(
                    "GEMINI_RATE_LIMITED", providerAttempts, successfulGenerations,
                    diagnosticHeaderToken(response, "X-Clinora-Rate-Limit-Category")
                );
            }
            if (status == 408 || status == 504) {
                return new GeminiProviderFailure("GEMINI_TIMEOUT", providerAttempts, successfulGenerations, "NONE");
            }
            return new GeminiProviderFailure("GEMINI_UNAVAILABLE", providerAttempts, successfulGenerations, "NONE");
        }
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause.getClass().getSimpleName().toLowerCase(java.util.Locale.ROOT).contains("timeout")) {
                return new GeminiProviderFailure("GEMINI_TIMEOUT", providerAttempts, successfulGenerations, "NONE");
            }
        }
        return new GeminiProviderFailure("GEMINI_UNAVAILABLE", providerAttempts, successfulGenerations, "NONE");
    }

    private static int diagnosticHeader(RestClientResponseException response, String name) {
        String value = response.getResponseHeaders() == null ? null : response.getResponseHeaders().getFirst(name);
        try {
            return value == null ? 0 : Math.max(0, Math.min(Integer.parseInt(value), 4));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private static String diagnosticHeaderToken(RestClientResponseException response, String name) {
        String value = response.getResponseHeaders() == null ? null : response.getResponseHeaders().getFirst(name);
        return value != null && value.matches("[A-Za-z0-9_.:-]{1,160}") ? value : "NONE";
    }

    private DoctorSupportExecutionResponse.Provenance providerFailureProvenance(
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorSupportTaskSpec spec,
        DoctorClinicalReasoningSnapshotService.Resolution snapshotResolution,
        int providerAttempts,
        int successfulGenerations
    ) {
        DoctorSupportExecutionResponse.Provenance base = provenance(snapshot, spec, null, snapshotResolution);
        return new DoctorSupportExecutionResponse.Provenance(
            base.reportIds(), base.observationIds(), base.evidenceSnapshotHash(), "GEMINI",
            null, null, null, base.promptVersion(), base.schemaVersion(), "NOT_RUN",
            false, base.ragPolicy(), "NOT_REQUIRED", null, List.of(), List.of(), 0, 0, 0, 0, 0,
            providerAttempts, successfulGenerations, base.reasoningSnapshots(), base.generatedAt()
        );
    }

    private DoctorSupportExecutionResponse.Provenance degradedProvenance(
        DoctorSupportEvidenceSnapshot snapshot,
        DoctorSupportTaskSpec spec,
        DoctorClinicalReasoningSnapshotService.Resolution snapshotResolution,
        int providerAttempts,
        int successfulGenerations
    ) {
        DoctorSupportExecutionResponse.Provenance base = provenance(snapshot, spec, null, snapshotResolution);
        return new DoctorSupportExecutionResponse.Provenance(
            base.reportIds(), base.observationIds(), base.evidenceSnapshotHash(), "MEDGEMMA_SNAPSHOT_FALLBACK",
            null, null, null, base.promptVersion(), base.schemaVersion(), "NOT_RUN",
            false, base.ragPolicy(), "NOT_REQUIRED", null, List.of(), List.of(), 0, 0, 0, 0, 0,
            providerAttempts, successfulGenerations, base.reasoningSnapshots(), base.generatedAt()
        );
    }

    private void logPerformance(
        UUID executionId,
        List<DoctorSupportTask> tasks,
        DoctorSupportEvidenceSnapshot evidence,
        DoctorClinicalReasoningSnapshotService.Resolution snapshots,
        long authorizationMs,
        long evidenceMs,
        long snapshotLookupMs,
        long retrievalMs,
        long geminiMs,
        long repairMs,
        long aiRoundTripMs,
        long groundingMs,
        long totalMs,
        boolean cached
    ) {
        LOGGER.info(
            "doctor_support_performance execution_id={} task={} route_ms=0 routing_separate_request=true "
                + "authorization_ms={} evidence_ms={} snapshot_ms={} retrieval_ms={} gemini_ms={} repair_ms={} "
                + "ai_round_trip_ms={} grounding_ms={} total_ms={} "
                + "authorized_report_count={} snapshot_count={} authorized_observation_count={} cached={}",
            executionId,
            tasks.stream().map(Enum::name).collect(java.util.stream.Collectors.joining(",")),
            authorizationMs,
            evidenceMs,
            snapshotLookupMs,
            retrievalMs,
            geminiMs,
            repairMs,
            aiRoundTripMs,
            groundingMs,
            totalMs,
            evidence.reports().size(),
            snapshots == null ? 0 : snapshots.snapshots().size(),
            evidence.observations().size(),
            cached
        );
    }

    private static long elapsedMillis(long startedNanos) {
        return Math.max(0, (System.nanoTime() - startedNanos) / 1_000_000);
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
    private record GeminiProviderFailure(
        String code, int providerAttempts, int successfulGenerations, String rateLimitCategory
    ) {}
    private record GapSource(String text, List<UUID> evidence) {}
    private record MatchedConcept(String concept, List<UUID> support, List<UUID> against, List<String> missing) {}
    private record ModelEvidenceSnapshot(
        String snapshotHash,
        List<ModelReportEvidence> reports,
        List<DoctorSupportEvidenceSnapshot.ObservationEvidence> observations,
        List<DoctorSupportEvidenceSnapshot.ComparisonFact> comparisonFacts
    ) {}
    private record ModelReportEvidence(UUID reportId, String reportType, java.time.LocalDate clinicalDate, String dateReliability) {}
}
