package com.clinora.security.jwt;

import com.clinora.config.AuthProperties;
import com.clinora.users.domain.UserRole;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;

@Service
public class AccessTokenService {

    private final JwtEncoder jwtEncoder;
    private final AuthProperties authProperties;
    private final Clock clock;

    public AccessTokenService(JwtEncoder jwtEncoder, AuthProperties authProperties, Clock clock) {
        this.jwtEncoder = jwtEncoder;
        this.authProperties = authProperties;
        this.clock = clock;
    }

    public IssuedAccessToken issue(UUID userId, UserRole role) {
        Instant issuedAt = clock.instant();
        Instant expiresAt = issuedAt.plus(authProperties.getAccessTokenTtl());

        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer(authProperties.getIssuer())
            .subject(userId.toString())
            .id(UUID.randomUUID().toString())
            .issuedAt(issuedAt)
            .expiresAt(expiresAt)
            .claim("role", role.name())
            .build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256)
            .type("JWT")
            .build();

        Jwt jwt = jwtEncoder.encode(JwtEncoderParameters.from(header, claims));
        return new IssuedAccessToken(jwt.getTokenValue(), expiresAt);
    }

    public record IssuedAccessToken(String token, Instant expiresAt) {
    }
}
