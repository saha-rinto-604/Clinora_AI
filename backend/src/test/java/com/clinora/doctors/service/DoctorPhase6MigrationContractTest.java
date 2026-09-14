package com.clinora.doctors.service;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class DoctorPhase6MigrationContractTest {
    @Test
    void v22KeepsDoctorReviewProvenanceInsideAppointmentPatientDoctorAndReportOwnership() throws IOException {
        try (var stream = getClass().getClassLoader().getResourceAsStream(
            "db/migration/V22__create_doctor_observation_reviews.sql"
        )) {
            assertNotNull(stream);
            String sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8);

            assertTrue(sql.contains("REFERENCES appointments(id, patient_user_id, doctor_user_id)"));
            assertTrue(sql.contains("REFERENCES patient_medical_reports(id, patient_user_id)"));
            assertTrue(sql.contains("REFERENCES appointment_report_shares(appointment_id, report_id, patient_user_id, doctor_user_id)"));
            assertTrue(sql.contains("REFERENCES medical_report_observations(id, extraction_result_id)"));
            assertTrue(sql.contains("REFERENCES medical_report_extraction_results(id, report_id)"));
            assertTrue(sql.contains("'CONFIRMED','DISAGREES','NEEDS_SOURCE_REVIEW'"));
            assertTrue(sql.contains("UNIQUE (observation_id, doctor_user_id, appointment_id)"));
        }
    }
}
