package com.clinora.doctors.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class DoctorSupportContextServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void contextContainsOnlyReportsExplicitlySharedWithThisDoctor() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorClinicalAccessService access = mock(DoctorClinicalAccessService.class);
        UUID doctor = UUID.randomUUID();
        UUID patient = UUID.randomUUID();
        UUID appointment = UUID.randomUUID();
        UUID reportA = UUID.randomUUID();
        UUID reportB = UUID.randomUUID();
        UUID hiddenReportC = UUID.randomUUID();
        when(jdbc.queryForList(anyString(), eq(UUID.class), eq(appointment), eq(doctor), eq(patient), eq(patient)))
            .thenReturn(List.of(reportA, reportB));
        DoctorClinicalAccessService.AppointmentAccess appointmentAccess = appointment(doctor, patient, appointment);
        when(access.requireActiveOwnedAppointment(doctor, appointment))
            .thenReturn(new DoctorClinicalAccessService.ActiveAppointmentAccess(appointmentAccess));
        when(access.requireSharedReport(eq(doctor), eq(appointment), any(UUID.class))).thenAnswer(invocation ->
            new DoctorClinicalAccessService.SharedReportAccess(
                appointmentAccess, invocation.getArgument(2), Instant.now()
            )
        );
        when(jdbc.query(anyString(), any(RowMapper.class), eq(reportA), eq(patient))).thenReturn(List.of("CBC"));
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(appointment), eq(doctor), eq(patient), eq(reportA), eq("CBC"), eq("CBC")))
            .thenReturn(1);

        DoctorSupportContext context = new DoctorSupportContextService(jdbc, access).build(
            doctor,
            appointment,
            new DoctorSupportRoutingRequest(
                "Compare these reports.", null, DoctorSupportScreen.REPORT_COMPARE, reportA,
                List.of(reportA, reportB), List.of(), false, false
            )
        );

        assertEquals(List.of(reportA, reportB), context.authorizedReportIds());
        assertFalse(context.authorizedReportIds().contains(hiddenReportC));
        assertEquals(2, context.authorizedReportIds().size());
    }

    @Test
    void unsharedAndRevokedReportIdsConvergeOnExistingUnavailableSemantics() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorClinicalAccessService access = mock(DoctorClinicalAccessService.class);
        UUID doctor = UUID.randomUUID();
        UUID patient = UUID.randomUUID();
        UUID appointment = UUID.randomUUID();
        UUID unavailable = UUID.randomUUID();
        DoctorClinicalAccessService.AppointmentAccess appointmentAccess = appointment(doctor, patient, appointment);
        when(access.requireActiveOwnedAppointment(doctor, appointment))
            .thenReturn(new DoctorClinicalAccessService.ActiveAppointmentAccess(appointmentAccess));
        when(access.requireSharedReport(doctor, appointment, unavailable)).thenThrow(
            new DoctorApiException(HttpStatus.NOT_FOUND, "SHARED_REPORT_NOT_AVAILABLE", "That report is not available for this appointment.")
        );
        DoctorSupportContextService service = new DoctorSupportContextService(jdbc, access);
        DoctorSupportRoutingRequest request = new DoctorSupportRoutingRequest(
            "Compare this.", null, DoctorSupportScreen.REPORT_REVIEW, unavailable,
            List.of(), List.of(), false, false
        );

        DoctorApiException unshared = assertThrows(DoctorApiException.class, () -> service.build(doctor, appointment, request));
        DoctorApiException revoked = assertThrows(DoctorApiException.class, () -> service.build(doctor, appointment, request));

        assertEquals("SHARED_REPORT_NOT_AVAILABLE", unshared.getErrorCode());
        assertEquals("SHARED_REPORT_NOT_AVAILABLE", revoked.getErrorCode());
    }

    private static DoctorClinicalAccessService.AppointmentAccess appointment(UUID doctor, UUID patient, UUID appointment) {
        Instant now = Instant.now();
        return new DoctorClinicalAccessService.AppointmentAccess(
            appointment, patient, doctor, "BOOKED", now.minusSeconds(60), now.plusSeconds(3600), "Asia/Dhaka"
        );
    }
}
