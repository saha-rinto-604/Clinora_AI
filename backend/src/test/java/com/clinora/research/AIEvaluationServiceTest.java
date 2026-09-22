package com.clinora.research;

import com.clinora.research.api.AIEvaluationModels.*;
import com.clinora.research.repository.AIEvaluationRunRepository;
import com.clinora.research.repository.DatasetVersionRepository;
import com.clinora.research.repository.ResearchProjectRepository;
import com.clinora.research.service.AIEvaluationService;
import com.clinora.research.service.DiseaseAnalyticsPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;

class AIEvaluationServiceTest {

    private AIEvaluationService service;
    private DiseaseAnalyticsPolicy diseaseAnalyticsPolicy;

    @BeforeEach
    void setUp() {
        AIEvaluationRunRepository evalRepo = Mockito.mock(AIEvaluationRunRepository.class);
        ResearchProjectRepository projectRepo = Mockito.mock(ResearchProjectRepository.class);
        DatasetVersionRepository versionRepo = Mockito.mock(DatasetVersionRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();

        service = new AIEvaluationService(evalRepo, projectRepo, versionRepo, objectMapper);
        diseaseAnalyticsPolicy = new DiseaseAnalyticsPolicy();
    }

    @Test
    @DisplayName("Phase R13: Standard 2x2 confusion matrix correctly computes accuracy, precision, recall, F1, FPR, FNR, and balancedAccuracy")
    void computesStandardMetricsCorrectly() {
        // TP=40, FP=10, TN=40, FN=10
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
    @DisplayName("Phase R13: Metric calculation handles edge cases with zero counts without division by zero errors")
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
    @DisplayName("Phase R13: Asymmetric classification matrix correctly calculates imbalanced medical diagnostic metrics")
    void asymmetricMedicalDatasetMetrics() {
        // High-sensitivity screening test: TP=95, FP=30, TN=850, FN=5 (Total=980)
        EvaluationMetrics metrics = service.computeMetrics(95, 30, 850, 5);

        assertEquals(980, metrics.sampleCount());
        // Sensitivity (Recall) = 95 / 100 = 0.95
        assertEquals(0.9500, metrics.recall(), 0.0001);
        // Precision = 95 / 125 = 0.76
        assertEquals(0.7600, metrics.precision(), 0.0001);
        // FPR = 30 / (30 + 850) = 30 / 880 ≈ 0.0341
        assertEquals(0.0341, metrics.falsePositiveRate(), 0.0001);
        // FNR = 5 / (5 + 95) = 5 / 100 = 0.05
        assertEquals(0.0500, metrics.falseNegativeRate(), 0.0001);
        // Specificity = 1 - 0.0341 = 0.9659, Balanced Accuracy = (0.9500 + 0.9659) / 2 = 0.9580
        assertEquals(0.9580, metrics.balancedAccuracy(), 0.0001);
    }

    @Test
    @DisplayName("Phase R12 Guardrail: Advisory AI suggestions are rejected for disease prevalence")
    void phaseR12AdvisorySuggestionsRejectedForPrevalence() {
        assertThrows(IllegalStateException.class, () ->
                diseaseAnalyticsPolicy.validateDiagnosisSourceForPrevalence(
                        DiseaseAnalyticsPolicy.DiagnosisSourceType.AI_SUGGESTED_ADVISORY
                )
        );

        // Confirmed diagnoses pass validation
        assertDoesNotThrow(() ->
                diseaseAnalyticsPolicy.validateDiagnosisSourceForPrevalence(
                        DiseaseAnalyticsPolicy.DiagnosisSourceType.PHYSICIAN_CONFIRMED
                )
        );

        assertFalse(diseaseAnalyticsPolicy.isDiseasePrevalenceEnabled(),
                "Disease prevalence must remain disabled until authoritative outcome pipeline exists");
    }
}
