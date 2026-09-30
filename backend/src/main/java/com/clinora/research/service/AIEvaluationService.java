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
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
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

    private static final List<ModelOption> APPROVED_MODELS = List.of(
            new ModelOption(
                    "clinora-ai-clinical",
                    "Clinora AI Clinical",
                    "v1.2.0",
                    "lab-extract-v3",
                    "Clinora AI",
                    "High-precision clinical extraction and structured parameter recognition."
            ),
            new ModelOption(
                    "clinora-ai-diagnostic",
                    "Clinora AI Diagnostic",
                    "v1.0.0",
                    "abnormality-v2",
                    "Clinora AI",
                    "Binary abnormality screening across standardized diagnostic observations."
            ),
            new ModelOption(
                    "clinora-ai-classifier",
                    "Clinora AI Classifier",
                    "v1.1.0",
                    "class-label-v1",
                    "Clinora AI",
                    "Multi-class severity and categorical observation classification."
            )
    );

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
                    List.of("Sensitivity (Recall)", "Specificity", "F1-Score", "Balanced Accuracy")
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
            com.clinora.research.service.ResearchAccessGuard accessGuard
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
                APPROVED_MODELS,
                SUPPORTED_TASKS,
                GROUND_TRUTH_DEFINITIONS
        );
    }

    /**
     * Submits a new AI evaluation run and executes the benchmark pipeline against the authorized dataset version.
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

        // 6. Model normalization & validation (Map legacy medgemma-7b-clinical to clinora-ai-clinical)
        String rawModelId = request.modelId().trim().toLowerCase(Locale.ROOT);
        String normalizedModelId = "medgemma-7b-clinical".equals(rawModelId) ? "clinora-ai-clinical" : rawModelId;
        boolean validModel = APPROVED_MODELS.stream().anyMatch(m -> m.id().equalsIgnoreCase(normalizedModelId));
        if (!validModel) {
            throw new ResearchApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_MODEL",
                    "Unsupported research model ID: " + request.modelId()
            );
        }

        if (request.groundTruthDefinition() == null || request.groundTruthDefinition().isBlank()) {
            throw new ResearchApiException(
                    HttpStatus.BAD_REQUEST,
                    "MISSING_GROUND_TRUTH",
                    "An authoritative ground truth definition is required."
            );
        }

        accessGuard.dataset(version.getDatasetId(), userId);

        // 7. Provenance & configuration serialization
        Map<String, Object> configMap = new HashMap<>(request.configuration() != null ? request.configuration() : Map.of());
        configMap.put("executionStatus", "UNAVAILABLE");
        configMap.put("datasetChecksum", version.getChecksum());
        configMap.put("datasetFormat", version.getFormat());
        configMap.put("evaluationHarness", "NOT_CONFIGURED");

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
                request.modelVersion().trim(),
                request.promptVersion().trim(),
                request.taskType(),
                request.groundTruthDefinition().trim(),
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

        auditService.record(
                userId,
                AuthAuditAction.AI_EVALUATION_QUEUED,
                AuthAuditOutcome.SUCCESS,
                "api",
                "workspace",
                run.getId().toString(),
                "datasetVersion=" + version.getId()
        );

        // No approved predictions/ground-truth execution adapter exists yet.
        run.markFailed("EVALUATION_EXECUTION_UNAVAILABLE: Authorized predictions and ground truth are not configured. No evaluation was executed.");
        auditService.record(userId, AuthAuditAction.AI_EVALUATION_FAILED, AuthAuditOutcome.FAILURE,
                "api", "workspace", run.getId().toString(), "execution=UNAVAILABLE;metrics=NONE");

        run = evaluationRunRepository.save(run);
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

        return new AIEvaluationRunResponse(
                run.getId(),
                run.getProjectId(),
                run.getDatasetVersionId(),
                run.getModelId(),
                run.getModelVersion(),
                run.getPromptVersion(),
                run.getTaskType(),
                run.getGroundTruthDefinition(),
                run.getStatus() == EvaluationRunStatus.COMPLETED ? EvaluationRunStatus.FAILED : run.getStatus(),
                run.getStartedAt(),
                run.getCompletedAt(),
                run.getConfiguration(),
                parsedMetrics,
                run.getStatus() == EvaluationRunStatus.COMPLETED ? "Historical result has unverified provenance; metrics withheld." : run.getFailureReason(),
                run.getCreatedBy(),
                run.getCreatedAt()
        );
    }
}
