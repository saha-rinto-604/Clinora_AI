package com.clinora.doctors.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class DoctorDevelopmentSeederContractTest {
    @Test
    void exposesTwelveStableReservedDoctorLogins() {
        List<String> emails = DoctorDevelopmentSeeder.fixtureDoctorEmails();

        assertEquals(12, emails.size());
        assertEquals(12, Set.copyOf(emails).size());
        assertTrue(emails.stream().allMatch(email -> email.endsWith("@clinora.test")));
    }

    @Test
    void keepsTheExpectedWorkspaceCompletionMatrix() {
        assertEquals(
            List.of(60, 65, 70, 75, 80, 80, 85, 85, 90, 90, 95, 100),
            DoctorDevelopmentSeeder.fixtureCompletionTargets()
        );
    }
}
