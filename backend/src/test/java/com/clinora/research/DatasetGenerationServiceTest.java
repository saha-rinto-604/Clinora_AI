package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.deid.DeidentificationResult;
import com.clinora.research.deid.DeidentificationService;
import com.clinora.research.domain.*;
import com.clinora.research.domain.catalog.ResearchDataCatalog;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.repository.*;
import com.clinora.research.service.DatasetGenerationService;
import com.clinora.research.storage.ResearchDatasetStoragePort;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DatasetGenerationServiceTest {

    @Mock private DatasetRequestRepository requestRepository;
    @Mock private ResearchProjectRepository projectRepository;
    @Mock private ResearchDatasetRepository datasetRepository;
    @Mock private DatasetVersionRepository versionRepository;
    @Mock private DatasetAccessGrantRepository accessGrantRepository;
    @Mock private DatasetGenerationJobRepository jobRepository;
    @Mock private DeidentificationService deidentificationService;
    @Mock private ResearchDatasetStoragePort storagePort;
    @Mock private NamedParameterJdbcTemplate jdbcTemplate;
    @Mock private RabbitTemplate rabbitTemplate;
    @Mock private AuthAuditService auditService;

    private ResearchDataCatalog catalog;
    private Clock clock;
    private DatasetGenerationService service;

    @BeforeEach
    void setUp() {
        catalog = new ResearchDataCatalog();
        clock = Clock.fixed(Instant.parse("2026-09-21T10:00:00Z"), ZoneOffset.UTC);
        service = new DatasetGenerationService(
                requestRepository,
                projectRepository,
                datasetRepository,
                versionRepository,
                accessGrantRepository,
                jobRepository,
                deidentificationService,
                storagePort,
                jdbcTemplate,
                catalog,
                rabbitTemplate,
                auditService,
                new ObjectMapper(),
                clock,
                "clinora.research.dataset-generation"
        , org.mockito.Mockito.mock(com.clinora.research.service.ResearchAccessGuard.class), org.mockito.Mockito.mock(com.clinora.research.service.ResearchPrivacyService.class));
    }

    @Test
    @DisplayName("enqueueJob fails if dataset request is not APPROVED")
    void enqueueJobFailsIfDraft() {
        UUID reqId = UUID.randomUUID();
        DatasetRequest draft = new DatasetRequest(
                reqId, UUID.randomUUID(), "Draft", "Purpose", "{}", "[]", "{}",
                DatasetFormat.CSV, clock.instant()
        );
        // Default status is DRAFT

        when(requestRepository.findById(reqId)).thenReturn(Optional.of(draft));

        ResearchApiException ex = assertThrows(ResearchApiException.class, () -> service.enqueueJob(reqId));
        assertTrue(ex.getMessage().contains("only be initiated for APPROVED"));
    }

    @Test
    @DisplayName("enqueueJob saves PENDING job and dispatches message to RabbitMQ")
    void enqueueJobSuccess() {
        UUID reqId = UUID.randomUUID();
        DatasetRequest request = new DatasetRequest(
                reqId, UUID.randomUUID(), "Approved Request", "Purpose", "{}", "[]", "{}",
                DatasetFormat.CSV, clock.instant()
        );
        request.submit(clock.instant());
        request.approve(UUID.randomUUID(), "Looks good", clock.instant(), clock.instant().plusSeconds(86400));

        when(requestRepository.findById(reqId)).thenReturn(Optional.of(request));
        when(jobRepository.save(any(DatasetGenerationJob.class))).thenAnswer(i -> i.getArgument(0));

        DatasetGenerationJob job = service.enqueueJob(reqId);

        assertNotNull(job);
        assertEquals("PENDING", job.getStatus());
        assertEquals(reqId, job.getDatasetRequestId());
        verify(rabbitTemplate).convertAndSend(eq("clinora.research.dataset-generation"), eq(job.getId().toString()));
    }

    @Test
    @DisplayName("processJob executes deidentification, uploads to private storage, and saves immutable version")
    void processJobSuccess() {
        UUID jobId = UUID.randomUUID();
        UUID reqId = UUID.randomUUID();
        UUID projId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();

        DatasetGenerationJob job = new DatasetGenerationJob(jobId, reqId, clock.instant());
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));

        DatasetRequest request = new DatasetRequest(
                reqId, projId, "Biomarker Study", "Purpose", "{}", "[\"HBA1C\"]", "{}",
                DatasetFormat.CSV, clock.instant()
        );
        request.submit(clock.instant());
        request.approve(UUID.randomUUID(), "Approved", clock.instant(), clock.instant().plusSeconds(86400 * 30));
        when(requestRepository.findById(reqId)).thenReturn(Optional.of(request));

        ResearchProject project = new ResearchProject(
                projId, ownerId, "Title", "Obj", "Desc", "Field", "Methodology", "Inst", "Ethics", clock.instant()
        );
        when(projectRepository.findById(projId)).thenReturn(Optional.of(project));

        // Mock database row fetch
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(java.util.stream.IntStream.range(0, 31).mapToObj(i ->
                    new DeidentificationService.RawObservationRow(UUID.randomUUID(), LocalDate.of(1980, 1, 1),
                        "MALE", LocalDate.of(2026, 1, 1), "HBA1C", new BigDecimal("6.5"), "%",
                        i < 24 ? new BigDecimal("4") : null, i < 24 ? new BigDecimal("6") : null,
                        "NORMAL", "DOCTOR_VERIFIED", false, null)).toList());

        // Mock deidentification service transform
        byte[] payload = "subject_id,age_band\nSUBJ-123,45-49".getBytes(StandardCharsets.UTF_8);
        DeidentificationResult deidResult = new DeidentificationResult(
                reqId, projId, 1, 1, "clinora-deid-v1", List.of(), payload, "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", "CSV"
        );
        when(deidentificationService.transform(eq(reqId), eq(projId), eq("CSV"), anyList(), anyList()))
                .thenReturn(deidResult);

        when(datasetRepository.findByDatasetRequestId(reqId)).thenReturn(Optional.empty());
        when(datasetRepository.save(any(ResearchDataset.class))).thenAnswer(i -> i.getArgument(0));
        when(versionRepository.findByDatasetIdOrderByVersionNumberDesc(any(UUID.class))).thenReturn(List.of());
        when(versionRepository.saveAndFlush(any(DatasetVersion.class))).thenAnswer(i -> i.getArgument(0));

        service.processJob(jobId);

        assertEquals("SUCCEEDED", job.getStatus());
        verify(storagePort).put(contains("datasets/"), eq(payload), eq("text/csv"));

        ArgumentCaptor<DatasetVersion> versionCaptor = ArgumentCaptor.forClass(DatasetVersion.class);
        verify(versionRepository).saveAndFlush(versionCaptor.capture());
        DatasetVersion savedVersion = versionCaptor.getValue();
        assertEquals(1, savedVersion.getVersionNumber());
        ArgumentCaptor<byte[]> referenceBytes = ArgumentCaptor.forClass(byte[].class);
        verify(storagePort).put(endsWith("-eval.json"), referenceBytes.capture(), eq("application/json"));
        try {
            var snapshot = new ObjectMapper().readValue(referenceBytes.getValue(),
                com.clinora.research.service.evaluation.EvaluationReferenceSnapshot.class);
            assertEquals(31, snapshot.totalObservations());
            assertEquals(24, snapshot.observations().size());
            snapshot.validate(savedVersion.getId(), savedVersion.getChecksum());
            assertTrue(snapshot.observations().stream().allMatch(o -> o.derivedGroundTruth().equals("ABNORMAL")));
        } catch (java.io.IOException e) { fail(e); }
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sql.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));
        assertTrue(sql.getValue().contains("obs.verification_status IN ('DOCTOR_VERIFIED', 'PATIENT_CONFIRMED', 'PATIENT_CORRECTED')"));
        assertTrue(sql.getValue().contains("obs.review_required = false"));
        assertTrue(sql.getValue().contains("obs.effective_numeric_value IS NOT NULL"));
        assertTrue(savedVersion.isImmutable());
        assertEquals("clinora-deid-v1", savedVersion.getDeidentificationProfileVersion());

        verify(auditService).record(
                eq(ownerId),
                eq(AuthAuditAction.RESEARCH_DATASET_GENERATED),
                eq(AuthAuditOutcome.SUCCESS),
                anyString(), anyString(), anyString(), anyString()
        );
    }

    @Test
    @DisplayName("downloadVersion verifies access grant and records audit event")
    void downloadVersionAuthorized() {
        UUID datasetId = UUID.randomUUID();
        UUID projId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID reqId = UUID.randomUUID();

        ResearchDataset dataset = new ResearchDataset(
                datasetId, projId, reqId, "Diabetic Cohort", clock.instant(), null
        );
        when(datasetRepository.findById(datasetId)).thenReturn(Optional.of(dataset));

        ResearchProject project = new ResearchProject(
                projId, ownerId, "Title", "Obj", "Desc", "Field", "Methodology", "Inst", "Ethics", clock.instant()
        );
        when(projectRepository.findById(projId)).thenReturn(Optional.of(project));

        DatasetVersion version = new DatasetVersion(
                UUID.randomUUID(), datasetId, 1, "1.0", 100, "datasets/p/d/v1.csv", "sha256checksum", "CSV", "clinora-deid-v1", clock.instant()
        );
        when(versionRepository.findByDatasetIdAndVersionNumber(datasetId, 1)).thenReturn(Optional.of(version));

        byte[] content = "test,csv\n1,2".getBytes(StandardCharsets.UTF_8);
        when(storagePort.get("datasets/p/d/v1.csv")).thenReturn(new ResearchDatasetStoragePort.StoredDataset(content, "text/csv"));

        DatasetGenerationService.DatasetDownload download = service.downloadVersion(
                datasetId, 1, ownerId, "127.0.0.1", "JUnit"
        );

        assertNotNull(download);
        assertEquals("text/csv", download.contentType());
        assertArrayEquals(content, download.bytes());
        assertEquals("sha256checksum", download.checksum());

        verify(auditService).record(
                eq(ownerId),
                eq(AuthAuditAction.RESEARCH_DATASET_DOWNLOADED),
                eq(AuthAuditOutcome.SUCCESS),
                eq("127.0.0.1"), eq("JUnit"), eq(datasetId.toString()), contains("version=1")
        );
    }
    @Test
    void approvedFiltersRemainInGenerationQuery() {
        var request = requestWithFilters("[\"HBA1C\"]", "{\"observationConditions\":[{\"variableCode\":\"HBA1C\",\"operator\":\"GTE\",\"value\":6.5}]}");
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class))).thenReturn(List.of());
        org.springframework.test.util.ReflectionTestUtils.invokeMethod(service, "fetchEligibleRows", request);
        var sql = ArgumentCaptor.forClass(String.class);
        var parameters = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).query(sql.capture(), parameters.capture(), any(RowMapper.class));
        assertTrue(sql.getValue().contains("crep.subject_type='SELF'"));
        assertTrue(sql.getValue().contains("cobs.effective_numeric_value >= :conditionValue0"));
        assertEquals(new BigDecimal("6.5"), parameters.getValue().getValue("conditionValue0"));
        assertTrue(sql.getValue().contains("prc.consent_status = 'CONSENTED'"));
    }

    @Test
    void malformedApprovedFiltersFailBeforeQueryOrStorage() {
        var request = requestWithFilters("[\"HBA1C\"]", "{\"observationConditions\":[{\"variableCode\":\"HBA1C\",\"operator\":\"OR 1=1\",\"value\":6.5}]}");
        assertThrows(com.clinora.research.service.DatasetGenerationException.class, () -> org.springframework.test.util.ReflectionTestUtils.invokeMethod(service, "fetchEligibleRows", request));
        verifyNoInteractions(jdbcTemplate, storagePort);
    }

    @Test
    void demographicRequestDoesNotExportClinicalValues() {
        UUID patient = UUID.randomUUID();
        var row = new DeidentificationService.RawObservationRow(patient, LocalDate.of(1980,1,1), "MALE", LocalDate.of(2026,1,1), "HBA1C", new BigDecimal("6.5"), "%", null, null, null);
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class))).thenReturn(List.of(row, row));
        List<DeidentificationService.RawObservationRow> result = org.springframework.test.util.ReflectionTestUtils.invokeMethod(service, "fetchEligibleRows", requestWithFilters("[\"AGE_BAND\"]", "{}"));
        assertEquals(1, result.size());
        assertNull(result.getFirst().numericValue());
        assertEquals("DEMOGRAPHICS", result.getFirst().variableCode());
    }

    @Test
    void eligiblePatientsRetainedWhenRequestedVariablesMissing() {
        UUID patientA = UUID.randomUUID(); // Has unrelated observation
        UUID patientB = UUID.randomUUID(); // Has NO observations
        UUID patientC = UUID.randomUUID(); // Has requested observation

        var rowA = new DeidentificationService.RawObservationRow(patientA, LocalDate.of(1980,1,1), "MALE", LocalDate.of(2026,1,1), "HGB", new BigDecimal("11.2"), "g/dL", null, null, null);
        var rowB = new DeidentificationService.RawObservationRow(patientB, LocalDate.of(1985,1,1), "FEMALE", LocalDate.of(2026,1,1), null, null, null, null, null, null);
        var rowC = new DeidentificationService.RawObservationRow(patientC, LocalDate.of(1990,1,1), "MALE", LocalDate.of(2026,1,1), "CRP", new BigDecimal("7.1"), "mg/L", null, null, null);

        var request = requestWithFilters("[\"CRP\"]", "{}");
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class))).thenReturn(List.of(rowA, rowB, rowC));

        List<DeidentificationService.RawObservationRow> result = org.springframework.test.util.ReflectionTestUtils.invokeMethod(service, "fetchEligibleRows", request);

        // All eligible subjects must be retained, irrespective of observation matches
        assertEquals(3, result.size());

        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(sql.capture(), any(MapSqlParameterSource.class), any(RowMapper.class));
        String executedSql = sql.getValue();

        // 1. LEFT JOIN must be used for observations to retain eligible subjects
        assertTrue(executedSql.contains("LEFT JOIN medical_report_observations obs ON obs.extraction_result_id = res.id"));

        // 2. The alias filter MUST be in the ON clause, NOT the WHERE clause, so subjects missing the requested var are not excluded
        assertTrue(executedSql.contains("AND (LOWER(obs.normalized_label) IN (:aliases) OR LOWER(obs.effective_label) IN (:aliases))"));

        // The where clause is independent of requested aliases
        assertFalse(executedSql.contains("OR obs.id IS NULL"));
    }


    private DatasetRequest requestWithFilters(String variables, String filters) {
        return new DatasetRequest(UUID.randomUUID(), UUID.randomUUID(), "Synthetic request", "Test", "{}", variables, filters, DatasetFormat.CSV, clock.instant());
    }

    @Test
    @DisplayName("processJob fails with EMPTY_ELIGIBLE_COHORT when no records found")
    void processJobEmptyEligibleCohort() {
        UUID jobId = UUID.randomUUID();
        UUID reqId = UUID.randomUUID();
        UUID projId = UUID.randomUUID();

        DatasetGenerationJob job = new DatasetGenerationJob(jobId, reqId, clock.instant());
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));

        DatasetRequest request = new DatasetRequest(
                reqId, projId, "Biomarker Study", "Purpose", "{}", "[\"HBA1C\"]", "{}",
                DatasetFormat.CSV, clock.instant()
        );
        request.submit(clock.instant());
        request.approve(UUID.randomUUID(), "Approved", clock.instant(), clock.instant().plusSeconds(86400 * 30));
        when(requestRepository.findById(reqId)).thenReturn(Optional.of(request));

        ResearchProject project = new ResearchProject(
                projId, UUID.randomUUID(), "Title", "Obj", "Desc", "Field", "Methodology", "Inst", "Ethics", clock.instant()
        );
        when(projectRepository.findById(projId)).thenReturn(Optional.of(project));

        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        service.processJob(jobId);

        assertEquals("FAILED", job.getStatus());
        assertEquals("EMPTY_ELIGIBLE_COHORT", job.getFailureCode());
        assertEquals("No records satisfied all approved eligibility and consent requirements.", job.getParsedFailureReason());
    }

    @Test
    @DisplayName("processJob fails with UNSUPPORTED_REQUESTED_FIELD when variables are invalid")
    void processJobUnsupportedField() {
        UUID jobId = UUID.randomUUID();
        UUID reqId = UUID.randomUUID();
        UUID projId = UUID.randomUUID();

        DatasetGenerationJob job = new DatasetGenerationJob(jobId, reqId, clock.instant());
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));

        DatasetRequest request = new DatasetRequest(
                reqId, projId, "Study", "Purpose", "{}", "[\"INVALID_FIELD_123\"]", "{}",
                DatasetFormat.CSV, clock.instant()
        );
        request.submit(clock.instant());
        request.approve(UUID.randomUUID(), "Approved", clock.instant(), clock.instant().plusSeconds(86400 * 30));
        when(requestRepository.findById(reqId)).thenReturn(Optional.of(request));

        ResearchProject project = new ResearchProject(
                projId, UUID.randomUUID(), "Title", "Obj", "Desc", "Field", "Methodology", "Inst", "Ethics", clock.instant()
        );
        when(projectRepository.findById(projId)).thenReturn(Optional.of(project));

        service.processJob(jobId);

        assertEquals("FAILED", job.getStatus());
        assertEquals("UNSUPPORTED_REQUESTED_FIELD", job.getFailureCode());
        assertTrue(job.getParsedFailureReason().contains("INVALID_FIELD_123 is not available"));
    }

    @Test
    @DisplayName("processJob fails with INTERNAL_GENERATION_ERROR on unexpected exceptions")
    void processJobInternalError() {
        UUID jobId = UUID.randomUUID();
        UUID reqId = UUID.randomUUID();
        UUID projId = UUID.randomUUID();

        DatasetGenerationJob job = new DatasetGenerationJob(jobId, reqId, clock.instant());
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));

        DatasetRequest request = new DatasetRequest(
                reqId, projId, "Study", "Purpose", "{}", "[\"HBA1C\"]", "{}",
                DatasetFormat.CSV, clock.instant()
        );
        request.submit(clock.instant());
        request.approve(UUID.randomUUID(), "Approved", clock.instant(), clock.instant().plusSeconds(86400 * 30));
        when(requestRepository.findById(reqId)).thenReturn(Optional.of(request));

        ResearchProject project = new ResearchProject(
                projId, UUID.randomUUID(), "Title", "Obj", "Desc", "Field", "Methodology", "Inst", "Ethics", clock.instant()
        );
        when(projectRepository.findById(projId)).thenReturn(Optional.of(project));

        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenThrow(new RuntimeException("Database down!"));

        service.processJob(jobId);

        assertEquals("FAILED", job.getStatus());
        assertEquals("INTERNAL_GENERATION_ERROR", job.getFailureCode());
        assertEquals("Clinora could not complete this generation job because of a system error.", job.getParsedFailureReason());
    }

}
