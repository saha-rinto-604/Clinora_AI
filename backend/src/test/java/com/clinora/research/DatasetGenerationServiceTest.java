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
        );
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
                .thenReturn(List.of(
                        new DeidentificationService.RawObservationRow(UUID.randomUUID(), LocalDate.of(1980, 1, 1), "MALE", LocalDate.of(2026, 1, 1), "HBA1C", new BigDecimal("6.5"), "%", null, null, null)
                ));

        // Mock deidentification service transform
        byte[] payload = "subject_id,age_band\nSUBJ-123,45-49".getBytes(StandardCharsets.UTF_8);
        DeidentificationResult deidResult = new DeidentificationResult(
                reqId, projId, 1, 1, "clinora-deid-v1", List.of(), payload, "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", "CSV"
        );
        when(deidentificationService.transform(eq(reqId), eq(projId), eq("CSV"), anyList()))
                .thenReturn(deidResult);

        when(datasetRepository.findByDatasetRequestId(reqId)).thenReturn(Optional.empty());
        when(datasetRepository.save(any(ResearchDataset.class))).thenAnswer(i -> i.getArgument(0));
        when(versionRepository.findByDatasetIdOrderByVersionNumberDesc(any(UUID.class))).thenReturn(List.of());
        when(versionRepository.save(any(DatasetVersion.class))).thenAnswer(i -> i.getArgument(0));

        service.processJob(jobId);

        assertEquals("SUCCEEDED", job.getStatus());
        verify(storagePort).put(contains("datasets/"), eq(payload), eq("text/csv"));

        ArgumentCaptor<DatasetVersion> versionCaptor = ArgumentCaptor.forClass(DatasetVersion.class);
        verify(versionRepository).save(versionCaptor.capture());
        DatasetVersion savedVersion = versionCaptor.getValue();
        assertEquals(1, savedVersion.getVersionNumber());
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
}
