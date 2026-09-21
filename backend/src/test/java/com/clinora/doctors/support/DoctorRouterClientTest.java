package com.clinora.doctors.support;

import com.clinora.ai.client.DoctorRouterException;
import com.clinora.ai.client.MedGemmaClient;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class DoctorRouterClientTest {
    private final Logger logger = (Logger) LoggerFactory.getLogger(MedGemmaClient.class);
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private MockRestServiceServer server;
    private MedGemmaClient client;
    private final MedGemmaClient.DoctorSupportRoutingRequest request = new MedGemmaClient.DoctorSupportRoutingRequest(
        UUID.randomUUID(), "DO_NOT_LOG_CLINICAL_TEXT", null, List.of());

    @BeforeEach
    void setUp() {
        logs.start();
        logger.addAppender(logs);
        var builder = spy(RestClient.builder());
        server = MockRestServiceServer.bindTo(builder).build();
        // Keep the mock transport when production creates independently bounded clients.
        doReturn(builder).when(builder).clone();
        doReturn(builder).when(builder).requestFactory(any());
        client = new MedGemmaClient(builder, "http://ai.test", "DO_NOT_LOG_TOKEN", 1000, 30000, 15000);
    }

    @AfterEach
    void tearDown() { logger.detachAppender(logs); logs.stop(); }

    @ParameterizedTest
    @CsvSource({
        "502,ROUTER_INVALID_RESPONSE,INVALID_ROUTER_CONTRACT,ROUTER_INVALID_RESPONSE,true",
        "502,ROUTER_INVALID_RESPONSE,UNKNOWN_ROUTER_TASK,ROUTER_INVALID_RESPONSE,true",
        "502,ROUTER_INVALID_RESPONSE,MALFORMED_ROUTER_JSON,ROUTER_INVALID_RESPONSE,false",
        "502,ROUTER_INVALID_RESPONSE,ROUTER_TRUNCATED,ROUTER_INVALID_RESPONSE,false",
        "502,OTHER,PROXY_ERROR,ROUTER_SERVICE_UNAVAILABLE,false",
        "503,ROUTER_MODEL_UNAVAILABLE,MODEL_UNAVAILABLE,ROUTER_MODEL_UNAVAILABLE,false",
        "503,OTHER,SERVICE_DOWN,ROUTER_SERVICE_UNAVAILABLE,false",
        "429,ROUTER_MODEL_BUSY,MODEL_CAPACITY,ROUTER_MODEL_BUSY,false",
        "504,ROUTER_TIMEOUT,MODEL_TIMEOUT,ROUTER_TIMEOUT,false",
        "401,ROUTER_AUTH_CONFIGURATION_ERROR,INTERNAL_AUTH_FAILED,ROUTER_AUTH_CONFIGURATION_ERROR,false",
        "422,OTHER,BAD_REQUEST,ROUTER_SERVICE_UNAVAILABLE,false"
    })
    void mapsDownstreamStatusesWithoutLeakingBodies(int status, String code, String reason,
        DoctorRouterException.Category category, boolean clarificationSafe) {
        server.expect(requestTo("http://ai.test/internal/v1/doctor-support/route"))
            .andExpect(header("X-Clinora-Internal-Token", "DO_NOT_LOG_TOKEN"))
            .andRespond(withStatus(HttpStatus.valueOf(status)).contentType(MediaType.APPLICATION_JSON)
                .body("{\"detail\":{\"errorCode\":\"" + code + "\",\"reasonCode\":\"" + reason
                    + "\",\"sensitive\":\"DO_NOT_LOG_RESPONSE\"}}"));
        var failure = assertThrows(DoctorRouterException.class, () -> client.routeDoctorSupport(request));
        assertEquals(category, failure.category());
        assertEquals(clarificationSafe, failure.clarificationSafe());
        String output = logs.list.stream().map(ILoggingEvent::getFormattedMessage).collect(java.util.stream.Collectors.joining("\n"));
        assertTrue(output.contains(request.requestId().toString()));
        assertTrue(output.contains("duration_ms="));
        assertTrue(output.contains("downstream_status=" + status));
        assertFalse(output.contains("DO_NOT_LOG"));
        assertTrue(logs.list.stream().allMatch(event -> event.getThrowableProxy() == null));
        server.verify();
    }

    @Test
    void connectionFailureIsDistinctFromTimeout() {
        server.expect(requestTo("http://ai.test/internal/v1/doctor-support/route"))
            .andRespond(withException(new ConnectException("DO_NOT_LOG")));
        server.expect(requestTo("http://ai.test/internal/v1/doctor-support/route"))
            .andRespond(withException(new SocketTimeoutException("DO_NOT_LOG")));
        assertEquals(DoctorRouterException.Category.ROUTER_CONNECTION_FAILURE,
            assertThrows(DoctorRouterException.class, () -> client.routeDoctorSupport(request)).category());
        assertEquals(DoctorRouterException.Category.ROUTER_TIMEOUT,
            assertThrows(DoctorRouterException.class, () -> client.routeDoctorSupport(request)).category());
        server.verify();
    }

    @Test
    void rejectsMalformedSuccessfulResponseWithoutClarificationFallback() {
        server.expect(requestTo("http://ai.test/internal/v1/doctor-support/route"))
            .andRespond(withSuccess("not JSON", MediaType.APPLICATION_JSON));
        var failure = assertThrows(DoctorRouterException.class, () -> client.routeDoctorSupport(request));
        assertEquals(DoctorRouterException.Category.ROUTER_INVALID_RESPONSE, failure.category());
        assertFalse(failure.clarificationSafe());
    }
}
