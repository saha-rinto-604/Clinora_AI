package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.ocr.client.OcrClient.ExtractionResponse;
import com.clinora.ocr.client.OcrClient.Observation;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.domain.PatientMedicalReport;
import com.clinora.patients.repository.PatientMedicalReportRepository;
import com.clinora.patients.service.PatientReportExtractionService.CorrectionCommand;
import com.clinora.patients.service.PatientReportExtractionService.ExtractionView;
import com.clinora.patients.service.PatientReportExtractionService.WorkItem;
import com.clinora.patients.storage.PatientReportStoragePort;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class PatientReportExtractionServiceTest {
    private static final UUID PATIENT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OTHER_PATIENT_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID REPORT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID JOB_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final UUID RESULT_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final UUID OBSERVATION_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
    private static final UUID PRIOR_JOB_ID = UUID.fromString("66666666-6666-4666-8666-666666666666");
    private static final Instant NOW = Instant.parse("2026-09-02T08:00:00Z");

    @Test
    void confirmsFlaggedObservationWithoutChangingItsClinicalValue() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport();
        fixture.observation(true, "UNREVIEWED", new BigDecimal("8"));
        fixture.unresolvedCount(0);

        ExtractionView result = fixture.service.confirmObservation(PATIENT_ID, REPORT_ID, OBSERVATION_ID);

        assertEquals(fixture.view, result);
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(fixture.jdbc, atLeastOnce()).update(sql.capture(), any(Object[].class));
        String confirmationSql = sql.getAllValues().stream()
            .filter(value -> value.contains("verification_status = 'PATIENT_CONFIRMED'"))
            .findFirst()
            .orElseThrow();
        assertTrue(confirmationSql.contains("review_required = FALSE"));
        assertTrue(!confirmationSql.contains("effective_numeric_value"));
        verify(fixture.jdbc).update(
            contains("verification_status = 'PATIENT_CONFIRMED'"),
            any(Timestamp.class),
            eq(OBSERVATION_ID),
            eq(RESULT_ID)
        );
    }

    @Test
    void correctionKeepsHistoryAndResolvesReviewAsPatientCorrected() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport();
        fixture.observation(true, "UNREVIEWED", new BigDecimal("8"));
        fixture.unresolvedCount(0);
        when(fixture.jdbc.queryForObject(
            contains("medical_report_observation_corrections"),
            eq(Integer.class),
            eq(OBSERVATION_ID)
        )).thenReturn(1);

        fixture.service.correct(
            PATIENT_ID,
            REPORT_ID,
            OBSERVATION_ID,
            new CorrectionCommand("MPV", "NUMERIC", new BigDecimal("8.5"), null, null, "fL", null, null, null, null)
        );

        verify(fixture.jdbc).update(
            contains("INSERT INTO medical_report_observation_corrections"),
            any(Object[].class)
        );
        verify(fixture.jdbc).update(
            contains("verification_status = 'PATIENT_CORRECTED'"),
            any(Object[].class)
        );
    }

    @Test
    void finalConfirmationIsBlockedWhileAnyFlaggedObservationIsUnresolved() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport();
        fixture.latestSuccessfulExtraction();
        fixture.observationCount(2);
        fixture.unresolvedCount(1);

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> fixture.service.confirm(PATIENT_ID, REPORT_ID)
        );

        assertEquals("REPORT_EXTRACTION_REVIEW_REQUIRED", exception.getErrorCode());
        verify(fixture.jdbc, never()).update(contains("review_status = 'VERIFIED'"), any(Object[].class));
    }

    @Test
    void finalConfirmationVerifiesExtractionAfterAllRequiredReviewsAreResolved() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport();
        fixture.latestSuccessfulExtraction();
        fixture.observationCount(2);
        fixture.unresolvedCount(0);

        ExtractionView result = fixture.service.confirm(PATIENT_ID, REPORT_ID);

        assertEquals(fixture.view, result);
        verify(fixture.jdbc).update(
            contains("SET verification_status = 'PATIENT_CONFIRMED'"),
            any(Object[].class)
        );
        verify(fixture.jdbc).update(contains("SET review_status = 'VERIFIED'"), any(Object[].class));
    }

    @Test
    void patientCannotReviewAnObservationFromAnotherPatientsReport() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        when(fixture.reports.findByIdAndPatientUserId(REPORT_ID, OTHER_PATIENT_ID)).thenReturn(Optional.empty());

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> fixture.service.confirmObservation(OTHER_PATIENT_ID, REPORT_ID, OBSERVATION_ID)
        );

        assertEquals("REPORT_NOT_FOUND", exception.getErrorCode());
        verify(fixture.jdbc, never()).update(contains("PATIENT_CONFIRMED"), any(Object[].class));
    }

    @Test
    void patientCanReExtractOwnReportUsingOriginalStoredObject() throws Exception {
        Fixture fixture = new Fixture();
        PatientMedicalReport report = fixture.ownedReportWithSource();
        when(fixture.storage.exists("reports/source.pdf")).thenReturn(true);
        fixture.queuedJob();

        ExtractionView result = fixture.service.reExtract(PATIENT_ID, REPORT_ID);

        assertEquals("QUEUED", result.status());
        assertTrue(result.reprocessing());
        verify(fixture.storage).exists(report.getObjectKey());
        verify(fixture.jdbc).update(contains("request_kind, baseline_result_id"), any(Object[].class));
    }

    @Test
    void duplicateReExtractionReturnsActiveJobWithoutCreatingAnother() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReportWithSource();
        fixture.activeExtractionJob("PROCESSING");

        ExtractionView result = fixture.service.reExtract(PATIENT_ID, REPORT_ID);

        assertEquals("PROCESSING", result.status());
        verify(fixture.jdbc, never()).update(contains("INSERT INTO medical_report_extraction_jobs"), any(Object[].class));
        verify(fixture.storage, never()).exists(anyString());
    }

    @Test
    void reExtractionFailsSafelyWhenOriginalSourceIsUnavailable() {
        Fixture fixture = new Fixture();
        fixture.ownedReportWithSource();
        when(fixture.storage.exists("reports/source.pdf")).thenReturn(false);

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> fixture.service.reExtract(PATIENT_ID, REPORT_ID)
        );

        assertEquals("REPORT_SOURCE_UNAVAILABLE", exception.getErrorCode());
        verify(fixture.jdbc, never()).update(contains("INSERT INTO medical_report_extraction_jobs"), any(Object[].class));
    }

    @Test
    void patientCannotReExtractAnotherPatientsReport() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        when(fixture.reports.findByIdAndPatientUserId(REPORT_ID, OTHER_PATIENT_ID)).thenReturn(Optional.empty());

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> fixture.service.reExtract(OTHER_PATIENT_ID, REPORT_ID)
        );

        assertEquals("REPORT_NOT_FOUND", exception.getErrorCode());
        verify(fixture.jdbc, never()).update(contains("INSERT INTO medical_report_extraction_jobs"), any(Object[].class));
    }

    @Test
    void failedReExtractionKeepsPreviousSuccessfulExtractionVisible() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport();
        fixture.failedJobWithPreviousSuccess();
        doCallRealMethod().when(fixture.service).view(PATIENT_ID, REPORT_ID);

        ExtractionView view = fixture.service.view(PATIENT_ID, REPORT_ID);

        assertEquals("FAILED", view.status());
        assertEquals(RESULT_ID, view.resultId());
        assertTrue(view.displayedPreviousResult());
    }

    @Test
    void changedProtectedValueCreatesPendingDifferenceInsteadOfOverwritingBaseline() throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();
        UUID baselineResultId = UUID.fromString("77777777-7777-7777-7777-777777777777");
        fixture.comparisonObservations(baselineResultId, new BigDecimal("9.1"), new BigDecimal("8.0"));
        WorkItem work = new WorkItem(
            JOB_ID, REPORT_ID, PATIENT_ID, "reports/source.pdf", "source.pdf", "application/pdf",
            "RE_EXTRACTION", baselineResultId
        );
        Observation result = new Observation(
            "MPV", "MPV", "NUMERIC", "9.1", new BigDecimal("9.1"), null, null, "fL",
            "7.5-11.5", new BigDecimal("7.5"), new BigDecimal("11.5"), null,
            "WITHIN_REPORTED_RANGE", 1, null, new BigDecimal("0.98"), false
        );
        ExtractionResponse response = new ExtractionResponse(
            "PADDLE_PP_STRUCTURE_V3", "3.5.0", "LAB_REPORT", 1, new BigDecimal("0.98"),
            "clinora-lab-parser-v3", "clinora-lab-normalizer-v3", "HIGH_CONFIDENCE", List.of(result), List.of()
        );

        fixture.service.complete(work, response);

        verify(fixture.jdbc).update(contains("INSERT INTO medical_report_extraction_differences"), any(Object[].class));
        verify(fixture.jdbc).update(contains("SET review_required = TRUE"), any(Object[].class));
        verify(fixture.jdbc, never()).update(contains("extraction_result_id = ?\n            SET effective"), any(Object[].class));
    }

    @Test
    void incompleteExtractionWarningFailsClosedBeforePersistingObservations() throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();
        WorkItem work = new WorkItem(JOB_ID, REPORT_ID, PATIENT_ID, "reports/source.pdf", "source.pdf", "application/pdf");
        ExtractionResponse response = new ExtractionResponse(
            "PADDLE_PP_STRUCTURE_V3",
            "3.5.0",
            "LAB_REPORT",
            1,
            new BigDecimal("0.98"),
            "clinora-lab-parser-v3",
            "clinora-lab-normalizer-v3",
            "INSUFFICIENT",
            List.of(),
            List.of("EXTRACTION_QUALITY_INSUFFICIENT")
        );

        fixture.service.complete(work, response);

        verify(fixture.jdbc).update(
            contains("SET status = 'FAILED'"),
            eq("EXTRACTION_QUALITY_INSUFFICIENT"),
            any(Timestamp.class),
            any(Timestamp.class),
            eq(JOB_ID)
        );
        verify(fixture.jdbc, never()).update(
            contains("INSERT INTO medical_report_extraction_results"),
            any(Object[].class)
        );
    }

    @Test
    void persistsRawResultTextAlongsideNormalizedNumericValue() throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();
        WorkItem work = new WorkItem(JOB_ID, REPORT_ID, PATIENT_ID, "reports/source.pdf", "source.pdf", "application/pdf");
        Observation platelet = new Observation(
            "Total Platelet Count", "Platelets", "NUMERIC", "1,60,000", new BigDecimal("160000"),
            null, null, "/Cmm", "1,50,000-4,50,000/Cmm", new BigDecimal("150000"),
            new BigDecimal("450000"), null, "WITHIN_REPORTED_RANGE", 1, null,
            new BigDecimal("0.98"), false
        );
        ExtractionResponse response = new ExtractionResponse(
            "PADDLE_PP_STRUCTURE_V3", "3.5.0", "LAB_REPORT", 1, new BigDecimal("0.98"),
            "clinora-lab-parser-v3", "clinora-lab-normalizer-v3", "HIGH_CONFIDENCE",
            List.of(platelet), List.of()
        );

        fixture.service.complete(work, response);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> arguments = ArgumentCaptor.forClass(Object[].class);
        verify(fixture.jdbc, atLeastOnce()).update(sql.capture(), arguments.capture());
        int insertIndex = java.util.stream.IntStream.range(0, sql.getAllValues().size())
            .filter(index -> sql.getAllValues().get(index).contains("INSERT INTO medical_report_observations"))
            .findFirst()
            .orElseThrow();
        assertTrue(sql.getAllValues().get(insertIndex).contains("ocr_raw_value"));
        assertTrue(java.util.Arrays.asList(arguments.getAllValues().get(insertIndex)).contains("1,60,000"));
        assertTrue(java.util.Arrays.asList(arguments.getAllValues().get(insertIndex)).contains(new BigDecimal("160000")));
    }

    private static final class Fixture {
        private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        private final PatientMedicalReportRepository reports = mock(PatientMedicalReportRepository.class);
        private final PatientReportStoragePort storage = mock(PatientReportStoragePort.class);
        private final PatientTimelineService timeline = mock(PatientTimelineService.class);
        private final ExtractionView view = ExtractionView.notRequested(REPORT_ID);
        private final PatientReportExtractionService service;

        private Fixture() {
            PatientReportExtractionService target = new PatientReportExtractionService(
                jdbc,
                reports,
                storage,
                mock(RabbitTemplate.class),
                timeline,
                mock(PatientNotificationService.class),
                new ObjectMapper(),
                Clock.fixed(NOW, ZoneOffset.UTC),
                "test-ocr-queue",
                15,
                600
            );
            service = spy(target);
            doReturn(view).when(service).view(PATIENT_ID, REPORT_ID);
            doReturn(view).when(service).view(OTHER_PATIENT_ID, REPORT_ID);
            when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        }

        private void activePatient() {
            when(jdbc.queryForObject(contains("FROM users"), eq(Integer.class), any(UUID.class))).thenReturn(1);
        }

        private void ownedReport() {
            activePatient();
            when(reports.findByIdAndPatientUserId(REPORT_ID, PATIENT_ID)).thenReturn(Optional.of(mock(PatientMedicalReport.class)));
        }

        private PatientMedicalReport ownedReportWithSource() {
            activePatient();
            PatientMedicalReport report = mock(PatientMedicalReport.class);
            when(report.getObjectKey()).thenReturn("reports/source.pdf");
            when(report.getSha256Checksum()).thenReturn("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
            when(reports.findByIdAndPatientUserId(REPORT_ID, PATIENT_ID)).thenReturn(Optional.of(report));
            when(jdbc.queryForObject(contains("FOR UPDATE"), eq(UUID.class), eq(REPORT_ID))).thenReturn(REPORT_ID);
            return report;
        }

        private void queuedJob() throws Exception {
            when(jdbc.query(contains("FROM medical_report_extraction_jobs WHERE id"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(invocation -> List.of(mapJob(invocation, "QUEUED", "RE_EXTRACTION")));
        }

        private void activeExtractionJob(String status) throws Exception {
            when(jdbc.query(contains("status IN ('QUEUED', 'PROCESSING')"), any(RowMapper.class), eq(REPORT_ID)))
                .thenAnswer(invocation -> List.of(mapJob(invocation, status, "RE_EXTRACTION")));
        }

        private Object mapJob(org.mockito.invocation.InvocationOnMock invocation, String status, String requestKind) throws Exception {
            @SuppressWarnings("unchecked")
            RowMapper<Object> mapper = invocation.getArgument(1);
            ResultSet rs = mock(ResultSet.class);
            when(rs.getObject("id", UUID.class)).thenReturn(JOB_ID);
            when(rs.getObject("report_id", UUID.class)).thenReturn(REPORT_ID);
            when(rs.getObject("patient_user_id", UUID.class)).thenReturn(PATIENT_ID);
            when(rs.getString("source_checksum")).thenReturn("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
            when(rs.getString("status")).thenReturn(status);
            when(rs.getString("request_kind")).thenReturn(requestKind);
            when(rs.getTimestamp("requested_at")).thenReturn(Timestamp.from(NOW));
            return mapper.mapRow(rs, 0);
        }

        private void failedJobWithPreviousSuccess() throws Exception {
            when(jdbc.query(contains("ORDER BY requested_at DESC, created_at DESC"), any(RowMapper.class), eq(REPORT_ID)))
                .thenAnswer(invocation -> List.of(mapJob(invocation, "FAILED", "RE_EXTRACTION")));
            when(jdbc.query(contains("status = 'SUCCEEDED' AND id <> ?"), any(RowMapper.class), eq(REPORT_ID), eq(JOB_ID)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    ResultSet rs = mock(ResultSet.class);
                    when(rs.getObject("id", UUID.class)).thenReturn(PRIOR_JOB_ID);
                    when(rs.getObject("report_id", UUID.class)).thenReturn(REPORT_ID);
                    when(rs.getObject("patient_user_id", UUID.class)).thenReturn(PATIENT_ID);
                    when(rs.getString("status")).thenReturn("SUCCEEDED");
                    when(rs.getString("request_kind")).thenReturn("INITIAL");
                    return List.of(mapper.mapRow(rs, 0));
                });
            when(jdbc.query(contains("FROM medical_report_extraction_results WHERE job_id"), any(RowMapper.class), eq(PRIOR_JOB_ID)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    ResultSet rs = mock(ResultSet.class);
                    when(rs.getObject("id", UUID.class)).thenReturn(RESULT_ID);
                    when(rs.getString("document_type")).thenReturn("LAB_REPORT");
                    when(rs.getInt("page_count")).thenReturn(1);
                    when(rs.getString("review_status")).thenReturn("VERIFIED");
                    return List.of(mapper.mapRow(rs, 0));
                });
        }

        private void comparisonObservations(UUID baselineResultId, BigDecimal currentValue, BigDecimal baselineValue) throws Exception {
            when(jdbc.query(contains("SELECT id, normalized_label"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(invocation -> {
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1);
                    UUID requestedResultId = invocation.getArgument(2);
                    boolean baseline = baselineResultId.equals(requestedResultId);
                    ResultSet rs = mock(ResultSet.class);
                    when(rs.getObject("id", UUID.class)).thenReturn(baseline ? UUID.randomUUID() : OBSERVATION_ID);
                    when(rs.getString("normalized_label")).thenReturn("MPV");
                    when(rs.getString("effective_label")).thenReturn("MPV");
                    when(rs.getString("effective_value_type")).thenReturn("NUMERIC");
                    when(rs.getBigDecimal("effective_numeric_value")).thenReturn(baseline ? baselineValue : currentValue);
                    when(rs.getString("effective_unit")).thenReturn("fL");
                    when(rs.getString("reference_range_raw")).thenReturn("7.5-11.5");
                    when(rs.getBigDecimal("reference_low")).thenReturn(new BigDecimal("7.5"));
                    when(rs.getBigDecimal("reference_high")).thenReturn(new BigDecimal("11.5"));
                    return List.of(mapper.mapRow(rs, 0));
                });
        }

        private void observation(boolean reviewRequired, String verificationStatus, BigDecimal numericValue) throws Exception {
            when(jdbc.query(
                contains("FROM medical_report_observations o"),
                any(RowMapper.class),
                eq(OBSERVATION_ID),
                eq(REPORT_ID),
                eq(PATIENT_ID)
            )).thenAnswer(invocation -> {
                @SuppressWarnings("unchecked")
                RowMapper<Object> mapper = invocation.getArgument(1);
                ResultSet rs = mock(ResultSet.class);
                when(rs.getObject("id", UUID.class)).thenReturn(OBSERVATION_ID);
                when(rs.getObject("extraction_result_id", UUID.class)).thenReturn(RESULT_ID);
                when(rs.getString("source_label")).thenReturn("MPV");
                when(rs.getString("effective_label")).thenReturn("MPV");
                when(rs.getString("effective_value_type")).thenReturn("NUMERIC");
                when(rs.getBigDecimal("effective_numeric_value")).thenReturn(numericValue);
                when(rs.getString("effective_unit")).thenReturn("fL");
                when(rs.getBoolean("review_required")).thenReturn(reviewRequired);
                when(rs.getString("verification_status")).thenReturn(verificationStatus);
                return List.of(mapper.mapRow(rs, 0));
            });
        }

        private void unresolvedCount(int count) {
            when(jdbc.queryForObject(
                contains("review_required = TRUE AND verification_status = 'UNREVIEWED'"),
                eq(Integer.class),
                eq(RESULT_ID)
            )).thenReturn(count);
        }

        private void observationCount(int count) {
            when(jdbc.queryForObject(
                contains("COUNT(*) FROM medical_report_observations WHERE extraction_result_id"),
                eq(Integer.class),
                eq(RESULT_ID)
            )).thenReturn(count);
        }

        private void latestSuccessfulExtraction() throws Exception {
            when(jdbc.query(
                contains("FROM medical_report_extraction_jobs"),
                any(RowMapper.class),
                eq(REPORT_ID)
            )).thenAnswer(invocation -> {
                @SuppressWarnings("unchecked")
                RowMapper<Object> mapper = invocation.getArgument(1);
                ResultSet rs = mock(ResultSet.class);
                when(rs.getObject("id", UUID.class)).thenReturn(JOB_ID);
                when(rs.getObject("report_id", UUID.class)).thenReturn(REPORT_ID);
                when(rs.getObject("patient_user_id", UUID.class)).thenReturn(PATIENT_ID);
                when(rs.getString("source_checksum")).thenReturn("checksum");
                when(rs.getString("status")).thenReturn("SUCCEEDED");
                when(rs.getTimestamp("requested_at")).thenReturn(Timestamp.from(NOW));
                return List.of(mapper.mapRow(rs, 0));
            });
            when(jdbc.query(
                contains("FROM medical_report_extraction_results WHERE job_id"),
                any(RowMapper.class),
                eq(JOB_ID)
            )).thenAnswer(invocation -> {
                @SuppressWarnings("unchecked")
                RowMapper<Object> mapper = invocation.getArgument(1);
                ResultSet rs = mock(ResultSet.class);
                when(rs.getObject("id", UUID.class)).thenReturn(RESULT_ID);
                when(rs.getString("document_type")).thenReturn("LAB_REPORT");
                when(rs.getInt("page_count")).thenReturn(1);
                when(rs.getString("review_status")).thenReturn("READY_FOR_CONFIRMATION");
                return List.of(mapper.mapRow(rs, 0));
            });
        }

        private void processingJob() throws Exception {
            when(jdbc.query(
                contains("FROM medical_report_extraction_jobs WHERE id"),
                any(RowMapper.class),
                eq(JOB_ID)
            )).thenAnswer(invocation -> {
                @SuppressWarnings("unchecked")
                RowMapper<Object> mapper = invocation.getArgument(1);
                ResultSet rs = mock(ResultSet.class);
                when(rs.getObject("id", UUID.class)).thenReturn(JOB_ID);
                when(rs.getObject("report_id", UUID.class)).thenReturn(REPORT_ID);
                when(rs.getObject("patient_user_id", UUID.class)).thenReturn(PATIENT_ID);
                when(rs.getString("source_checksum")).thenReturn("checksum");
                when(rs.getString("status")).thenReturn("PROCESSING");
                when(rs.getTimestamp("requested_at")).thenReturn(Timestamp.from(NOW));
                return List.of(mapper.mapRow(rs, 0));
            });
        }
    }
}
