package com.clinora.ai.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.SocketTimeoutException;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import static com.clinora.ai.client.DoctorRouterException.Category.*;

@Component
public class MedGemmaClient {
    private static final Logger LOGGER = LoggerFactory.getLogger(MedGemmaClient.class);
    private static final String ROUTER_ENDPOINT = "/internal/v1/doctor-support/route";

    private final RestClient client;
    private final RestClient doctorClient;
    private final String internalToken;

    public MedGemmaClient(
        RestClient.Builder builder,
        @Value("${clinora.services.ai-url:http://localhost:8001}") String baseUrl,
        @Value("${clinora.services.ai-token:dev-only-clinora-ai-token-change-me}") String internalToken,
        @Value("${clinora.services.ai-connect-timeout-ms:5000}") int connectTimeoutMs,
        @Value("${clinora.services.ai-read-timeout-ms:240000}") int readTimeoutMs,
        @Value("${clinora.services.ai-doctor-read-timeout-ms:15000}") int doctorReadTimeoutMs
    ) {
        SimpleClientHttpRequestFactory backgroundRequestFactory = new SimpleClientHttpRequestFactory();
        backgroundRequestFactory.setConnectTimeout(Duration.ofMillis(Math.max(1000L, connectTimeoutMs)));
        backgroundRequestFactory.setReadTimeout(Duration.ofMillis(Math.max(30000L, readTimeoutMs)));
        this.client = builder.clone().requestFactory(backgroundRequestFactory).baseUrl(baseUrl).build();
        SimpleClientHttpRequestFactory doctorRequestFactory = new SimpleClientHttpRequestFactory();
        doctorRequestFactory.setConnectTimeout(Duration.ofMillis(Math.max(1000L, Math.min(5000L, connectTimeoutMs))));
        doctorRequestFactory.setReadTimeout(Duration.ofMillis(Math.max(3000L, Math.min(15000L, doctorReadTimeoutMs))));
        this.doctorClient = builder.clone().requestFactory(doctorRequestFactory).baseUrl(baseUrl).build();
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

    public DoctorSupportRoutingResponse routeDoctorSupport(DoctorSupportRoutingRequest request) {
        long started = System.nanoTime();
        try {
            DoctorSupportRoutingResponse response = doctorClient.post()
                .uri(ROUTER_ENDPOINT)
                .header("X-Clinora-Internal-Token", internalToken)
                .body(request)
                .retrieve()
                .body(DoctorSupportRoutingResponse.class);
            if (response == null || response.status() == null
                || !List.of("ROUTED", "CLARIFICATION_REQUIRED", "UNSUPPORTED").contains(response.status())) {
                throw routerFailure(request, started, 200, ROUTER_INVALID_RESPONSE, false, "MALFORMED_SERVICE_RESPONSE");
            }
            LOGGER.info("doctor_router request_id={} endpoint={} downstream_status=200 duration_ms={} category=SUCCESS",
                request.requestId(), ROUTER_ENDPOINT, (System.nanoTime() - started) / 1_000_000);
            return response;
        } catch (RestClientResponseException exception) {
            int status = exception.getStatusCode().value();
            JsonNode detail = null;
            try {
                detail = new ObjectMapper().readTree(exception.getResponseBodyAsByteArray()).path("detail");
            } catch (Exception ignored) {
                // Never log the body or parser exception: either may contain sensitive data.
            }
            String code = detail == null ? "" : detail.path("errorCode").asText("");
            String reason = detail == null ? "" : detail.path("reasonCode").asText("");
            var category = switch (status) {
                case 401, 403 -> ROUTER_AUTH_CONFIGURATION_ERROR;
                case 429 -> ROUTER_MODEL_BUSY;
                case 408, 504 -> ROUTER_TIMEOUT;
                case 503 -> "ROUTER_MODEL_UNAVAILABLE".equals(code) ? ROUTER_MODEL_UNAVAILABLE : ROUTER_SERVICE_UNAVAILABLE;
                case 502 -> "ROUTER_INVALID_RESPONSE".equals(code) ? ROUTER_INVALID_RESPONSE : ROUTER_SERVICE_UNAVAILABLE;
                default -> ROUTER_SERVICE_UNAVAILABLE;
            };
            boolean clarificationSafe = status == 502 && category == ROUTER_INVALID_RESPONSE
                && List.of("INVALID_ROUTER_CONTRACT", "UNKNOWN_ROUTER_TASK").contains(reason);
            String safeReason = clarificationSafe ? "INVALID_ROUTER_CONTRACT"
                : category == ROUTER_INVALID_RESPONSE ? "MALFORMED_OR_TRUNCATED_ROUTER_RESPONSE" : "DOWNSTREAM_HTTP_ERROR";
            throw routerFailure(request, started, status, category, clarificationSafe, safeReason);
        } catch (ResourceAccessException exception) {
            boolean timeout = false;
            for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
                if (cause instanceof SocketTimeoutException) { timeout = true; break; }
            }
            throw routerFailure(request, started, 0, timeout ? ROUTER_TIMEOUT : ROUTER_CONNECTION_FAILURE,
                false, timeout ? "HTTP_TIMEOUT" : "CONNECTION_FAILED");
        } catch (DoctorRouterException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw routerFailure(request, started, 200, ROUTER_INVALID_RESPONSE, false, "MALFORMED_SERVICE_RESPONSE");
        }
    }

