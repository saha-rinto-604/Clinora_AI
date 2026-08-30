package com.clinora.patients.storage;

public interface PatientReportStoragePort {
    void put(String objectKey, byte[] bytes, String contentType);
    StoredObject get(String objectKey);
    void delete(String objectKey);

    record StoredObject(byte[] bytes, String contentType) {
    }
}
