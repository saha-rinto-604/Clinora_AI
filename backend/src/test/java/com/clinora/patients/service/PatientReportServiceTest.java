package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.config.PatientReportStorageProperties;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.domain.PatientMedicalReport;
import com.clinora.patients.domain.PatientReportType;
import com.clinora.patients.repository.PatientMedicalReportRepository;
import com.clinora.patients.service.PatientReportService.ContentAccess;
import com.clinora.patients.service.PatientReportService.ReportCollection;
import com.clinora.patients.service.PatientReportService.UpdateReportCommand;
import com.clinora.patients.service.PatientReportService.UploadReportCommand;
import com.clinora.patients.storage.PatientReportStoragePort;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.unit.DataSize;

class PatientReportServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-30T08:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID REPORT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Test
    void uploadStoresValidatedPrivateObjectMetadataAndAudit() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        when(fixture.reports.save(any(PatientMedicalReport.class))).thenAnswer(invocation -> {
            PatientMedicalReport report = invocation.getArgument(0);
            ReflectionTestUtils.setField(report, "id", REPORT_ID);
            return report;
        });
        byte[] pdf = "%PDF-1.7\nClinora report\n%%EOF\n".getBytes(StandardCharsets.US_ASCII);

        var view = fixture.service.upload(
            USER_ID,
            new UploadReportCommand("  Annual blood panel  ", PatientReportType.LAB_RESULTS, LocalDate.of(2026, 8, 25), "  City Lab  "),
            new MockMultipartFile("file", "blood-panel.pdf", "application/pdf", pdf),
            "127.0.0.1",
            "JUnit"
        );

        assertEquals(REPORT_ID, view.id());
        assertEquals("Annual blood panel", view.reportName());
        assertEquals("City Lab", view.providerLaboratory());
        assertFalse(view.archived());
        verify(fixture.storage).put(
            org.mockito.ArgumentMatchers.matches("patient-reports/" + USER_ID + "/2026/08/.+\\.pdf"),
            eq(pdf),
            eq("application/pdf")
        );
        verify(fixture.audit).record(
            USER_ID,
            AuthAuditAction.PATIENT_REPORT_UPLOADED,
            AuthAuditOutcome.SUCCESS,
            "127.0.0.1",
            "JUnit",
            REPORT_ID.toString(),
            null
        );
    }

    @Test
    void uploadRejectsExecutableContentAndTypeMismatchesBeforeStorage() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        MockMultipartFile executable = new MockMultipartFile(
            "file",
            "report.pdf",
            "application/pdf",
            "MZ executable".getBytes(StandardCharsets.US_ASCII)
        );

        assertThrows(
            PatientApiException.class,
            () -> fixture.service.upload(
                USER_ID,
                new UploadReportCommand("Report", PatientReportType.OTHER, null, null),
                executable,
                null,
                null
            )
        );
        verify(fixture.storage, never()).put(any(), any(), any());
        verify(fixture.reports, never()).save(any());
    }

    @Test
    void uploadRemovesPrivateObjectWhenTheDatabaseTransactionRollsBack() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        when(fixture.reports.save(any(PatientMedicalReport.class))).thenAnswer(invocation -> {
            PatientMedicalReport report = invocation.getArgument(0);
            ReflectionTestUtils.setField(report, "id", REPORT_ID);
            return report;
        });
        MockMultipartFile pdf = new MockMultipartFile(
            "file",
            "report.pdf",
            "application/pdf",
            "%PDF-1.7\n%%EOF".getBytes(StandardCharsets.US_ASCII)
        );

        TransactionSynchronizationManager.initSynchronization();
        try {
            fixture.service.upload(
                USER_ID,
                new UploadReportCommand("Report", PatientReportType.OTHER, null, null),
                pdf,
                null,
                null
            );
            TransactionSynchronizationManager.getSynchronizations().forEach(
                synchronization -> synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK)
            );
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(fixture.storage).delete(org.mockito.ArgumentMatchers.startsWith("patient-reports/" + USER_ID + "/"));
    }

    @Test
    void uploadRequiresAReportTypeBeforeWritingTheObject() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        MockMultipartFile pdf = new MockMultipartFile(
            "file",
            "report.pdf",
            "application/pdf",
            "%PDF-1.7\n%%EOF".getBytes(StandardCharsets.US_ASCII)
        );

        assertThrows(
            PatientApiException.class,
            () -> fixture.service.upload(
                USER_ID,
                new UploadReportCommand("Report", null, null, null),
                pdf,
                null,
                null
            )
        );
        verify(fixture.storage, never()).put(any(), any(), any());
    }

    @Test
    void reportOwnershipIsAppliedToMetadataAndContentLookups() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        when(fixture.reports.findByIdAndPatientUserId(REPORT_ID, USER_ID)).thenReturn(Optional.empty());

        assertThrows(PatientApiException.class, () -> fixture.service.detail(USER_ID, REPORT_ID));
        assertThrows(
            PatientApiException.class,
            () -> fixture.service.content(USER_ID, REPORT_ID, ContentAccess.VIEW, null, null)
        );

        verify(fixture.reports, never()).findById(REPORT_ID);
        verify(fixture.storage, never()).get(any());
    }

    @Test
    void inlineViewAndDownloadUsePrivateStorageAndDifferentAuditActions() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        byte[] bytes = "%PDF-1.7\n%%EOF".getBytes(StandardCharsets.US_ASCII);
        PatientMedicalReport report = report(bytes);
        when(fixture.reports.findByIdAndPatientUserId(REPORT_ID, USER_ID)).thenReturn(Optional.of(report));
        when(fixture.storage.get(report.getObjectKey()))
            .thenReturn(new PatientReportStoragePort.StoredObject(bytes, "application/pdf"));

        var inline = fixture.service.content(USER_ID, REPORT_ID, ContentAccess.VIEW, "127.0.0.1", "JUnit");
        var download = fixture.service.content(USER_ID, REPORT_ID, ContentAccess.DOWNLOAD, "127.0.0.1", "JUnit");

        assertEquals("report.pdf", inline.filename());
        assertEquals(bytes.length, download.bytes().length);
        verify(fixture.audit).record(
            USER_ID,
            AuthAuditAction.PATIENT_REPORT_VIEWED,
            AuthAuditOutcome.SUCCESS,
            "127.0.0.1",
            "JUnit",
            REPORT_ID.toString(),
            null
        );
        verify(fixture.audit).record(
            USER_ID,
            AuthAuditAction.PATIENT_REPORT_DOWNLOADED,
            AuthAuditOutcome.SUCCESS,
            "127.0.0.1",
            "JUnit",
            REPORT_ID.toString(),
            null
        );
    }

    @Test
    void contentIntegrityFailureDoesNotReturnOrAuditTamperedBytes() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        byte[] original = "%PDF-1.7\n%%EOF".getBytes(StandardCharsets.US_ASCII);
        PatientMedicalReport report = report(original);
        when(fixture.reports.findByIdAndPatientUserId(REPORT_ID, USER_ID)).thenReturn(Optional.of(report));
        when(fixture.storage.get(report.getObjectKey())).thenReturn(new PatientReportStoragePort.StoredObject(
            "%PDF-1.7\ntampered\n%%EOF".getBytes(StandardCharsets.US_ASCII),
            "application/pdf"
        ));

        assertThrows(
            PatientApiException.class,
            () -> fixture.service.content(USER_ID, REPORT_ID, ContentAccess.VIEW, null, null)
        );
        verify(fixture.audit, never()).record(
            any(),
            eq(AuthAuditAction.PATIENT_REPORT_VIEWED),
            any(),
            any(),
            any(),
            any(),
            any()
        );
    }

    @Test
    void listUsesOneBasedPaginationAndSelectedCollection() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        PatientMedicalReport report = report();
        var pageable = PageRequest.of(1, 10);
        when(fixture.reports.search(USER_ID, true, PatientReportType.LAB_RESULTS, "blood", pageable))
            .thenReturn(new PageImpl<>(List.of(report), pageable, 11));
        when(fixture.reports.countByPatientUserIdAndArchivedAtIsNull(USER_ID)).thenReturn(4L);
        when(fixture.reports.countByPatientUserIdAndArchivedAtIsNotNull(USER_ID)).thenReturn(11L);

        var page = fixture.service.list(
            USER_ID,
            " blood ",
            PatientReportType.LAB_RESULTS,
            ReportCollection.ARCHIVED,
            2,
            10
        );

        assertEquals(2, page.page());
        assertEquals(11, page.totalItems());
        assertEquals(4, page.activeCount());
        assertEquals(11, page.archivedCount());
        assertEquals(1, page.items().size());
        assertTrue(page.hasPrevious());
    }

    @Test
    void listUsesEmptySearchTextWhenQueryIsAbsent() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        var pageable = PageRequest.of(0, 20);
        when(fixture.reports.search(USER_ID, false, null, "", pageable))
            .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        var page = fixture.service.list(USER_ID, null, null, ReportCollection.ACTIVE, 1, 20);

        assertEquals(0, page.totalItems());
        verify(fixture.reports).search(USER_ID, false, null, "", pageable);
    }

    @Test
    void metadataArchiveAndRestorePreserveTheOriginalObject() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        PatientMedicalReport report = report();
        when(fixture.reports.findByIdAndPatientUserId(REPORT_ID, USER_ID)).thenReturn(Optional.of(report));
        when(fixture.reports.save(report)).thenReturn(report);

        var updated = fixture.service.updateMetadata(
            USER_ID,
            REPORT_ID,
            new UpdateReportCommand("Updated report", PatientReportType.CARDIOLOGY, LocalDate.of(2026, 8, 20), "Heart Centre"),
            null,
            null
        );
        var archived = fixture.service.archive(USER_ID, REPORT_ID, null, null);
        var restored = fixture.service.restore(USER_ID, REPORT_ID, null, null);

        assertEquals("Updated report", updated.reportName());
        assertTrue(archived.archived());
        assertFalse(restored.archived());
        verify(fixture.storage, never()).delete(any());
    }

    @Test
    void futureReportDateAndInactivePatientAreRejected() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        MockMultipartFile pdf = new MockMultipartFile(
            "file",
            "report.pdf",
            "application/pdf",
            "%PDF-1.7\n%%EOF".getBytes(StandardCharsets.US_ASCII)
        );
        assertThrows(
            PatientApiException.class,
            () -> fixture.service.upload(
                USER_ID,
                new UploadReportCommand("Report", PatientReportType.OTHER, LocalDate.of(2026, 8, 31), null),
                pdf,
                null,
                null
            )
        );

        when(fixture.users.findById(USER_ID)).thenReturn(Optional.of(user(UserRole.PATIENT, AccountStatus.SUSPENDED)));
        assertThrows(
            PatientApiException.class,
            () -> fixture.service.list(USER_ID, null, null, ReportCollection.ACTIVE, 1, 20)
        );
    }

    private static PatientMedicalReport report() {
        return report("%PDF-1.7\n%%EOF".getBytes(StandardCharsets.US_ASCII));
    }

    private static PatientMedicalReport report(byte[] bytes) {
        PatientMedicalReport report = new PatientMedicalReport(
            USER_ID,
            "Blood panel",
            PatientReportType.LAB_RESULTS,
            LocalDate.of(2026, 8, 20),
            "City Lab",
            "patient-reports/key.pdf",
            "report.pdf",
            "application/pdf",
            128,
            sha256(bytes),
            NOW.minusSeconds(60)
        );
        ReflectionTestUtils.setField(report, "id", REPORT_ID);
        return report;
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static UserAccount user(UserRole role, AccountStatus status) {
        UserAccount user = new UserAccount(
            "Pia",
            "Patient",
            "patient@example.test",
            "patient@example.test",
            "hash",
            role,
            status,
            NOW.minusSeconds(3600)
        );
        ReflectionTestUtils.setField(user, "id", USER_ID);
        if (status == AccountStatus.ACTIVE) user.markEmailVerified(NOW.minusSeconds(3000));
        return user;
    }

    private static class Fixture {
        private final UserAccountRepository users = mock(UserAccountRepository.class);
        private final PatientMedicalReportRepository reports = mock(PatientMedicalReportRepository.class);
        private final PatientReportStoragePort storage = mock(PatientReportStoragePort.class);
        private final AuthAuditService audit = mock(AuthAuditService.class);
        private final PatientReportStorageProperties properties = new PatientReportStorageProperties();
        private final PatientReportService service;

        private Fixture() {
            properties.setMaxFileSize(DataSize.ofMegabytes(20));
            service = new PatientReportService(users, reports, storage, properties, audit, CLOCK);
        }

        private void activePatient() {
            when(users.findById(USER_ID)).thenReturn(Optional.of(user(UserRole.PATIENT, AccountStatus.ACTIVE)));
        }
    }
}
