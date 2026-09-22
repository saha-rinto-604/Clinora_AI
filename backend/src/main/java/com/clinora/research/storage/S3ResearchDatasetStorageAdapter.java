package com.clinora.research.storage;

import com.clinora.config.ResearchStorageProperties;
import jakarta.annotation.PostConstruct;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

@Component
public class S3ResearchDatasetStorageAdapter implements ResearchDatasetStoragePort {

    private static final Logger LOGGER = LoggerFactory.getLogger(S3ResearchDatasetStorageAdapter.class);

    private final S3Client s3Client;
    private final ResearchStorageProperties properties;
    private final AtomicBoolean bucketReady = new AtomicBoolean(false);

    public S3ResearchDatasetStorageAdapter(
            @Qualifier("researchDatasetS3Client") S3Client s3Client,
            ResearchStorageProperties properties
    ) {
        this.s3Client = s3Client;
        this.properties = properties;
    }

    @PostConstruct
    public void initializeBucket() {
        if (properties.isAutoCreateBucket()) {
            try {
                ensureBucket();
            } catch (Exception ex) {
                LOGGER.warn("Deferred research dataset bucket initialization due to connection: {}", ex.getMessage());
            }
        }
    }

    @Override
    public void put(String objectKey, byte[] bytes, String contentType) {
        ensureBucket();
        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(properties.getBucket())
                        .key(objectKey)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromBytes(bytes)
        );
    }

    @Override
    public StoredDataset get(String objectKey) {
        ensureBucket();
        var response = s3Client.getObjectAsBytes(
                GetObjectRequest.builder().bucket(properties.getBucket()).key(objectKey).build()
        );
        return new StoredDataset(response.asByteArray(), response.response().contentType());
    }

    @Override
    public boolean exists(String objectKey) {
        ensureBucket();
        try {
            s3Client.headObject(
                    HeadObjectRequest.builder().bucket(properties.getBucket()).key(objectKey).build()
            );
            return true;
        } catch (NoSuchKeyException exception) {
            return false;
        } catch (S3Exception exception) {
            if (exception.statusCode() == 404) return false;
            throw exception;
        }
    }

    @Override
    public void delete(String objectKey) {
        ensureBucket();
        s3Client.deleteObject(
                DeleteObjectRequest.builder().bucket(properties.getBucket()).key(objectKey).build()
        );
    }

    private void ensureBucket() {
        if (bucketReady.get()) return;
        try {
            s3Client.headBucket(HeadBucketRequest.builder().bucket(properties.getBucket()).build());
            bucketReady.set(true);
        } catch (NoSuchBucketException exception) {
            createBucket();
        } catch (S3Exception exception) {
            if (exception.statusCode() == 404) {
                createBucket();
            } else {
                LOGGER.warn("Research dataset S3 bucket check failed: {}", exception.getMessage());
            }
        } catch (Exception exception) {
            LOGGER.warn("Research dataset S3 bucket check encountered error: {}", exception.getMessage());
        }
    }

    private synchronized void createBucket() {
        if (bucketReady.get()) return;
        try {
            s3Client.createBucket(CreateBucketRequest.builder().bucket(properties.getBucket()).build());
            bucketReady.set(true);
            LOGGER.info("Created private research dataset S3 bucket: {}", properties.getBucket());
        } catch (BucketAlreadyExistsException | BucketAlreadyOwnedByYouException ignored) {
            bucketReady.set(true);
        } catch (Exception ex) {
            LOGGER.warn("Could not create research dataset bucket: {}", ex.getMessage());
        }
    }
}
