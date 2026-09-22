package com.clinora.appointments.service;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class AppointmentConsultationMigrationContractTest {
    @Test
    void v27KeepsLegacyAvailabilityBookableWithoutInventingHistoricalAppointmentModes() throws IOException {
        try (var stream = getClass().getClassLoader().getResourceAsStream(
            "db/migration/V27__add_appointment_consultation_modes.sql"
        )) {
            assertNotNull(stream);
            String sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8)
                .replace("\r\n", "\n");

            assertTrue(sql.contains("consultation_mode VARCHAR(16) NOT NULL DEFAULT 'BOTH'"));
            assertTrue(sql.contains("ALTER TABLE appointments\n    ADD COLUMN consultation_mode VARCHAR(16),"));
            assertTrue(sql.contains("meeting_url VARCHAR(2048)"));
            assertTrue(sql.contains("meeting_link_updated_at TIMESTAMPTZ"));
            assertTrue(sql.contains("visit_location VARCHAR(500)"));
        }
    }
}
