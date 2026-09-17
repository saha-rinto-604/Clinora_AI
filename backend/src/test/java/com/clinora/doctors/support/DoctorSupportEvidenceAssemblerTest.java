package com.clinora.doctors.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

class DoctorSupportEvidenceAssemblerTest {
    @Test
    void executionReauthorizesEveryReportAndPreservesOpaqueUnavailableSemantics() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorClinicalAccessService access = mock(DoctorClinicalAccessService.class);
        UUID doctor = UUID.randomUUID();
        UUID patient = UUID.randomUUID();
        UUID appointment = UUID.randomUUID();
        UUID unavailable = UUID.randomUUID();
        var appointmentAccess = new DoctorClinicalAccessService.AppointmentAccess(
            appointment, patient, doctor, "BOOKED", Instant.now(), Instant.now().plusSeconds(3600), "UTC"
        );
        when(access.requireActiveOwnedAppointment(doctor, appointment))
            .thenReturn(new DoctorClinicalAccessService.ActiveAppointmentAccess(appointmentAccess));
        when(access.requireSharedReport(doctor, appointment, unavailable)).thenThrow(new DoctorApiException(
            HttpStatus.NOT_FOUND, "SHARED_REPORT_NOT_AVAILABLE", "That report is not available for this appointment."
        ));
        var request = new DoctorSupportExecutionRequest(
            List.of(DoctorSupportTask.FIND_GAPS), "What is missing?", unavailable,
            List.of(), List.of(), null, null
        );
        var service = new DoctorSupportEvidenceAssembler(access, jdbc, new ObjectMapper().findAndRegisterModules());

        DoctorApiException unshared = assertThrows(DoctorApiException.class,
            () -> service.assemble(doctor, appointment, request));
        DoctorApiException revoked = assertThrows(DoctorApiException.class,
            () -> service.assemble(doctor, appointment, request));

        assertEquals("SHARED_REPORT_NOT_AVAILABLE", unshared.getErrorCode());
        assertEquals("SHARED_REPORT_NOT_AVAILABLE", revoked.getErrorCode());
        verifyNoInteractions(jdbc);
    }
}
