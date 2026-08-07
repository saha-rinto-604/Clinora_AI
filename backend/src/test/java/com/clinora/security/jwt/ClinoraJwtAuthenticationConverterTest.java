package com.clinora.security.jwt;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

class ClinoraJwtAuthenticationConverterTest {

    @Test
    void mapsRoleClaimToSpringRoleAuthority() {
        Jwt jwt = new Jwt(
            "token",
            Instant.now(),
            Instant.now().plusSeconds(60),
            Map.of("alg", "HS256"),
            Map.of("sub", "user-id", "role", "SYSTEM_ADMIN")
        );

        AbstractAuthenticationToken authentication = new ClinoraJwtAuthenticationConverter().convert(jwt);

        assertEquals("user-id", authentication.getName());
        assertEquals("ROLE_SYSTEM_ADMIN", authentication.getAuthorities().iterator().next().getAuthority());
    }
}
