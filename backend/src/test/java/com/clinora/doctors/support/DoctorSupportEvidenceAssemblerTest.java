package com.clinora.doctors.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;

import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

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

    @Test
    @SuppressWarnings("unchecked")
    void guessedOrUnverifiedObservationIdsConvergeOnOpaqueUnavailableSemantics() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorClinicalAccessService access = mock(DoctorClinicalAccessService.class);
        UUID doctor = UUID.randomUUID();
        UUID patient = UUID.randomUUID();
        UUID appointment = UUID.randomUUID();
        UUID report = UUID.randomUUID();
        UUID eligibleObservation = UUID.randomUUID();
        var appointmentAccess = new DoctorClinicalAccessService.AppointmentAccess(
            appointment, patient, doctor, "BOOKED", Instant.now(), Instant.now().plusSeconds(3600), "UTC"
        );
        when(access.requireActiveOwnedAppointment(doctor, appointment))
            .thenReturn(new DoctorClinicalAccessService.ActiveAppointmentAccess(appointmentAccess));
        when(access.requireSharedReport(doctor, appointment, report)).thenReturn(
            new DoctorClinicalAccessService.SharedReportAccess(appointmentAccess, report, Instant.now())
        );
        var reportEvidence = new DoctorSupportEvidenceSnapshot.ReportEvidence(
            report, "CBC", LocalDate.of(2026, 9, 1), "REPORT_DATE", UUID.randomUUID(), "a".repeat(64), 1L
        );
        var observation = new DoctorSupportEvidenceSnapshot.ObservationEvidence(
            eligibleObservation, report, "MCV", "MCV", "NUMERIC", BigDecimal.valueOf(72), null, null,
            "fL", BigDecimal.valueOf(80), BigDecimal.valueOf(100), "80-100", "LOW", "PATIENT_CONFIRMED",
            BigDecimal.valueOf(72), "fl", "fl"
        );
        when(jdbc.query(argThat(sql -> sql != null && sql.contains("FROM patient_medical_reports r")), any(RowMapper.class), eq(report)))
            .thenReturn((List) List.of(reportEvidence));
        when(jdbc.query(argThat(sql -> sql != null && sql.contains("WITH latest")), any(RowMapper.class), eq(report)))
            .thenReturn((List) List.of(observation));
        var service = new DoctorSupportEvidenceAssembler(access, jdbc, new ObjectMapper().findAndRegisterModules());

        for (UUID unavailableObservation : List.of(UUID.randomUUID(), UUID.randomUUID())) {
            var request = new DoctorSupportExecutionRequest(
                List.of(DoctorSupportTask.CONNECT_EVIDENCE), "Connect this.", report,
                List.of(), List.of(unavailableObservation), null, null
            );
            DoctorApiException exception = assertThrows(DoctorApiException.class,
                () -> service.assemble(doctor, appointment, request));
            assertEquals("REPORT_OBSERVATION_NOT_AVAILABLE", exception.getErrorCode());
        }
    }
}
