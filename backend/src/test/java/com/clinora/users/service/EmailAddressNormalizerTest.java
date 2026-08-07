package com.clinora.users.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class EmailAddressNormalizerTest {

    @Test
    void normalizesEmailForUniqueIdentityLookup() {
        EmailAddressNormalizer normalizer = new EmailAddressNormalizer();
        assertEquals("doctor@example.com", normalizer.normalize("  Doctor@Example.COM  "));
    }
}
