package com.clinora.security.token;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SecureTokenServiceTest {

    private final SecureTokenService service = new SecureTokenService();

    @Test
    void generatesRandomTokensAndStoresOnlyHashMaterial() {
        GeneratedSecureToken first = service.generate();
        GeneratedSecureToken second = service.generate();

        assertNotEquals(first.rawToken(), first.tokenHash());
        assertNotEquals(first.rawToken(), second.rawToken());
        assertEquals(first.tokenHash(), service.hash(first.rawToken()));
        assertTrue(service.hashesMatch(first.tokenHash(), service.hash(first.rawToken())));
        assertFalse(service.hashesMatch(first.tokenHash(), second.tokenHash()));
    }
}
