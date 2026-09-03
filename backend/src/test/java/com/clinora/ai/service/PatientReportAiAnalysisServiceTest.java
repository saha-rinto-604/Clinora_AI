package com.clinora.ai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.ai.client.MedGemmaClient.AnalysisInputSnapshot;
import com.clinora.ai.client.MedGemmaClient.ClinicalObservation;
import com.clinora.ai.client.MedGemmaClient.ReportAnalysisResponse;
import com.clinora.ai.service.PatientReportAiAnalysisService.AnalysisView;
import com.clinora.ai.service.PatientReportAiAnalysisService.WorkItem;
import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.service.PatientTimelineService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class PatientReportAiAnalysisServiceTest {
    private static final UUID PATIENT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OTHER_PATIENT_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID REPORT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID EXTRACTION_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final UUID OBSERVATION_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final UUID JOB_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
    private static final Instant NOW = Instant.parse("2026-09-02T08:00:00Z");

    @Test
    void unverifiedLatestSuccessfulExtractionCannotRequestAnalysisOrFallBackToOlderVerifiedExtraction() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport(PATIENT_ID);
        fixture.latestExtraction("NEEDS_REVIEW");

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> fixture.service.request(PATIENT_ID, REPORT_ID)
        );

        assertEquals("REPORT_EXTRACTION_NOT_VERIFIED", exception.getErrorCode());
        verify(fixture.jdbc, never()).update(contains("INSERT INTO medical_report_ai_analysis_jobs"), any(Object[].class));
    }

    @Test
    void patientCannotRequestAnalysisForAnotherPatientsReport() {
        Fixture fixture = new Fixture();
        fixture.activePatient(OTHER_PATIENT_ID);
        fixture.missingReport(OTHER_PATIENT_ID);

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> fixture.service.request(OTHER_PATIENT_ID, REPORT_ID)
        );

        assertEquals("REPORT_NOT_FOUND", exception.getErrorCode());
        verify(fixture.jdbc, never()).update(contains("INSERT INTO medical_report_ai_analysis_jobs"), any(Object[].class));
    }

    @Test
    void sameClinicalFingerprintReusesExistingAnalysisJob() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport(PATIENT_ID);
        fixture.latestExtraction("VERIFIED");
        fixture.observation(new BigDecimal("8.0"));
        fixture.reusableJobMatchingRequestedFingerprint();

        AnalysisView view = fixture.service.request(PATIENT_ID, REPORT_ID);

        assertEquals(JOB_ID, view.jobId());
        assertEquals("QUEUED", view.status());
        assertFalse(view.stale());
        verify(fixture.jdbc, never()).update(contains("INSERT INTO medical_report_ai_analysis_jobs"), any(Object[].class));
    }

    @Test
    void changedConfirmedObservationMakesPriorAnalysisStale() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport(PATIENT_ID);
        fixture.latestExtraction("VERIFIED");
        fixture.observation(new BigDecimal("8.5"));
        fixture.noReusableJob();
        fixture.latestPriorJob("fingerprint-for-the-old-confirmed-values");

        AnalysisView view = fixture.service.view(PATIENT_ID, REPORT_ID);

        assertEquals(JOB_ID, view.jobId());
        assertTrue(view.stale());
        assertNotEquals("fingerprint-for-the-old-confirmed-values", fixture.requestedFingerprint);
    }

    @Test
    void invalidAiResponseIsRejectedBeforeSuccessfulResultIsPersisted() throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();
        AnalysisInputSnapshot input = new AnalysisInputSnapshot("LAB_REPORT", List.of(
            new ClinicalObservation(
                OBSERVATION_ID,
                "MPV",
                "NUMERIC",
                new BigDecimal("8.0"),
                null,
                null,
                "fL",
                "7.5-11.5",
                new BigDecimal("7.5"),
                new BigDecimal("11.5"),
                "NORMAL"
            )
        ));
        WorkItem work = new WorkItem(
            JOB_ID, REPORT_ID, PATIENT_ID, EXTRACTION_ID, input,
            "google/medgemma-1.5-4b-it", "main", "patient-lab-report-v1", "1.0"
        );
        ReportAnalysisResponse invalid = new ReportAnalysisResponse(
            "DEFINITIVE_DIAGNOSIS",
            "The diagnosis is final.",
            List.of(),
            List.of(),
            List.of(),
            "You definitely have a condition.",
            List.of(),
            "google/medgemma-1.5-4b-it",
            "main",
            "patient-lab-report-v1",
            "1.0"
        );

        assertThrows(IllegalStateException.class, () -> fixture.service.complete(work, invalid));

        verify(fixture.jdbc, never()).update(contains("INSERT INTO medical_report_ai_analysis_results"), any(Object[].class));
        verify(fixture.jdbc, never()).update(contains("status = 'SUCCEEDED'"), any(Object[].class));
    }

    private static final class Fixture {
        private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        private final PatientReportAiAnalysisService service;
        private String requestedFingerprint;

        @SuppressWarnings("unchecked")
        private Fixture() {
            ObjectProvider<Clock> clocks = mock(ObjectProvider.class);
            when(clocks.getIfAvailable(any())).thenReturn(Clock.fixed(NOW, ZoneOffset.UTC));
            service = new PatientReportAiAnalysisService(
                jdbc,
                mock(RabbitTemplate.class),
                mock(PatientTimelineService.class),
                mock(PatientNotificationService.class),
                new ObjectMapper(),
                clocks,
                "test-ai-queue",
                "google/medgemma-1.5-4b-it",
                "main",
                "patient-lab-report-v1",
                "1.0",
                15,
                300
            );
        }

        private void activePatient(UUID patientId) {
            when(jdbc.queryForObject(contains("FROM users"), eq(Integer.class), eq(patientId))).thenReturn(1);
        }

        private void ownedReport(UUID patientId) {
            activePatient(patientId);
            when(jdbc.query(
                contains("FROM patient_medical_reports"),
                any(RowMapper.class),
                eq(REPORT_ID),
                eq(patientId)
            )).thenAnswer(invocation -> {
                @SuppressWarnings("unchecked")
                RowMapper<Object> mapper = invocation.getArgument(1);
                ResultSet rs = mock(ResultSet.class);
                when(rs.getString("report_type")).thenReturn("LAB_REPORT");
                return List.of(mapper.mapRow(rs, 0));
            });
            when(jdbc.queryForObject(contains("FOR UPDATE"), eq(UUID.class), eq(REPORT_ID))).thenReturn(REPORT_ID);
        }

        private void missingReport(UUID patientId) {
            when(jdbc.query(
                contains("FROM patient_medical_reports"),
                any(RowMapper.class),
                eq(REPORT_ID),
                eq(patientId)
            )).thenReturn(List.of());
        }

        private void latestExtraction(String reviewStatus) throws Exception {
            when(jdbc.query(
                contains("FROM medical_report_extraction_results er"),
                any(RowMapper.class),
                eq(REPORT_ID),
                eq(PATIENT_ID)
            )).thenAnswer(invocation -> {
                @SuppressWarnings("unchecked")
                RowMapper<Object> mapper = invocation.getArgument(1);
                ResultSet rs = mock(ResultSet.class);
                when(rs.getObject("id", UUID.class)).thenReturn(EXTRACTION_ID);
                when(rs.getString("document_type")).thenReturn("LAB_REPORT");
                when(rs.getString("review_status")).thenReturn(reviewStatus);
                return List.of(mapper.mapRow(rs, 0));
            });
        }

        private void observation(BigDecimal value) throws Exception {
            when(jdbc.query(
                contains("verification_status IN"),
                any(RowMapper.class),
                eq(EXTRACTION_ID)
            )).thenAnswer(invocation -> {
                @SuppressWarnings("unchecked")
                RowMapper<Object> mapper = invocation.getArgument(1);
                ResultSet rs = mock(ResultSet.class);
                when(rs.getObject("id", UUID.class)).thenReturn(OBSERVATION_ID);
                when(rs.getString("effective_label")).thenReturn("MPV");
                when(rs.getString("effective_value_type")).thenReturn("NUMERIC");
                when(rs.getBigDecimal("effective_numeric_value")).thenReturn(value);
                when(rs.getString("effective_unit")).thenReturn("fL");
                when(rs.getString("reference_range_raw")).thenReturn("7.5-11.5");
                when(rs.getBigDecimal("reference_low")).thenReturn(new BigDecimal("7.5"));
                when(rs.getBigDecimal("reference_high")).thenReturn(new BigDecimal("11.5"));
                when(rs.getString("derived_range_flag")).thenReturn("NORMAL");
                return List.of(mapper.mapRow(rs, 0));
            });
        }

        private void reusableJobMatchingRequestedFingerprint() throws Exception {
            when(jdbc.query(
                contains("input_fingerprint = ?"),
                any(RowMapper.class),
                eq(PATIENT_ID),
                eq(REPORT_ID),
                anyString()
            )).thenAnswer(invocation -> {
                requestedFingerprint = invocation.getArgument(4);
                return List.of(mapJob(invocation, requestedFingerprint, "QUEUED"));
            });
        }

        private void noReusableJob() {
            when(jdbc.query(
                contains("input_fingerprint = ?"),
                any(RowMapper.class),
                eq(PATIENT_ID),
                eq(REPORT_ID),
                anyString()
            )).thenAnswer(invocation -> {
                requestedFingerprint = invocation.getArgument(4);
                return List.of();
            });
        }

        private void latestPriorJob(String fingerprint) throws Exception {
            when(jdbc.query(
                contains("ORDER BY requested_at DESC, created_at DESC"),
                any(RowMapper.class),
                eq(PATIENT_ID),
                eq(REPORT_ID)
            )).thenAnswer(invocation -> List.of(mapJob(invocation, fingerprint, "FAILED")));
        }

        private void processingJob() throws Exception {
            when(jdbc.query(
                contains("FROM medical_report_ai_analysis_jobs\nWHERE id = ?"),
                any(RowMapper.class),
                eq(JOB_ID)
            )).thenAnswer(invocation -> List.of(mapJob(invocation, "fingerprint", "PROCESSING")));
        }

        private Object mapJob(org.mockito.invocation.InvocationOnMock invocation, String fingerprint, String status)
            throws Exception {
            @SuppressWarnings("unchecked")
            RowMapper<Object> mapper = invocation.getArgument(1);
            ResultSet rs = mock(ResultSet.class);
            when(rs.getObject("id", UUID.class)).thenReturn(JOB_ID);
            when(rs.getObject("report_id", UUID.class)).thenReturn(REPORT_ID);
            when(rs.getObject("patient_user_id", UUID.class)).thenReturn(PATIENT_ID);
            when(rs.getObject("extraction_result_id", UUID.class)).thenReturn(EXTRACTION_ID);
            when(rs.getString("input_fingerprint")).thenReturn(fingerprint);
            when(rs.getString("status")).thenReturn(status);
            when(rs.getString("model_name")).thenReturn("google/medgemma-1.5-4b-it");
            when(rs.getString("model_revision")).thenReturn("main");
            when(rs.getString("prompt_version")).thenReturn("patient-lab-report-v1");
            when(rs.getString("schema_version")).thenReturn("1.0");
            when(rs.getTimestamp("requested_at")).thenReturn(Timestamp.from(NOW));
            return mapper.mapRow(rs, 0);
        }
    }
}
