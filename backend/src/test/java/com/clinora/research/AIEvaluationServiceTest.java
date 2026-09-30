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
                objectMapper
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
        assertEquals(EvaluationRunStatus.COMPLETED, response.status());
        assertEquals("clinora-ai-clinical", response.modelId());
        assertNotNull(response.metrics());
        assertTrue(response.metrics().sampleCount() > 0);
        verify(evalRepo, atLeast(2)).save(any(AIEvaluationRun.class));
        verify(auditService, atLeastOnce()).record(eq(ownerUserId), eq(com.clinora.audit.AuthAuditAction.AI_EVALUATION_COMPLETED), any(), any(), any(), any(), any());
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
    @DisplayName("Extraction task calculates exactMatchRate and toleranceMatchRate")
    void extractionTaskCalculatesExtractionMetrics() {
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
        assertNotNull(response.metrics());
        assertNotNull(response.metrics().exactMatchRate());
        assertNotNull(response.metrics().toleranceMatchRate());
        assertTrue(response.metrics().exactMatchRate() > 0);
    }

    @Test
    @DisplayName("Options endpoint returns only authorized dataset versions for the requesting user")
    void optionsEndpointFiltersByDatasetAccessGrant() {
        when(authService.requireReadAccess(projectId, coResearcherUserId)).thenReturn(approvedProject);
        when(datasetRepo.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of(activeDataset));
        when(accessGrantRepo.findByDatasetIdAndResearcherUserId(datasetId, coResearcherUserId)).thenReturn(Optional.of(activeGrant));
        when(versionRepo.findByDatasetIdOrderByVersionNumberDesc(datasetId)).thenReturn(List.of(datasetVersion));

        AIEvaluationOptionsResponse options = service.getEvaluationOptions(projectId, coResearcherUserId);

        assertNotNull(options);
        assertEquals(1, options.datasetVersions().size());
        assertEquals("Clinora AI Clinical", options.models().get(0).name());
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
}
