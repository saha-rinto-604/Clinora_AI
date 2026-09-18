package com.clinora.doctors.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

import com.clinora.ai.client.MedGemmaClient;
import com.clinora.doctors.api.DoctorApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClientException;

class DoctorSupportExecutionServiceTest {
    private final UUID doctorId = UUID.randomUUID();
    private final UUID appointmentId = UUID.randomUUID();
    private final UUID reportId = UUID.randomUUID();
    private final UUID secondReportId = UUID.randomUUID();
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    private DoctorSupportEvidenceAssembler assembler;
    private MedGemmaClient ai;
    private DoctorSupportExecutionService service;

    @BeforeEach
    void setUp() {
        assembler = mock(DoctorSupportEvidenceAssembler.class);
        ai = mock(MedGemmaClient.class);
        when(ai.clinicalKnowledgeHealth()).thenReturn(
            new MedGemmaClient.ClinicalKnowledgeHealth("READY", true, "cki_test", 6, "hash:384")
        );
        service = new DoctorSupportExecutionService(
            new DoctorSupportTaskRegistry(), assembler, ai, mapper,
            Clock.fixed(Instant.parse("2026-09-17T10:00:00Z"), ZoneOffset.UTC)
        );
    }

    @Test
    void rejectsDuplicateTasksAndRequiresNotesBeforeEvidenceAccess() {
        assertEquals("DUPLICATE_TASK_IDS", assertThrows(DoctorApiException.class, () -> service.execute(
            doctorId, appointmentId, request(List.of(DoctorSupportTask.FIND_GAPS, DoctorSupportTask.FIND_GAPS), null, "a")
        )).getErrorCode());
        assertEquals("DOCTOR_NOTES_REQUIRED", assertThrows(DoctorApiException.class, () -> service.execute(
            doctorId, appointmentId, request(List.of(DoctorSupportTask.STRUCTURE_NOTES), null, "b")
        )).getErrorCode());
        verify(assembler, never()).assemble(any(), any(), any());
    }

    @Test
    void assessmentIsEphemeralAndRequiredOnlyForCrossCheck() {
        DoctorApiException exception = assertThrows(DoctorApiException.class, () -> service.execute(
            doctorId, appointmentId, request(List.of(DoctorSupportTask.CROSS_CHECK_ASSESSMENT), null, "key")
        ));
        assertEquals("DOCTOR_ASSESSMENT_REQUIRED", exception.getErrorCode());
        verify(assembler, never()).assemble(any(), any(), any());
    }

    @Test
    void independentTaskFailureProducesPartialSuccessAndProvenance() {
        var request = request(List.of(DoctorSupportTask.CONNECT_EVIDENCE, DoctorSupportTask.FIND_GAPS), null, "partial");
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly(true));
        when(ai.executeDoctorSupport(any())).thenReturn(new MedGemmaClient.DoctorSupportExecutionResponse(List.of(
            aiResult("CONNECT_EVIDENCE", "FAILED_SAFE", "UNKNOWN_OBSERVATION_ID"),
            aiResult("FIND_GAPS", "SUCCEEDED", null)
        )));

        DoctorSupportExecutionResponse response = service.execute(doctorId, appointmentId, request);

