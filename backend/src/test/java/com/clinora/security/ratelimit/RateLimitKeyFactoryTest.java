package com.clinora.security.ratelimit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.clinora.config.AuthProperties;
import org.junit.jupiter.api.Test;

class RateLimitKeyFactoryTest {

    @Test
    void doesNotPlaceRawSubjectIntoRedisKey() {
        AuthProperties properties = new AuthProperties();
        properties.setRateLimitKeySecret("test-rate-limit-secret-that-is-at-least-thirty-two-bytes");
        RateLimitKeyFactory factory = new RateLimitKeyFactory(properties);

        String first = factory.create("login-email", "doctor@example.com");
        String second = factory.create("login-email", "doctor@example.com");

        assertEquals(first, second);
        assertFalse(first.contains("doctor@example.com"));
    }
}
