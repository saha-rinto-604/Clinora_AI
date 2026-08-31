package com.clinora.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "clinora.storage.malware")
public class PatientReportSecurityProperties {
    private boolean enabled = false;
    private boolean failClosed = true;
    private String host = "localhost";
    private int port = 3310;
    private int timeoutMs = 5000;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public boolean isFailClosed() { return failClosed; }
    public void setFailClosed(boolean failClosed) { this.failClosed = failClosed; }
    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }
    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }
    public int getTimeoutMs() { return timeoutMs; }
    public void setTimeoutMs(int timeoutMs) { this.timeoutMs = timeoutMs; }
}

