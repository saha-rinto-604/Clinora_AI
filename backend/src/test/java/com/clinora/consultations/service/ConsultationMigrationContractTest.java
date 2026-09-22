package com.clinora.consultations.service;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class ConsultationMigrationContractTest {
    @Test
    void v29SeparatesEncounterFromAppointmentAndEnforcesOneConsultationPerAppointment() throws IOException {
        String sql = migration("db/migration/V29__create_doctor_consultations.sql");

        assertTrue(sql.contains("appointment_id UUID NOT NULL UNIQUE"));
        assertTrue(sql.contains("status IN ('IN_PROGRESS', 'COMPLETED')"));
        assertTrue(sql.contains("FOREIGN KEY (appointment_id, patient_user_id, doctor_user_id)"));
        assertTrue(sql.contains("REFERENCES appointments(id, patient_user_id, doctor_user_id)"));
        assertTrue(sql.contains("status = 'COMPLETED' AND completed_at IS NOT NULL"));
    }

    @Test
    void v30KeepsCareActionsDoctorAuthoredAndConsultationScoped() throws IOException {
        String sql = migration("db/migration/V30__create_consultation_care_actions.sql");

        assertTrue(sql.contains("CREATE TABLE consultation_prescriptions"));
        assertTrue(sql.contains("CREATE TABLE consultation_investigations"));
        assertTrue(sql.contains("CREATE TABLE consultation_follow_ups"));
        assertTrue(sql.contains("priority IN ('ROUTINE', 'URGENT')"));
        assertTrue(sql.contains("consultation_id UUID NOT NULL UNIQUE REFERENCES doctor_consultations(id)"));
    }

    private String migration(String resource) throws IOException {
        try (var stream = getClass().getClassLoader().getResourceAsStream(resource)) {
            assertNotNull(stream);
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n");
        }
    }
}
