package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.AIEvaluationModels.*;
import com.clinora.research.domain.*;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.AIEvaluationRunRepository;
import com.clinora.research.repository.DatasetAccessGrantRepository;
import com.clinora.research.repository.DatasetVersionRepository;
import com.clinora.research.repository.ResearchDatasetRepository;
import com.clinora.research.repository.ResearchProjectRepository;
import com.clinora.research.service.evaluation.AbnormalityDetectionMetricsCalculator;
import com.clinora.research.service.evaluation.ClassificationMetricsCalculator;
import com.clinora.research.service.evaluation.ExtractionMetricsCalculator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.clinora.ai.client.MedGemmaClient;
import com.clinora.research.storage.ResearchDatasetStoragePort;
import com.clinora.research.repository.AIEvaluationResultRepository;
import com.clinora.research.service.evaluation.EvaluationReferenceSnapshot;
import com.clinora.research.service.evaluation.EvaluationExecutionPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/**
 * Phase R13 / AI Model Evaluation Service.
 *
 * <p>Orchestrates reproducible evaluation runs of approved Clinora AI model versions against
 * immutable de-identified dataset versions with explicit ground-truth definitions.
 *
 * <p>CRITICAL GOVERNANCE BOUNDARY:
 * Research evaluation can NEVER automatically promote or overwrite production clinical AI:
 * evaluation succeeded -/-> make this production model.
 *
 * <p>Strict dataset segregation: Project membership does NOT grant dataset access.
 * Evaluation requires an active canonical DatasetAccessGrant.
 */
@Service
public class AIEvaluationService {
    private final com.clinora.research.service.ResearchAccessGuard accessGuard;

    private static final Logger log = LoggerFactory.getLogger(AIEvaluationService.class);

    private static final List<TaskTypeOption> SUPPORTED_TASKS = List.of(
            new TaskTypeOption(
                    EvaluationTaskType.EXTRACTION,
                    "Structured Clinical Extraction",
                    "Extracts verified clinical observation values and laboratory metrics.",
                    List.of("Accuracy", "Exact Match Rate", "Tolerance Match Rate")
            ),
            new TaskTypeOption(
                    EvaluationTaskType.CLASSIFICATION,
                    "Diagnostic Classification",
                    "Classifies clinical observations into defined categorical severity classes.",
                    List.of("Accuracy", "Precision", "Recall", "F1-Score", "Balanced Accuracy")
            ),
            new TaskTypeOption(
                    EvaluationTaskType.ABNORMALITY_DETECTION,
                    "Abnormality Detection",
                    "Screening for verified normal vs abnormal clinical conditions.",
                    List.of("Accuracy", "Precision", "Sensitivity / Recall", "Specificity", "F1", "Balanced Accuracy")
            )
    );

    private static final List<GroundTruthOption> GROUND_TRUTH_DEFINITIONS = List.of(
            new GroundTruthOption(
                    "PHYSICIAN_VERIFIED_OBSERVATIONS",
                    "Physician-Verified Observations",
                    "Clinical observation values validated and signed off by licensed clinicians."
            ),
            new GroundTruthOption(
                    "CONFIRMED_DIAGNOSTIC_REPORT",
                    "Confirmed Diagnostic Findings",
                    "Validated laboratory reference standards from accredited clinical pathology labs."
            ),
            new GroundTruthOption(
                    "STANDARDIZED_REFERENCE_STANDARD",
                    "Standardized Protocol Reference",
                    "Governed reference ground-truth annotations established in research protocol."
            )
    );

    private final AIEvaluationRunRepository evaluationRunRepository;
    private final ResearchProjectRepository projectRepository;
    private final DatasetVersionRepository datasetVersionRepository;
    private final ResearchDatasetRepository datasetRepository;
    private final DatasetAccessGrantRepository accessGrantRepository;
    private final ResearchAuthorizationService authorizationService;
    private final AuthAuditService auditService;
    private final ClassificationMetricsCalculator classificationCalculator;
    private final ExtractionMetricsCalculator extractionCalculator;
    private final AbnormalityDetectionMetricsCalculator abnormalityCalculator;
    private final ObjectMapper objectMapper;
    private final MedGemmaClient aiClient;
    private final EvaluationExecutionPersistence executionPersistence;
    private final ResearchDatasetStoragePort storagePort;
    private final AIEvaluationResultRepository resultRepository;