    private DoctorRouterException routerFailure(DoctorSupportRoutingRequest request, long started, int status,
        DoctorRouterException.Category category, boolean clarificationSafe, String reason) {
        LOGGER.warn("doctor_router request_id={} endpoint={} downstream_status={} duration_ms={} category={} reason={}",
            request.requestId(), ROUTER_ENDPOINT, status, (System.nanoTime() - started) / 1_000_000, category, reason);
        return new DoctorRouterException(category, clarificationSafe);
    }

    public DoctorQueryInterpretationResponse interpretDoctorQuery(DoctorQueryInterpretationRequest request) {
        DoctorQueryInterpretationResponse response = doctorClient.post()
            .uri("/internal/v1/doctor-support/interpret")
            .header("X-Clinora-Internal-Token", internalToken)
            .body(request)
            .retrieve()
            .body(DoctorQueryInterpretationResponse.class);
        if (response == null) {
            throw new IllegalStateException("AI service returned an empty Doctor query interpretation response.");
        }
        return response;
    }

    public DoctorSupportExecutionResponse executeDoctorSupport(DoctorSupportExecutionRequest request) {
        DoctorSupportExecutionResponse response = doctorClient.post()
            .uri("/internal/v1/doctor-support/execute")
            .header("X-Clinora-Internal-Token", internalToken)
            .body(request)
            .retrieve()
            .body(DoctorSupportExecutionResponse.class);
        if (response == null) throw new IllegalStateException("AI service returned an empty execution response.");
        return response;
    }

    public ClinicalKnowledgeHealth clinicalKnowledgeHealth() {
        ClinicalKnowledgeHealth response = doctorClient.get()
            .uri("/health/clinical-knowledge")
            .header("X-Clinora-Internal-Token", internalToken)
            .retrieve()
            .body(ClinicalKnowledgeHealth.class);
        if (response == null) throw new IllegalStateException("AI service returned an empty knowledge health response.");
        return response;
    }

    public record ClinicalKnowledgeHealth(
        String status, boolean ready, String indexVersion, int approvedChunkCount, String embeddingModel
    ) {}

    public record DoctorSupportExecutionRequest(
        UUID executionId,
        String originalQuestion,
        String doctorAssessment,
        String doctorNotes,
        JsonNode appointmentContext,
        JsonNode evidenceSnapshot,
        JsonNode reasoningSnapshots,
        List<DoctorSupportTaskExecutionRequest> tasks
    ) {}

