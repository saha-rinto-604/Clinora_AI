package com.clinora.blood.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class GoogleRoutesService {

    private static final Logger log = LoggerFactory.getLogger(GoogleRoutesService.class);
    private static final String FIELD_MASK = "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline";

    private final RestClient client;
    private final String apiKey;

    public GoogleRoutesService(RestClient.Builder builder, @Value("${clinora.maps.google-api-key:}") String apiKey) {
        this.client = builder.baseUrl("https://routes.googleapis.com").build();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    public boolean configured() {
        return !apiKey.isBlank();
    }

    public Optional<RouteResult> drivingRoute(double originLat, double originLng, double destinationLat, double destinationLng) {
        if (!configured()) {
            return Optional.empty();
        }
        try {
            Map<String, Object> body = Map.of(
                "origin", waypoint(originLat, originLng),
                "destination", waypoint(destinationLat, destinationLng),
                "travelMode", "DRIVE",
                "routingPreference", "TRAFFIC_AWARE"
            );
            JsonNode response = client.post()
                .uri("/directions/v2:computeRoutes")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Goog-Api-Key", apiKey)
                .header("X-Goog-FieldMask", FIELD_MASK)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
            JsonNode route = response == null ? null : response.path("routes").path(0);
            if (route == null || route.isMissingNode() || !route.has("distanceMeters")) {
                return Optional.empty();
            }
            String encodedPolyline = route.path("polyline").path("encodedPolyline").asText("");
            if (encodedPolyline.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(new RouteResult(
                route.path("distanceMeters").asInt(),
                durationSeconds(route.path("duration").asText("0s")),
                encodedPolyline
            ));
        } catch (RestClientException | IllegalArgumentException exception) {
            log.warn("Google Routes request failed: {}", exception.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private Map<String, Object> waypoint(double latitude, double longitude) {
        return Map.of(
            "location", Map.of(
                "latLng", Map.of(
                    "latitude", latitude,
                    "longitude", longitude
                )
            )
        );
    }

    static long durationSeconds(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        String normalized = value.trim().endsWith("s")
            ? value.trim().substring(0, value.trim().length() - 1)
            : value.trim();
        try {
            return Math.max(0, Math.round(Double.parseDouble(normalized)));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    public record RouteResult(int distanceMeters, long durationSeconds, String encodedPolyline) {}
}
