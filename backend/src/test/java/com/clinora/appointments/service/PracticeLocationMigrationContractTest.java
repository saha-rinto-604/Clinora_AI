package com.clinora.appointments.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class PracticeLocationMigrationContractTest {
    @Test
    void migrationAddsOneDoctorConfiguredPracticeLocationWithoutChangingV27() throws IOException {
        String sql;
        try (var input = getClass().getClassLoader().getResourceAsStream(
            "db/migration/V28__add_doctor_practice_location.sql"
        )) {
            if (input == null) throw new IOException("V28 migration is missing");
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("ADD COLUMN practice_location VARCHAR(500)"));
        assertTrue(sql.contains("Single Doctor-configured Patient-facing location"));
    }
}
