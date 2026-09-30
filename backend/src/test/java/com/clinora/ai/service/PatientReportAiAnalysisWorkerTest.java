package com.clinora.ai.service;

import static org.mockito.Mockito.*;

import com.clinora.ai.client.MedGemmaClient;
import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

class PatientReportAiAnalysisWorkerTest {
    static Stream<Arguments> failures() {
        return Stream.of(
            Arguments.of(new ResourceAccessException("request failed", new SocketTimeoutException("read timed out")), "AI_TIMEOUT"),
            Arguments.of(new ResourceAccessException("request failed", new IOException(new SocketTimeoutException())), "AI_TIMEOUT"),
            Arguments.of(new ResourceAccessException("request failed", new HttpTimeoutException("request timed out")), "AI_TIMEOUT"),
            Arguments.of(new ResourceAccessException("request failed", new ConnectException("connection refused")), "AI_SERVICE_UNAVAILABLE"),
            Arguments.of(new ResourceAccessException("request failed"), "AI_SERVICE_UNAVAILABLE"),
            Arguments.of(httpFailure(504), "AI_TIMEOUT"),
            Arguments.of(httpFailure(503), "AI_MODEL_UNAVAILABLE"),
            Arguments.of(httpFailure(502), "AI_RESPONSE_REJECTED"),
            Arguments.of(httpFailure(401), "AI_SERVICE_AUTH_FAILED")
        );
    }

    private static RestClientResponseException httpFailure(int status) {
        return new RestClientResponseException("request failed", status, "error", null, null, null);
    }

    @ParameterizedTest
    @MethodSource("failures")
    void classifiesFailureWithoutCompletingOrRetrying(Exception failure, String code) {
        var service = mock(PatientReportAiAnalysisService.class);
        var client = mock(MedGemmaClient.class);
        UUID id = UUID.randomUUID();
        var work = new PatientReportAiAnalysisService.WorkItem(id, UUID.randomUUID(), UUID.randomUUID(),
            UUID.randomUUID(), null, "model", "revision", "prompt", "schema", 0L);
        when(service.claim(id)).thenReturn(work);
        when(client.analyze(id, null)).thenThrow(failure);

        new PatientReportAiAnalysisWorker(service, client).process(id.toString());

        verify(service).fail(work, code);
        verify(service, never()).complete(any(), any());
        verify(client, times(1)).analyze(id, null);
    }
}
