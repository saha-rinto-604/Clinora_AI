package com.clinora.notifications.email;

import com.clinora.config.EmailProperties;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

@Component
@ConditionalOnProperty(name = "clinora.email.provider", havingValue = "resend")
public class ResendEmailDeliveryAdapter implements EmailDeliveryPort {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);
    private final WebClient webClient;
    private final EmailProperties emailProperties;

    public ResendEmailDeliveryAdapter(
        WebClient.Builder builder,
        EmailProperties emailProperties,
        org.springframework.core.env.Environment environment
    ) {
        this.emailProperties = emailProperties;
        String apiKey = environment.getProperty("RESEND_API_KEY", "");
        String apiBaseUrl = environment.getProperty("EMAIL_API_BASE_URL", "https://api.resend.com");
        if (apiKey.isBlank()) {
            throw new IllegalStateException("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
        }
        this.webClient = builder
            .baseUrl(apiBaseUrl)
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .build();
    }

    @Override
    public void send(TransactionalEmail email) {
        Map<String, Object> payload = Map.of(
            "from", emailProperties.getFrom(),
            "to", List.of(email.to()),
            "subject", email.subject(),
            "text", email.textBody(),
            "html", email.htmlBody()
        );

        try {
            webClient.post()
                .uri("/emails")
                .bodyValue(payload)
                .retrieve()
                .toBodilessEntity()
                .block(REQUEST_TIMEOUT);
        } catch (WebClientResponseException exception) {
            throw new EmailDeliveryException(
                "Transactional email provider rejected the request with status "
                    + exception.getStatusCode().value(),
                exception
            );
        } catch (RuntimeException exception) {
            throw new EmailDeliveryException("Transactional email delivery failed", exception);
        }
    }
}
