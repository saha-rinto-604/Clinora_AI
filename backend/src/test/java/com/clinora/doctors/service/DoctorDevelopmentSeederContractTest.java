package com.clinora.doctors.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.patients.storage.PatientReportStoragePort;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.password.PasswordEncoder;

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

    @Test
    @SuppressWarnings("unchecked")
    void reusesSlotIdAlreadyAssignedToTheSameDoctorAndTimeRange() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorDevelopmentSeeder seeder = seeder(jdbc);
        UUID requestedId = UUID.randomUUID();
        UUID existingId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-09-21T08:00:00Z");
        Instant endsAt = Instant.parse("2026-09-21T08:30:00Z");
        Instant now = Instant.parse("2026-09-21T06:00:00Z");

        when(jdbc.query(
            contains("WHERE doctor_user_id = ? AND starts_at = ? AND ends_at = ?"),
            any(RowMapper.class),
            eq(doctorId),
            eq(Timestamp.from(startsAt)),
            eq(Timestamp.from(endsAt))
        )).thenReturn(List.of(existingId));

        UUID resolvedId = seeder.upsertSlot(requestedId, doctorId, startsAt, endsAt, "BOOKED", now);

        assertEquals(existingId, resolvedId);
        verify(jdbc).update(
            contains("UPDATE doctor_availability_slots"),
            eq("BOOKED"),
            eq(Timestamp.from(now)),
            eq(existingId)
        );
        verify(jdbc, never()).queryForObject(contains("INSERT INTO doctor_availability_slots"), eq(UUID.class), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void returnsRequestedSlotIdWhenNoMatchingNaturalKeyExists() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorDevelopmentSeeder seeder = seeder(jdbc);
        UUID requestedId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        Instant startsAt = Instant.parse("2026-09-21T08:00:00Z");
        Instant endsAt = Instant.parse("2026-09-21T08:30:00Z");
        Instant now = Instant.parse("2026-09-21T06:00:00Z");

        when(jdbc.query(anyString(), any(RowMapper.class), any(), any(), any())).thenReturn(List.of());
        when(jdbc.queryForObject(
            contains("INSERT INTO doctor_availability_slots"),
            eq(UUID.class),
            eq(requestedId),
            eq(doctorId),
            eq(Timestamp.from(startsAt)),
            eq(Timestamp.from(endsAt)),
            eq("AVAILABLE"),
            eq(Timestamp.from(now.minusSeconds(3 * 24 * 60 * 60))),
            eq(Timestamp.from(now))
        )).thenReturn(requestedId);

        assertEquals(requestedId, seeder.upsertSlot(requestedId, doctorId, startsAt, endsAt, "AVAILABLE", now));
    }

    private DoctorDevelopmentSeeder seeder(JdbcTemplate jdbc) {
        return new DoctorDevelopmentSeeder(
            jdbc,
            mock(PasswordEncoder.class),
            mock(ApplicationDocumentStoragePort.class),
            mock(PatientReportStoragePort.class),
            Clock.fixed(Instant.parse("2026-09-21T06:00:00Z"), ZoneOffset.UTC),
            "doctor-password",
            "patient-password"
        );
    }
}
