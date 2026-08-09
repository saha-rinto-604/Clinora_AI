package com.clinora.auth.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.clinora.auth.api.AuthApiException;
import org.junit.jupiter.api.Test;

class PasswordPolicyTest {

    private final PasswordPolicy policy = new PasswordPolicy();

    @Test
    void enforcesPhase4PasswordBaseline() {
        assertDoesNotThrow(() -> policy.validate("Strong#Pass1"));
        assertThrows(AuthApiException.class, () -> policy.validate("password"));
        assertThrows(AuthApiException.class, () -> policy.validate("PASSWORD1!"));
        assertThrows(AuthApiException.class, () -> policy.validate("Password!"));
        assertThrows(AuthApiException.class, () -> policy.validate("Password1"));
    }
}
