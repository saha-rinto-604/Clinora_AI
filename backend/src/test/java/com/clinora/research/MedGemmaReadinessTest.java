package com.clinora.research;

import com.clinora.ai.client.MedGemmaClient;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;

class MedGemmaReadinessTest {
    @Test
    void onlyActualReadyResponseIsAcceptedAndFailuresAreSafe() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        int[] status = {200};
        String[] body = {"{\"status\":\"READY\"}"};
        server.createContext("/ready", exchange -> {
            assertEquals("test-token", exchange.getRequestHeaders().getFirst("X-Clinora-Internal-Token"));
            byte[] data = body[0].getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status[0], data.length);
            exchange.getResponseBody().write(data);
            exchange.close();
        });
        server.start();
        var client = new MedGemmaClient(RestClient.builder(), "http://127.0.0.1:" + server.getAddress().getPort(),
            "test-token", 1000, 30000, 3000);
        try {
            assertTrue(client.isInferenceRuntimeReady());
            body[0] = "{\"status\":\"UP\"}";
            assertFalse(client.isInferenceRuntimeReady());
            body[0] = "invalid";
            assertFalse(client.isInferenceRuntimeReady());
            status[0] = 503;
            assertFalse(client.isInferenceRuntimeReady());
        } finally { server.stop(0); }
        assertFalse(client.isInferenceRuntimeReady());
    }
}
