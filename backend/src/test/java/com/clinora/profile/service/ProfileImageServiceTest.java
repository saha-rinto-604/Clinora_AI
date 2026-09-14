package com.clinora.profile.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.clinora.audit.AuthAuditService;
import com.clinora.config.PatientReportSecurityProperties;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.security.PatientReportMalwareScanner;
import com.clinora.profile.storage.ProfileImageStoragePort;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;

class ProfileImageServiceTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-09-10T10:00:00Z"), ZoneOffset.UTC);

    @Test
    void rejectsUnsupportedDeclaredTypeBeforeStorage() {
        JdbcTemplate jdbc = activeUserJdbc();
        ProfileImageStoragePort storage = mock(ProfileImageStoragePort.class);
        PatientReportMalwareScanner scanner = mock(PatientReportMalwareScanner.class);
        ProfileImageService service = service(jdbc, storage, scanner, new PatientReportSecurityProperties());
        MockMultipartFile file = new MockMultipartFile("file", "avatar.gif", "image/gif", "GIF89a".getBytes());

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> service.replace(UUID.randomUUID(), file, "127.0.0.1", "test")
        );

        assertEquals("PROFILE_IMAGE_TYPE_INVALID", exception.getErrorCode());
        verifyNoInteractions(storage, scanner);
    }

    @Test
    void failsClosedWhenMalwareScannerIsUnavailable() {
        JdbcTemplate jdbc = activeUserJdbc();
        ProfileImageStoragePort storage = mock(ProfileImageStoragePort.class);
        PatientReportMalwareScanner scanner = mock(PatientReportMalwareScanner.class);
        PatientReportSecurityProperties properties = new PatientReportSecurityProperties();
        properties.setFailClosed(true);
        when(scanner.scan(any())).thenReturn(PatientReportMalwareScanner.ScanResult.UNAVAILABLE);
        ProfileImageService service = service(jdbc, storage, scanner, properties);
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10});

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> service.replace(UUID.randomUUID(), file, "127.0.0.1", "test")
        );

        assertEquals("PROFILE_IMAGE_SCAN_UNAVAILABLE", exception.getErrorCode());
        verifyNoInteractions(storage);
    }

    @Test
    void rejectsImageThatExceedsLimitAfterSafeProcessing() {
        UUID userId = UUID.randomUUID();
        JdbcTemplate jdbc = activeUserJdbc();
        ProfileImageStoragePort storage = mock(ProfileImageStoragePort.class);
        PatientReportMalwareScanner scanner = mock(PatientReportMalwareScanner.class);
        when(scanner.scan(any())).thenReturn(PatientReportMalwareScanner.ScanResult.CLEAN);
        ProfileImageSanitizer sanitizer = mock(ProfileImageSanitizer.class);
        when(sanitizer.sanitize(any(byte[].class))).thenReturn(
            new ProfileImageSanitizer.SanitizedImage(
                new byte[(5 * 1024 * 1024) + 1], "image/png", 64, 64, "png"
            )
        );
        ProfileImageService service = new ProfileImageService(
            jdbc, storage, sanitizer, scanner, new PatientReportSecurityProperties(),
            mock(DoctorClinicalAccessService.class), mock(AuthAuditService.class), CLOCK
        );
        MockMultipartFile file = new MockMultipartFile(
            "file", "avatar.png", "image/png", new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10}
        );

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> service.replace(userId, file, "127.0.0.1", "test")
        );

        assertEquals("PROFILE_IMAGE_SIZE_INVALID", exception.getErrorCode());
        verifyNoInteractions(storage);
    }

    @Test
    void rejectsOversizedUploadBeforeScannerOrStorage() {
        JdbcTemplate jdbc = activeUserJdbc();
        ProfileImageStoragePort storage = mock(ProfileImageStoragePort.class);
        PatientReportMalwareScanner scanner = mock(PatientReportMalwareScanner.class);
        ProfileImageService service = service(jdbc, storage, scanner, new PatientReportSecurityProperties());
        MockMultipartFile file = new MockMultipartFile("file", "large.jpg", "image/jpeg", new byte[(5 * 1024 * 1024) + 1]);

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> service.replace(UUID.randomUUID(), file, "127.0.0.1", "test")
        );

        assertEquals("PROFILE_IMAGE_SIZE_INVALID", exception.getErrorCode());
        verifyNoInteractions(storage, scanner);
    }

    private static JdbcTemplate activeUserJdbc() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(any(String.class), eq(Integer.class), any(UUID.class))).thenReturn(1);
        return jdbc;
    }

    private static ProfileImageService service(
        JdbcTemplate jdbc,
        ProfileImageStoragePort storage,
        PatientReportMalwareScanner scanner,
        PatientReportSecurityProperties properties
    ) {
        return new ProfileImageService(
            jdbc,
            storage,
            mock(ProfileImageSanitizer.class),
            scanner,
            properties,
            mock(DoctorClinicalAccessService.class),
            mock(AuthAuditService.class),
            CLOCK
        );
    }
}
