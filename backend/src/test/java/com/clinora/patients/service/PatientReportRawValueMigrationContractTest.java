package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class PatientReportRawValueMigrationContractTest {

    @Test
    void additiveMigrationPreservesExactOcrResultText() throws IOException {
        String sql = Files.readString(Path.of(
            "src/main/resources/db/migration/V25__preserve_medical_report_observation_raw_value.sql"
        ));

        assertTrue(sql.contains("ADD COLUMN ocr_raw_value VARCHAR(400)"));
        assertTrue(sql.contains("before numeric normalization"));
    }
}
