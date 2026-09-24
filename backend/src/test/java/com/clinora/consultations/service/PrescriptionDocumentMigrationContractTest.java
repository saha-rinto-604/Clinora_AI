package com.clinora.consultations.service;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class PrescriptionDocumentMigrationContractTest {
    @Test
    void prescriptionDocumentStorageIsBoundedVersionedAndSeparateFromPatientReports() throws IOException {
        String sql = migration("db/migration/V31__create_consultation_prescription_documents.sql");

        assertTrue(sql.contains("consultation_prescription_documents"));
        assertTrue(sql.contains("object_key VARCHAR(512) NOT NULL UNIQUE"));
        assertTrue(sql.contains("sha256_checksum CHAR(64) NOT NULL"));
        assertTrue(sql.contains("UNIQUE (consultation_id, position)"));
        assertTrue(sql.contains("UNIQUE (consultation_id, sha256_checksum)"));
        assertTrue(sql.contains("ON DELETE CASCADE"));
        assertTrue(!sql.contains("patient_medical_reports"));
    }

    private String migration(String resource) throws IOException {
        try (var stream = getClass().getClassLoader().getResourceAsStream(resource)) {
            assertNotNull(stream);
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n");
        }
    }
}
