package com.clinora.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

@ConfigurationProperties(prefix = "clinora.access-applications")
public class AccessApplicationProperties {
    private Duration emailVerificationTtl = Duration.ofHours(24);
    private Duration portalLinkTtl = Duration.ofMinutes(30);
    private Duration accountActivationTtl = Duration.ofHours(48);
    private Duration sessionTtl = Duration.ofHours(8);
    private boolean cookieSecure;
    private String cookieSameSite = "Lax";
    private DataSize maxDocumentSize = DataSize.ofMegabytes(10);
    private Duration interviewDefaultDuration = Duration.ofMinutes(30);
    private List<Duration> interviewReminderOffsets = List.of(Duration.ofHours(24), Duration.ofHours(1));
    private long interviewReminderScanDelayMs = 60_000;
    private final RateLimits rateLimits = new RateLimits();

    public Duration getEmailVerificationTtl() { return emailVerificationTtl; }
    public void setEmailVerificationTtl(Duration value) { this.emailVerificationTtl = value; }
    public Duration getPortalLinkTtl() { return portalLinkTtl; }
    public void setPortalLinkTtl(Duration value) { this.portalLinkTtl = value; }
    public Duration getAccountActivationTtl() { return accountActivationTtl; }
    public void setAccountActivationTtl(Duration value) { this.accountActivationTtl = value; }
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
    public RateLimits getRateLimits() { return rateLimits; }

    public static class RateLimits {
        private Policy createIp = new Policy(10, Duration.ofHours(1));
        private Policy createEmail = new Policy(4, Duration.ofHours(1));
        private Policy verifyIp = new Policy(30, Duration.ofHours(1));
        private Policy accessLinkIp = new Policy(10, Duration.ofHours(1));
        private Policy accessLinkEmail = new Policy(8, Duration.ofHours(1));
        private Policy sessionIp = new Policy(30, Duration.ofHours(1));
        private Policy uploadApplication = new Policy(30, Duration.ofHours(1));
        private Policy submitApplication = new Policy(10, Duration.ofHours(1));

        public Policy getCreateIp() { return createIp; }
        public void setCreateIp(Policy createIp) { this.createIp = createIp; }
        public Policy getCreateEmail() { return createEmail; }
        public void setCreateEmail(Policy createEmail) { this.createEmail = createEmail; }
        public Policy getVerifyIp() { return verifyIp; }
        public void setVerifyIp(Policy verifyIp) { this.verifyIp = verifyIp; }
        public Policy getAccessLinkIp() { return accessLinkIp; }
        public void setAccessLinkIp(Policy accessLinkIp) { this.accessLinkIp = accessLinkIp; }
        public Policy getAccessLinkEmail() { return accessLinkEmail; }
        public void setAccessLinkEmail(Policy accessLinkEmail) { this.accessLinkEmail = accessLinkEmail; }
        public Policy getSessionIp() { return sessionIp; }
        public void setSessionIp(Policy sessionIp) { this.sessionIp = sessionIp; }
        public Policy getUploadApplication() { return uploadApplication; }
        public void setUploadApplication(Policy uploadApplication) { this.uploadApplication = uploadApplication; }
        public Policy getSubmitApplication() { return submitApplication; }
        public void setSubmitApplication(Policy submitApplication) { this.submitApplication = submitApplication; }
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
