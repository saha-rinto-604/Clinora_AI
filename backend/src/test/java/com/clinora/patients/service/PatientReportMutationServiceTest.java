package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.clinora.config.PatientReportSecurityProperties;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.domain.PatientReportSubjectType;
import com.clinora.patients.domain.PatientReportType;
import com.clinora.patients.security.PatientReportMalwareScanner;
import com.clinora.patients.security.PatientReportMalwareScanner.ScanResult;
import com.clinora.patients.service.PatientReportService.ReportView;
import com.clinora.patients.service.PatientReportService.UploadReportCommand;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PatientReportMutationServiceTest {
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-08-30T12:00:00Z"), ZoneOffset.UTC);

    @Test
    void failsClosedBeforeStorageWhenMalwareScannerIsUnavailable() {
        PatientReportService reports = mock(PatientReportService.class);
        PatientTimelineService timeline = mock(PatientTimelineService.class);
        PatientReportMalwareScanner scanner = mock(PatientReportMalwareScanner.class);
        PatientReportSecurityProperties security = new PatientReportSecurityProperties();
        security.setEnabled(true);
        security.setFailClosed(true);
        PatientReportMutationService service = new PatientReportMutationService(reports, timeline, scanner, security, CLOCK);
        MockMultipartFile file = pdf();
        UploadReportCommand command = command();
        when(scanner.scan(file)).thenReturn(ScanResult.UNAVAILABLE);

        assertThrows(
            PatientApiException.class,
            () -> service.upload(USER_ID, command, file, "127.0.0.1", "JUnit")
        );

        verify(reports, never()).upload(USER_ID, command, file, "127.0.0.1", "JUnit");
    }

    @Test
    void rejectsInfectedContentBeforeExistingReportVaultIsInvoked() {
        PatientReportService reports = mock(PatientReportService.class);
        PatientTimelineService timeline = mock(PatientTimelineService.class);
        PatientReportMalwareScanner scanner = mock(PatientReportMalwareScanner.class);
        PatientReportSecurityProperties security = new PatientReportSecurityProperties();
        security.setEnabled(true);
        security.setFailClosed(true);
        PatientReportMutationService service = new PatientReportMutationService(reports, timeline, scanner, security, CLOCK);
        MockMultipartFile file = pdf();
        UploadReportCommand command = command();
        when(scanner.scan(file)).thenReturn(ScanResult.INFECTED);

        assertThrows(
            PatientApiException.class,
            () -> service.upload(USER_ID, command, file, "127.0.0.1", "JUnit")
        );

        verify(reports, never()).upload(USER_ID, command, file, "127.0.0.1", "JUnit");
    }

    @Test
    void otherPersonUploadDoesNotEnterThePatientsOwnHealthTimeline() {
        PatientReportService reports = mock(PatientReportService.class);
        PatientTimelineService timeline = mock(PatientTimelineService.class);
        PatientReportMalwareScanner scanner = mock(PatientReportMalwareScanner.class);
        PatientReportSecurityProperties security = new PatientReportSecurityProperties();
        PatientReportMutationService service = new PatientReportMutationService(reports, timeline, scanner, security, CLOCK);
        MockMultipartFile file = pdf();
        UploadReportCommand command = new UploadReportCommand(
            "Mother CBC",
            PatientReportType.LAB_RESULTS,
            PatientReportSubjectType.OTHER,
            "Mother",
            LocalDate.of(2026, 8, 25),
            "City Diagnostic Centre"
        );
        UUID reportId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        ReportView otherReport = new ReportView(
            reportId,
            "Mother CBC",
            PatientReportType.LAB_RESULTS,
            PatientReportSubjectType.OTHER,
            "Mother",
            LocalDate.of(2026, 8, 25),
            "City Diagnostic Centre",
            "mother-cbc.pdf",
            "application/pdf",
            128,
            false,
            null,
            CLOCK.instant(),
            CLOCK.instant()
        );
        when(scanner.scan(file)).thenReturn(ScanResult.CLEAN);
        when(reports.upload(USER_ID, command, file, "127.0.0.1", "JUnit")).thenReturn(otherReport);

        service.upload(USER_ID, command, file, "127.0.0.1", "JUnit");

        verify(reports).upload(USER_ID, command, file, "127.0.0.1", "JUnit");
        verifyNoInteractions(timeline);
    }

    private static UploadReportCommand command() {
        return new UploadReportCommand(
            "Annual blood panel",
            PatientReportType.LAB_RESULTS,
            LocalDate.of(2026, 8, 25),
            "City Diagnostic Centre"
        );
    }

    private static MockMultipartFile pdf() {
        return new MockMultipartFile(
            "file",
            "annual-blood-panel.pdf",
            "application/pdf",
            "%PDF-1.7\nClinora\n%%EOF\n".getBytes(StandardCharsets.US_ASCII)
        );
    }
}
