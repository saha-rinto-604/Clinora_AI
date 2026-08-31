package com.clinora.appointments.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.appointments.service.PatientAppointmentService.AppointmentCollection;
import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.patients.service.PatientTimelineService;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

class PatientAppointmentServiceTest {
    @Test
    void emptyUpcomingCollectionUsesValidSqlAndReturnsAnEmptyList() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID patientId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(patientId), eq("PATIENT"))).thenReturn(1);
        when(jdbc.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class), eq(patientId)))
            .thenReturn(List.of());

        PatientAppointmentService service = new PatientAppointmentService(
            jdbc,
            mock(PatientTimelineService.class),
            mock(PatientNotificationService.class),
            Clock.systemUTC()
        );

        assertEquals(List.of(), service.appointments(patientId, AppointmentCollection.UPCOMING));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(org.springframework.jdbc.core.RowMapper.class), eq(patientId));
        org.junit.jupiter.api.Assertions.assertTrue(sql.getValue().contains("? AND a.status"));
    }
}