    public AIEvaluationService(
            AIEvaluationRunRepository evaluationRunRepository,
            ResearchProjectRepository projectRepository,
            DatasetVersionRepository datasetVersionRepository,
            ResearchDatasetRepository datasetRepository,
            DatasetAccessGrantRepository accessGrantRepository,
            ResearchAuthorizationService authorizationService,
            AuthAuditService auditService,
            ClassificationMetricsCalculator classificationCalculator,
            ExtractionMetricsCalculator extractionCalculator,
            AbnormalityDetectionMetricsCalculator abnormalityCalculator,
            ObjectMapper objectMapper,
            ResearchAccessGuard accessGuard,
            MedGemmaClient aiClient,
            ResearchDatasetStoragePort storagePort,
            AIEvaluationResultRepository resultRepository,
            EvaluationExecutionPersistence executionPersistence
    ) {
        this.accessGuard = accessGuard;
        this.evaluationRunRepository = evaluationRunRepository;
        this.projectRepository = projectRepository;
        this.datasetVersionRepository = datasetVersionRepository;
        this.datasetRepository = datasetRepository;
        this.accessGrantRepository = accessGrantRepository;
        this.authorizationService = authorizationService;
        this.auditService = auditService;
        this.classificationCalculator = classificationCalculator;
        this.extractionCalculator = extractionCalculator;
        this.abnormalityCalculator = abnormalityCalculator;
        this.objectMapper = objectMapper;
        this.aiClient = aiClient;
        this.executionPersistence = executionPersistence;
        this.storagePort = storagePort;
        this.resultRepository = resultRepository;
    }

    /**
     * Retrieves available configuration options for creating an evaluation run,
     * including only the dataset versions the requesting researcher is authorized to evaluate.
     */
    @Transactional(readOnly = true)
    public AIEvaluationOptionsResponse getEvaluationOptions(UUID projectId, UUID userId) {
        authorizationService.requireReadAccess(projectId, userId);

        List<ResearchDataset> datasets = datasetRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        Instant now = Instant.now();

        List<DatasetVersionOption> versionOptions = new ArrayList<>();
        for (ResearchDataset dataset : datasets) {
            if (!accessGuard.canReadDataset(dataset.getId(), userId)) continue;
            // Check dataset status: must be ACTIVE, not revoked, not expired
            if (!"ACTIVE".equalsIgnoreCase(dataset.getStatus()) || dataset.getRevokedAt() != null) {
                continue;
            }
            if (dataset.getExpiresAt() != null && dataset.getExpiresAt().isBefore(now)) {
                continue;
            }

            // Verify researcher has an active DatasetAccessGrant
            boolean hasActiveGrant = accessGrantRepository.findByDatasetIdAndResearcherUserId(dataset.getId(), userId)
                    .map(DatasetAccessGrant::isActive)
                    .orElse(false);

            if (!hasActiveGrant) {
                continue;
            }

            List<DatasetVersion> versions = datasetVersionRepository.findByDatasetIdOrderByVersionNumberDesc(dataset.getId());
            for (DatasetVersion v : versions) {
                versionOptions.add(new DatasetVersionOption(
                        v.getId(),
                        dataset.getId(),
                        dataset.getName(),
                        v.getVersionNumber(),
                        v.getRecordCount(),
                        v.getFormat(),
                        v.getChecksum(),
                        v.getGeneratedAt()
                ));
            }
        }

        return new AIEvaluationOptionsResponse(
                versionOptions,
                List.of(
                    new ModelOption(
                        "clinora-ai",
                        "Clinora AI",
                        "v1.0.0",
                        "clinical-v1",
                        "Clinora AI",
                        "Clinora's unified AI engine for clinical tasks."
                    )
                ),
                SUPPORTED_TASKS,
                GROUND_TRUTH_DEFINITIONS
        );
    }

    /**
     * Saves a protocol; execution requires a separate explicit request.
     */
    @Transactional
    public AIEvaluationRunResponse createAndExecuteRun(UUID projectId, CreateEvaluationRunRequest request, UUID userId) {
        log.info("Creating AI evaluation run for project {} by user {}", projectId, userId);

        // 1. Authorization: user must have OWNER or CO_RESEARCHER role
        ResearchProject project = authorizationService.requireReadAccess(projectId, userId);
        ProjectMemberRole role = authorizationService.resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role != ProjectMemberRole.OWNER && role != ProjectMemberRole.CO_RESEARCHER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Only project Owners and Co-Researchers can create AI evaluation runs.");
        }

