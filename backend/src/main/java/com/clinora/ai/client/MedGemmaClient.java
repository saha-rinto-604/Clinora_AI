package com.clinora.ai.client;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class MedGemmaClient {

    private final RestClient client;
    private final String internalToken;

    public MedGemmaClient(
        RestClient.Builder builder,
        @Value("${clinora.services.ai-url:http://localhost:8001}") String baseUrl,
        @Value("${clinora.services.ai-token:dev-only-clinora-ai-token-change-me}") String internalToken,
        @Value("${clinora.services.ai-connect-timeout-ms:5000}") int connectTimeoutMs,
        @Value("${clinora.services.ai-read-timeout-ms:240000}") int readTimeoutMs
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(Math.max(1000L, connectTimeoutMs)));
        requestFactory.setReadTimeout(Duration.ofMillis(Math.max(30000L, readTimeoutMs)));
        this.client = builder.requestFactory(requestFactory).baseUrl(baseUrl).build();
        this.internalToken = internalToken;
    }

    public ReportAnalysisResponse analyze(UUID requestId, AnalysisInputSnapshot input) {
        ReportAnalysisResponse response = client.post()
            .uri("/internal/v1/report-analysis")
            .header("X-Clinora-Internal-Token", internalToken)
            .body(new ReportAnalysisRequest(requestId, input.reportType(), input.observations()))
            .retrieve()
            .body(ReportAnalysisResponse.class);
        if (response == null) {
            throw new IllegalStateException("AI service returned an empty response.");
        }
        return response;
    }

    public record AnalysisInputSnapshot(String reportType, List<ClinicalObservation> observations) {
        public AnalysisInputSnapshot {
            observations = observations == null ? List.of() : List.copyOf(observations);
        }
    }

    public record ReportAnalysisRequest(UUID requestId, String reportType, List<ClinicalObservation> observations) {
    }

    public record ClinicalObservation(
        UUID observationId,
        String label,
        String valueType,
        BigDecimal numericValue,
        String textValue,
        String comparator,
        String unit,
        String referenceRangeRaw,
        BigDecimal referenceLow,
        BigDecimal referenceHigh,
        String rangeFlag
    ) {
    }

    public record ReportAnalysisResponse(
        String analysisStatus,
        String summary,
        List<Finding> notableFindings,
        List<ClinicalPattern> clinicalPatterns,
        List<DiscussionPoint> discussionPoints,
        String patientExplanation,
        List<String> limitations,
        String modelName,
        String modelRevision,
        String promptVersion,
        String schemaVersion
    ) {
        public ReportAnalysisResponse {
            notableFindings = notableFindings == null ? List.of() : List.copyOf(notableFindings);
            clinicalPatterns = clinicalPatterns == null ? List.of() : List.copyOf(clinicalPatterns);
            discussionPoints = discussionPoints == null ? List.of() : List.copyOf(discussionPoints);
            limitations = limitations == null ? List.of() : List.copyOf(limitations);
        }
    }

    public record Finding(UUID observationId, String title, String interpretation) {
    }

    public record ClinicalPattern(
        String name,
        String supportLevel,
        String reasoning,
        List<UUID> supportingObservationIds,
        List<UUID> contradictoryObservationIds,
        List<String> missingEvidence,
        List<String> possibleCauses
    ) {
        public ClinicalPattern {
            supportingObservationIds = supportingObservationIds == null ? List.of() : List.copyOf(supportingObservationIds);
            contradictoryObservationIds = contradictoryObservationIds == null ? List.of() : List.copyOf(contradictoryObservationIds);
            missingEvidence = missingEvidence == null ? List.of() : List.copyOf(missingEvidence);
            possibleCauses = possibleCauses == null ? List.of() : List.copyOf(possibleCauses);
        }
    }

    public record DiscussionPoint(String type, String title, String reason) {
    }
}
