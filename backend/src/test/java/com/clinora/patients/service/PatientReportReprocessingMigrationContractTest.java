package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class PatientReportReprocessingMigrationContractTest {

    @Test
    void migrationAddsProtectedExtractionComparisonAndVersionedAiHistory() throws IOException {
        String sql = Files.readString(Path.of(
            "src/main/resources/db/migration/V26__add_patient_report_reprocessing_history.sql"
        ));

        assertTrue(sql.contains("baseline_result_id"));
        assertTrue(sql.contains("medical_report_extraction_differences"));
        assertTrue(sql.contains("CHANGED', 'NEW', 'MISSING"));
        assertTrue(sql.contains("DROP INDEX uq_medical_report_ai_analysis_successful_input"));
        assertTrue(sql.contains("CREATE INDEX idx_medical_report_ai_analysis_successful_input"));
        assertFalse(sql.contains("DROP INDEX uq_medical_report_ai_analysis_active_job"));
    }
}
