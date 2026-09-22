package com.clinora.consultations.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class ConsultationAccessServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-22T10:00:00Z");

    @Test
    @SuppressWarnings("unchecked")
    void inProgressConsultationKeepsAppointmentScopedEvidenceAvailableAfterScheduledEnd() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID doctorId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        when(jdbc.queryForObject(any(String.class), eq(Integer.class), eq(doctorId))).thenReturn(1);
        when(jdbc.query(
            contains("FROM appointments"),
            any(RowMapper.class),
            eq(appointmentId),
            eq(doctorId)
        )).thenReturn(List.of(new DoctorClinicalAccessService.AppointmentAccess(
            appointmentId,
            patientId,
            doctorId,
            "BOOKED",
            NOW.minusSeconds(3600),
            NOW.minusSeconds(60),
            "Asia/Dhaka"
        )));
        when(jdbc.queryForObject(
            contains("FROM doctor_consultations"),
            eq(Boolean.class),
            eq(appointmentId),
            eq(doctorId)
        )).thenReturn(true);

        DoctorClinicalAccessService access = new DoctorClinicalAccessService(
            jdbc,
            Clock.fixed(NOW, ZoneOffset.UTC)
        );

        assertDoesNotThrow(() -> access.requireActiveOwnedAppointment(doctorId, appointmentId));
    }

    @Test
    @SuppressWarnings("unchecked")
    void expiredAppointmentWithoutInProgressConsultationClosesEvidenceAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID doctorId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        when(jdbc.queryForObject(any(String.class), eq(Integer.class), eq(doctorId))).thenReturn(1);
        when(jdbc.query(
            contains("FROM appointments"),
            any(RowMapper.class),
            eq(appointmentId),
            eq(doctorId)
        )).thenReturn(List.of(new DoctorClinicalAccessService.AppointmentAccess(
            appointmentId,
            patientId,
            doctorId,
            "BOOKED",
            NOW.minusSeconds(3600),
            NOW.minusSeconds(60),
            "Asia/Dhaka"
        )));
        when(jdbc.queryForObject(
            contains("FROM doctor_consultations"),
            eq(Boolean.class),
            eq(appointmentId),
            eq(doctorId)
        )).thenReturn(false);

        DoctorClinicalAccessService access = new DoctorClinicalAccessService(
            jdbc,
            Clock.fixed(NOW, ZoneOffset.UTC)
        );

        DoctorApiException exception = assertThrows(
            DoctorApiException.class,
            () -> access.requireActiveOwnedAppointment(doctorId, appointmentId)
        );
        assertEquals("APPOINTMENT_NOT_ACTIVE", exception.getErrorCode());
    }
}
