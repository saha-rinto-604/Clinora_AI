package com.clinora.config;

import java.net.URI;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

@Configuration
public class ApplicationStorageConfig {
    @Bean
    public S3Client applicationS3Client(ApplicationStorageProperties properties) {
        return S3Client.builder()
            .endpointOverride(URI.create(properties.getEndpoint()))
            .region(Region.of(properties.getRegion()))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(properties.getAccessKey(), properties.getSecretKey())))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(properties.isPathStyle()).build())
            .build();
    }
}
