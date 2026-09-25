package com.clinora.consultations.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class DoctorCareWorkflowContractTest {
    @Test
    void patientsRequireRealCareOrCurrentBookingAndInboxRemainsActionOriented() throws IOException {
        String source = source("src/main/java/com/clinora/consultations/service/DoctorCareWorkflowService.java");

        assertTrue(source.contains("rel.status = 'BOOKED'"));
        assertTrue(source.contains("relc.status IN ('IN_PROGRESS', 'COMPLETED')"));
        assertTrue(source.contains("c.status = 'COMPLETED'"));
        assertTrue(source.contains("Appointment ready now"));
        assertTrue(source.contains("\"READY_NOW\""));
        assertTrue(source.contains("Scheduled consultation needs action"));
        assertTrue(source.contains("\"NEEDS_ACTION\""));
        assertTrue(source.contains("a.scheduled_start <= ?"));
        assertTrue(source.contains("a.scheduled_end >= ?"));
        assertTrue(source.contains("Patient-shared evidence ready"));
        assertTrue(source.contains("ROW_NUMBER() OVER"));
        assertTrue(source.contains("next_a.status = 'BOOKED'"));
        assertTrue(source.contains("next_a.scheduled_end >= CURRENT_TIMESTAMP - INTERVAL '30 days'"));
        assertTrue(source.contains("COALESCE(ip.appointment_id, na.appointment_id) AS context_appointment_id"));
        assertTrue(source.contains("COALESCE(ipa.consultation_mode, na.consultation_mode) AS context_appointment_mode"));
        assertTrue(source.contains("ORDER BY consultation_in_progress DESC"));
        assertFalse(source.contains("\"UPCOMING\""));
        assertFalse(source.contains("Pending investigations"));
    }

    private String source(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8).replace("\r\n", "\n");
    }
}
