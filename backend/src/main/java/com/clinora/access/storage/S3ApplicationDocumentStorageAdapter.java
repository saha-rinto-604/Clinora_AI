package com.clinora.access.storage;

import com.clinora.config.ApplicationStorageProperties;
import jakarta.annotation.PostConstruct;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Component
public class S3ApplicationDocumentStorageAdapter implements ApplicationDocumentStoragePort {
    private final S3Client s3Client;
    private final ApplicationStorageProperties properties;
    private final AtomicBoolean bucketReady = new AtomicBoolean(false);

    public S3ApplicationDocumentStorageAdapter(S3Client applicationS3Client, ApplicationStorageProperties properties) {
        this.s3Client = applicationS3Client;
        this.properties = properties;
    }

    @PostConstruct
    public void initializeBucket() {
        if (properties.isAutoCreateBucket()) {
            ensureBucket();
        }
    }

    @Override
    public void put(String objectKey, byte[] bytes, String contentType) {
        ensureBucket();
        s3Client.putObject(PutObjectRequest.builder()
            .bucket(properties.getBucket()).key(objectKey).contentType(contentType).build(), RequestBody.fromBytes(bytes));
    }

    @Override
    public StoredObject get(String objectKey) {
        ensureBucket();
        var response = s3Client.getObjectAsBytes(GetObjectRequest.builder().bucket(properties.getBucket()).key(objectKey).build());
        return new StoredObject(response.asByteArray(), response.response().contentType());
    }

    @Override
    public void delete(String objectKey) {
        ensureBucket();
        s3Client.deleteObject(DeleteObjectRequest.builder().bucket(properties.getBucket()).key(objectKey).build());
    }

    private void ensureBucket() {
        if (bucketReady.get()) return;
        synchronized (bucketReady) {
            if (bucketReady.get()) return;
            try {
                s3Client.headBucket(HeadBucketRequest.builder().bucket(properties.getBucket()).build());
            } catch (NoSuchBucketException exception) {
                if (!properties.isAutoCreateBucket()) throw exception;
                s3Client.createBucket(CreateBucketRequest.builder().bucket(properties.getBucket()).build());
            } catch (software.amazon.awssdk.services.s3.model.S3Exception exception) {
                if (exception.statusCode() == 404 && properties.isAutoCreateBucket()) {
                    s3Client.createBucket(CreateBucketRequest.builder().bucket(properties.getBucket()).build());
                } else {
                    throw exception;
                }
            }
            bucketReady.set(true);
        }
    }
}
