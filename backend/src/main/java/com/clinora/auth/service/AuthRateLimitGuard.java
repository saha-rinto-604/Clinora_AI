package com.clinora.auth.service;

import com.clinora.auth.api.AuthApiException;
import com.clinora.security.ratelimit.RateLimitDecision;
import com.clinora.security.ratelimit.RateLimitService;
import java.time.Duration;
import org.springframework.stereotype.Component;

@Component
public class AuthRateLimitGuard {

    private final RateLimitService rateLimitService;

    public AuthRateLimitGuard(RateLimitService rateLimitService) {
        this.rateLimitService = rateLimitService;
    }

    public void registration(String ip, String email) {
        enforce("auth-register-ip", ip, 5, Duration.ofHours(1));
        enforce("auth-register-email", email, 3, Duration.ofHours(1));
    }

    public void login(String ip, String email) {
        enforce("auth-login-ip", ip, 5, Duration.ofMinutes(1));
        enforce("auth-login-email", email, 10, Duration.ofMinutes(15));
    }

    public void forgotPassword(String ip, String email) {
        enforce("auth-forgot-ip", ip, 10, Duration.ofHours(1));
        enforce("auth-forgot-email", email, 3, Duration.ofHours(1));
    }

    public void resendVerification(String ip, String email) {
        enforce("auth-resend-ip", ip, 10, Duration.ofHours(1));
        enforce("auth-resend-email", email, 3, Duration.ofHours(1));
    }

    public void refresh(String ip) {
        enforce("auth-refresh-ip", ip, 120, Duration.ofHours(1));
    }

    private void enforce(String bucket, String subject, int limit, Duration window) {
        String safeSubject = subject == null || subject.isBlank() ? "unknown" : subject;
        RateLimitDecision decision = rateLimitService.consume(bucket, safeSubject, limit, window);
        if (!decision.allowed()) {
            throw AuthApiException.rateLimited(decision.retryAfter());
        }
    }
}
