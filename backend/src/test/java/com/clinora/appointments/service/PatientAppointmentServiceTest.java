package com.clinora.appointments.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.appointments.service.PatientAppointmentService.AppointmentCollection;
import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.notifications.service.DoctorNotificationService;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.service.PatientTimelineService;
import java.sql.ResultSet;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
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
            mock(DoctorNotificationService.class),
            Clock.systemUTC()
        );

        assertEquals(List.of(), service.appointments(patientId, AppointmentCollection.UPCOMING));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(org.springframework.jdbc.core.RowMapper.class), eq(patientId));
        assertTrue(sql.getValue().contains("? AND a.status"));
        assertTrue(sql.getValue().contains("a.scheduled_end >= CURRENT_TIMESTAMP"));
        assertTrue(sql.getValue().contains("c.status = 'IN_PROGRESS'"));
    }

    @Test
    void owningDoctorCanAddAnOnlineMeetingLinkAndPatientIsNotifiedWithoutTheUrl() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        PatientNotificationService notifications = mock(PatientNotificationService.class);
        UUID doctorId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(doctorId), eq("DOCTOR"))).thenReturn(1);
        stubMeetingLinkLock(jdbc, appointmentId, doctorId, patientId, "BOOKED", "ONLINE", null, 7L);

        PatientAppointmentService service = service(jdbc, notifications);
        service.updateMeetingUrl(doctorId, appointmentId, "https://meet.example.test/room");

        verify(jdbc).update(
            contains("SET meeting_url = ?"),
            eq("https://meet.example.test/room"), any(), any(), eq(appointmentId), eq(doctorId)
        );
        verify(notifications).create(
            eq(patientId), eq("APPOINTMENT_MEETING_LINK_UPDATED"), any(), anyString(),
            eq("Your Doctor added or updated the meeting link for your online appointment."),
            eq("APPOINTMENT"), eq(appointmentId), eq("appointment-meeting-link:" + appointmentId + ":8")
        );
    }

    @Test
    void meetingLinkCannotBeAddedToInPersonAppointment() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID doctorId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(doctorId), eq("DOCTOR"))).thenReturn(1);
        stubMeetingLinkLock(jdbc, appointmentId, doctorId, UUID.randomUUID(), "BOOKED", "IN_PERSON", null, 0L);

        PatientApiException error = assertThrows(
            PatientApiException.class,
            () -> service(jdbc, mock(PatientNotificationService.class))
                .updateMeetingUrl(doctorId, appointmentId, "https://meet.example.test/room")
        );

        assertEquals("MEETING_LINK_NOT_ALLOWED", error.getErrorCode());
        verify(jdbc, never()).update(contains("SET meeting_url = ?"), any(), any(), any(), any(), any());
    }

    @Test
    void anotherDoctorCannotModifyTheAppointmentMeetingLink() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID doctorId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(doctorId), eq("DOCTOR"))).thenReturn(1);
        when(jdbc.query(contains("FROM appointments"), any(RowMapper.class), eq(appointmentId), eq(doctorId)))
            .thenReturn(List.of());

        PatientApiException error = assertThrows(
            PatientApiException.class,
            () -> service(jdbc, mock(PatientNotificationService.class))
                .updateMeetingUrl(doctorId, appointmentId, "https://meet.example.test/room")
        );

        assertEquals("APPOINTMENT_NOT_FOUND", error.getErrorCode());
    }

    private static PatientAppointmentService service(JdbcTemplate jdbc, PatientNotificationService notifications) {
        return new PatientAppointmentService(
            jdbc,
            mock(PatientTimelineService.class),
            notifications,
            mock(DoctorNotificationService.class),
            Clock.systemUTC()
        );
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static void stubMeetingLinkLock(
        JdbcTemplate jdbc,
        UUID appointmentId,
        UUID doctorId,
        UUID patientId,
        String status,
        String mode,
        String meetingUrl,
        long version
    ) throws Exception {
        ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("id", UUID.class)).thenReturn(appointmentId);
        when(rs.getObject("patient_user_id", UUID.class)).thenReturn(patientId);
        when(rs.getString("status")).thenReturn(status);
        when(rs.getString("consultation_mode")).thenReturn(mode);
        when(rs.getString("meeting_url")).thenReturn(meetingUrl);
        when(rs.getLong("version")).thenReturn(version);
        when(jdbc.query(contains("FROM appointments"), any(RowMapper.class), eq(appointmentId), eq(doctorId)))
            .thenAnswer(invocation -> List.of(((RowMapper) invocation.getArgument(1)).mapRow(rs, 0)));
    }
}