        assertEquals(DoctorSupportExecutionStatus.PARTIAL_SUCCESS, response.status());
        assertEquals(DoctorSupportTaskExecutionStatus.FAILED_SAFE, response.taskResults().get(0).status());
        assertEquals(DoctorSupportTaskExecutionStatus.SUCCEEDED, response.taskResults().get(1).status());
        assertEquals("snapshot", response.taskResults().get(1).provenance().evidenceSnapshotHash());
    }

    @Test
    void jsonNullFailedSafeResultIsAcceptedAsAbsentResult() {
        var request = request(List.of(DoctorSupportTask.BRIEF_PATIENT), null, "json-null");
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly(true));
        DoctorSupportTaskSpec spec = new DoctorSupportTaskRegistry().require(DoctorSupportTask.BRIEF_PATIENT);
        when(ai.executeDoctorSupport(any())).thenReturn(new MedGemmaClient.DoctorSupportExecutionResponse(List.of(
            new MedGemmaClient.DoctorSupportTaskExecutionResponse(
                "BRIEF_PATIENT", "FAILED_SAFE", NullNode.getInstance(), "UNKNOWN_OBSERVATION_ID",
                "medgemma", "main", "Q4_0", spec.promptVersion(), spec.responseSchemaVersion(), "REJECTED",
                false, spec.ragPolicy().name(), "NOT_REQUIRED", null, List.of(), List.of(), 0L, List.of()
            )
        )));

        DoctorSupportExecutionResponse response = service.execute(doctorId, appointmentId, request);

        assertEquals(DoctorSupportExecutionStatus.FAILED_SAFE, response.status());
        assertEquals(DoctorSupportTaskExecutionStatus.FAILED_SAFE, response.taskResults().getFirst().status());
        assertEquals("UNKNOWN_OBSERVATION_ID", response.taskResults().getFirst().safeFailureCode());
    }

    @Test
    void comparisonWithoutTwoReliableDatesReturnsAuthorizedSelectionCandidates() {
        var request = request(List.of(DoctorSupportTask.COMPARE_EVIDENCE), null, "compare");
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly(false));

        DoctorSupportExecutionResponse response = service.execute(doctorId, appointmentId, request);

        assertEquals(DoctorSupportExecutionStatus.FAILED_SAFE, response.status());
        assertEquals(DoctorSupportTaskExecutionStatus.EVIDENCE_SELECTION_REQUIRED, response.taskResults().getFirst().status());
        assertEquals(secondReportId, response.selectionCandidates().getFirst().reportId());
        verify(ai, never()).executeDoctorSupport(any());
    }

    @Test
    void idempotencyKeyReturnsSameExecutionAndRejectsChangedRequest() {
        var request = request(List.of(DoctorSupportTask.FIND_GAPS), null, "same-key");
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly(true));
        when(ai.executeDoctorSupport(any())).thenReturn(new MedGemmaClient.DoctorSupportExecutionResponse(
            List.of(aiResult("FIND_GAPS", "SUCCEEDED", null))
        ));

        var first = service.execute(doctorId, appointmentId, request);
        var second = service.execute(doctorId, appointmentId, request);
        assertEquals(first.executionId(), second.executionId());

        var changed = new DoctorSupportExecutionRequest(
            List.of(DoctorSupportTask.FIND_GAPS), "A changed question", reportId, List.of(), List.of(), null, "same-key"
        );
        DoctorApiException exception = assertThrows(DoctorApiException.class,
            () -> service.execute(doctorId, appointmentId, changed));
        assertEquals("IDEMPOTENCY_KEY_REUSED", exception.getErrorCode());
        verify(ai).executeDoctorSupport(any());
    }

    @Test
    void concurrentDuplicateSubmissionsLaunchOnlyOneAiJob() throws Exception {
        var request = request(List.of(DoctorSupportTask.FIND_GAPS), null, "double-click");
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly(true));
        CountDownLatch aiStarted = new CountDownLatch(1);
        CountDownLatch releaseAi = new CountDownLatch(1);
        when(ai.executeDoctorSupport(any())).thenAnswer(invocation -> {
            aiStarted.countDown();
            if (!releaseAi.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("test timeout");
            return new MedGemmaClient.DoctorSupportExecutionResponse(List.of(aiResult("FIND_GAPS", "SUCCEEDED", null)));
        });
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> service.execute(doctorId, appointmentId, request));
            aiStarted.await(5, TimeUnit.SECONDS);
            var second = executor.submit(() -> service.execute(doctorId, appointmentId, request));
            releaseAi.countDown();

            assertEquals(first.get().executionId(), second.get().executionId());
            verify(ai).executeDoctorSupport(any());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void modelUnavailableReturnsFailedSafeWithoutExposingTransportDetails() {
        var request = request(List.of(DoctorSupportTask.CONNECT_EVIDENCE), null, "unavailable");
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly(true));
        when(ai.executeDoctorSupport(any())).thenThrow(new RestClientException("secret upstream detail"));

        DoctorSupportExecutionResponse response = service.execute(doctorId, appointmentId, request);

        assertEquals(DoctorSupportExecutionStatus.FAILED_SAFE, response.status());
        assertEquals("MODEL_UNAVAILABLE", response.taskResults().getFirst().safeFailureCode());
    }

    @Test
    void sameIdempotencyKeyReauthorizesAndRerunsWhenEvidenceSnapshotChanged() {
        var request = request(List.of(DoctorSupportTask.CONNECT_EVIDENCE), null, "fresh-auth");
        var firstAssembly = assembly(true);
        var changedSnapshot = new DoctorSupportEvidenceSnapshot(
            "changed-snapshot", firstAssembly.snapshot().reports(), firstAssembly.snapshot().observations(),
            firstAssembly.snapshot().comparisonFacts()
        );
        when(assembler.assemble(doctorId, appointmentId, request))
            .thenReturn(firstAssembly)
            .thenReturn(new DoctorSupportEvidenceAssembler.Assembly(changedSnapshot, List.of()));
        when(ai.executeDoctorSupport(any())).thenReturn(new MedGemmaClient.DoctorSupportExecutionResponse(
            List.of(aiResult("CONNECT_EVIDENCE", "SUCCEEDED", null))
        ));

        var first = service.execute(doctorId, appointmentId, request);
        var second = service.execute(doctorId, appointmentId, request);

        org.junit.jupiter.api.Assertions.assertNotEquals(first.executionId(), second.executionId());
        assertEquals("changed-snapshot", second.evidenceSnapshotHash());
        verify(ai, times(2)).executeDoctorSupport(any());
    }

    @Test
    void cachedExecutionNeverBypassesFreshRevocationCheck() {
        var request = request(List.of(DoctorSupportTask.CONNECT_EVIDENCE), null, "revoked-after-result");
        when(assembler.assemble(doctorId, appointmentId, request))
            .thenReturn(assembly(true))
            .thenThrow(new DoctorApiException(
                org.springframework.http.HttpStatus.NOT_FOUND, "SHARED_REPORT_NOT_AVAILABLE",
                "That report is not available for this appointment."
            ));
        when(ai.executeDoctorSupport(any())).thenReturn(new MedGemmaClient.DoctorSupportExecutionResponse(
            List.of(aiResult("CONNECT_EVIDENCE", "SUCCEEDED", null))
        ));

        service.execute(doctorId, appointmentId, request);
        DoctorApiException exception = assertThrows(DoctorApiException.class,
            () -> service.execute(doctorId, appointmentId, request));

        assertEquals("SHARED_REPORT_NOT_AVAILABLE", exception.getErrorCode());
        verify(ai).executeDoctorSupport(any());
    }

    @Test
    void changedKnowledgeIndexInvalidatesRagExecutionCache() {
        var request = request(List.of(DoctorSupportTask.CONNECT_EVIDENCE), null, "knowledge-change");
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly(true));
        when(ai.executeDoctorSupport(any())).thenReturn(new MedGemmaClient.DoctorSupportExecutionResponse(
            List.of(aiResult("CONNECT_EVIDENCE", "SUCCEEDED", null))
        ));
        when(ai.clinicalKnowledgeHealth()).thenReturn(
            new MedGemmaClient.ClinicalKnowledgeHealth("READY", true, "cki_changed", 7, "hash:384")
        );

        var first = service.execute(doctorId, appointmentId, request);
        var second = service.execute(doctorId, appointmentId, request);

        org.junit.jupiter.api.Assertions.assertNotEquals(first.executionId(), second.executionId());
        verify(ai, times(2)).executeDoctorSupport(any());
    }

    private DoctorSupportExecutionRequest request(List<DoctorSupportTask> tasks, String assessment, String key) {
        return new DoctorSupportExecutionRequest(tasks, "Review this evidence.", reportId, List.of(), List.of(), assessment, key);
    }

    private DoctorSupportEvidenceAssembler.Assembly assembly(boolean twoReports) {
        var reports = twoReports
            ? List.of(report(reportId, LocalDate.of(2026, 1, 1)), report(secondReportId, LocalDate.of(2026, 2, 1)))
            : List.of(report(reportId, null));
        var observation = new DoctorSupportEvidenceSnapshot.ObservationEvidence(
            UUID.randomUUID(), reportId, "MCV", "MCV", "NUMERIC", BigDecimal.valueOf(72), null, null,
            "fL", BigDecimal.valueOf(80), BigDecimal.valueOf(100), "80-100", "LOW", "PATIENT_CONFIRMED",
            BigDecimal.valueOf(72), "fl", "fl"
        );
        var snapshot = new DoctorSupportEvidenceSnapshot("snapshot", reports, List.of(observation), List.of());
        return new DoctorSupportEvidenceAssembler.Assembly(snapshot,
            List.of(new DoctorSupportExecutionResponse.CandidateReport(secondReportId, "LAB_RESULTS", LocalDate.of(2025, 12, 1))));
    }

    private DoctorSupportEvidenceSnapshot.ReportEvidence report(UUID id, LocalDate date) {
        return new DoctorSupportEvidenceSnapshot.ReportEvidence(
            id, "LAB_RESULTS", date, date == null ? "DATE_UNAVAILABLE" : "REPORT_DATE", UUID.randomUUID(), "a".repeat(64), 1L
        );
    }

    private MedGemmaClient.DoctorSupportTaskExecutionResponse aiResult(String task, String status, String failure) {
        DoctorSupportTaskSpec spec = new DoctorSupportTaskRegistry().require(DoctorSupportTask.valueOf(task));
        return new MedGemmaClient.DoctorSupportTaskExecutionResponse(
            task, status, "SUCCEEDED".equals(status) ? mapper.createObjectNode().put("taskId", task) : null,
            failure, "medgemma", "main", "Q4_0", spec.promptVersion(), spec.responseSchemaVersion(),
            "SUCCEEDED".equals(status) ? "PASSED" : "REJECTED",
            spec.ragPolicy() != DoctorSupportRagPolicy.DISABLED, spec.ragPolicy().name(),
            spec.ragPolicy() == DoctorSupportRagPolicy.DISABLED ? "NOT_REQUIRED" : "USED",
            spec.ragPolicy() == DoctorSupportRagPolicy.DISABLED ? null : "cki_test",
            spec.ragPolicy() == DoctorSupportRagPolicy.DISABLED ? List.of() : List.of("ck_test"),
            List.of(), 4L, List.of()
        );
    }
}
