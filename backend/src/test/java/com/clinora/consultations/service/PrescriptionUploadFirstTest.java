package com.clinora.consultations.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.clinora.audit.AuthAuditService;
import com.clinora.config.PatientReportSecurityProperties;
import com.clinora.config.PatientReportStorageProperties;
import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import com.clinora.patients.security.PatientReportMalwareScanner;
import com.clinora.patients.storage.PatientReportStoragePort;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mock.web.MockMultipartFile;

class PrescriptionUploadFirstTest {
    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void uploadsScannedDocumentWithZeroMedicationsAndRejectsMutationAfterCompletion() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DoctorClinicalAccessService access = mock(DoctorClinicalAccessService.class);
        PatientReportStoragePort storage = mock(PatientReportStoragePort.class);
        PatientReportMalwareScanner scanner = mock(PatientReportMalwareScanner.class);
        UUID doctor = UUID.randomUUID(), patient = UUID.randomUUID(), consultation = UUID.randomUUID();
        ResultSet encounter = mock(ResultSet.class);
        when(encounter.getObject("id", UUID.class)).thenReturn(consultation);
        when(encounter.getObject("patient_user_id", UUID.class)).thenReturn(patient);
        when(encounter.getString("status")).thenReturn("IN_PROGRESS");
        when(jdbc.query(contains("FOR UPDATE"), any(RowMapper.class), eq(consultation), eq(doctor)))
            .thenAnswer(call -> List.of(((RowMapper) call.getArgument(1)).mapRow(encounter, 0)));
        ResultSet document = mock(ResultSet.class);
        when(document.getObject("id", UUID.class)).thenReturn(UUID.randomUUID());
        when(document.getObject("consultation_id", UUID.class)).thenReturn(consultation);
        when(document.getString("original_filename")).thenReturn("prescription.pdf");
        when(document.getTimestamp("created_at")).thenReturn(Timestamp.from(Instant.now()));
        when(jdbc.query(contains("WHERE id = ? AND consultation_id = ?"), any(RowMapper.class), any(UUID.class), eq(consultation)))
            .thenAnswer(call -> List.of(((RowMapper) call.getArgument(1)).mapRow(document, 0)));
        when(scanner.scan(any())).thenReturn(PatientReportMalwareScanner.ScanResult.CLEAN);
        PrescriptionDocumentService service = new PrescriptionDocumentService(jdbc, access, storage,
            new PatientReportStorageProperties(), scanner, new PatientReportSecurityProperties(),
            mock(AuthAuditService.class), Clock.systemUTC());
        byte[] bytes = "%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF".getBytes(StandardCharsets.US_ASCII);
        MockMultipartFile file = new MockMultipartFile("file", "prescription.pdf", "application/pdf", bytes);

        assertEquals("prescription.pdf", service.upload(doctor, consultation, file, null, null).originalFilename());
        verify(scanner).scan(file);
        verify(storage).put(startsWith("consultation-prescriptions/"), eq(bytes), eq("application/pdf"));
        // Upload neither queries nor inserts structured medication rows.
        assertTrue(mockingDetails(jdbc).getInvocations().stream().noneMatch(invocation ->
            invocation.getArguments().length > 0 && invocation.getArguments()[0] instanceof String sql
                && sql.contains("consultation_prescriptions ")));
        when(encounter.getString("status")).thenReturn("COMPLETED");
        DoctorApiException failure = assertThrows(DoctorApiException.class,
            () -> service.upload(doctor, consultation, file, null, null));
        assertEquals("PRESCRIPTION_DOCUMENT_FINALIZED", failure.getErrorCode());
        verify(scanner, times(1)).scan(any());
    }
}
