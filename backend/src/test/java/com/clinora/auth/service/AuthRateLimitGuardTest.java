package com.clinora.auth.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.auth.api.AuthApiException;
import com.clinora.config.AuthProperties;
import com.clinora.security.ratelimit.RateLimitDecision;
import com.clinora.security.ratelimit.RateLimitService;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class AuthRateLimitGuardTest {

    @Test
    void usesConfigurablePolicyBucketsForSensitiveAuthEndpoints() {
        RateLimitService limits = Mockito.mock(RateLimitService.class);
        AuthProperties properties = new AuthProperties();
        properties.getRateLimits().getLoginIp().setLimit(7);
        properties.getRateLimits().getLoginIp().setWindow(Duration.ofSeconds(30));
        properties.getRateLimits().getLoginEmail().setLimit(11);
        properties.getRateLimits().getLoginEmail().setWindow(Duration.ofMinutes(20));
        when(limits.consume(Mockito.any(), Mockito.any(), Mockito.anyInt(), Mockito.any()))
            .thenReturn(new RateLimitDecision(true, 1, Duration.ZERO));

        AuthRateLimitGuard guard = new AuthRateLimitGuard(limits, properties);

        guard.login("127.0.0.1", "patient@example.test");
        guard.registration("127.0.0.1", "patient@example.test");
        guard.forgotPassword("127.0.0.1", "patient@example.test");
        guard.resendVerification("127.0.0.1", "patient@example.test");
        guard.refresh("127.0.0.1");

        verify(limits).consume("auth-login-ip", "127.0.0.1", 7, Duration.ofSeconds(30));
        verify(limits).consume("auth-login-email", "patient@example.test", 11, Duration.ofMinutes(20));
        verify(limits).consume("auth-register-ip", "127.0.0.1", 5, Duration.ofHours(1));
        verify(limits).consume("auth-register-email", "patient@example.test", 3, Duration.ofHours(1));
        verify(limits).consume("auth-forgot-ip", "127.0.0.1", 10, Duration.ofHours(1));
        verify(limits).consume("auth-forgot-email", "patient@example.test", 3, Duration.ofHours(1));
        verify(limits).consume("auth-resend-ip", "127.0.0.1", 10, Duration.ofHours(1));
        verify(limits).consume("auth-resend-email", "patient@example.test", 3, Duration.ofHours(1));
        verify(limits).consume("auth-refresh-ip", "127.0.0.1", 120, Duration.ofHours(1));
    }

    @Test
    void deniedRateLimitRaisesApiRateLimitError() {
        RateLimitService limits = Mockito.mock(RateLimitService.class);
        when(limits.consume(Mockito.any(), Mockito.any(), Mockito.anyInt(), Mockito.any()))
            .thenReturn(new RateLimitDecision(false, 0, Duration.ofMinutes(1)));

        AuthRateLimitGuard guard = new AuthRateLimitGuard(limits, new AuthProperties());

        assertThrows(AuthApiException.class, () -> guard.refresh("127.0.0.1"));
    }
}