    public record DoctorSupportTaskExecutionRequest(
        String taskId, String promptVersion, String schemaVersion, String ragPolicy
    ) {}

    public record DoctorSupportExecutionResponse(List<DoctorSupportTaskExecutionResponse> taskResults) {
        public DoctorSupportExecutionResponse {
            taskResults = taskResults == null ? List.of() : List.copyOf(taskResults);
        }
    }

    public record DoctorSupportTaskExecutionResponse(
        String taskId, String status, JsonNode result, String safeFailureCode,
        String modelName, String modelRevision, String quantization,
        String promptVersion, String schemaVersion, String executionProvider, String groundingStatus,
        long inferenceDurationMs, long repairDurationMs, long groundingDurationMs, int generationCallCount,
        int providerAttempts, int successfulGenerations,
        boolean ragUsed, String ragPolicy, String retrievalStatus, String knowledgeIndexVersion,
        List<String> retrievedChunkIds, List<String> citedChunkIds, long retrievalDurationMs,
        List<ClinicalReference> references,
        String failureStage, String invalidHandle, String invalidType, String invalidField
    ) {
        public DoctorSupportTaskExecutionResponse(
            String taskId, String status, JsonNode result, String safeFailureCode,
            String modelName, String modelRevision, String quantization,
            String promptVersion, String schemaVersion, String executionProvider, String groundingStatus,
            long inferenceDurationMs, long repairDurationMs, long groundingDurationMs, int generationCallCount,
            boolean ragUsed, String ragPolicy, String retrievalStatus, String knowledgeIndexVersion,
            List<String> retrievedChunkIds, List<String> citedChunkIds, long retrievalDurationMs,
            List<ClinicalReference> references
        ) {
            this(
                taskId, status, result, safeFailureCode, modelName, modelRevision, quantization,
                promptVersion, schemaVersion, executionProvider, groundingStatus, inferenceDurationMs,
                repairDurationMs, groundingDurationMs, generationCallCount,
                generationCallCount, generationCallCount, ragUsed, ragPolicy,
                retrievalStatus, knowledgeIndexVersion, retrievedChunkIds, citedChunkIds,
                retrievalDurationMs, references, null, null, null, null
            );
        }

        public DoctorSupportTaskExecutionResponse {
            retrievedChunkIds = retrievedChunkIds == null ? List.of() : List.copyOf(retrievedChunkIds);
            citedChunkIds = citedChunkIds == null ? List.of() : List.copyOf(citedChunkIds);
            references = references == null ? List.of() : List.copyOf(references);
        }
    }

    public record ClinicalReference(
        String chunkId, String sourceId, String documentId, String title, String publisher,
        String sourceType, String clinicalDomain, String publicationDate, String version,
        String jurisdiction, String sourceReference, String sectionPath
    ) {}

    public record DoctorSupportRoutingRequest(
        UUID requestId,
        String doctorMessage,
        DoctorSupportMinimalContext context,
        List<DoctorSupportTaskCatalogEntry> taskCatalog
    ) {}

    public record DoctorSupportMinimalContext(
        String contextType,
        String currentScreen,
        String currentReportType,
        int selectedReportCount,
        int selectedObservationCount,
        boolean doctorAssessmentPresent,
        boolean doctorNotesPresent,
        boolean comparableAuthorizedReportsAvailable,
        String selectionType
    ) {}

    public record DoctorQueryInterpretationRequest(
        UUID requestId,
        String doctorMessage,
        DoctorQueryMinimalContext context
    ) {}

    public record DoctorQueryMinimalContext(
        String contextType,
        String currentScreen,
        String currentReportType,
        int selectedReportCount,
        int selectedObservationCount,
        boolean doctorAssessmentPresent,
        boolean doctorNotesPresent,
        boolean comparableAuthorizedReportsAvailable,
        String selectionType
    ) {}

    public record DoctorQueryInterpretationResponse(
        JsonNode frame,
        String promptVersion,
        String schemaVersion,
        String finishReason,
        Integer promptTokens,
        Integer completionTokens,
        long durationMs
    ) {}

