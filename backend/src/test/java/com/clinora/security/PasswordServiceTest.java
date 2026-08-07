package com.clinora.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class PasswordServiceTest {

    @Test
    void hashesPasswordsWithBcryptAndMatchesTheOriginal() {
        PasswordService service = new PasswordService(new BCryptPasswordEncoder(4));

        String rawPassword = "StrongPassword#123";
        String hash = service.hash(rawPassword);

        assertNotEquals(rawPassword, hash);
        assertTrue(service.matches(rawPassword, hash));
        assertFalse(service.matches("wrong-password", hash));
    }
}
