package com.clinora.doctors.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.appointments.service.PatientAppointmentService;
import com.clinora.audit.AuthAuditService;
import com.clinora.doctors.api.DoctorApiException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class DoctorPhase6ServiceTest {
    @Test
    void inactiveOrUnapprovedDoctorIsRejected() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID doctorId = UUID.randomUUID();
        when(jdbc.queryForObject(any(String.class), eq(Integer.class), eq(doctorId))).thenReturn(0);

        DoctorClinicalAccessService access = new DoctorClinicalAccessService(jdbc, Clock.systemUTC());
        DoctorApiException exception = assertThrows(DoctorApiException.class, () -> access.requireActiveDoctor(doctorId));

        assertEquals("ACTIVE_DOCTOR_REQUIRED", exception.getErrorCode());
    }

    @Test
    @SuppressWarnings("unchecked")
    void appointmentCollectionUsesCurrentV16ColumnsAndDoctorScope() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorClinicalAccessService access = mock(DoctorClinicalAccessService.class);
        UUID doctorId = UUID.randomUUID();
        when(jdbc.query(any(String.class), any(RowMapper.class), eq(doctorId), anyInt(), anyInt())).thenReturn(List.of());

        DoctorWorkspaceService service = new DoctorWorkspaceService(
            jdbc,
            access,
            mock(PatientAppointmentService.class),
            mock(AuthAuditService.class),
            Clock.systemUTC()
        );

        DoctorWorkspaceModels.AppointmentPage page = service.appointments(doctorId, "upcoming", 20, 0);
        assertEquals(List.of(), page.items());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(RowMapper.class), eq(doctorId), eq(21), eq(0));
        assertTrue(sql.getValue().contains("a.reason_for_visit"));
        assertTrue(sql.getValue().contains("a.booking_timezone"));
        assertTrue(sql.getValue().contains("a.doctor_user_id = ?"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void unsharedReportReturnsTheSameNotAvailableBoundaryWithoutReportLookupLeak() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID doctorId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        UUID reportId = UUID.randomUUID();
        Instant now = Instant.now();

        when(jdbc.queryForObject(any(String.class), eq(Integer.class), eq(doctorId))).thenReturn(1);
        when(jdbc.query(
            contains("FROM appointments"),
            any(RowMapper.class),
            eq(appointmentId),
            eq(doctorId)
        )).thenReturn(List.of(new DoctorClinicalAccessService.AppointmentAccess(
            appointmentId, patientId, doctorId, "BOOKED", now.plusSeconds(600), now.plusSeconds(2400), "Asia/Dhaka"
        )));
        when(jdbc.query(
            argThat(sql -> sql.contains("FROM appointment_report_shares")
                && sql.contains("s.revoked_at IS NULL")
                && sql.contains("r.archived_at IS NULL")),
            any(RowMapper.class),
            eq(appointmentId),
            eq(reportId),
            eq(doctorId),
            eq(patientId)
        )).thenReturn(List.of());

        DoctorClinicalAccessService access = new DoctorClinicalAccessService(jdbc, Clock.systemUTC());
        DoctorApiException exception = assertThrows(
            DoctorApiException.class,
            () -> access.requireSharedReport(doctorId, appointmentId, reportId)
        );

        assertEquals("SHARED_REPORT_NOT_AVAILABLE", exception.getErrorCode());
    }


    @Test
    @SuppressWarnings("unchecked")
    void forgedAppointmentIdForAnotherDoctorIsOpaqueNotFound() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID doctorId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        when(jdbc.queryForObject(any(String.class), eq(Integer.class), eq(doctorId))).thenReturn(1);
        when(jdbc.query(
            contains("FROM appointments"),
            any(RowMapper.class),
            eq(appointmentId),
            eq(doctorId)
        )).thenReturn(List.of());

        DoctorClinicalAccessService access = new DoctorClinicalAccessService(jdbc, Clock.systemUTC());
        DoctorApiException exception = assertThrows(
            DoctorApiException.class,
            () -> access.requireOwnedAppointment(doctorId, appointmentId)
        );

        assertEquals("APPOINTMENT_NOT_FOUND", exception.getErrorCode());
    }

    @Test
    void comparisonRejectsSelectingTheSameReportTwiceBeforeAnyDataAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorClinicalAccessService access = mock(DoctorClinicalAccessService.class);
        UUID reportId = UUID.randomUUID();
        DoctorReportReviewService service = new DoctorReportReviewService(
            jdbc,
            access,
            mock(AuthAuditService.class),
            Clock.systemUTC()
        );

        DoctorApiException exception = assertThrows(
            DoctorApiException.class,
            () -> service.compare(UUID.randomUUID(), UUID.randomUUID(), reportId, reportId, "127.0.0.1", "test")
        );

        assertEquals("REPORT_COMPARE_SELECTION_INVALID", exception.getErrorCode());
    }

    @Test
    @SuppressWarnings("unchecked")
    void doctorCancellationDelegatesToTheExistingAppointmentInvariantService() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorClinicalAccessService access = mock(DoctorClinicalAccessService.class);
        PatientAppointmentService patientAppointments = mock(PatientAppointmentService.class);
        UUID doctorId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        Instant now = Instant.now();
        DoctorClinicalAccessService.AppointmentAccess owned = new DoctorClinicalAccessService.AppointmentAccess(
            appointmentId, patientId, doctorId, "BOOKED", now.plusSeconds(600), now.plusSeconds(2400), "Asia/Dhaka"
        );
        when(access.requireOwnedAppointment(doctorId, appointmentId)).thenReturn(owned);
        when(access.mayModifyAppointment(owned)).thenReturn(true);
        when(jdbc.query(any(String.class), any(RowMapper.class), eq(appointmentId), eq(doctorId))).thenReturn(List.of());

        DoctorWorkspaceService service = new DoctorWorkspaceService(
            jdbc, access, patientAppointments, mock(AuthAuditService.class), Clock.systemUTC()
        );
        assertThrows(DoctorApiException.class, () ->
            service.cancel(doctorId, appointmentId, "Clinic schedule changed", "127.0.0.1", "test")
        );

        verify(patientAppointments).cancel(patientId, appointmentId, "Clinic schedule changed");
    }


    @Test
    @SuppressWarnings("unchecked")
    void doctorRescheduleDelegatesToTheExistingAppointmentInvariantService() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorClinicalAccessService access = mock(DoctorClinicalAccessService.class);
        PatientAppointmentService patientAppointments = mock(PatientAppointmentService.class);
        UUID doctorId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        UUID slotId = UUID.randomUUID();
        Instant now = Instant.now();
        DoctorClinicalAccessService.AppointmentAccess owned = new DoctorClinicalAccessService.AppointmentAccess(
            appointmentId, patientId, doctorId, "BOOKED", now.plusSeconds(600), now.plusSeconds(2400), "Asia/Dhaka"
        );
        when(access.requireOwnedAppointment(doctorId, appointmentId)).thenReturn(owned);
        when(access.mayModifyAppointment(owned)).thenReturn(true);
        when(jdbc.query(any(String.class), any(RowMapper.class), eq(appointmentId), eq(doctorId))).thenReturn(List.of());

        DoctorWorkspaceService service = new DoctorWorkspaceService(
            jdbc, access, patientAppointments, mock(AuthAuditService.class), Clock.systemUTC()
        );
        assertThrows(DoctorApiException.class, () ->
            service.reschedule(doctorId, appointmentId, slotId, "Asia/Dhaka", "127.0.0.1", "test")
        );

        verify(patientAppointments).reschedule(patientId, appointmentId, slotId, "Asia/Dhaka");
    }

    @Test
    void structuredRangeStatusPrefersPersistedDerivedRangeFlag() {
        assertEquals("OUTSIDE_RANGE", DoctorReportReviewService.resultStatus("ABOVE_REPORTED_RANGE", null));
        assertEquals("OUTSIDE_RANGE", DoctorReportReviewService.resultStatus("BELOW_REPORTED_RANGE", null));
        assertEquals("WITHIN_RANGE", DoctorReportReviewService.resultStatus("WITHIN_REPORTED_RANGE", "H"));
        assertEquals("OUTSIDE_RANGE", DoctorReportReviewService.resultStatus(null, "H"));
        assertEquals("NOT_CLASSIFIED", DoctorReportReviewService.resultStatus(null, null));
    }
}
