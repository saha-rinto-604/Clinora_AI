package com.clinora.research;

import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.AIEvaluationModels.*;
import com.clinora.research.domain.*;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.repository.*;
import com.clinora.research.service.AIEvaluationService;
import com.clinora.research.service.DiseaseAnalyticsPolicy;
import com.clinora.research.service.ResearchAuthorizationService;
import com.clinora.research.service.evaluation.AbnormalityDetectionMetricsCalculator;
import com.clinora.research.service.evaluation.ClassificationMetricsCalculator;
import com.clinora.research.service.evaluation.ExtractionMetricsCalculator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.math.BigDecimal;
import com.clinora.ai.client.MedGemmaClient;
import com.clinora.research.storage.ResearchDatasetStoragePort;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AIEvaluationServiceTest {

    private AIEvaluationService service;
    private DiseaseAnalyticsPolicy diseaseAnalyticsPolicy;

    private AIEvaluationRunRepository evalRepo;
    private ResearchProjectRepository projectRepo;
    private DatasetVersionRepository versionRepo;
    private ResearchDatasetRepository datasetRepo;
    private DatasetAccessGrantRepository accessGrantRepo;
    private ResearchAuthorizationService authService;
    private AuthAuditService auditService;
    private ClassificationMetricsCalculator classificationCalculator;
    private ExtractionMetricsCalculator extractionCalculator;
    private AbnormalityDetectionMetricsCalculator abnormalityCalculator;
    private ObjectMapper objectMapper;

    private UUID projectId;
    private UUID ownerUserId;
    private UUID coResearcherUserId;
    private UUID viewerUserId;
    private UUID datasetId;
    private UUID versionId;
    private ResearchProject approvedProject;
    private ResearchDataset activeDataset;
    private DatasetVersion datasetVersion;
    private DatasetAccessGrant activeGrant;

    private final com.clinora.research.service.ResearchAccessGuard accessGuard = mock(com.clinora.research.service.ResearchAccessGuard.class);
    private MedGemmaClient aiClient;
    private ResearchDatasetStoragePort storagePort;
    private AIEvaluationResultRepository resultRepository;

    @BeforeEach
    void setUp() {
        evalRepo = mock(AIEvaluationRunRepository.class);
        projectRepo = mock(ResearchProjectRepository.class);
        versionRepo = mock(DatasetVersionRepository.class);
        datasetRepo = mock(ResearchDatasetRepository.class);
        accessGrantRepo = mock(DatasetAccessGrantRepository.class);
        authService = mock(ResearchAuthorizationService.class);
        auditService = mock(AuthAuditService.class);
        classificationCalculator = new ClassificationMetricsCalculator();
        extractionCalculator = new ExtractionMetricsCalculator();
        abnormalityCalculator = new AbnormalityDetectionMetricsCalculator();
        objectMapper = new ObjectMapper();

        aiClient = mock(MedGemmaClient.class);
        storagePort = mock(ResearchDatasetStoragePort.class);
        resultRepository = mock(AIEvaluationResultRepository.class);

        service = new AIEvaluationService(
                evalRepo,
                projectRepo,
                versionRepo,
                datasetRepo,
                accessGrantRepo,
                authService,
                auditService,
                classificationCalculator,
                extractionCalculator,
                abnormalityCalculator,
                objectMapper,
                accessGuard,
                aiClient,
                storagePort,
                resultRepository,
                new com.clinora.research.service.evaluation.EvaluationExecutionPersistence(
                    evalRepo, resultRepository, abnormalityCalculator, objectMapper, auditService, accessGuard, versionRepo)
        );
        diseaseAnalyticsPolicy = new DiseaseAnalyticsPolicy();

        projectId = UUID.randomUUID();
        ownerUserId = UUID.randomUUID();
        coResearcherUserId = UUID.randomUUID();
        viewerUserId = UUID.randomUUID();
        datasetId = UUID.randomUUID();
        versionId = UUID.randomUUID();

        approvedProject = mock(ResearchProject.class);
        when(approvedProject.getId()).thenReturn(projectId);
        when(approvedProject.getOwnerUserId()).thenReturn(ownerUserId);
        when(approvedProject.getStatus()).thenReturn(ResearchProjectStatus.APPROVED);
        when(approvedProject.getTitle()).thenReturn("Cardiology Study");

        activeDataset = new ResearchDataset(
                datasetId,
                projectId,
                UUID.randomUUID(),
                "De-identified Cardiology Cohort",
                Instant.now(),
                Instant.now().plusSeconds(86400)
        );

        datasetVersion = new DatasetVersion(
                versionId,
                datasetId,
                1,
                "1.0",
                100,
                "datasets/v1.json",
                "checksum123456",
                "JSON",
                "v1.0",
                Instant.now()
        );

        activeGrant = new DatasetAccessGrant(
                UUID.randomUUID(),
                datasetId,
                ownerUserId,
                ownerUserId,
                Instant.now(),
                Instant.now().plusSeconds(86400)
        );
    }

    @Test
    @DisplayName("Standard 2x2 confusion matrix correctly computes accuracy, precision, recall, F1, FPR, FNR, and balancedAccuracy")
    void computesStandardMetricsCorrectly() {
        EvaluationMetrics metrics = service.computeMetrics(40, 10, 40, 10);

        assertEquals(100, metrics.sampleCount());
        assertEquals(0.8000, metrics.accuracy(), 0.0001);
        assertEquals(0.8000, metrics.precision(), 0.0001);
        assertEquals(0.8000, metrics.recall(), 0.0001);
        assertEquals(0.8000, metrics.f1(), 0.0001);
        assertEquals(0.2000, metrics.falsePositiveRate(), 0.0001);
        assertEquals(0.2000, metrics.falseNegativeRate(), 0.0001);
        assertEquals(0.8000, metrics.balancedAccuracy(), 0.0001);
        assertEquals(0.8000, metrics.rocAuc(), 0.0001, "Legacy rocAuc accessor must return balancedAccuracy");
        assertNotNull(metrics.confusionMatrix());
        assertEquals(40, metrics.confusionMatrix().truePositives());
        assertEquals(10, metrics.confusionMatrix().falsePositives());
        assertEquals(40, metrics.confusionMatrix().trueNegatives());
        assertEquals(10, metrics.confusionMatrix().falseNegatives());
    }

    @Test
    @DisplayName("Metric calculation handles edge cases with zero counts without division by zero errors")
    void handlesZeroCountsGracefully() {
        EvaluationMetrics zeroMetrics = service.computeMetrics(0, 0, 0, 0);

        assertEquals(0, zeroMetrics.sampleCount());
        assertEquals(0.0, zeroMetrics.accuracy());
        assertEquals(0.0, zeroMetrics.precision());
        assertEquals(0.0, zeroMetrics.recall());
        assertEquals(0.0, zeroMetrics.f1());
        assertEquals(0.0, zeroMetrics.falsePositiveRate());
        assertEquals(0.0, zeroMetrics.falseNegativeRate());
        assertEquals(0.0, zeroMetrics.balancedAccuracy());
        assertEquals(0.0, zeroMetrics.rocAuc());
    }

    @Test
    @DisplayName("Asymmetric classification matrix correctly calculates imbalanced medical diagnostic metrics")
    void asymmetricMedicalDatasetMetrics() {
        EvaluationMetrics metrics = service.computeMetrics(95, 30, 850, 5);

        assertEquals(980, metrics.sampleCount());
        assertEquals(0.9500, metrics.recall(), 0.0001);
        assertEquals(0.7600, metrics.precision(), 0.0001);
        assertEquals(0.0341, metrics.falsePositiveRate(), 0.0001);
        assertEquals(0.0500, metrics.falseNegativeRate(), 0.0001);
        assertEquals(0.9580, metrics.balancedAccuracy(), 0.0001);
    }

    @Test
    @DisplayName("Owner with active DatasetAccessGrant can create and execute an AI evaluation run")
    void ownerCanCreateEvaluationRun() {
        when(authService.requireReadAccess(projectId, ownerUserId)).thenReturn(approvedProject);
        when(authService.resolveProjectRole(projectId, ownerUserId)).thenReturn(Optional.of(ProjectMemberRole.OWNER));
        when(versionRepo.findById(versionId)).thenReturn(Optional.of(datasetVersion));
        when(datasetRepo.findById(datasetId)).thenReturn(Optional.of(activeDataset));
        when(accessGrantRepo.findByDatasetIdAndResearcherUserId(datasetId, ownerUserId)).thenReturn(Optional.of(activeGrant));
        when(evalRepo.save(any(AIEvaluationRun.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateEvaluationRunRequest request = new CreateEvaluationRunRequest(
                versionId,
                "clinora-ai-clinical",
                "v1.2.0",
                "lab-extract-v3",
                EvaluationTaskType.CLASSIFICATION,
                "PHYSICIAN_VERIFIED_OBSERVATIONS",
                Map.of("temperature", 0.0)
        );

        AIEvaluationRunResponse response = service.createAndExecuteRun(projectId, request, ownerUserId);

        assertNotNull(response);
        assertEquals(EvaluationRunStatus.CONFIGURED, response.status());
        assertEquals("clinora-ai", response.modelId());
        assertNull(response.metrics());
    }

    @Test
    @DisplayName("Viewer role is rejected with FORBIDDEN when attempting to create an evaluation run")
    void viewerCannotCreateEvaluationRun() {
        when(authService.requireReadAccess(projectId, viewerUserId)).thenReturn(approvedProject);
        when(authService.resolveProjectRole(projectId, viewerUserId)).thenReturn(Optional.of(ProjectMemberRole.VIEWER));

        CreateEvaluationRunRequest request = new CreateEvaluationRunRequest(
                versionId,
                "clinora-ai-clinical",
                "v1.2.0",
                "lab-extract-v3",
                EvaluationTaskType.CLASSIFICATION,
                "PHYSICIAN_VERIFIED_OBSERVATIONS",
                null
        );

        ResearchApiException ex = assertThrows(ResearchApiException.class, () ->
                service.createAndExecuteRun(projectId, request, viewerUserId));
        assertEquals(org.springframework.http.HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    @DisplayName("Creation fails if researcher lacks an active DatasetAccessGrant for the dataset")
    void missingDatasetAccessGrantThrowsForbidden() {
        when(authService.requireReadAccess(projectId, coResearcherUserId)).thenReturn(approvedProject);
        when(authService.resolveProjectRole(projectId, coResearcherUserId)).thenReturn(Optional.of(ProjectMemberRole.CO_RESEARCHER));
        when(versionRepo.findById(versionId)).thenReturn(Optional.of(datasetVersion));
        when(datasetRepo.findById(datasetId)).thenReturn(Optional.of(activeDataset));
        when(accessGrantRepo.findByDatasetIdAndResearcherUserId(datasetId, coResearcherUserId)).thenReturn(Optional.empty());

        CreateEvaluationRunRequest request = new CreateEvaluationRunRequest(
                versionId,
                "clinora-ai-clinical",
                "v1.2.0",
                "lab-extract-v3",
                EvaluationTaskType.CLASSIFICATION,
                "PHYSICIAN_VERIFIED_OBSERVATIONS",
                null
        );

        ResearchApiException ex = assertThrows(ResearchApiException.class, () ->
                service.createAndExecuteRun(projectId, request, coResearcherUserId));
        assertEquals(org.springframework.http.HttpStatus.FORBIDDEN, ex.getStatus());
        assertEquals("DATASET_ACCESS_DENIED", ex.getErrorCode());
    }

    @Test
    @DisplayName("RISK_SCORING task type is rejected per safety rules")
    void riskScoringTaskTypeIsRejected() {
        when(authService.requireReadAccess(projectId, ownerUserId)).thenReturn(approvedProject);
        when(authService.resolveProjectRole(projectId, ownerUserId)).thenReturn(Optional.of(ProjectMemberRole.OWNER));
        when(versionRepo.findById(versionId)).thenReturn(Optional.of(datasetVersion));
        when(datasetRepo.findById(datasetId)).thenReturn(Optional.of(activeDataset));
        when(accessGrantRepo.findByDatasetIdAndResearcherUserId(datasetId, ownerUserId)).thenReturn(Optional.of(activeGrant));

        CreateEvaluationRunRequest request = new CreateEvaluationRunRequest(
                versionId,
                "clinora-ai-clinical",
                "v1.2.0",
                "lab-extract-v3",
                EvaluationTaskType.RISK_SCORING,
                "PHYSICIAN_VERIFIED_OBSERVATIONS",
                null
        );

        ResearchApiException ex = assertThrows(ResearchApiException.class, () ->
                service.createAndExecuteRun(projectId, request, ownerUserId));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("UNSUPPORTED_TASK_TYPE", ex.getErrorCode());
    }

    @Test
    @DisplayName("Extraction without an execution adapter returns unavailable with no metrics")
    void extractionTaskCannotFabricateMetrics() {
        when(authService.requireReadAccess(projectId, ownerUserId)).thenReturn(approvedProject);
        when(authService.resolveProjectRole(projectId, ownerUserId)).thenReturn(Optional.of(ProjectMemberRole.OWNER));
        when(versionRepo.findById(versionId)).thenReturn(Optional.of(datasetVersion));
        when(datasetRepo.findById(datasetId)).thenReturn(Optional.of(activeDataset));
        when(accessGrantRepo.findByDatasetIdAndResearcherUserId(datasetId, ownerUserId)).thenReturn(Optional.of(activeGrant));
        when(evalRepo.save(any(AIEvaluationRun.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateEvaluationRunRequest request = new CreateEvaluationRunRequest(
                versionId,
                "clinora-ai-clinical",
                "v1.2.0",
                "lab-extract-v3",
                EvaluationTaskType.EXTRACTION,
                "PHYSICIAN_VERIFIED_OBSERVATIONS",
                null
        );

        AIEvaluationRunResponse response = service.createAndExecuteRun(projectId, request, ownerUserId);
        assertNull(response.metrics());
        assertEquals(EvaluationRunStatus.CONFIGURED, response.status());
        assertNull(response.failureReason());
    }

    @Test
    @DisplayName("Options endpoint returns only authorized dataset versions for the requesting user")
    void optionsEndpointFiltersByDatasetAccessGrant() {
        when(accessGuard.canReadDataset(datasetId, coResearcherUserId)).thenReturn(true);
        when(authService.requireReadAccess(projectId, coResearcherUserId)).thenReturn(approvedProject);
        when(datasetRepo.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of(activeDataset));
        when(accessGrantRepo.findByDatasetIdAndResearcherUserId(datasetId, coResearcherUserId)).thenReturn(Optional.of(activeGrant));
        when(versionRepo.findByDatasetIdOrderByVersionNumberDesc(datasetId)).thenReturn(List.of(datasetVersion));

        AIEvaluationOptionsResponse options = service.getEvaluationOptions(projectId, coResearcherUserId);

        assertNotNull(options);
        assertEquals(1, options.datasetVersions().size());
        assertEquals("Clinora AI", options.models().get(0).name());
        assertEquals(3, options.taskTypes().size());
        assertEquals(3, options.groundTruthDefinitions().size());
    }

    @Test
    @DisplayName("Phase R12 Guardrail: Advisory AI suggestions are rejected for disease prevalence")
    void phaseR12AdvisorySuggestionsRejectedForPrevalence() {
        assertThrows(IllegalStateException.class, () ->
                diseaseAnalyticsPolicy.validateDiagnosisSourceForPrevalence(
                        DiseaseAnalyticsPolicy.DiagnosisSourceType.AI_SUGGESTED_ADVISORY
                )
        );

        assertDoesNotThrow(() ->
                diseaseAnalyticsPolicy.validateDiagnosisSourceForPrevalence(
                        DiseaseAnalyticsPolicy.DiagnosisSourceType.PHYSICIAN_CONFIRMED
                )
        );
    }

    // ───────────────────────── ABNORMALITY_DETECTION: all-observation execution ─────────────────────────

    private static com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.Observation sample(
            String key, String value, String low, String high, String truth) {
        return new com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.Observation(
            key, "HGB", new BigDecimal(value), "g/dL", new BigDecimal(low), new BigDecimal(high), truth);
    }

    private static MedGemmaClient.AbnormalityEvaluationResponse answer(List<MedGemmaClient.AbnormalityPrediction> predictions) {
        return new MedGemmaClient.AbnormalityEvaluationResponse(predictions, "LLAMA_CPP_MEDGEMMA", "medgemma", "test", "abnormality-all-v1", 1, 120);
    }

    private AIEvaluationRun prepareConfiguredRun(List<com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.Observation> snapshot) throws Exception {
        UUID runId = UUID.randomUUID();
        AIEvaluationRun run = new AIEvaluationRun(runId, projectId, versionId, "clinora-ai", "1.0", "abnormality-v2",
                EvaluationTaskType.ABNORMALITY_DETECTION, "gt", "{\"referenceResolver\":\"READY\", \"automatedExecution\":\"READY\"}", ownerUserId);
        when(evalRepo.findByIdAndProjectId(runId, projectId)).thenReturn(Optional.of(run));
        when(authService.requireReadAccess(projectId, viewerUserId)).thenReturn(approvedProject);
        when(authService.resolveProjectRole(projectId, viewerUserId)).thenReturn(Optional.of(ProjectMemberRole.CO_RESEARCHER));
        DatasetVersion version = new DatasetVersion(versionId, datasetId, 1, "1.0", 1, "test-key.json", "hash", "JSON", "1.0", Instant.now());
        when(versionRepo.findById(versionId)).thenReturn(Optional.of(version));
        when(storagePort.get("test-key-eval.json")).thenReturn(
                new ResearchDatasetStoragePort.StoredDataset(objectMapper.writeValueAsBytes(new com.clinora.research.service.evaluation.EvaluationReferenceSnapshot(
                    "verified-lab-reference-v1", versionId, "hash", snapshot.size(), snapshot)), "application/json"));
        when(datasetRepo.findById(datasetId)).thenReturn(Optional.of(activeDataset));
        when(accessGrantRepo.findByDatasetIdAndResearcherUserId(datasetId, viewerUserId)).thenReturn(Optional.of(activeGrant));
        when(evalRepo.findById(runId)).thenReturn(Optional.of(run));
        when(resultRepository.saveAllAndFlush(any())).thenAnswer(inv -> {
            List<AIEvaluationResult> pairs = inv.getArgument(0);
            when(resultRepository.findByEvaluationRunId(runId)).thenReturn(pairs);
            return pairs;
        });
        when(aiClient.isInferenceRuntimeReady()).thenReturn(true);
        when(evalRepo.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        when(evalRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        return run;
    }

    private static MedGemmaClient.AbnormalityPrediction pred(String key, String label) {
        return new MedGemmaClient.AbnormalityPrediction(key, label);
    }

    @Test
    @DisplayName("Every eligible observation is sent in ONE request, with no 4-sample limit and no class balancing")
    void executeEvaluation_evaluatesEveryEligibleObservationInOneRequest() throws Exception {
        java.util.ArrayList<com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.Observation> all = new java.util.ArrayList<>();
        for (int i = 0; i < 24; i++) {
            // 21 normal, 3 abnormal: real, unbalanced distribution
            boolean abnormal = i < 3;
            all.add(sample("S" + (i + 1), abnormal ? "20" : "13", "12", "16", abnormal ? "ABNORMAL" : "NORMAL"));
        }
        AIEvaluationRun run = prepareConfiguredRun(all);

        // A perfect model answer: derived from the reference only inside the test stub, never in production code.
        when(aiClient.evaluateAbnormality(any())).thenAnswer(inv -> {
            MedGemmaClient.AbnormalityEvaluationRequest req = inv.getArgument(0);
            return answer(
                    req.samples().stream().map(s -> pred(s.sampleKey(), s.value().intValue() > 16 ? "ABNORMAL" : "NORMAL")).toList());
        });

        AIEvaluationRunResponse response = service.executeEvaluation(projectId, run.getId(), viewerUserId);

        org.mockito.ArgumentCaptor<MedGemmaClient.AbnormalityEvaluationRequest> captor =
                org.mockito.ArgumentCaptor.forClass(MedGemmaClient.AbnormalityEvaluationRequest.class);
        verify(aiClient, times(1)).evaluateAbnormality(captor.capture());
        assertEquals(24, captor.getValue().samples().size());
        // deterministic order
        assertEquals("S1", captor.getValue().samples().get(0).sampleKey());
        assertEquals("S24", captor.getValue().samples().get(23).sampleKey());

        assertEquals(EvaluationRunStatus.COMPLETED, response.status());
        assertEquals(24, response.metrics().sampleCount());
        assertEquals(3, response.metrics().confusionMatrix().truePositives());
        assertEquals(21, response.metrics().confusionMatrix().trueNegatives());
        assertEquals(0, response.metrics().confusionMatrix().falsePositives());
        assertEquals(0, response.metrics().confusionMatrix().falseNegatives());

        org.mockito.ArgumentCaptor<List<AIEvaluationResult>> pairs = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(resultRepository).saveAllAndFlush(pairs.capture());
        assertEquals(24, pairs.getValue().size());
    }

    @Test
    @DisplayName("Ground truth, expected labels and verification status are never part of the AI request payload")
    void executeEvaluation_neverSendsGroundTruthToModel() throws Exception {
        List<com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.Observation> snapshot = List.of(
            sample("S1", "20", "12", "16", "ABNORMAL"),
            sample("S2", "13", "12", "16", "NORMAL")
        );
        AIEvaluationRun run = prepareConfiguredRun(snapshot);
        when(aiClient.evaluateAbnormality(any())).thenReturn(answer(
                List.of(pred("S1", "ABNORMAL"), pred("S2", "NORMAL"))));

        service.executeEvaluation(projectId, run.getId(), viewerUserId);

        org.mockito.ArgumentCaptor<MedGemmaClient.AbnormalityEvaluationRequest> captor =
                org.mockito.ArgumentCaptor.forClass(MedGemmaClient.AbnormalityEvaluationRequest.class);
        verify(aiClient).evaluateAbnormality(captor.capture());
        String json = objectMapper.writeValueAsString(captor.getValue()).toLowerCase();
        assertFalse(json.contains("groundtruth"));
        assertFalse(json.contains("expectedlabel"));
        assertFalse(json.contains("correctanswer"));
        assertFalse(json.contains("derived"));
        assertFalse(json.contains("verif"));
    }

    @Test
    @DisplayName("Metrics come only from real truth/prediction pairs (TP/TN/FP/FN mix)")
    void executeEvaluation_metricsFromRealPairs() throws Exception {
        List<com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.Observation> snapshot = List.of(
                sample("S1", "20", "12", "16", "ABNORMAL"), // predicted ABNORMAL -> TP
                sample("S2", "20", "12", "16", "ABNORMAL"), // predicted NORMAL   -> FN
                sample("S3", "13", "12", "16", "NORMAL"),   // predicted ABNORMAL -> FP
                sample("S4", "13", "12", "16", "NORMAL")    // predicted NORMAL   -> TN
        );
        AIEvaluationRun run = prepareConfiguredRun(snapshot);
        when(aiClient.evaluateAbnormality(any())).thenReturn(answer(
                List.of(pred("S1", "ABNORMAL"), pred("S2", "NORMAL"), pred("S3", "ABNORMAL"), pred("S4", "NORMAL"))));

        AIEvaluationRunResponse response = service.executeEvaluation(projectId, run.getId(), viewerUserId);

        assertEquals(1, response.metrics().confusionMatrix().truePositives());
        assertEquals(1, response.metrics().confusionMatrix().falseNegatives());
        assertEquals(1, response.metrics().confusionMatrix().falsePositives());
        assertEquals(1, response.metrics().confusionMatrix().trueNegatives());
        assertEquals(0.5, response.metrics().accuracy(), 1e-9);
        assertEquals(0.5, response.metrics().precision(), 1e-9);
        assertEquals(0.5, response.metrics().recall(), 1e-9);
        assertEquals(0.5, response.metrics().f1(), 1e-9);
        assertEquals(0.5, response.metrics().balancedAccuracy(), 1e-9);
    }

    @Test
    @DisplayName("Missing prediction fails the run: no pairs, no metrics")
    void executeEvaluation_failsOnMissingPrediction() throws Exception {
        List<com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.Observation> snapshot = List.of(
                sample("S1", "20", "12", "16", "ABNORMAL"),
                sample("S2", "13", "12", "16", "NORMAL")
        );
        AIEvaluationRun run = prepareConfiguredRun(snapshot);
        when(aiClient.evaluateAbnormality(any())).thenReturn(answer(List.of(pred("S1", "ABNORMAL"))));

        AIEvaluationRunResponse response = service.executeEvaluation(projectId, run.getId(), viewerUserId);
        assertEquals("INVALID_AI_RESPONSE", response.failureReason());
        verify(resultRepository, never()).saveAllAndFlush(any());
        assertEquals(EvaluationRunStatus.FAILED, run.getStatus());
        assertNull(run.getMetrics());
    }

    @Test
    @DisplayName("Invalid label fails the run")
    void executeEvaluation_failsOnInvalidLabel() throws Exception {
        List<com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.Observation> snapshot = List.of(sample("S1", "20", "12", "16", "ABNORMAL"));
        AIEvaluationRun run = prepareConfiguredRun(snapshot);
        when(aiClient.evaluateAbnormality(any())).thenReturn(answer(List.of(pred("S1", "WEIRD"))));

        AIEvaluationRunResponse response = service.executeEvaluation(projectId, run.getId(), viewerUserId);
        assertEquals("INVALID_AI_RESPONSE", response.failureReason());
        verify(resultRepository, never()).saveAllAndFlush(any());
        assertEquals(EvaluationRunStatus.FAILED, run.getStatus());
    }

    @Test
    @DisplayName("Duplicate prediction fails the run")
    void executeEvaluation_failsOnDuplicatePrediction() throws Exception {
        List<com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.Observation> snapshot = List.of(
            sample("S1", "20", "12", "16", "ABNORMAL"),
            sample("S2", "13", "12", "16", "NORMAL")
        );
        AIEvaluationRun run = prepareConfiguredRun(snapshot);
        when(aiClient.evaluateAbnormality(any())).thenReturn(answer(
                List.of(pred("S1", "ABNORMAL"), pred("S1", "ABNORMAL"))));

        AIEvaluationRunResponse response = service.executeEvaluation(projectId, run.getId(), viewerUserId);
        assertEquals("INVALID_AI_RESPONSE", response.failureReason());
        verify(resultRepository, never()).saveAllAndFlush(any());
        assertEquals(EvaluationRunStatus.FAILED, run.getStatus());
    }

    @Test
    @DisplayName("Missing, legacy-format, or empty reference snapshot is rejected before the run starts")
    void executeEvaluation_missingReferenceRejected() throws Exception {
        List<com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.Observation> snapshot = List.of();
        AIEvaluationRun run = prepareConfiguredRun(snapshot);

        ResearchApiException ex = assertThrows(ResearchApiException.class, () -> service.executeEvaluation(projectId, run.getId(), viewerUserId));
        assertEquals("REFERENCE_NOT_FOUND", ex.getErrorCode());
        assertEquals(EvaluationRunStatus.CONFIGURED, run.getStatus());
        verify(aiClient, never()).evaluateAbnormality(any());

        // legacy array-format file (old 4-sample snapshot) is also not usable
        when(storagePort.get("test-key-eval.json")).thenThrow(new RuntimeException("not found"));
        ex = assertThrows(ResearchApiException.class, () -> service.executeEvaluation(projectId, run.getId(), viewerUserId));
        assertEquals("REFERENCE_NOT_FOUND", ex.getErrorCode());
    }

    @Test
    @DisplayName("Readiness is derived from real backend state and CONFIGURED runs expose eligible counts")
    void configuredRunReadinessReflectsBackend() throws Exception {
        List<com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.Observation> snapshot = List.of(
                sample("S1", "20", "12", "16", "ABNORMAL"),
                sample("S2", "13", "12", "16", "NORMAL")
        );
        AIEvaluationRun run = prepareConfiguredRun(snapshot);
        when(authService.requireReadAccess(projectId, ownerUserId)).thenReturn(approvedProject);
        when(accessGuard.canReadDataset(datasetId, ownerUserId)).thenReturn(true);
        when(evalRepo.findByIdAndProjectId(run.getId(), projectId)).thenReturn(Optional.of(run));

        Map<?, ?> ready = objectMapper.readValue(service.getRun(projectId, run.getId(), ownerUserId).configuration(), Map.class);
        assertEquals("READY", ready.get("predictionRunner"));
        assertEquals("READY", ready.get("referenceResolver"));
        assertEquals("READY", ready.get("automatedExecution"));
    }

    @Test
    @DisplayName("Completed run without real-AI provenance is suppressed as legacy/unverified")
    void legacyCompletedRunMetricsAreSuppressed() throws Exception {
        UUID runId = UUID.randomUUID();
        AIEvaluationRun run = new AIEvaluationRun(runId, projectId, versionId, "clinora-ai", "1.0", "abnormality-v2",
                EvaluationTaskType.ABNORMALITY_DETECTION, "gt", "{\"legacyUnverified\": true}", ownerUserId);
        run.markRunning();
        run.markCompleted(objectMapper.writeValueAsString(abnormalityCalculator.calculate(2, 0, 2, 0)));
        when(evalRepo.findByIdAndProjectId(runId, projectId)).thenReturn(Optional.of(run));
        when(authService.requireReadAccess(projectId, ownerUserId)).thenReturn(approvedProject);
        DatasetVersion version = new DatasetVersion(versionId, datasetId, 1, "1.0", 1, "test-key.json", "hash", "JSON", "1.0", Instant.now());
        when(versionRepo.findById(versionId)).thenReturn(Optional.of(version));
        AIEvaluationRunResponse response = service.getRun(projectId, runId, ownerUserId);
        assertEquals(true, objectMapper.readValue(response.configuration(), Map.class).get("legacyUnverified"));
        assertNull(response.metrics());
        assertEquals(EvaluationRunStatus.COMPLETED, response.status());
    }

    @Test
    void unavailableRuntimeDisablesReadinessAndFailsWithoutResults() throws Exception {
        var run = prepareConfiguredRun(List.of(sample("S1", "13", "12", "16", "NORMAL")));
        when(aiClient.isInferenceRuntimeReady()).thenReturn(false);
        var config = objectMapper.readValue(service.getRun(projectId, run.getId(), viewerUserId).configuration(), Map.class);
        assertEquals("UNAVAILABLE", config.get("predictionRunner"));
        assertEquals("READY", config.get("referenceResolver"));
        assertEquals("UNAVAILABLE", config.get("automatedExecution"));
        var response = service.executeEvaluation(projectId, run.getId(), viewerUserId);
        assertEquals(EvaluationRunStatus.FAILED, response.status());
        assertEquals("CLINORA_AI_UNAVAILABLE", response.failureReason());
        assertNotNull(response.startedAt());
        assertNull(response.metrics());
        verify(aiClient, never()).evaluateAbnormality(any());
        verify(resultRepository, never()).saveAllAndFlush(any());
        assertEquals(EvaluationRunStatus.FAILED, service.getRun(projectId, run.getId(), viewerUserId).status());
    }

    @Test
    void unavailableReferenceDisablesReadiness() throws Exception {
        var run = prepareConfiguredRun(List.of());
        var config = objectMapper.readValue(service.getRun(projectId, run.getId(), viewerUserId).configuration(), Map.class);
        assertEquals("READY", config.get("predictionRunner"));
        assertEquals("UNAVAILABLE", config.get("referenceResolver"));
        assertEquals("UNAVAILABLE", config.get("automatedExecution"));
    }

    @Test
    void runningResponsePreservesStatusWithoutMetrics() throws Exception {
        var run = prepareConfiguredRun(List.of(sample("S1", "13", "12", "16", "NORMAL")));
        run.markRunning();
        var response = service.getRun(projectId, run.getId(), viewerUserId);
        assertEquals(EvaluationRunStatus.RUNNING, response.status());
        assertNull(response.metrics());
    }

    @Test
    void duplicateAlongsideEveryExpectedKeyIsRejected() throws Exception {
        var run = prepareConfiguredRun(List.of(sample("S1", "13", "12", "16", "NORMAL")));
        when(aiClient.evaluateAbnormality(any())).thenReturn(answer(List.of(pred("S1", "NORMAL"), pred("S1", "NORMAL"))));
        assertEquals("INVALID_AI_RESPONSE", service.executeEvaluation(projectId, run.getId(), viewerUserId).failureReason());
        verify(resultRepository, never()).saveAllAndFlush(any());
    }

    @Test
    void missingExpiredAndRevokedGrantsAreRejectedBeforeInference() throws Exception {
        var run = prepareConfiguredRun(List.of(sample("S1", "13", "12", "16", "NORMAL")));
        when(accessGrantRepo.findByDatasetIdAndResearcherUserId(datasetId, viewerUserId)).thenReturn(Optional.empty());
        assertThrows(ResearchApiException.class, () -> service.executeEvaluation(projectId, run.getId(), viewerUserId));
        var expired = new DatasetAccessGrant(UUID.randomUUID(), datasetId, viewerUserId, ownerUserId,
            Instant.now().minusSeconds(100), Instant.now().minusSeconds(1));
        when(accessGrantRepo.findByDatasetIdAndResearcherUserId(datasetId, viewerUserId)).thenReturn(Optional.of(expired));
        assertThrows(ResearchApiException.class, () -> service.executeEvaluation(projectId, run.getId(), viewerUserId));
        doThrow(new ResearchApiException(org.springframework.http.HttpStatus.FORBIDDEN, "DATASET_ACCESS_DENIED", "Revoked"))
            .when(accessGuard).dataset(datasetId, viewerUserId);
        assertThrows(ResearchApiException.class, () -> service.executeEvaluation(projectId, run.getId(), viewerUserId));
        assertEquals(EvaluationRunStatus.CONFIGURED, run.getStatus());
        verify(aiClient, never()).evaluateAbnormality(any());
    }

    @Test
    void crossProjectAndUnauthorizedExecutionsRejected() throws Exception {
        var run = prepareConfiguredRun(List.of(sample("S1", "13", "12", "16", "NORMAL")));
        assertThrows(ResearchApiException.class, () -> service.executeEvaluation(UUID.randomUUID(), run.getId(), viewerUserId));
        when(authService.resolveProjectRole(projectId, viewerUserId)).thenReturn(Optional.of(ProjectMemberRole.VIEWER));
        assertThrows(ResearchApiException.class, () -> service.executeEvaluation(projectId, run.getId(), viewerUserId));
        when(authService.resolveProjectRole(projectId, viewerUserId)).thenReturn(Optional.of(ProjectMemberRole.CO_RESEARCHER));
        var foreignDataset = mock(ResearchDataset.class);
        when(foreignDataset.getProjectId()).thenReturn(UUID.randomUUID());
        when(datasetRepo.findById(datasetId)).thenReturn(Optional.of(foreignDataset));
        assertThrows(ResearchApiException.class, () -> service.executeEvaluation(projectId, run.getId(), viewerUserId));
        verify(aiClient, never()).evaluateAbnormality(any());
    }

    @Test
    void otherTasksStayConfiguredAndCannotExecute() throws Exception {
        for (var task : List.of(EvaluationTaskType.EXTRACTION, EvaluationTaskType.CLASSIFICATION)) {
            var run = prepareConfiguredRun(List.of());
            var unsupported = new AIEvaluationRun(run.getId(), projectId, versionId, "clinora-ai", "1", "1", task, "gt", "{}", ownerUserId);
            when(evalRepo.findByIdAndProjectId(run.getId(), projectId)).thenReturn(Optional.of(unsupported));
            assertThrows(ResearchApiException.class, () -> service.executeEvaluation(projectId, run.getId(), viewerUserId));
            assertEquals(EvaluationRunStatus.CONFIGURED, unsupported.getStatus());
        }
        verify(aiClient, never()).evaluateAbnormality(any());
    }

    @Test
    void exactMetricsUseAllCountsAndNoAuc() throws Exception {
        var metrics = abnormalityCalculator.calculate(9, 1, 12, 2);
        assertEquals(24, metrics.sampleCount());
        assertEquals(0.875, metrics.accuracy());
        assertEquals(0.9, metrics.precision());
        assertEquals(0.8182, metrics.recall());
        assertEquals(0.9231, 1 - metrics.falsePositiveRate(), 0.00001);
        assertEquals(0.8571, metrics.f1());
        assertEquals(0.8706, metrics.balancedAccuracy());
        assertFalse(objectMapper.writeValueAsString(metrics).contains("rocAuc"));
    }
}