    public record DoctorSupportTaskCatalogEntry(
        String taskId,
        String purpose,
        String routingDescription,
        List<String> exampleUtterances
    ) {
        public DoctorSupportTaskCatalogEntry {
            exampleUtterances = exampleUtterances == null ? List.of() : List.copyOf(exampleUtterances);
        }
    }

    public record DoctorSupportRoutingResponse(
        String status,
        List<String> taskIds,
        List<String> clarificationOptionTaskIds,
        String promptVersion,
        String schemaVersion
    ) {
        public DoctorSupportRoutingResponse {
            taskIds = taskIds == null ? List.of() : List.copyOf(taskIds);
            clarificationOptionTaskIds = clarificationOptionTaskIds == null
                ? List.of()
                : List.copyOf(clarificationOptionTaskIds);
        }
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
        String schemaVersion,
        List<ClinicalCluster> clinicalClusters,
        String overallInterpretation
    ) {
        public ReportAnalysisResponse {
            notableFindings = notableFindings == null ? List.of() : List.copyOf(notableFindings);
            clinicalPatterns = clinicalPatterns == null ? List.of() : List.copyOf(clinicalPatterns);
            clinicalClusters = clinicalClusters == null ? List.of() : List.copyOf(clinicalClusters);
            discussionPoints = discussionPoints == null ? List.of() : List.copyOf(discussionPoints);
            limitations = limitations == null ? List.of() : List.copyOf(limitations);
        }

        // Historical results and existing Java consumers retain the v1.0 contract.
        public ReportAnalysisResponse(
            String analysisStatus, String summary, List<Finding> notableFindings,
            List<ClinicalPattern> clinicalPatterns, List<DiscussionPoint> discussionPoints,
            String patientExplanation, List<String> limitations, String modelName,
            String modelRevision, String promptVersion, String schemaVersion
        ) {
            this(analysisStatus, summary, notableFindings, clinicalPatterns, discussionPoints,
                patientExplanation, limitations, modelName, modelRevision, promptVersion,
                schemaVersion, List.of(), null);
        }
    }

    public record ClinicalCluster(
        String title,
        String interpretation,
        List<ClusterEvidence> evidence,
        List<ClusterCandidate> candidates,
        List<String> missingEvidence,
        List<String> alternatives,
        String displayTitle
    ) {
        public ClinicalCluster(String title, String interpretation, List<ClusterEvidence> evidence,
                List<ClusterCandidate> candidates, List<String> missingEvidence, List<String> alternatives) {
            this(title, interpretation, evidence, candidates, missingEvidence, alternatives, null);
        }

        public ClinicalCluster {
            evidence = evidence == null ? List.of() : List.copyOf(evidence);
            candidates = candidates == null ? List.of() : List.copyOf(candidates);
            missingEvidence = missingEvidence == null ? List.of() : List.copyOf(missingEvidence);
            alternatives = alternatives == null ? List.of() : List.copyOf(alternatives);
        }
    }

    public record ClusterEvidence(UUID observationId, String role, String clinicalRelevance, String supportEligibility) {
        public ClusterEvidence(UUID observationId, String role, String clinicalRelevance) {
            this(observationId, role, clinicalRelevance, null);
        }
    }

    public record ClusterCandidate(
        String name,
        String rationale,
        List<UUID> supportingObservationIds,
        List<UUID> contradictoryObservationIds,
        List<String> missingEvidence,
        List<String> alternatives,
        String supportLevel
    ) {
        public ClusterCandidate {
            supportingObservationIds = supportingObservationIds == null ? List.of() : List.copyOf(supportingObservationIds);
            contradictoryObservationIds = contradictoryObservationIds == null ? List.of() : List.copyOf(contradictoryObservationIds);
            missingEvidence = missingEvidence == null ? List.of() : List.copyOf(missingEvidence);
            alternatives = alternatives == null ? List.of() : List.copyOf(alternatives);
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
