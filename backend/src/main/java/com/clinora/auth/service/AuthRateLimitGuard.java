package com.clinora.auth.service;

import com.clinora.auth.api.AuthApiException;
import com.clinora.config.AuthProperties;
import com.clinora.config.AuthProperties.Policy;
import com.clinora.security.ratelimit.RateLimitDecision;
import com.clinora.security.ratelimit.RateLimitService;
import org.springframework.stereotype.Component;

@Component
public class AuthRateLimitGuard {

    private final RateLimitService rateLimitService;
    private final AuthProperties.RateLimits policies;

    public AuthRateLimitGuard(RateLimitService rateLimitService, AuthProperties authProperties) {
        this.rateLimitService = rateLimitService;
        this.policies = authProperties.getRateLimits();
    }

    public void registration(String ip, String email) {
        enforce("auth-register-ip", ip, policies.getRegistrationIp());
        enforce("auth-register-email", email, policies.getRegistrationEmail());
    }

    public void login(String ip, String email) {
        enforce("auth-login-ip", ip, policies.getLoginIp());
        enforce("auth-login-email", email, policies.getLoginEmail());
    }

    public void forgotPassword(String ip, String email) {
        enforce("auth-forgot-ip", ip, policies.getForgotPasswordIp());
        enforce("auth-forgot-email", email, policies.getForgotPasswordEmail());
    }

    public void resendVerification(String ip, String email) {
        enforce("auth-resend-ip", ip, policies.getResendVerificationIp());
        enforce("auth-resend-email", email, policies.getResendVerificationEmail());
    }

    public void refresh(String ip) {
        enforce("auth-refresh-ip", ip, policies.getRefreshIp());
    }

    private void enforce(String bucket, String subject, Policy policy) {
        String safeSubject = subject == null || subject.isBlank() ? "unknown" : subject;
        RateLimitDecision decision = rateLimitService.consume(bucket, safeSubject, policy.getLimit(), policy.getWindow());
        if (!decision.allowed()) {
            throw AuthApiException.rateLimited(decision.retryAfter());
        }
    }
}
