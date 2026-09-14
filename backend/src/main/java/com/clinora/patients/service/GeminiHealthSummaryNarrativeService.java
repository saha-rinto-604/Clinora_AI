package com.clinora.patients.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Optional de-identified language layer for the Personal Health Briefing. */
@Service
public class GeminiHealthSummaryNarrativeService {
    private static final Logger LOGGER = LoggerFactory.getLogger(GeminiHealthSummaryNarrativeService.class);
    private static final String DEFAULT_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
    private static final int MAX_TEXT_CHARS = 2_400;
    private static final int MAX_THEMES = 5;
    private static final int MAX_ITEMS = 5;
    private static final int MAX_QUESTIONS = 4;
    private static final int MAX_LIMITATIONS = 6;
    private static final int MAX_CACHE_ENTRIES = 256;
    private static final int MAX_OUTPUT_TOKENS = 3_072;
    private static final Pattern NUMBER = Pattern.compile("(?<![A-Za-z])[-+]?\\d+(?:\\.\\d+)?");
    private static final List<Pattern> PROHIBITED_OUTPUT = List.of(
        Pattern.compile("\\bthe diagnosis is\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\byou (?:definitely|certainly) have\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\bstart taking\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\bstop taking\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\bchange your dose\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\bi prescribe\\b", Pattern.CASE_INSENSITIVE)
    );

    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final String apiBase;
    private final HttpTransport transport;
    private final ConcurrentHashMap<String, NarrativeResult> cache = new ConcurrentHashMap<>();

    @Autowired
    public GeminiHealthSummaryNarrativeService(
        ObjectMapper objectMapper,
        @Value("${clinora.health-summary.gemini.api-key:${GEMINI_API_KEY:}}") String apiKey,
        @Value("${clinora.health-summary.gemini.model:${GEMINI_MODEL:gemini-2.5-flash}}") String model,
        @Value("${clinora.health-summary.gemini.api-base-url:${GEMINI_API_BASE_URL:https://generativelanguage.googleapis.com/v1beta}}") String apiBase
    ) {
        this(objectMapper, apiKey, model, apiBase, defaultTransport());
    }

