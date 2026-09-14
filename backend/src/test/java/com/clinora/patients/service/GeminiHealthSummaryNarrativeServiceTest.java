package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.EvidenceFact;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.InsightCandidate;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.NarrativeInput;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.NarrativeResult;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.PeriodFacts;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.ProviderResponse;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.SnapshotFacts;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.ThemeCandidate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class GeminiHealthSummaryNarrativeServiceTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void configuredKeyBuildsSupportedGemini25FlashStructuredRequest() {
        GeminiHealthSummaryNarrativeService service = service("configured-key", (endpoint, key, body) -> {
            assertEquals(URI.create("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"), endpoint);
            assertEquals("configured-key", key);
            JsonNode config = JSON.readTree(body).path("generationConfig");
            assertEquals("application/json", config.path("responseMimeType").asText());
            assertEquals(3_072, config.path("maxOutputTokens").asInt());
            assertEquals(0, config.path("thinkingConfig").path("thinkingBudget").asInt());
            assertTrue(config.path("responseSchema").path("properties").path("keyThemes").isObject());
            return ok();
        });
        assertTrue(service.readiness().configured());
        assertEquals("AVAILABLE", service.generate(input()).status());
    }

    @Test
    void absentKeyDoesNotCallProvider() {
        NarrativeResult result = service("", (endpoint, key, body) -> { throw new AssertionError("provider called"); }).generate(input());
        assertEquals("NOT_CONFIGURED", result.status());
        assertNull(result.overallHealthView());
    }

    @Test
    void realCandidateShapeAndJsonModeAreParsed() throws Exception {
        String json = generated();
        ProviderResponse response = new ProviderResponse(200, JSON.writeValueAsString(Map.of("candidates", List.of(Map.of(
            "finishReason", "STOP", "content", Map.of("parts", List.of(
                Map.of("text", json.substring(0, json.length() / 2)), Map.of("text", json.substring(json.length() / 2)))))))));
        NarrativeResult result = service("key", unused()).parseProviderResponse(response, input());
        assertEquals("AVAILABLE", result.status());
        assertEquals("HbA1c is 6.8% (high), while TSH is 2.1 mIU/L (in range).", result.overallHealthView());
        assertEquals(1, result.keyThemes().size());
        assertEquals(2, result.visitQuestions().size());
    }

    @Test
    void schema400GetsOneJsonModeFallback() {
        AtomicInteger calls = new AtomicInteger();
        GeminiHealthSummaryNarrativeService service = service("key", (endpoint, key, body) -> {
            if (calls.incrementAndGet() == 1) return new ProviderResponse(400, "{\"error\":{\"code\":400,\"message\":\"Unsupported responseSchema\"}}");
            assertFalse(body.contains("responseSchema"));
            return ok();
        });
        assertEquals("AVAILABLE", service.generate(input()).status());
        assertEquals(2, calls.get());
    }

    @Test
    void nonSchema400DoesNotRetry() {
        AtomicInteger calls = new AtomicInteger();
        NarrativeResult result = service("key", (endpoint, key, body) -> {
            calls.incrementAndGet();
            return new ProviderResponse(400, "{\"error\":{\"code\":400,\"message\":\"Bad prompt\"}}");
        }).generate(input());
        assertEquals("REQUEST_REJECTED", result.status());
        assertEquals(1, calls.get());
    }

    @Test void authenticationFailure() { assertFailure(401, "AUTH_FAILED"); }
    @Test void permissionFailure() { assertFailure(403, "PERMISSION_DENIED"); }
    @Test void unavailableModel() { assertFailure(404, "MODEL_NOT_AVAILABLE"); }
    @Test void rateLimited() { assertFailure(429, "RATE_LIMITED"); }

    @Test
    void networkAndTimeoutAreDistinct() {
        assertEquals("NETWORK_ERROR", service("key", (e, k, b) -> { throw new IOException(); }).generate(input()).status());
        assertEquals("TIMEOUT", service("key", (e, k, b) -> { throw new HttpTimeoutException("timeout"); }).generate(input()).status());
    }

    @Test
    void safetyMalformedAndEmptyResponsesAreClassified() {
        GeminiHealthSummaryNarrativeService service = service("key", unused());
        assertEquals("SAFETY_BLOCKED", service.parseProviderResponse(new ProviderResponse(200,
            "{\"candidates\":[{\"finishReason\":\"SAFETY\",\"content\":{\"parts\":[]}}]}"), input()).status());
        assertEquals("INVALID_RESPONSE", service.parseProviderResponse(new ProviderResponse(200,
            "{\"candidates\":[{\"finishReason\":\"STOP\",\"content\":{\"parts\":[{\"text\":\"not json\"}]}}]}"), input()).status());
        assertEquals("EMPTY_RESPONSE", service.parseProviderResponse(new ProviderResponse(200, "{\"candidates\":[]}"), input()).status());
    }

    @Test
    void unknownEvidenceAndHallucinatedValuesArePrunedOrRejected() throws Exception {
        Map<String, Object> output = output();
        output.put("keyThemes", List.of(Map.of("themeId", "T-LABS", "description", "HbA1c is 99%.", "evidenceIds", List.of("UNKNOWN"))));
        ProviderResponse response = provider(output);
        NarrativeResult result = service("key", unused()).parseProviderResponse(response, input());
        assertEquals("AVAILABLE", result.status());
        assertTrue(result.keyThemes().isEmpty());

        output = output();
        output.put("overallHealthView", "HbA1c is 99%.");
        assertEquals("INVALID_RESPONSE", service("key", unused()).parseProviderResponse(provider(output), input()).status());
    }

    @Test
    void failedResponsesAreNeverCachedAndRefreshBypassesSuccessfulCache() {
        AtomicInteger failureCalls = new AtomicInteger();
        GeminiHealthSummaryNarrativeService failed = service("key", (e, k, b) -> {
            failureCalls.incrementAndGet(); return new ProviderResponse(429, "{\"error\":{\"code\":429}}");
        });
        failed.generate(input()); failed.generate(input());
        assertEquals(2, failureCalls.get());

        AtomicInteger successCalls = new AtomicInteger();
        GeminiHealthSummaryNarrativeService success = service("key", (e, k, b) -> { successCalls.incrementAndGet(); return ok(); });
        assertFalse(success.generate(input()).cached());
        assertTrue(success.generate(input()).cached());
        assertFalse(success.generate(input(), true).cached());
        assertEquals(2, successCalls.get());
    }

    @Test
    void zeroFactsIsInsufficientButUndatedVerifiedFactsCanGenerate() {
        NarrativeInput empty = new NarrativeInput(input().period(), new SnapshotFacts(0, 0, 0, 0, 0, 0), List.of(), List.of(), List.of(), List.of(), List.of());
        assertEquals("INSUFFICIENT_DATA", service("key", (e, k, b) -> { throw new AssertionError(); }).generate(empty).status());
        assertEquals("AVAILABLE", service("key", (e, k, b) -> {
            assertTrue(JSON.readTree(b).path("contents").path(0).path("parts").path(0).path("text").asText().contains("\"dateReliable\":false"));
            return ok();
        }).generate(input()).status());
    }

    @Test
    void minimizedPayloadContainsNoIdentityRawOcrOrSourceIds() {
        service("key", (e, k, body) -> {
            assertTrue(body.contains("HbA1c"));
            for (String forbidden : List.of("patientName", "email", "phone", "address", "accountId", "rawOcr", "storageKey", "reportId", "reportName")) {
                assertFalse(body.contains(forbidden));
            }
            return ok();
        }).generate(input());
    }

    private void assertFailure(int code, String reason) {
        NarrativeResult result = service("key", (e, k, b) -> new ProviderResponse(code, "{\"error\":{\"code\":" + code + "}}")).generate(input());
        assertEquals(reason, result.status());
    }

    private GeminiHealthSummaryNarrativeService service(String key, GeminiHealthSummaryNarrativeService.HttpTransport transport) {
        return new GeminiHealthSummaryNarrativeService(JSON, key, "gemini-2.5-flash", "https://generativelanguage.googleapis.com/v1beta", transport);
    }

    private GeminiHealthSummaryNarrativeService.HttpTransport unused() { return (e, k, b) -> { throw new AssertionError("unused"); }; }
    private ProviderResponse ok() throws Exception { return provider(output()); }
    private ProviderResponse provider(Map<String, Object> output) throws Exception {
        return new ProviderResponse(200, JSON.writeValueAsString(Map.of("candidates", List.of(Map.of("finishReason", "STOP",
            "content", Map.of("parts", List.of(Map.of("text", JSON.writeValueAsString(output)))))))));
    }
    private String generated() throws Exception { return JSON.writeValueAsString(output()); }

    private Map<String, Object> output() {
        Map<String, Object> output = new java.util.LinkedHashMap<>();
        output.put("overallHealthView", "HbA1c is 6.8% (high), while TSH is 2.1 mIU/L (in range).");
        output.put("keyThemes", List.of(Map.of("themeId", "T-LABS", "description", "HbA1c is 6.8% (high) and TSH is 2.1 mIU/L (in range).", "evidenceIds", List.of("E1", "E2"))));
        output.put("stableContext", List.of(Map.of("itemId", "S-E2", "text", "TSH is 2.1 mIU/L, within its supplied range.", "evidenceIds", List.of("E2"))));
        output.put("followUpItems", List.of(Map.of("itemId", "F-T-LABS", "text", "HbA1c of 6.8% may be worth discussing in clinical context.", "evidenceIds", List.of("E1"))));
        output.put("visitQuestions", List.of(
            Map.of("text", "How should my HbA1c of 6.8% be interpreted?", "evidenceIds", List.of("E1")),
            Map.of("text", "How should my TSH of 2.1 mIU/L be interpreted?", "evidenceIds", List.of("E2"))));
        output.put("limitations", List.of("The HbA1c clinical date is unavailable, so it is not used for chronology."));
        return output;
    }

    private NarrativeInput input() {
        return new NarrativeInput(
            new PeriodFacts("Last 12 months", "2025-09-15", "2026-09-15"),
            new SnapshotFacts(1, 0, 1, 2, 1, 0),
            List.of(
                new EvidenceFact("E1", "Laboratory", "HbA1c", "6.8%", "4.0-5.6", "HIGH", null, false, false),
                new EvidenceFact("E2", "Laboratory", "TSH", "2.1 mIU/L", "0.4-4.0", "IN_RANGE", "2026-09-10", true, true)),
            List.of(new ThemeCandidate("T-LABS", "Laboratory", "Related laboratory findings.", List.of("E1", "E2"))),
            List.of(new InsightCandidate("S-E2", "TSH is in range.", List.of("E2"))),
            List.of(new InsightCandidate("F-T-LABS", "HbA1c may deserve follow-up.", List.of("E1"))),
            List.of("One report has no reliable clinical date."));
    }
}
