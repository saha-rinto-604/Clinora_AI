package com.clinora.ocr.client;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class OcrClient {

    private final RestClient client;
    private final String internalToken;

    public OcrClient(
        RestClient.Builder builder,
        @Value("${clinora.services.ocr-url:http://localhost:8000}") String baseUrl,
        @Value("${clinora.services.ocr-token:dev-only-clinora-ocr-token-change-me}") String internalToken,
        @Value("${clinora.services.ocr-connect-timeout-ms:5000}") int connectTimeoutMs,
        @Value("${clinora.services.ocr-read-timeout-ms:210000}") int readTimeoutMs
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(Math.max(1000L, connectTimeoutMs)));
        requestFactory.setReadTimeout(Duration.ofMillis(Math.max(30000L, readTimeoutMs)));
        this.client = builder.requestFactory(requestFactory).baseUrl(baseUrl).build();
        this.internalToken = internalToken;
    }

    public ExtractionResponse extract(
        UUID requestId,
        byte[] bytes,
        String filename,
        String contentType
    ) {
        MultipartBodyBuilder parts = new MultipartBodyBuilder();
        ByteArrayResource resource = new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
        parts.part("file", resource).contentType(MediaType.parseMediaType(contentType));
        parts.part("requestId", requestId.toString());
        ExtractionResponse response = client.post()
            .uri("/internal/v1/extract")
            .header("X-Clinora-Internal-Token", internalToken)
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .body(parts.build())
            .retrieve()
            .body(ExtractionResponse.class);
        if (response == null) {
            throw new IllegalStateException("OCR service returned an empty response.");
        }
        return response;
    }

    public record ExtractionResponse(
        String engine,
        String engineVersion,
        String documentType,
        int pageCount,
        BigDecimal overallConfidence,
        String parserVersion,
        String normalizerVersion,
        List<Observation> observations,
        List<String> warnings
    ) {
    }

    public record Observation(
        String sourceLabel,
        String normalizedLabel,
        String valueType,
        BigDecimal numericValue,
        String textValue,
        String comparator,
        String unit,
        String referenceRangeRaw,
        BigDecimal referenceLow,
        BigDecimal referenceHigh,
        String sourceFlag,
        String derivedRangeFlag,
        int pageNumber,
        BoundingBox boundingBox,
        BigDecimal confidence,
        boolean reviewRequired
    ) {
    }

    public record BoundingBox(double x, double y, double width, double height) {
    }
}
