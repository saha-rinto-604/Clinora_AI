package com.clinora.appointments.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.notifications.service.DoctorNotificationService;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.service.PatientTimelineService;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class DoctorAvailabilityRangeTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UUID doctor = UUID.randomUUID();
    private final Instant from = Instant.parse("2026-09-24T00:00:00Z");
    private final Instant until = Instant.parse("2026-10-09T00:00:00Z");
    private final PatientAppointmentService service = new PatientAppointmentService(jdbc,
        mock(PatientTimelineService.class), mock(PatientNotificationService.class), mock(DoctorNotificationService.class), Clock.systemUTC());

    @Test void completeCalendarIsDoctorScopedBoundedAndNotTruncatedTo120Slots() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(doctor), eq("DOCTOR"))).thenReturn(1);
        var slots = IntStream.range(0, 160).mapToObj(i -> new PatientAppointmentService.AvailabilitySlotView(
            UUID.randomUUID(), doctor, from.plusSeconds(i * 1800L), from.plusSeconds((i + 1) * 1800L),
            "UTC", i % 2 == 0 ? "AVAILABLE" : "BOOKED", "BOTH")).toList();
        when(jdbc.query(anyString(), any(RowMapper.class), eq(doctor), eq(Timestamp.from(from)), eq(Timestamp.from(until))))
            .thenReturn(slots);
        assertEquals(slots, service.doctorAvailability(doctor, from, until));
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(RowMapper.class), eq(doctor), eq(Timestamp.from(from)), eq(Timestamp.from(until)));
        assertTrue(sql.getValue().contains("doctor_user_id = ?"));
        assertTrue(sql.getValue().contains("starts_at >= ? AND starts_at < ?"));
        assertTrue(sql.getValue().contains("status IN ('AVAILABLE', 'BOOKED')"));
        assertFalse(sql.getValue().contains("LIMIT"));
    }

    @Test void partialReversedAndOversizedWindowsAreRejected() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(doctor), eq("DOCTOR"))).thenReturn(1);
        assertThrows(PatientApiException.class, () -> service.doctorAvailability(doctor, null, until));
        assertThrows(PatientApiException.class, () -> service.doctorAvailability(doctor, from, null));
        assertThrows(PatientApiException.class, () -> service.doctorAvailability(doctor, until, from));
        assertThrows(PatientApiException.class, () -> service.doctorAvailability(doctor, from, from));
        assertThrows(PatientApiException.class, () -> service.doctorAvailability(doctor, from, from.plusSeconds(17 * 86400)));
        verify(jdbc, never()).query(anyString(), any(RowMapper.class), any(), any(), any());
    }

    @Test void inactiveDoctorCannotReadCalendar() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(doctor), eq("DOCTOR"))).thenReturn(0);
        assertThrows(PatientApiException.class, () -> service.doctorAvailability(doctor, from, until));
        verify(jdbc, never()).query(anyString(), any(RowMapper.class), any(), any(), any());
    }

    @Test void legacyListKeepsItsExistingLimitAndContract() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(doctor), eq("DOCTOR"))).thenReturn(1);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(doctor))).thenReturn(List.of());
        assertEquals(List.of(), service.doctorAvailability(doctor));
        verify(jdbc).query(contains("ORDER BY starts_at LIMIT 120"), any(RowMapper.class), eq(doctor));
    }
}
