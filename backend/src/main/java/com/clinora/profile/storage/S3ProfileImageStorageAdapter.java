package com.clinora.profile.storage;

import jakarta.annotation.PostConstruct;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
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
public class S3ProfileImageStorageAdapter implements ProfileImageStoragePort {
    private final S3Client s3Client;
    private final String bucket;
    private final boolean autoCreateBucket;
    private final AtomicBoolean bucketReady = new AtomicBoolean(false);

    public S3ProfileImageStorageAdapter(
        @Qualifier("applicationS3Client") S3Client applicationS3Client,
        @Value("${clinora.storage.profile-image.bucket:clinora-profile-images}") String bucket,
        @Value("${clinora.storage.profile-image.auto-create-bucket:${clinora.storage.application.auto-create-bucket:true}}") boolean autoCreateBucket
    ) {
        this.s3Client = applicationS3Client;
        this.bucket = bucket;
        this.autoCreateBucket = autoCreateBucket;
    }

    @PostConstruct
    public void initializeBucket() {
        if (autoCreateBucket) ensureBucket();
    }

    @Override
    public void put(String objectKey, byte[] bytes, String contentType) {
        ensureBucket();
        s3Client.putObject(
            PutObjectRequest.builder().bucket(bucket).key(objectKey).contentType(contentType).build(),
            RequestBody.fromBytes(bytes)
        );
    }

    @Override
    public StoredObject get(String objectKey) {
        ensureBucket();
        var response = s3Client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(objectKey).build());
        return new StoredObject(response.asByteArray(), response.response().contentType());
    }

    @Override
    public void delete(String objectKey) {
        ensureBucket();
        s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(objectKey).build());
    }

    private void ensureBucket() {
        if (bucketReady.get()) return;
        synchronized (bucketReady) {
            if (bucketReady.get()) return;
            try {
                s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
            } catch (NoSuchBucketException exception) {
                if (!autoCreateBucket) throw exception;
                s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
            } catch (software.amazon.awssdk.services.s3.model.S3Exception exception) {
                if (exception.statusCode() == 404 && autoCreateBucket) {
                    s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
                } else {
                    throw exception;
                }
            }
            bucketReady.set(true);
        }
    }
}
