package com.clinora.doctors.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.audit.AuthAuditService;
import com.clinora.doctors.api.DoctorApiException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class DoctorProfileServiceTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-09-10T10:00:00Z"), ZoneOffset.UTC);

    @Test
    void rejectsUnsafeProfessionalProfileUrlBeforeWritingProfileData() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorClinicalAccessService access = mock(DoctorClinicalAccessService.class);
        ApplicationDocumentStoragePort storage = mock(ApplicationDocumentStoragePort.class);
        DoctorProfileService service = new DoctorProfileService(
            jdbc,
            access,
            storage,
            mock(AuthAuditService.class),
            CLOCK
        );
        UUID doctorId = UUID.randomUUID();

        DoctorApiException exception = assertThrows(
            DoctorApiException.class,
            () -> service.update(
                doctorId,
                new DoctorProfileModels.UpdateProfileCommand(
                    2,
                    "Professional bio",
                    "javascript:alert(1)",
                    "Consultant",
                    "Clinora Medical Centre",
                    "Consultant Physician",
                    "Asia/Dhaka",
                    30
                ),
                "127.0.0.1",
                "test"
            )
        );

        assertEquals("DOCTOR_PROFILE_URL_INVALID", exception.getErrorCode());
        verifyNoInteractions(storage);
    }

    @Test
    void staleProfileVersionFailsWithoutSilentlyOverwritingAnotherSession() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorClinicalAccessService access = mock(DoctorClinicalAccessService.class);
        AuthAuditService audit = mock(AuthAuditService.class);
        DoctorProfileService service = new DoctorProfileService(
            jdbc,
            access,
            mock(ApplicationDocumentStoragePort.class),
            audit,
            CLOCK
        );
        UUID doctorId = UUID.randomUUID();
        when(jdbc.update(any(String.class), any(Object[].class))).thenReturn(0);

        DoctorApiException exception = assertThrows(
            DoctorApiException.class,
            () -> service.update(
                doctorId,
                new DoctorProfileModels.UpdateProfileCommand(
                    7,
                    "Professional bio",
                    "https://example.test/profile",
                    "Senior Consultant",
                    "Dhaka Medical Centre",
                    "Consultant",
                    "Asia/Dhaka",
                    30
                ),
                "127.0.0.1",
                "test"
            )
        );

        assertEquals("DOCTOR_PROFILE_STALE", exception.getErrorCode());
        verifyNoInteractions(audit);
    }

    @Test
    void invalidConsultationDurationIsRejectedBeforeMutation() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorProfileService service = new DoctorProfileService(
            jdbc,
            mock(DoctorClinicalAccessService.class),
            mock(ApplicationDocumentStoragePort.class),
            mock(AuthAuditService.class),
            CLOCK
        );

        DoctorApiException exception = assertThrows(
            DoctorApiException.class,
            () -> service.update(
                UUID.randomUUID(),
                new DoctorProfileModels.UpdateProfileCommand(
                    1,
                    null,
                    null,
                    null,
                    null,
                    null,
                    "Asia/Dhaka",
                    17
                ),
                "127.0.0.1",
                "test"
            )
        );

        assertEquals("DOCTOR_PROFILE_DURATION_INVALID", exception.getErrorCode());
    }
}
