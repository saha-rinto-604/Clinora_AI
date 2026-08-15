package com.clinora.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

@ConfigurationProperties(prefix = "clinora.access-applications")
public class AccessApplicationProperties {
    private Duration emailVerificationTtl = Duration.ofHours(24);
    private Duration portalLinkTtl = Duration.ofMinutes(30);
    private Duration sessionTtl = Duration.ofHours(8);
    private boolean cookieSecure;
    private String cookieSameSite = "Lax";
    private DataSize maxDocumentSize = DataSize.ofMegabytes(10);
    private Duration interviewDefaultDuration = Duration.ofMinutes(30);
    private List<Duration> interviewReminderOffsets = List.of(Duration.ofHours(24), Duration.ofHours(1));
    private long interviewReminderScanDelayMs = 60_000;

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
    public Duration getInterviewDefaultDuration() { return interviewDefaultDuration; }
    public void setInterviewDefaultDuration(Duration value) { this.interviewDefaultDuration = value; }
    public List<Duration> getInterviewReminderOffsets() { return interviewReminderOffsets; }
    public void setInterviewReminderOffsets(List<Duration> value) { this.interviewReminderOffsets = value; }
    public long getInterviewReminderScanDelayMs() { return interviewReminderScanDelayMs; }
    public void setInterviewReminderScanDelayMs(long value) { this.interviewReminderScanDelayMs = value; }
}
