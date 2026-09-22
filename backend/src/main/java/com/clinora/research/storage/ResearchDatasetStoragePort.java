package com.clinora.research.storage;

public interface ResearchDatasetStoragePort {
    void put(String objectKey, byte[] bytes, String contentType);
    StoredDataset get(String objectKey);
    boolean exists(String objectKey);
    void delete(String objectKey);

    record StoredDataset(byte[] bytes, String contentType) {}
}