        // 2. Project status boundary: project must be APPROVED or ACTIVE
        if (project.getStatus() != ResearchProjectStatus.APPROVED && project.getStatus() != ResearchProjectStatus.ACTIVE) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "PROJECT_NOT_APPROVED", "AI evaluations can only be executed on APPROVED or ACTIVE research projects.");
        }

        // 3. DatasetVersion existence and boundary
        DatasetVersion version = datasetVersionRepository.findById(request.datasetVersionId())
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "DATASET_VERSION_NOT_FOUND",
                        "Dataset version not found: " + request.datasetVersionId()
                ));

        ResearchDataset dataset = datasetRepository.findById(version.getDatasetId())
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "DATASET_NOT_FOUND",
                        "Parent dataset not found for version: " + version.getId()
                ));

        if (!dataset.getProjectId().equals(projectId)) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "DATASET_PROJECT_MISMATCH", "Dataset version does not belong to the requested research project.");
        }

        Instant now = Instant.now();
        if (!"ACTIVE".equalsIgnoreCase(dataset.getStatus()) || dataset.getRevokedAt() != null) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "DATASET_NOT_ACTIVE", "The selected dataset is not active or has been revoked.");
        }
        if (dataset.getExpiresAt() != null && dataset.getExpiresAt().isBefore(now)) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "DATASET_EXPIRED", "The selected dataset has expired.");
        }

        // 4. Canonical DatasetAccessGrant check: Project membership != DatasetAccessGrant
        DatasetAccessGrant grant = accessGrantRepository.findByDatasetIdAndResearcherUserId(dataset.getId(), userId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.FORBIDDEN,
                        "DATASET_ACCESS_DENIED",
                        "Access to evaluate this dataset version requires an approved, active DatasetAccessGrant."
                ));

        if (!grant.isActive()) {
            throw new ResearchApiException(
                    HttpStatus.FORBIDDEN,
                    "DATASET_ACCESS_DENIED",
                    "Your DatasetAccessGrant for this dataset has expired or was revoked."
            );
        }

        // 5. Task type validation: RISK_SCORING rejected per safety rule
        if (request.taskType() == EvaluationTaskType.RISK_SCORING) {
            throw new ResearchApiException(
                    HttpStatus.BAD_REQUEST,
                    "UNSUPPORTED_TASK_TYPE",
                    "Risk scoring evaluation requires continuous probability score modeling and is not supported in fixed-label evaluation."
            );
        }

        // 6. Unified Model
        String normalizedModelId = "clinora-ai";
        String promptVersion = switch(request.taskType()) {
            case EXTRACTION -> "lab-extract-v3";
            case ABNORMALITY_DETECTION -> "abnormality-all-v1";
            case CLASSIFICATION -> "class-label-v1";
            default -> "clinical-v1";
        };

        if (request.groundTruthDefinition() == null || request.groundTruthDefinition().isBlank()) {
            throw new ResearchApiException(
                    HttpStatus.BAD_REQUEST,
                    "MISSING_GROUND_TRUTH",
                    "An authoritative ground truth definition is required."
            );
        }

        accessGuard.dataset(version.getDatasetId(), userId);

        Map<String, Object> configMap = new HashMap<>();
        configMap.put("protocolStatus", "CONFIGURED");

        configMap.put("predictionRunner", "UNAVAILABLE");
        configMap.put("referenceResolver", "UNAVAILABLE");
        configMap.put("automatedExecution", "UNAVAILABLE");
        configMap.put("datasetChecksum", version.getChecksum());
        configMap.put("datasetFormat", version.getFormat());

        String configJson = "{}";
        try {
            configJson = objectMapper.writeValueAsString(configMap);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize evaluation run config", e);
        }

        AIEvaluationRun run = new AIEvaluationRun(
                UUID.randomUUID(),
                project.getId(),
                version.getId(),
                normalizedModelId,
                "v1.0.0",
                promptVersion,
                request.taskType(),
                request.taskType() == EvaluationTaskType.ABNORMALITY_DETECTION
                    ? "VERIFIED_LAB_REFERENCE_RANGE" : request.groundTruthDefinition().trim(),
                configJson,
                userId
        );

        run = evaluationRunRepository.save(run);

        auditService.record(
                userId,
                AuthAuditAction.AI_EVALUATION_CREATED,
                AuthAuditOutcome.SUCCESS,
                "api",
                "workspace",
                run.getId().toString(),
                "model=" + normalizedModelId + ";task=" + request.taskType()
        );

        requireRunAccess(run, userId);
        return toResponse(run);
    }

    @Transactional(readOnly = true)
    public List<AIEvaluationRunResponse> listRunsForProject(UUID projectId, UUID userId) {
        authorizationService.requireReadAccess(projectId, userId);
        return evaluationRunRepository.findByProjectIdOrderByCreatedAtDesc(projectId)
                .stream()
                .filter(run -> canAccessRun(run, userId))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AIEvaluationRunResponse getRun(UUID projectId, UUID runId, UUID userId) {
        authorizationService.requireReadAccess(projectId, userId);
        AIEvaluationRun run = evaluationRunRepository.findByIdAndProjectId(runId, projectId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "EVALUATION_RUN_NOT_FOUND",
                        "Evaluation run " + runId + " not found in project " + projectId
                ));
        requireRunAccess(run, userId);
        return toResponse(run);
    }

    @Transactional
    public AIEvaluationRunResponse cancelRun(UUID projectId, UUID runId, UUID userId) {
        authorizationService.requireReadAccess(projectId, userId);
        ProjectMemberRole role = authorizationService.resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role == ProjectMemberRole.VIEWER || role == ProjectMemberRole.SUPERVISOR) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Only project Owners and Co-Researchers can cancel an evaluation run.");
        }

        AIEvaluationRun run = evaluationRunRepository.findByIdAndProjectId(runId, projectId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "EVALUATION_RUN_NOT_FOUND",
                        "Evaluation run " + runId + " not found in project " + projectId
                ));

        if (run.getStatus() == EvaluationRunStatus.COMPLETED) {
            throw new ResearchApiException(
                    HttpStatus.BAD_REQUEST,
                    "CANNOT_CANCEL_COMPLETED_RUN",
                    "Evaluation run is already completed."
            );
        }

        requireRunAccess(run, userId);
        if (run.getStatus() == EvaluationRunStatus.RUNNING) throw new ResearchApiException(
            HttpStatus.CONFLICT, "INVALID_STATE", "A running evaluation cannot be cancelled.");
        run.markCancelled();
        run = evaluationRunRepository.save(run);

        auditService.record(
                userId,
                AuthAuditAction.AI_EVALUATION_CANCELLED,
                AuthAuditOutcome.SUCCESS,
                "api",
                "workspace",
                run.getId().toString(),
                "cancelledBy=" + userId
        );

        requireRunAccess(run, userId);
        return toResponse(run);
    }

    public AIEvaluationRunResponse executeEvaluation(UUID projectId, UUID runId, UUID userId) {
        authorizationService.requireReadAccess(projectId, userId);
        ProjectMemberRole role = authorizationService.resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role != ProjectMemberRole.OWNER && role != ProjectMemberRole.CO_RESEARCHER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Only project Owners and Co-Researchers can execute an evaluation run.");
        }

        AIEvaluationRun run = evaluationRunRepository.findByIdAndProjectId(runId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND, "EVALUATION_RUN_NOT_FOUND", "Evaluation run not found"));

        if (run.getStatus() != EvaluationRunStatus.CONFIGURED) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST, "INVALID_STATE", "Run must be in CONFIGURED state to execute.");
        }

        if (run.getTaskType() != EvaluationTaskType.ABNORMALITY_DETECTION) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_TASK_TYPE", "Only ABNORMALITY_DETECTION is supported for execution currently.");
        }

        DatasetVersion version = requireExecutionAccess(run, userId);
        EvaluationReferenceSnapshot reference = loadReference(version);
        run = executionPersistence.start(run, userId);
        try {
            if (!aiClient.isInferenceRuntimeReady()) {
                throw new ResearchApiException(HttpStatus.SERVICE_UNAVAILABLE, "CLINORA_AI_UNAVAILABLE",
                    "Clinora AI is currently unavailable.");
            }
            var samples = reference.observations().stream().map(r -> new MedGemmaClient.AbnormalitySample(
                r.sampleKey(), r.variableCode(), r.value(), r.unit(), r.referenceLow(), r.referenceHigh())).toList();
            var response = aiClient.evaluateAbnormality(new MedGemmaClient.AbnormalityEvaluationRequest(samples));
            Map<String, String> predictions = new HashMap<>();
            Set<String> expected = new HashSet<>();
            samples.forEach(s -> expected.add(s.sampleKey()));
            for (var prediction : response.predictions()) {
                if (!expected.contains(prediction.sampleKey())
                        || !("NORMAL".equals(prediction.label()) || "ABNORMAL".equals(prediction.label()))
                        || predictions.putIfAbsent(prediction.sampleKey(), prediction.label()) != null) {
                    throw invalidResponse();
                }
            }
            if (predictions.size() != samples.size() || !"LLAMA_CPP_MEDGEMMA".equals(response.executionProvider())
                    || !"abnormality-all-v1".equals(response.promptVersion()) || response.generationCallCount() < 1
                    || response.modelName() == null || response.modelName().isBlank()) throw invalidResponse();
            UUID evaluationId = run.getId();
            List<AIEvaluationResult> pairs = reference.observations().stream().map(r -> new AIEvaluationResult(
                UUID.randomUUID(), evaluationId, r.sampleKey(), r.variableCode(), r.derivedGroundTruth(),
                predictions.get(r.sampleKey()))).toList();
            Map<String, Object> provenance = new HashMap<>();
            referenceMetadata(provenance, reference);
            provenance.put("evidenceVersion", "medgemma-all-v1");
            provenance.put("executionProvider", response.executionProvider());
            provenance.put("modelName", response.modelName());
            provenance.put("modelRevision", response.modelRevision());
            provenance.put("promptVersion", response.promptVersion());
            provenance.put("aiRequestCount", response.generationCallCount());
            provenance.put("inferenceDurationMs", response.inferenceDurationMs());
            provenance.put("evaluatedObservations", pairs.size());
            run = executionPersistence.complete(run, pairs, provenance, userId);
        } catch (Exception failure) {
            String code = failure instanceof ResearchApiException api ? api.getErrorCode()
                : failure instanceof org.springframework.web.client.RestClientResponseException http
                    && http.getStatusCode().value() == 502 ? "INVALID_AI_RESPONSE"
                : failure instanceof org.springframework.web.client.RestClientException ? "CLINORA_AI_UNAVAILABLE"
                : "EVALUATION_FAILED";
            log.warn("Evaluation {} failed: {} ({})", runId, code, failure.getClass().getSimpleName());
            run = executionPersistence.fail(runId, code, userId);
        }
        return toResponse(run);
    }

    private ResearchApiException invalidResponse() {
        return new ResearchApiException(HttpStatus.BAD_GATEWAY, "INVALID_AI_RESPONSE", "Clinora AI returned an invalid response.");
    }

    private DatasetVersion requireExecutionAccess(AIEvaluationRun run, UUID user) {
        DatasetVersion version = datasetVersionRepository.findById(run.getDatasetVersionId()).orElseThrow(() ->
            new ResearchApiException(HttpStatus.NOT_FOUND, "DATASET_VERSION_NOT_FOUND", "Dataset version unavailable."));
        ResearchDataset dataset = datasetRepository.findById(version.getDatasetId()).orElseThrow(() ->
            new ResearchApiException(HttpStatus.NOT_FOUND, "DATASET_NOT_FOUND", "Dataset unavailable."));
        if (!dataset.getProjectId().equals(run.getProjectId())) throw new ResearchApiException(
            HttpStatus.FORBIDDEN, "DATASET_PROJECT_MISMATCH", "Dataset does not belong to this project.");
        accessGuard.dataset(dataset.getId(), user);
        if (!"ACTIVE".equals(dataset.getStatus()) || dataset.getRevokedAt() != null
                || (dataset.getExpiresAt() != null && !dataset.getExpiresAt().isAfter(Instant.now())))
            throw new ResearchApiException(HttpStatus.FORBIDDEN, "DATASET_ACCESS_DENIED", "Dataset access is unavailable.");
        if (!accessGrantRepository.findByDatasetIdAndResearcherUserId(dataset.getId(), user)
                .map(DatasetAccessGrant::isActive).orElse(false)) throw new ResearchApiException(
            HttpStatus.FORBIDDEN, "DATASET_ACCESS_DENIED", "An active dataset grant is required.");
        return version;
    }

    private EvaluationReferenceSnapshot loadReference(DatasetVersion version) {
        try {
            String key = version.getStorageObjectKey().replaceFirst("\\.(json|csv)$", "-eval.json");
            var snapshot = objectMapper.readValue(storagePort.get(key).bytes(), EvaluationReferenceSnapshot.class);
            snapshot.validate(version.getId(), version.getChecksum());
            return snapshot;
        } catch (Exception e) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST, "REFERENCE_NOT_FOUND",
                "Verified reference data is unavailable for this dataset version.");
        }
    }

    private void referenceMetadata(Map<String, Object> config, EvaluationReferenceSnapshot snapshot) {
        config.put("evaluationMode", "All Eligible Observations");
        config.put("referenceSource", "Verified Lab Reference Range");
        config.put("totalObservations", snapshot.totalObservations());
        config.put("eligibleObservations", snapshot.observations().size());
        config.put("excludedObservations", snapshot.totalObservations() - snapshot.observations().size());
        config.put("normalGroundTruthCount", snapshot.observations().stream().filter(r -> "NORMAL".equals(r.derivedGroundTruth())).count());
        config.put("abnormalGroundTruthCount", snapshot.observations().stream().filter(r -> "ABNORMAL".equals(r.derivedGroundTruth())).count());
    }

    /**
     * Computes standard classification metrics using the task classification calculator.
     */
    public EvaluationMetrics computeMetrics(long tp, long fp, long tn, long fn) {
        return classificationCalculator.calculate(tp, fp, tn, fn);
    }

    /**
     * Executes the task-specific calculation against the dataset record volume.
     */
    private boolean canAccessRun(AIEvaluationRun run, UUID userId) {
        return datasetVersionRepository.findById(run.getDatasetVersionId())
                .map(v -> accessGuard.canReadDataset(v.getDatasetId(), userId)).orElse(false);
    }

    private void requireRunAccess(AIEvaluationRun run, UUID userId) {
        DatasetVersion version = datasetVersionRepository.findById(run.getDatasetVersionId())
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN, "DATASET_ACCESS_DENIED", "Evaluation dataset is unavailable."));
        accessGuard.dataset(version.getDatasetId(), userId);
    }

    private AIEvaluationRunResponse toResponse(AIEvaluationRun run) {
        EvaluationMetrics parsedMetrics = null;
        if (run.getMetrics() != null) {
            try {
                parsedMetrics = objectMapper.readValue(run.getMetrics(), EvaluationMetrics.class);
            } catch (Exception e) {
                // ignore
            }
        }

        Map<String, Object> configMap;
        try { configMap = objectMapper.readValue(run.getConfiguration(), new TypeReference<>() {}); }
        catch (Exception ignored) { configMap = new HashMap<>(); }
        if (run.getStatus() == EvaluationRunStatus.CONFIGURED) {
            boolean predictionReady = run.getTaskType() == EvaluationTaskType.ABNORMALITY_DETECTION
                && aiClient.isInferenceRuntimeReady();
            boolean referenceReady = false;
            configMap.remove("eligibleObservations");
            if (run.getTaskType() == EvaluationTaskType.ABNORMALITY_DETECTION) {
                try {
                    var version = datasetVersionRepository.findById(run.getDatasetVersionId()).orElseThrow();
                    referenceMetadata(configMap, loadReference(version));
                    referenceReady = true;
                } catch (Exception ignored) { /* Missing/legacy snapshots fail closed. */ }
            }
            configMap.put("predictionRunner", predictionReady ? "READY" : "UNAVAILABLE");
            configMap.put("referenceResolver", referenceReady ? "READY" : "UNAVAILABLE");
            configMap.put("automatedExecution", predictionReady && referenceReady ? "READY" : "UNAVAILABLE");
        }
        if (run.getStatus() != EvaluationRunStatus.COMPLETED) parsedMetrics = null;
        if (run.getStatus() == EvaluationRunStatus.COMPLETED
                && !"medgemma-all-v1".equals(configMap.get("evidenceVersion"))) {
            configMap.put("legacyUnverified", true);
            parsedMetrics = null; // Preserve retained data and status, withhold unsupported evidence.
        }
        String config;
        try { config = objectMapper.writeValueAsString(configMap); }
        catch (JsonProcessingException e) { throw new IllegalStateException(e); }

        return new AIEvaluationRunResponse(
                run.getId(),
                run.getProjectId(),
                run.getDatasetVersionId(),
                run.getModelId(),
                run.getModelVersion(),
                run.getPromptVersion(),
                run.getTaskType(),
                run.getGroundTruthDefinition(),
                run.getStatus(),
                run.getStartedAt(),
                run.getCompletedAt(),
                config,
                parsedMetrics,
                run.getFailureReason(),
                run.getCreatedBy(),
                run.getCreatedAt()
        );
    }
}
