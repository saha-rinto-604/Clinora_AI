package com.clinora.blood.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class GoogleGeocodingService {

    private static final Logger log = LoggerFactory.getLogger(GoogleGeocodingService.class);

    private final RestClient client;
    private final String apiKey;

    public GoogleGeocodingService(RestClient.Builder builder, @Value("${clinora.maps.google-api-key:}") String apiKey) {
        this.client = builder.baseUrl("https://maps.googleapis.com").build();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    public boolean configured() {
        return !apiKey.isBlank();
    }

    public Optional<GeoPoint> geocode(String address) {
        if (!configured() || address == null || address.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode response = client.get()
                .uri(uri -> uri
                    .path("/maps/api/geocode/json")
                    .queryParam("address", address.trim())
                    .queryParam("components", "country:BD")
                    .queryParam("key", apiKey)
                    .build())
                .retrieve()
                .body(JsonNode.class);
            if (response == null || !"OK".equals(response.path("status").asText())) {
                return Optional.empty();
            }
            JsonNode first = response.path("results").path(0);
            JsonNode location = first.path("geometry").path("location");
            if (!location.has("lat") || !location.has("lng")) {
                return Optional.empty();
            }
            return Optional.of(new GeoPoint(
                location.path("lat").asDouble(),
                location.path("lng").asDouble(),
                first.path("formatted_address").asText(address.trim())
            ));
        } catch (RestClientException | IllegalArgumentException exception) {
            log.warn("Google geocoding request failed: {}", exception.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    public record GeoPoint(double latitude, double longitude, String formattedAddress) {}
}
