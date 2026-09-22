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
        assertTrue(source.contains("Patient-shared evidence ready"));
        assertTrue(source.contains("ROW_NUMBER() OVER"));
        assertTrue(source.contains("next_a.status = 'BOOKED'"));
        assertFalse(source.contains("\"UPCOMING\""));
        assertFalse(source.contains("Pending investigations"));
    }

    private String source(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8).replace("\r\n", "\n");
    }
}
