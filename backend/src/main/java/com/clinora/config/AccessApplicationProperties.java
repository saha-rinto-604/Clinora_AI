package com.clinora.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

@ConfigurationProperties(prefix = "clinora.access-applications")
public class AccessApplicationProperties {
    private Duration emailVerificationTtl = Duration.ofHours(24);
    private Duration portalLinkTtl = Duration.ofMinutes(30);
    private Duration sessionTtl = Duration.ofHours(24);
    private boolean cookieSecure;
    private String cookieSameSite = "Lax";
    private DataSize maxDocumentSize = DataSize.ofMegabytes(10);

    public Duration getEmailVerificationTtl() { return emailVerificationTtl; }
    public void setEmailVerificationTtl(Duration value) { this.emailVerificationTtl = value; }
    public Duration getPortalLinkTtl() { return portalLinkTtl; }
    public void setPortalLinkTtl(Duration value) { this.portalLinkTtl = value; }
    public Duration getSessionTtl() { return sessionTtl; }
    public void setSessionTtl(Duration value) { this.sessionTtl = value; }
    public boolean isCookieSecure() { return cookieSecure; }
    public void setCookieSecure(boolean value) { this.cookieSecure = value; }
    public String getCookieSameSite() { return cookieSameSite; }
    public void setCookieSameSite(String value) { this.cookieSameSite = value; }
    public DataSize getMaxDocumentSize() { return maxDocumentSize; }
    public void setMaxDocumentSize(DataSize value) { this.maxDocumentSize = value; }
}
