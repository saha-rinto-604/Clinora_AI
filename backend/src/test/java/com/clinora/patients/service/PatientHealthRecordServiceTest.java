package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.patients.domain.BloodGroup;
import com.clinora.patients.domain.PatientGender;
import com.clinora.patients.service.PatientHealthRecordService.CareAppointmentView;
import com.clinora.patients.service.PatientHealthRecordService.HealthRecordReportView;
import com.clinora.patients.service.PatientProfileService.EmergencyContactView;
import com.clinora.patients.service.PatientProfileService.PatientProfileView;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class PatientHealthRecordServiceTest {
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PROFILE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final Instant UPDATED_AT = Instant.parse("2026-08-31T08:00:00Z");

    @Test
    @SuppressWarnings("unchecked")
    void composesProtectedCurrentRecordFromRealSources() {
        PatientProfileService profiles = mock(PatientProfileService.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(profiles.profile(USER_ID)).thenReturn(populatedProfile());

        HealthRecordReportView report = new HealthRecordReportView(
            UUID.randomUUID(), "Complete blood count", "LAB_RESULTS", LocalDate.of(2026, 8, 30),
            "Clinora Laboratory", UPDATED_AT.minusSeconds(60), "MEDICAL_REPORT"
        );
        CareAppointmentView upcoming = new CareAppointmentView(
            UUID.randomUUID(), "BOOKED", UPDATED_AT.plusSeconds(3600), UPDATED_AT.plusSeconds(5400),
            "Dr. Anika Rahman", "Internal Medicine", "APPOINTMENT"
        );
        CareAppointmentView recent = new CareAppointmentView(
            UUID.randomUUID(), "COMPLETED", UPDATED_AT.minusSeconds(7200), UPDATED_AT.minusSeconds(5400),
            "Dr. Anika Rahman", "Internal Medicine", "APPOINTMENT"
        );
        when(jdbc.query(
            argThat(sql -> sql != null && sql.contains("FROM patient_medical_reports")),
            any(RowMapper.class),
            eq(USER_ID)
        )).thenReturn(List.of(report));
        when(jdbc.query(
            argThat(sql -> sql != null && sql.contains("a.status = 'BOOKED'")), any(RowMapper.class), eq(USER_ID)
        )).thenReturn(List.of(upcoming));
        when(jdbc.query(
            argThat(sql -> sql != null && sql.contains("a.status IN ('CANCELLED', 'COMPLETED')")),
            any(RowMapper.class),
            eq(USER_ID)
        )).thenReturn(List.of(recent));
        when(jdbc.queryForObject(
            argThat(sql -> sql != null && sql.contains("SELECT MAX(activity_at)")),
            any(RowMapper.class),
            eq(USER_ID),
            eq(USER_ID),
            eq(USER_ID),
            eq(USER_ID)
        )).thenReturn(UPDATED_AT);

        PatientHealthRecordService.HealthRecordView result = new PatientHealthRecordService(profiles, jdbc)
            .record(USER_ID);

        assertEquals("Grass pollen", result.clinicalEssentials().allergies().getFirst().name());
        assertEquals("PATIENT_PROFILE", result.clinicalEssentials().allergies().getFirst().sourceType());
        assertEquals(new BigDecimal("23.1"), result.currentMeasurements().bmi());
        assertEquals("MEDICAL_REPORT", result.recentReports().getFirst().sourceType());
        assertEquals(upcoming, result.care().nextAppointment());
        assertEquals(List.of(recent), result.care().recentAppointments());
        assertEquals("Family history recorded", result.background().familyMedicalHistory());
        assertEquals("PATIENT_PROFILE", result.background().sourceType());
        assertEquals(UPDATED_AT, result.lastUpdatedAt());
        verify(jdbc).query(
            argThat(sql -> sql != null && sql.contains("archived_at IS NULL")), any(RowMapper.class), eq(USER_ID)
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void returnsIntentionalEmptyCollectionsForAnEmptyProfileAndNoActivity() {
        PatientProfileService profiles = mock(PatientProfileService.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(profiles.profile(USER_ID)).thenReturn(emptyProfile());
        when(jdbc.query(any(String.class), any(RowMapper.class), eq(USER_ID))).thenReturn(List.of());
        when(jdbc.queryForObject(
            any(String.class), any(RowMapper.class), eq(USER_ID), eq(USER_ID), eq(USER_ID), eq(USER_ID)
        )).thenReturn(null);

        PatientHealthRecordService.HealthRecordView result = new PatientHealthRecordService(profiles, jdbc)
            .record(USER_ID);

        assertTrue(result.clinicalEssentials().allergies().isEmpty());
        assertTrue(result.recentReports().isEmpty());
        assertNull(result.care().nextAppointment());
        assertTrue(result.care().recentAppointments().isEmpty());
        assertNull(result.currentMeasurements().bmi());
        assertNull(result.lastUpdatedAt());
    }

    private static PatientProfileView populatedProfile() {
        return new PatientProfileView(
            PROFILE_ID, true, "Pia", "Patient", "patient@example.test", LocalDate.of(1990, 1, 1),
            PatientGender.FEMALE, BloodGroup.B_POSITIVE, "+8801700000000", "Dhaka, Bangladesh",
            new BigDecimal("165"), new BigDecimal("63"), "Family history recorded", "Exercises regularly",
            new EmergencyContactView("Rina Patient", "+8801800000000", "Sibling", true),
            List.of("Grass pollen"), List.of("Hypertension"), List.of("Amlodipine"), 100, List.of(), UPDATED_AT
        );
    }

    private static PatientProfileView emptyProfile() {
        return new PatientProfileView(
            null, false, "Pia", "Patient", "patient@example.test", null, null, null, null, null, null, null,
            null, null, new EmergencyContactView(null, null, null, false), List.of(), List.of(), List.of(), 0,
            List.of("Date of birth"), null
        );
    }
}
