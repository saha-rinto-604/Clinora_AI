package com.clinora.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

@ConfigurationProperties(prefix = "clinora.storage")
public class PatientReportStorageProperties {
    private String endpoint = "http://localhost:9000";
    private String region = "us-east-1";
    private String bucket = "clinora-medical-reports";
    private String accessKey = "clinora-minio";
    private String secretKey = "change-me-minio";
    private boolean pathStyle = true;
    private boolean autoCreateBucket = true;
    private DataSize maxFileSize = DataSize.ofMegabytes(20);

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String value) { this.endpoint = value; }
    public String getRegion() { return region; }
    public void setRegion(String value) { this.region = value; }
    public String getBucket() { return bucket; }
    public void setBucket(String value) { this.bucket = value; }
    public String getAccessKey() { return accessKey; }
    public void setAccessKey(String value) { this.accessKey = value; }
    public String getSecretKey() { return secretKey; }
    public void setSecretKey(String value) { this.secretKey = value; }
    public boolean isPathStyle() { return pathStyle; }
    public void setPathStyle(boolean value) { this.pathStyle = value; }
    public boolean isAutoCreateBucket() { return autoCreateBucket; }
    public void setAutoCreateBucket(boolean value) { this.autoCreateBucket = value; }
    public DataSize getMaxFileSize() { return maxFileSize; }
    public void setMaxFileSize(DataSize value) { this.maxFileSize = value; }
}
