package com.clinora.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "clinora.auth")
public class AuthProperties {

    private String issuer = "clinora-ai";
    private Duration accessTokenTtl = Duration.ofMinutes(15);
    private Duration refreshTokenTtl = Duration.ofDays(7);
    private Duration emailVerificationTtl = Duration.ofHours(24);
    private Duration passwordResetTtl = Duration.ofMinutes(30);
    private boolean refreshCookieSecure;
    private String refreshCookieSameSite = "Lax";
    private String jwtSecret = "dev-only-clinora-jwt-secret-change-me-32-bytes";
    private String rateLimitKeySecret = "dev-only-clinora-rate-limit-key-change-me";
    private int bcryptStrength = 12;
    private final RateLimits rateLimits = new RateLimits();

    public String getIssuer() { return issuer; }
    public void setIssuer(String issuer) { this.issuer = issuer; }
    public Duration getAccessTokenTtl() { return accessTokenTtl; }
    public void setAccessTokenTtl(Duration accessTokenTtl) { this.accessTokenTtl = accessTokenTtl; }
    public Duration getRefreshTokenTtl() { return refreshTokenTtl; }
    public void setRefreshTokenTtl(Duration refreshTokenTtl) { this.refreshTokenTtl = refreshTokenTtl; }
    public Duration getEmailVerificationTtl() { return emailVerificationTtl; }
    public void setEmailVerificationTtl(Duration emailVerificationTtl) { this.emailVerificationTtl = emailVerificationTtl; }
    public Duration getPasswordResetTtl() { return passwordResetTtl; }
    public void setPasswordResetTtl(Duration passwordResetTtl) { this.passwordResetTtl = passwordResetTtl; }
    public boolean isRefreshCookieSecure() { return refreshCookieSecure; }
    public void setRefreshCookieSecure(boolean refreshCookieSecure) { this.refreshCookieSecure = refreshCookieSecure; }
    public String getRefreshCookieSameSite() { return refreshCookieSameSite; }
    public void setRefreshCookieSameSite(String refreshCookieSameSite) { this.refreshCookieSameSite = refreshCookieSameSite; }
    public String getJwtSecret() { return jwtSecret; }
    public void setJwtSecret(String jwtSecret) { this.jwtSecret = jwtSecret; }
    public String getRateLimitKeySecret() { return rateLimitKeySecret; }
    public void setRateLimitKeySecret(String rateLimitKeySecret) { this.rateLimitKeySecret = rateLimitKeySecret; }
    public int getBcryptStrength() { return bcryptStrength; }
    public void setBcryptStrength(int bcryptStrength) { this.bcryptStrength = bcryptStrength; }
    public RateLimits getRateLimits() { return rateLimits; }

    public static class RateLimits {
        private Policy registrationIp = new Policy(5, Duration.ofHours(1));
        private Policy registrationEmail = new Policy(3, Duration.ofHours(1));
        private Policy loginIp = new Policy(5, Duration.ofMinutes(1));
        private Policy loginEmail = new Policy(10, Duration.ofMinutes(15));
        private Policy forgotPasswordIp = new Policy(10, Duration.ofHours(1));
        private Policy forgotPasswordEmail = new Policy(3, Duration.ofHours(1));
        private Policy resendVerificationIp = new Policy(10, Duration.ofHours(1));
        private Policy resendVerificationEmail = new Policy(3, Duration.ofHours(1));
        private Policy refreshIp = new Policy(120, Duration.ofHours(1));

        public Policy getRegistrationIp() { return registrationIp; }
        public void setRegistrationIp(Policy registrationIp) { this.registrationIp = registrationIp; }
        public Policy getRegistrationEmail() { return registrationEmail; }
        public void setRegistrationEmail(Policy registrationEmail) { this.registrationEmail = registrationEmail; }
        public Policy getLoginIp() { return loginIp; }
        public void setLoginIp(Policy loginIp) { this.loginIp = loginIp; }
        public Policy getLoginEmail() { return loginEmail; }
        public void setLoginEmail(Policy loginEmail) { this.loginEmail = loginEmail; }
        public Policy getForgotPasswordIp() { return forgotPasswordIp; }
        public void setForgotPasswordIp(Policy forgotPasswordIp) { this.forgotPasswordIp = forgotPasswordIp; }
        public Policy getForgotPasswordEmail() { return forgotPasswordEmail; }
        public void setForgotPasswordEmail(Policy forgotPasswordEmail) { this.forgotPasswordEmail = forgotPasswordEmail; }
        public Policy getResendVerificationIp() { return resendVerificationIp; }
        public void setResendVerificationIp(Policy resendVerificationIp) { this.resendVerificationIp = resendVerificationIp; }
        public Policy getResendVerificationEmail() { return resendVerificationEmail; }
        public void setResendVerificationEmail(Policy resendVerificationEmail) { this.resendVerificationEmail = resendVerificationEmail; }
        public Policy getRefreshIp() { return refreshIp; }
        public void setRefreshIp(Policy refreshIp) { this.refreshIp = refreshIp; }
    }

    public static class Policy {
        private int limit;
        private Duration window;

        public Policy() {
        }

        public Policy(int limit, Duration window) {
            this.limit = limit;
            this.window = window;
        }

        public int getLimit() { return limit; }
        public void setLimit(int limit) { this.limit = limit; }
        public Duration getWindow() { return window; }
        public void setWindow(Duration window) { this.window = window; }
    }
}