    GeminiHealthSummaryNarrativeService(ObjectMapper objectMapper, String apiKey, String model, String apiBase, HttpTransport transport) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = safeModel(model);
        this.apiBase = safeApiBase(apiBase);
        this.transport = transport;
    }

    public ProviderReadiness readiness() {
        return apiKey.isBlank() ? new ProviderReadiness("NOT_CONFIGURED", model, false) : new ProviderReadiness("CONFIGURED", model, true);
    }

    public NarrativeResult generate(NarrativeInput input) {
        return generate(input, false);
    }

    public NarrativeResult generate(NarrativeInput input, boolean forceRefresh) {
        if (input == null || input.evidence() == null || input.evidence().isEmpty()) return NarrativeResult.insufficientData();
        if (apiKey.isBlank()) return NarrativeResult.failed("NOT_CONFIGURED");
        try {
            String cacheKey = fingerprint(input);
            if (forceRefresh) cache.remove(cacheKey);
            else {
                NarrativeResult cached = cache.get(cacheKey);
                if (cached != null) return cached.withCached(true);
            }
            String instruction = instruction(objectMapper.writeValueAsString(input));
            ProviderResponse response = transport.post(endpoint(), apiKey, requestBody(instruction, true));
            if (schemaCompatibilityFailure(response)) response = transport.post(endpoint(), apiKey, requestBody(instruction, false));
            NarrativeResult result = parseProviderResponse(response, input);
            if ("AVAILABLE".equals(result.status())) {
                if (cache.size() >= MAX_CACHE_ENTRIES) cache.clear();
                cache.put(cacheKey, result);
            }
            return result;
        } catch (HttpTimeoutException timeout) {
            logFailure(null, "TIMEOUT");
            return NarrativeResult.failed("TIMEOUT");
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            logFailure(null, "NETWORK_ERROR");
            return NarrativeResult.failed("NETWORK_ERROR");
        } catch (Exception exception) {
            logFailure(null, "NETWORK_ERROR");
            return NarrativeResult.failed("NETWORK_ERROR");
        }
    }

    NarrativeResult parseProviderResponse(ProviderResponse response, NarrativeInput input) {
        if (response.statusCode() < 200 || response.statusCode() >= 300) return failed(response.statusCode(), reasonForStatus(response.statusCode()));
        try {
            if (response.body() == null || response.body().isBlank()) return failed(response.statusCode(), "EMPTY_RESPONSE");
            JsonNode root = objectMapper.readTree(response.body());
            if (root.has("error")) {
                int code = root.path("error").path("code").asInt(0);
                return failed(code > 0 ? code : response.statusCode(), code > 0 ? reasonForStatus(code) : "INVALID_RESPONSE");
            }
            String promptBlock = root.path("promptFeedback").path("blockReason").asText("");
            if (!promptBlock.isBlank()) return failed(response.statusCode(), safetyFinishReason(promptBlock) ? "SAFETY_BLOCKED" : "REQUEST_REJECTED");
            JsonNode candidates = root.path("candidates");
            if (!candidates.isArray() || candidates.isEmpty()) return failed(response.statusCode(), "EMPTY_RESPONSE");
            JsonNode candidate = candidates.path(0);
            String finishReason = candidate.path("finishReason").asText("");
            if (safetyFinishReason(finishReason)) return failed(response.statusCode(), "SAFETY_BLOCKED");
            if ("MAX_TOKENS".equalsIgnoreCase(finishReason)) return failed(response.statusCode(), "INVALID_RESPONSE");
            String text = candidateText(candidate.path("content").path("parts"));
            if (text.isBlank()) return failed(response.statusCode(), "EMPTY_RESPONSE");
            JsonNode parsed = objectMapper.readTree(stripFences(text));
            if (!validShape(parsed)) return failed(response.statusCode(), "INVALID_RESPONSE");

            Map<String, EvidenceFact> evidence = byEvidenceId(input.evidence());
            Map<String, ThemeCandidate> themeCandidates = byThemeId(input.themeCandidates());
            Map<String, InsightCandidate> stableCandidates = byItemId(input.stableCandidates());
            Map<String, InsightCandidate> followUpCandidates = byItemId(input.followUpCandidates());
            String overall = compact(parsed.path("overallHealthView").asText(""), MAX_TEXT_CHARS);
            if (overall.isBlank() || unsafe(overall) || !numbersAllowed(overall, allowedNumbers(input.evidence()))) {
                return failed(response.statusCode(), unsafe(overall) ? "SAFETY_BLOCKED" : "INVALID_RESPONSE");
            }
            List<NarrativeTheme> themes = themes(parsed.path("keyThemes"), themeCandidates, evidence);
            List<NarrativeItem> stable = candidateItems(parsed.path("stableContext"), stableCandidates, evidence, false, MAX_ITEMS);
            List<NarrativeItem> followUps = candidateItems(parsed.path("followUpItems"), followUpCandidates, evidence, false, MAX_ITEMS);
            List<NarrativeItem> questions = freeItems(parsed.path("visitQuestions"), evidence, true, MAX_QUESTIONS);
            List<String> limitations = strings(parsed.path("limitations"), MAX_LIMITATIONS, 360).stream().filter(value -> !unsafe(value)).toList();
            return new NarrativeResult("AVAILABLE", overall, themes, stable, followUps, questions, limitations, null, false);
        } catch (Exception exception) {
            return failed(response.statusCode(), "INVALID_RESPONSE");
        }
    }

    private NarrativeResult failed(int status, String reason) {
        logFailure(status, reason);
        return NarrativeResult.failed(reason);
    }

    private boolean validShape(JsonNode parsed) {
        return parsed.isObject() && parsed.path("overallHealthView").isTextual() && parsed.path("keyThemes").isArray()
            && parsed.path("stableContext").isArray() && parsed.path("followUpItems").isArray()
            && parsed.path("visitQuestions").isArray() && validStringArray(parsed.path("limitations"));
    }

    private List<NarrativeTheme> themes(JsonNode nodes, Map<String, ThemeCandidate> candidates, Map<String, EvidenceFact> evidence) {
        List<NarrativeTheme> result = new ArrayList<>();
        for (JsonNode node : nodes) {
            if (result.size() >= MAX_THEMES) break;
            if (!node.isObject()) continue;
            String id = compact(node.path("themeId").asText(""), 80);
            String description = compact(node.path("description").asText(""), 600);
            ThemeCandidate candidate = candidates.get(id);
            List<String> ids = evidenceIds(node.path("evidenceIds"));
            if (candidate == null || description.isBlank() || ids.isEmpty() || !candidate.evidenceIds().containsAll(ids)) continue;
            if (validEvidenceText(description, ids, evidence)) result.add(new NarrativeTheme(id, description, ids));
        }
        return List.copyOf(result);
    }

    private List<NarrativeItem> candidateItems(JsonNode nodes, Map<String, InsightCandidate> candidates, Map<String, EvidenceFact> evidence, boolean question, int limit) {
        List<NarrativeItem> result = new ArrayList<>();
        for (JsonNode node : nodes) {
            if (result.size() >= limit) break;
            if (!node.isObject()) continue;
            String id = compact(node.path("itemId").asText(""), 80);
            String value = compact(node.path("text").asText(""), 500);
            InsightCandidate candidate = candidates.get(id);
            List<String> ids = evidenceIds(node.path("evidenceIds"));
            if (candidate == null || value.isBlank() || ids.isEmpty() || !candidate.evidenceIds().containsAll(ids)) continue;
            if ((!question || value.endsWith("?")) && validEvidenceText(value, ids, evidence)) result.add(new NarrativeItem(id, value, ids));
        }
        return List.copyOf(result);
    }

    private List<NarrativeItem> freeItems(JsonNode nodes, Map<String, EvidenceFact> evidence, boolean question, int limit) {
        List<NarrativeItem> result = new ArrayList<>();
        for (JsonNode node : nodes) {
            if (result.size() >= limit) break;
            if (!node.isObject()) continue;
            String value = compact(node.path("text").asText(""), 500);
            List<String> ids = evidenceIds(node.path("evidenceIds"));
            if (value.isBlank() || ids.isEmpty() || (question && !value.endsWith("?"))) continue;
            if (validEvidenceText(value, ids, evidence)) result.add(new NarrativeItem("Q" + (result.size() + 1), value, ids));
        }
        return List.copyOf(result);
    }

    private boolean validEvidenceText(String value, List<String> ids, Map<String, EvidenceFact> evidence) {
        if (unsafe(value) || ids.stream().anyMatch(id -> !evidence.containsKey(id))) return false;
        return numbersAllowed(value, allowedNumbers(ids.stream().map(evidence::get).toList()));
    }

    private boolean numbersAllowed(String value, Set<String> allowed) {
        Matcher matcher = NUMBER.matcher(value.replaceAll("\\b\\d{4}-\\d{2}-\\d{2}\\b", ""));
        while (matcher.find()) if (!allowed.contains(normalizeNumber(matcher.group()))) return false;
        return true;
    }

    private Set<String> allowedNumbers(List<EvidenceFact> facts) {
        Set<String> result = new HashSet<>();
        for (EvidenceFact fact : facts) {
            collectNumbers(result, fact.displayValue());
            collectNumbers(result, fact.suppliedRange());
        }
        return result;
    }

    private void collectNumbers(Set<String> target, String value) {
        if (value == null) return;
        Matcher matcher = NUMBER.matcher(value);
        while (matcher.find()) target.add(normalizeNumber(matcher.group()));
    }

    private String normalizeNumber(String value) {
        try { return new java.math.BigDecimal(value).stripTrailingZeros().toPlainString(); }
        catch (NumberFormatException ignored) { return value; }
    }

    private Map<String, EvidenceFact> byEvidenceId(List<EvidenceFact> values) {
        Map<String, EvidenceFact> result = new LinkedHashMap<>();
        values.forEach(value -> result.put(value.evidenceId(), value));
        return result;
    }

    private Map<String, ThemeCandidate> byThemeId(List<ThemeCandidate> values) {
        Map<String, ThemeCandidate> result = new LinkedHashMap<>();
        if (values != null) values.forEach(value -> result.put(value.themeId(), value));
        return result;
    }

    private Map<String, InsightCandidate> byItemId(List<InsightCandidate> values) {
        Map<String, InsightCandidate> result = new LinkedHashMap<>();
        if (values != null) values.forEach(value -> result.put(value.itemId(), value));
        return result;
    }

    private List<String> evidenceIds(JsonNode node) {
        return validStringArray(node) ? strings(node, 12, 80) : List.of();
    }

    private String requestBody(String instruction, boolean includeSchema) throws Exception {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("temperature", 0.1);
        config.put("maxOutputTokens", MAX_OUTPUT_TOKENS);
        config.put("responseMimeType", "application/json");
        if (model.startsWith("gemini-2.5-")) config.put("thinkingConfig", Map.of("thinkingBudget", 0));
        if (includeSchema) config.put("responseSchema", responseSchema());
        return objectMapper.writeValueAsString(Map.of("contents", List.of(Map.of("parts", List.of(Map.of("text", instruction)))), "generationConfig", config));
    }

    private Map<String, Object> responseSchema() {
        Map<String, Object> textItem = objectSchema(Map.of(
            "itemId", Map.of("type", "string"), "text", Map.of("type", "string"),
            "evidenceIds", Map.of("type", "array", "items", Map.of("type", "string"))), List.of("itemId", "text", "evidenceIds"));
        Map<String, Object> questionItem = objectSchema(Map.of(
            "text", Map.of("type", "string"), "evidenceIds", Map.of("type", "array", "items", Map.of("type", "string"))), List.of("text", "evidenceIds"));
        Map<String, Object> themeItem = objectSchema(Map.of(
            "themeId", Map.of("type", "string"), "description", Map.of("type", "string"),
            "evidenceIds", Map.of("type", "array", "items", Map.of("type", "string"))), List.of("themeId", "description", "evidenceIds"));
        return objectSchema(Map.of(
            "overallHealthView", Map.of("type", "string"),
            "keyThemes", arraySchema(themeItem, MAX_THEMES), "stableContext", arraySchema(textItem, MAX_ITEMS),
            "followUpItems", arraySchema(textItem, MAX_ITEMS), "visitQuestions", arraySchema(questionItem, MAX_QUESTIONS),
            "limitations", arraySchema(Map.of("type", "string"), MAX_LIMITATIONS)),
            List.of("overallHealthView", "keyThemes", "stableContext", "followUpItems", "visitQuestions", "limitations"));
    }

    private Map<String, Object> objectSchema(Map<String, Object> properties, List<String> required) {
        return Map.of("type", "object", "properties", properties, "required", required);
    }

    private Map<String, Object> arraySchema(Map<String, Object> item, int max) {
        return Map.of("type", "array", "items", item, "maxItems", max);
    }

    private String instruction(String facts) {
        return """
            You are the Clinora Personal Health Briefing language layer. Use only the supplied deterministic candidates and evidence.
            Do not diagnose, prescribe, recommend medication changes, infer causes or urgency, invent values, change statuses or ranges,
            or infer chronology from an observation whose dateReliable value is false. An undated verified fact may be explained as part
            of the current health picture, but never as a trend or period-specific change. Exact numeric values in your words must occur
            in the evidence you reference. Do not introduce other numeric counts. Keep the overview to one or two concise paragraphs.
            Select no more than five strongest theme candidates. Reword stable and follow-up candidates without changing their meaning.
            Create two to four patient-friendly visit questions, each with supporting evidenceIds. Questions are discussion prompts, not
            instructions. Use calm, balanced, non-diagnostic language. Do not mention Gemini or the provider.

            Return JSON only with exactly this shape:
            {"overallHealthView":"...","keyThemes":[{"themeId":"...","description":"...","evidenceIds":["E1"]}],
            "stableContext":[{"itemId":"...","text":"...","evidenceIds":["E2"]}],
            "followUpItems":[{"itemId":"...","text":"...","evidenceIds":["E1"]}],
            "visitQuestions":[{"text":"...?","evidenceIds":["E1"]}],"limitations":["..."]}

            CLINORA_FACTS:
            """ + facts;
    }

    private URI endpoint() {
        return URI.create(apiBase + "/models/" + URLEncoder.encode(model, StandardCharsets.UTF_8) + ":generateContent");
    }

    private String fingerprint(NarrativeInput input) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        digest.update(model.getBytes(StandardCharsets.UTF_8));
        digest.update((byte) 0);
        digest.update(objectMapper.writeValueAsBytes(input));
        return HexFormat.of().formatHex(digest.digest());
    }

    private boolean schemaCompatibilityFailure(ProviderResponse response) {
        if (response.statusCode() != 400 || response.body() == null) return false;
        try {
            String message = objectMapper.readTree(response.body()).path("error").path("message").asText("").toLowerCase(Locale.ROOT);
            return message.contains("schema") || message.contains("responsemimetype") || message.contains("response mime") || message.contains("generationconfig");
        } catch (Exception ignored) { return false; }
    }

    private String candidateText(JsonNode parts) {
        if (!parts.isArray()) return "";
        StringBuilder result = new StringBuilder();
        for (JsonNode part : parts) if (!part.path("thought").asBoolean(false) && part.path("text").isTextual()) result.append(part.path("text").asText());
        return result.toString().trim();
    }

    private boolean validStringArray(JsonNode node) {
        if (!node.isArray()) return false;
        for (JsonNode item : node) if (!item.isTextual()) return false;
        return true;
    }

    private boolean safetyFinishReason(String reason) {
        return switch (reason.toUpperCase(Locale.ROOT)) {
            case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY" -> true;
            default -> false;
        };
    }

    private void logFailure(Integer status, String reason) {
        LOGGER.warn("Gemini health summary failed: status={} reason={} model={}", status == null ? "none" : status, reason, model);
    }

    private List<String> strings(JsonNode node, int limit, int maxChars) {
        if (!node.isArray()) return List.of();
        List<String> result = new ArrayList<>();
        for (JsonNode item : node) {
            if (result.size() >= limit) break;
            if (item.isTextual()) {
                String value = compact(item.asText(), maxChars);
                if (!value.isBlank()) result.add(value);
            }
        }
        return List.copyOf(result);
    }

    private boolean unsafe(String value) {
        return value != null && PROHIBITED_OUTPUT.stream().anyMatch(pattern -> pattern.matcher(value).find());
    }

    static String reasonForStatus(int status) {
        if (status == 401) return "AUTH_FAILED";
        if (status == 403) return "PERMISSION_DENIED";
        if (status == 404) return "MODEL_NOT_AVAILABLE";
        if (status == 429) return "RATE_LIMITED";
        if (status == 408 || status == 504) return "TIMEOUT";
        if (status >= 400 && status < 500) return "REQUEST_REJECTED";
        return "NETWORK_ERROR";
    }

    private static String compact(String value, int maxChars) {
        if (value == null) return "";
        String normalized = value.replaceAll("\\s+", " ").trim();
        return normalized.length() <= maxChars ? normalized : normalized.substring(0, maxChars).trim();
    }

    private static String stripFences(String value) {
        String result = value.trim();
        if (result.startsWith("```")) {
            result = result.replaceFirst("^```(?:json)?\\s*", "");
            result = result.replaceFirst("\\s*```$", "");
        }
        return result.trim();
    }

    private static String safeModel(String value) {
        String candidate = value == null ? "" : value.trim();
        return candidate.matches("[A-Za-z0-9._-]{1,100}") ? candidate : "gemini-2.5-flash";
    }

    private static String safeApiBase(String value) {
        String candidate = value == null ? "" : value.trim();
        return candidate.isBlank() || !candidate.startsWith("https://") ? DEFAULT_API_BASE : candidate.replaceAll("/+$", "");
    }

    private static HttpTransport defaultTransport() {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        return (endpoint, key, body) -> {
            HttpRequest request = HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(25))
                .header("Content-Type", "application/json").header("x-goog-api-key", key)
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return new ProviderResponse(response.statusCode(), response.body());
        };
    }

    @FunctionalInterface interface HttpTransport { ProviderResponse post(URI endpoint, String apiKey, String body) throws Exception; }
    record ProviderResponse(int statusCode, String body) { }
    public record ProviderReadiness(String status, String model, boolean configured) { }
    public record NarrativeInput(PeriodFacts period, SnapshotFacts snapshot, List<EvidenceFact> evidence,
        List<ThemeCandidate> themeCandidates, List<InsightCandidate> stableCandidates,
        List<InsightCandidate> followUpCandidates, List<String> deterministicLimitations) { }
    public record PeriodFacts(String label, String from, String to) { }
    public record SnapshotFacts(int verifiedReportsAvailable, int reliablyDatedReports, int dateUncertainVerifiedReports,
        int trackedVerifiedMeasurements, int healthAreasRepresented, int measurementsWithComparableHistory) { }
    public record EvidenceFact(String evidenceId, String healthArea, String name, String displayValue, String suppliedRange,
        String status, String clinicalDate, boolean dateReliable, boolean chronologyEligible) { }
    public record ThemeCandidate(String themeId, String title, String deterministicDescription, List<String> evidenceIds) { }
    public record InsightCandidate(String itemId, String deterministicText, List<String> evidenceIds) { }
    public record NarrativeTheme(String themeId, String description, List<String> evidenceIds) { }
    public record NarrativeItem(String itemId, String text, List<String> evidenceIds) { }
    public record NarrativeResult(String status, String overallHealthView, List<NarrativeTheme> keyThemes,
        List<NarrativeItem> stableContext, List<NarrativeItem> followUpItems, List<NarrativeItem> visitQuestions,
        List<String> limitations, String reason, boolean cached) {
        static NarrativeResult insufficientData() { return failed("INSUFFICIENT_DATA"); }
        static NarrativeResult failed(String reason) {
            return new NarrativeResult(reason, null, List.of(), List.of(), List.of(), List.of(), List.of(), reason, false);
        }
        NarrativeResult withCached(boolean value) {
            return new NarrativeResult(status, overallHealthView, keyThemes, stableContext, followUpItems, visitQuestions, limitations, reason, value);
        }
    }
}
