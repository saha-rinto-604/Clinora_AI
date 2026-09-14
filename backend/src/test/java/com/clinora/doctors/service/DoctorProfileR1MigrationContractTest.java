package com.clinora.doctors.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class DoctorProfileR1MigrationContractTest {
    @Test
    void v23SeparatesMutablePresentationFromVerifiedApplicationEvidence() throws IOException {
        try (var stream = getClass().getClassLoader().getResourceAsStream(
            "db/migration/V23__create_professional_profiles_and_profile_images.sql"
        )) {
            assertNotNull(stream);
            String sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8);

            assertTrue(sql.contains("ALTER TABLE doctor_booking_profiles"));
            assertTrue(sql.contains("professional_bio"));
            assertTrue(sql.contains("professional_profile_url"));
            assertTrue(sql.contains("preferred_timezone"));
            assertTrue(sql.contains("default_consultation_minutes"));
            assertTrue(sql.contains("profile_version"));
            assertTrue(sql.contains("CREATE TABLE user_profile_images"));
            assertTrue(sql.contains("REFERENCES users(id) ON DELETE CASCADE"));
            assertTrue(sql.contains("image/jpeg"));
            assertTrue(sql.contains("image/png"));
            assertTrue(sql.contains("image/webp"));
            assertTrue(sql.contains("size_bytes <= 5242880"));

            // R1 must not turn approved signup credentials into mutable profile columns.
            assertFalse(sql.contains("ALTER TABLE doctor_application_details"));
            assertFalse(sql.contains("ALTER TABLE doctor_qualifications"));
            assertFalse(sql.contains("ALTER TABLE application_documents"));
        }
    }
}
