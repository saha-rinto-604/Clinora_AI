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
}
