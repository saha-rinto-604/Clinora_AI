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
import com.clinora.ai.client.MedGemmaClient.ClinicalCluster;
import com.clinora.ai.client.MedGemmaClient.ClusterCandidate;
import com.clinora.ai.client.MedGemmaClient.ClusterEvidence;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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

    @Test
    void v5PersistsMultipleClustersAndTwoPossibilitiesWithoutLegacyPatterns() throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();
        UUID secondId = UUID.fromString("66666666-6666-6666-6666-666666666666");
        ClinicalCluster first = cluster(OBSERVATION_ID, List.of(
            candidate("Possible process A", OBSERVATION_ID), candidate("Possible process B", OBSERVATION_ID)
        ));
        ClinicalCluster second = cluster(secondId, List.of(candidate("Possible process C", secondId)));
        ReportAnalysisResponse response = clusterResponse(List.of(first, second));

        fixture.service.complete(clusterWork(OBSERVATION_ID, secondId), response);

        verify(fixture.jdbc).update(contains("INSERT INTO medical_report_ai_analysis_results"), any(Object[].class));
        ObjectMapper mapper = new ObjectMapper();
        ReportAnalysisResponse stored = mapper.readValue(mapper.writeValueAsString(response), ReportAnalysisResponse.class);
        assertEquals(response, stored);
        assertEquals(2, stored.clinicalClusters().size());
        assertEquals(2, stored.clinicalClusters().getFirst().candidates().size());
        assertEquals(List.of(secondId), stored.clinicalClusters().get(1).candidates().getFirst().supportingObservationIds());
    }

    @Test
    void v5PatternOnlyClusterIsAcceptedWithoutForcingCandidate() throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();

        fixture.service.complete(clusterWork(OBSERVATION_ID), clusterResponse(List.of(cluster(OBSERVATION_ID, List.of()))));

        verify(fixture.jdbc).update(contains("INSERT INTO medical_report_ai_analysis_results"), any(Object[].class));
    }

    @Test
    void v5CandidateCannotBorrowSupportFromAnotherCluster() throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();
        UUID secondId = UUID.fromString("66666666-6666-6666-6666-666666666666");
        ReportAnalysisResponse response = clusterResponse(List.of(
            cluster(OBSERVATION_ID, List.of(candidate("Possible process", secondId))),
            cluster(secondId, List.of())
        ));

        assertThrows(IllegalStateException.class, () -> fixture.service.complete(clusterWork(OBSERVATION_ID, secondId), response));
        verify(fixture.jdbc, never()).update(contains("INSERT INTO medical_report_ai_analysis_results"), any(Object[].class));
    }

    @Test
    void v5BoundaryRejectsUnknownEvidenceThatEscapedAiGrounding() throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();
        UUID unknownId = UUID.fromString("66666666-6666-6666-6666-666666666666");

        assertThrows(IllegalStateException.class, () -> fixture.service.complete(
            clusterWork(OBSERVATION_ID), clusterResponse(List.of(cluster(unknownId, List.of())))
        ));
        verify(fixture.jdbc, never()).update(contains("INSERT INTO medical_report_ai_analysis_results"), any(Object[].class));
    }

    @Test
    void v5ContextEvidenceCannotBecomeCandidateSupport() throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();
        ClinicalCluster cluster = new ClinicalCluster("Clinical pattern", "A possible related pattern.",
            List.of(new ClusterEvidence(OBSERVATION_ID, "CONTEXT", "Provides neutral context.")),
            List.of(candidate("Possible process", OBSERVATION_ID)), List.of(), List.of());

        assertThrows(IllegalStateException.class, () -> fixture.service.complete(
            clusterWork(OBSERVATION_ID), clusterResponse(List.of(cluster))
        ));
    }

    @Test
    void v5ContradictoryEvidenceRemainsScopedAndSeparateFromSupport() throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();
        UUID secondId = UUID.fromString("66666666-6666-6666-6666-666666666666");
        ClinicalCluster cluster = new ClinicalCluster("Clinical pattern", "A possible related pattern.",
            List.of(new ClusterEvidence(OBSERVATION_ID, "SUPPORTS", "Supports the possible process."),
                new ClusterEvidence(secondId, "CONTRADICTS", "Does not fully match the possible process.")),
            List.of(new ClusterCandidate("Possible process", "The verified findings may fit this process.",
                List.of(OBSERVATION_ID), List.of(secondId), List.of(), List.of(), "LIMITED")),
            List.of(), List.of());

        fixture.service.complete(clusterWork(OBSERVATION_ID, secondId), clusterResponse(List.of(cluster)));

        verify(fixture.jdbc).update(contains("INSERT INTO medical_report_ai_analysis_results"), any(Object[].class));
    }

    @Test
    void v5RejectsExcessClustersAndCandidates() throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();
        ClinicalCluster pattern = cluster(OBSERVATION_ID, List.of());
        assertThrows(IllegalStateException.class, () -> fixture.service.complete(
            clusterWork(OBSERVATION_ID), clusterResponse(List.of(pattern, pattern, pattern, pattern))
        ));
        assertThrows(IllegalStateException.class, () -> fixture.service.complete(
            clusterWork(OBSERVATION_ID), clusterResponse(List.of(cluster(OBSERVATION_ID, List.of(
                candidate("Possible A", OBSERVATION_ID), candidate("Possible B", OBSERVATION_ID),
                candidate("Possible C", OBSERVATION_ID)
            ))))
        ));
    }

    @ParameterizedTest
    @ValueSource(strings = {"overall", "title", "interpretation", "relevance", "name", "rationale", "missing", "alternatives", "clusterMissing", "clusterAlternatives"})
    void v5NewPatientTextFieldsRetainSafetyBoundary(String field) throws Exception {
        Fixture fixture = new Fixture();
        fixture.processingJob();
        String unsafe = "Start taking a medicine.";
        ClinicalCluster cluster = new ClinicalCluster(
            field.equals("title") ? unsafe : "Clinical pattern",
            field.equals("interpretation") ? unsafe : "A possible related pattern.",
            List.of(new ClusterEvidence(OBSERVATION_ID, "SUPPORTS", field.equals("relevance") ? unsafe : "Related finding.")),
            List.of(new ClusterCandidate(field.equals("name") ? unsafe : "Possible process",
                field.equals("rationale") ? unsafe : "These findings may fit.", List.of(OBSERVATION_ID), List.of(),
                field.equals("missing") ? List.of(unsafe) : List.of(),
                field.equals("alternatives") ? List.of(unsafe) : List.of(), "LIMITED")),
            field.equals("clusterMissing") ? List.of(unsafe) : List.of(),
            field.equals("clusterAlternatives") ? List.of(unsafe) : List.of());
        ReportAnalysisResponse response = new ReportAnalysisResponse(
            "POSSIBLE_CLINICAL_PATTERN", "Verified report summary.", List.of(), List.of(), List.of(),
            "Please discuss these possibilities with your clinician.", List.of(),
            "google/medgemma-1.5-4b-it", "main", "patient-lab-report-v5", "1.1", List.of(cluster),
            field.equals("overall") ? unsafe : "A related clinical pattern may be present.");

        assertThrows(IllegalStateException.class, () -> fixture.service.complete(clusterWork(OBSERVATION_ID), response));
        verify(fixture.jdbc, never()).update(contains("INSERT INTO medical_report_ai_analysis_results"), any(Object[].class));
    }

    @Test
    void historicalSchemaDeserializesWithoutNewFields() throws Exception {
        ReportAnalysisResponse historical = new ObjectMapper().readValue("""
            {"analysisStatus":"NO_CLEAR_ABNORMAL_PATTERN", "summary":"No clear abnormal pattern.",
             "clinicalPatterns":[], "patientExplanation":"Discuss your report with your clinician.",
             "modelName":"google/medgemma-1.5-4b-it", "modelRevision":"main",
             "promptVersion":"patient-lab-report-v4", "schemaVersion":"1.0"}
            """, ReportAnalysisResponse.class);

        assertEquals(List.of(), historical.clinicalClusters());
        assertEquals("1.0", historical.schemaVersion());
        assertEquals(null, historical.overallInterpretation());
    }

    @Test
    void preservesNeutralDisplayTitleAndExplicitUnknownContextThroughJson() throws Exception {
        UUID contextId = UUID.randomUUID();
        ClinicalCluster group = new ClinicalCluster("PDW pattern", "Reference information limits this grouping.",
            List.of(new ClusterEvidence(OBSERVATION_ID, "SUPPORTS", "Size variation merits review.", "VERIFIED_ABNORMAL"),
                new ClusterEvidence(contextId, "CONTEXT", "Range status unavailable.", "UNKNOWN")),
            List.of(), List.of("Usable reference information"), List.of(), "PDW + Platelets pattern");
        ObjectMapper mapper = new ObjectMapper();
        ReportAnalysisResponse result = mapper.readValue(mapper.writeValueAsString(clusterResponse(List.of(group))), ReportAnalysisResponse.class);
        assertEquals("PDW + Platelets pattern", result.clinicalClusters().getFirst().displayTitle());
        assertEquals("UNKNOWN", result.clinicalClusters().getFirst().evidence().get(1).supportEligibility());
        assertEquals("CONTEXT", result.clinicalClusters().getFirst().evidence().get(1).role());
        assertEquals(List.of(), result.clinicalClusters().getFirst().candidates());
    }

    private static WorkItem clusterWork(UUID... observationIds) {
        AnalysisInputSnapshot input = new AnalysisInputSnapshot("LAB_REPORT", java.util.Arrays.stream(observationIds)
            .map(id -> new ClinicalObservation(id, "Verified finding", "NUMERIC", new BigDecimal("12.0"),
                null, null, "unit", "2-10", new BigDecimal("2"), new BigDecimal("10"), "HIGH"))
            .toList());
        return new WorkItem(JOB_ID, REPORT_ID, PATIENT_ID, EXTRACTION_ID, input,
            "google/medgemma-1.5-4b-it", "main", "patient-lab-report-v5", "1.1");
    }

    private static ClusterCandidate candidate(String name, UUID supportId) {
        return new ClusterCandidate(name, "The verified findings may fit this process.",
            List.of(supportId), List.of(), List.of("Clinical history"), List.of("Other physiological processes"), "LIMITED");
    }

    private static ClinicalCluster cluster(UUID evidenceId, List<ClusterCandidate> candidates) {
        return new ClinicalCluster("Related clinical pattern", "The findings may reflect a related process.",
            List.of(new ClusterEvidence(evidenceId, "SUPPORTS", "Contributes to the clinical pattern.")),
            candidates, List.of("Clinical context"), List.of());
    }

    private static ReportAnalysisResponse clusterResponse(List<ClinicalCluster> clusters) {
        return new ReportAnalysisResponse("POSSIBLE_CLINICAL_PATTERN", "Verified report summary.",
            List.of(), List.of(), List.of(), "Please discuss these possibilities with your clinician.", List.of(),
            "google/medgemma-1.5-4b-it", "main", "patient-lab-report-v5", "1.1", clusters,
            "The report contains potentially independent clinical patterns.");
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
