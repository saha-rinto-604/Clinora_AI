package com.clinora.security.jwt;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.clinora.config.AuthProperties;
import com.clinora.config.SecurityFoundationConfig;
import com.clinora.users.domain.UserRole;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;

class AccessTokenServiceTest {

    @Test
    void issuesSignedJwtWithMinimalClinoraClaims() {
        AuthProperties properties = new AuthProperties();
        properties.setIssuer("clinora-test");
        properties.setAccessTokenTtl(Duration.ofMinutes(15));
        properties.setJwtSecret("test-only-clinora-secret-that-is-long-enough-1234567890");

        SecurityFoundationConfig configuration = new SecurityFoundationConfig();
        SecretKey key = configuration.jwtSecretKey(properties);
        JwtEncoder encoder = configuration.jwtEncoder(key);
        JwtDecoder decoder = configuration.jwtDecoder(key, properties);
        Instant now = Instant.now();
        AccessTokenService service = new AccessTokenService(
            encoder,
            properties,
            Clock.fixed(now, ZoneOffset.UTC)
        );

        UUID userId = UUID.randomUUID();
        AccessTokenService.IssuedAccessToken issued = service.issue(userId, UserRole.DOCTOR);
        Jwt jwt = decoder.decode(issued.token());

        assertEquals(userId.toString(), jwt.getSubject());
        assertEquals("DOCTOR", jwt.getClaimAsString("role"));
        assertEquals("clinora-test", jwt.getClaimAsString("iss"));
        assertEquals(now.plus(Duration.ofMinutes(15)), issued.expiresAt());
    }
}
