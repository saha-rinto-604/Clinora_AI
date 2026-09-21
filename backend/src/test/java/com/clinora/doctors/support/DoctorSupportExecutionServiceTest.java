package com.clinora.doctors.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import java.nio.charset.StandardCharsets;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;

class DoctorSupportExecutionServiceTest {
    private final UUID doctorId = UUID.randomUUID();
    private final UUID patientId = UUID.randomUUID();
    private final UUID appointmentId = UUID.randomUUID();
    private final UUID reportId = UUID.randomUUID();
    private final UUID secondReportId = UUID.randomUUID();
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    private DoctorSupportEvidenceAssembler assembler;
    private MedGemmaClient ai;
    private DoctorClinicalReasoningSnapshotService snapshotService;
    private DoctorSupportExecutionService service;

    @BeforeEach
    void setUp() {
        assembler = mock(DoctorSupportEvidenceAssembler.class);
        ai = mock(MedGemmaClient.class);
        snapshotService = mock(DoctorClinicalReasoningSnapshotService.class);
        when(snapshotService.resolve(any(), any())).thenAnswer(invocation -> readySnapshots(invocation.getArgument(1)));
        when(snapshotService.resolveAvailable(any(), any())).thenAnswer(invocation -> readySnapshots(invocation.getArgument(1)));
        when(ai.clinicalKnowledgeHealth()).thenReturn(
            new MedGemmaClient.ClinicalKnowledgeHealth("READY", true, "cki_test", 6, "hash:384")
        );
        service = new DoctorSupportExecutionService(
            new DoctorSupportTaskRegistry(), assembler, snapshotService, ai, mapper,
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
        var request = request(List.of(DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION), null, "json-null");
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly(true));
        DoctorSupportTaskSpec spec = new DoctorSupportTaskRegistry().require(DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION);
        when(ai.executeDoctorSupport(any())).thenReturn(new MedGemmaClient.DoctorSupportExecutionResponse(List.of(
            new MedGemmaClient.DoctorSupportTaskExecutionResponse(
                "FOCUSED_EVIDENCE_QUESTION", "FAILED_SAFE", NullNode.getInstance(), "UNKNOWN_OBSERVATION_ID",
                "gemini-2.5-flash", "api", "HOSTED", spec.promptVersion(), spec.responseSchemaVersion(),
                "GEMINI", "REJECTED", 2L, 0L, 1L, 0,
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
    void briefIsDeterministicEvenWhenAiIsUnavailable() {
        var request = request(List.of(DoctorSupportTask.BRIEF_PATIENT), null, "brief");
        var authorized = assembly(true);
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(authorized);
        when(ai.executeDoctorSupport(any())).thenThrow(new RestClientException("offline"));
        var result = service.execute(doctorId, appointmentId, request);
        assertEquals(DoctorSupportExecutionStatus.SUCCEEDED, result.status());
        assertEquals("NOT_RUN", result.taskResults().getFirst().provenance().groundingStatus());
        org.junit.jupiter.api.Assertions.assertNull(result.taskResults().getFirst().provenance().modelName());
        assertEquals(1, result.taskResults().getFirst().result().path("evidenceHighlights").size());
        assertEquals(2, result.taskResults().getFirst().result().path("reportCount").asInt());
        assertEquals(1, result.taskResults().getFirst().result().path("evidenceCount").asInt());
        assertEquals(1, result.taskResults().getFirst().result().path("abnormalCount").asInt());
        verify(snapshotService).resolveAvailable(patientId, authorized.snapshot());
        verify(snapshotService, never()).resolve(any(), any());
        verify(ai, never()).executeDoctorSupport(any());
        verify(ai, never()).clinicalKnowledgeHealth();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "What abnormal findings are there?",
        "What findings can you find?",
        "List the observations documented here.",
        "Describe the current abnormalities.",
        "What is the latest MCV value?",
        "What unit and reference range are documented for MCV?",
        "How many verified findings are available?"
    })
    void simpleAbnormalFindingQuestionIsDeterministicAndMakesZeroAiCalls(String question) {
        var request = new DoctorSupportExecutionRequest(
            List.of(DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION), question,
            reportId, List.of(), List.of(), null, "deterministic-findings"
        );
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly(false));

        var response = service.execute(doctorId, appointmentId, request);

        assertEquals(DoctorSupportExecutionStatus.SUCCEEDED, response.status());
        assertEquals("DETERMINISTIC", response.taskResults().getFirst().provenance().executionProvider());
        verify(snapshotService, never()).resolve(any(), any());
        verify(ai, never()).executeDoctorSupport(any());
    }

    @Test
    void compareUsesAuthoritativeFactsAndMakesZeroAiCalls() {
        var request = request(List.of(DoctorSupportTask.COMPARE_EVIDENCE), null, "deterministic-compare");
        var firstObservation = UUID.randomUUID();
        var secondObservation = UUID.randomUUID();
        var reports = List.of(
            report(reportId, LocalDate.of(2026, 1, 1)),
            report(secondReportId, LocalDate.of(2026, 2, 1))
        );
        var observations = List.of(
            new DoctorSupportEvidenceSnapshot.ObservationEvidence(
                firstObservation, reportId, "MCV", "MCV", "NUMERIC", BigDecimal.valueOf(72), null, null,
                "fL", BigDecimal.valueOf(80), BigDecimal.valueOf(100), "80-100", "LOW", "PATIENT_CONFIRMED",
                BigDecimal.valueOf(72), "fl", "fl"),
            new DoctorSupportEvidenceSnapshot.ObservationEvidence(
                secondObservation, secondReportId, "MCV", "MCV", "NUMERIC", BigDecimal.valueOf(70), null, null,
                "fL", BigDecimal.valueOf(80), BigDecimal.valueOf(100), "80-100", "LOW", "DOCTOR_VERIFIED",
                BigDecimal.valueOf(70), "fl", "fl")
        );
        var fact = new DoctorSupportEvidenceSnapshot.ComparisonFact(
            "MCV", "MCV", firstObservation, secondObservation,
            LocalDate.of(2026, 1, 1), LocalDate.of(2026, 2, 1),
            BigDecimal.valueOf(72), BigDecimal.valueOf(70), "fl", "DECREASED"
        );
        var snapshot = new DoctorSupportEvidenceSnapshot("snapshot", reports, observations, List.of(fact));
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(
            new DoctorSupportEvidenceAssembler.Assembly(
                snapshot, List.of(), patientId,
                new DoctorSupportEvidenceAssembler.AppointmentContext(null, null, null, null)
            )
        );

        var response = service.execute(doctorId, appointmentId, request);

        assertEquals(DoctorSupportExecutionStatus.SUCCEEDED, response.status());
        assertEquals("DETERMINISTIC", response.taskResults().getFirst().provenance().executionProvider());
        assertEquals("DECREASED", response.taskResults().getFirst().result().path("comparisons").get(0).path("direction").asText());
        verify(snapshotService, never()).resolve(any(), any());
        verify(ai, never()).executeDoctorSupport(any());
    }

    @Test
    void staleSnapshotReturnsPreparationStateWithoutCallingGemini() {
        var request = request(List.of(DoctorSupportTask.CONNECT_EVIDENCE), null, "stale-snapshot");
        var assembly = assembly(false);
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly);
        when(snapshotService.resolve(patientId, assembly.snapshot())).thenReturn(
            new DoctorClinicalReasoningSnapshotService.Resolution(
                DoctorClinicalReasoningSnapshotService.Availability.STALE, List.of(), List.of()
            )
        );

        var response = service.execute(doctorId, appointmentId, request);

        assertEquals(DoctorSupportExecutionStatus.FAILED_SAFE, response.status());
        assertEquals("CLINICAL_REASONING_STALE", response.taskResults().getFirst().safeFailureCode());
        verify(ai, never()).executeDoctorSupport(any());
    }

    @Test
    void shareThenRevokeBuildsGeminiRequestsFromCurrentAuthorizedReportsOnly() {
        var firstRequest = request(List.of(DoctorSupportTask.CONNECT_EVIDENCE), null, "shared-a-c");
        var secondRequest = request(List.of(DoctorSupportTask.CONNECT_EVIDENCE), null, "revoked-a");
        var firstAssembly = assemblyForReports(List.of(reportId, secondReportId));
        var secondAssembly = assemblyForReports(List.of(secondReportId));
        when(assembler.assemble(doctorId, appointmentId, firstRequest)).thenReturn(firstAssembly);
        when(assembler.assemble(doctorId, appointmentId, secondRequest)).thenReturn(secondAssembly);
        when(ai.executeDoctorSupport(any())).thenReturn(new MedGemmaClient.DoctorSupportExecutionResponse(
            List.of(aiResult("CONNECT_EVIDENCE", "SUCCEEDED", null))
        ));

        service.execute(doctorId, appointmentId, firstRequest);
        service.execute(doctorId, appointmentId, secondRequest);

        ArgumentCaptor<MedGemmaClient.DoctorSupportExecutionRequest> capture =
            ArgumentCaptor.forClass(MedGemmaClient.DoctorSupportExecutionRequest.class);
        verify(ai, times(2)).executeDoctorSupport(capture.capture());
        assertEquals(List.of(reportId, secondReportId), jsonReportIds(capture.getAllValues().get(0).reasoningSnapshots()));
        assertEquals(List.of(secondReportId), jsonReportIds(capture.getAllValues().get(1).reasoningSnapshots()));
        assertEquals(2, capture.getAllValues().get(0).evidenceSnapshot().path("reports").size());
        assertEquals(1, capture.getAllValues().get(1).evidenceSnapshot().path("reports").size());
    }

    @Test
    void differentDoctorsReceiveOnlyTheirOwnCurrentReportShares() {
        UUID doctorTwo = UUID.randomUUID();
        var firstRequest = request(List.of(DoctorSupportTask.CONNECT_EVIDENCE), null, "doctor-one");
        var secondRequest = request(List.of(DoctorSupportTask.CONNECT_EVIDENCE), null, "doctor-two");
        when(assembler.assemble(doctorId, appointmentId, firstRequest)).thenReturn(assemblyForReports(List.of(reportId)));
        when(assembler.assemble(doctorTwo, appointmentId, secondRequest)).thenReturn(assemblyForReports(List.of(secondReportId)));
        when(ai.executeDoctorSupport(any())).thenReturn(new MedGemmaClient.DoctorSupportExecutionResponse(
            List.of(aiResult("CONNECT_EVIDENCE", "SUCCEEDED", null))
        ));

        service.execute(doctorId, appointmentId, firstRequest);
        service.execute(doctorTwo, appointmentId, secondRequest);

        ArgumentCaptor<MedGemmaClient.DoctorSupportExecutionRequest> capture =
            ArgumentCaptor.forClass(MedGemmaClient.DoctorSupportExecutionRequest.class);
        verify(ai, times(2)).executeDoctorSupport(capture.capture());
        assertEquals(List.of(reportId), jsonReportIds(capture.getAllValues().get(0).reasoningSnapshots()));
        assertEquals(List.of(secondReportId), jsonReportIds(capture.getAllValues().get(1).reasoningSnapshots()));
    }

    @Test
    void datedReportsWithoutComparisonFactsReturnUsefulSideBySideComparison() {
        var request = request(List.of(DoctorSupportTask.COMPARE_EVIDENCE), null, "no-facts");
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly(true));
        var result = service.execute(doctorId, appointmentId, request);
        var task = result.taskResults().getFirst();
        assertEquals(DoctorSupportExecutionStatus.SUCCEEDED, result.status());
        assertEquals(DoctorSupportTaskExecutionStatus.SUCCEEDED, task.status());
        assertEquals(2, task.result().path("reportSummaries").size());
        assertEquals(
            "No directly comparable repeated observations were available across these reports.",
            task.result().path("summary").asText()
        );
        assertEquals(1, task.result().path("findingsOnlyInEarlierReport").size());
        verify(ai, never()).executeDoctorSupport(any());
        verify(ai, never()).analyze(any(), any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({
        "FIND_GAPS,KNOWLEDGE_UNAVAILABLE,true,true", "FIND_GAPS,NO_RELEVANT_REFERENCE,true,true",
        "FIND_GAPS,KNOWLEDGE_UNAVAILABLE,false,false", "FIND_GAPS,RETRIEVAL_FAILED_SAFE,true,false", "FIND_GAPS,NOT_REQUIRED,true,false",
        "EXPLORE_EXPLANATIONS,KNOWLEDGE_UNAVAILABLE,true,true", "EXPLORE_EXPLANATIONS,NO_RELEVANT_REFERENCE,true,true",
        "EXPLORE_EXPLANATIONS,KNOWLEDGE_UNAVAILABLE,false,false", "EXPLORE_EXPLANATIONS,RETRIEVAL_FAILED_SAFE,true,false", "EXPLORE_EXPLANATIONS,NOT_REQUIRED,true,false"
    })
    void requiredWhenAvailableContractMatchesPython(DoctorSupportTask taskId, String retrieval, boolean limitation, boolean accepted) {
        var request = request(List.of(taskId), null, "reference-contract");
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(assembly(true));
        var spec = new DoctorSupportTaskRegistry().require(taskId);
        var output = mapper.createObjectNode().put("taskId", taskId.name());
        var limitations = output.putArray("limitations");
        if (limitation) limitations.add("Approved clinical reference material was unavailable; general explanations require independent verification.");
        var task = new MedGemmaClient.DoctorSupportTaskExecutionResponse(
            taskId.name(), "SUCCEEDED", output, null, "medgemma", "main", "Q4_0", spec.promptVersion(),
            spec.responseSchemaVersion(), "GEMINI", "PASSED", 2L, 0L, 1L, 1, false, spec.ragPolicy().name(), retrieval,
            null, List.of(), List.of(), 0L, List.of());
        when(ai.executeDoctorSupport(any())).thenReturn(new MedGemmaClient.DoctorSupportExecutionResponse(List.of(task)));
        if (accepted) assertEquals(DoctorSupportExecutionStatus.SUCCEEDED, service.execute(doctorId, appointmentId, request).status());
        else assertEquals("CLINICAL_SUPPORT_EXECUTION_INVALID", assertThrows(DoctorApiException.class,
            () -> service.execute(doctorId, appointmentId, request)).getErrorCode());
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
        assertEquals("GEMINI_UNAVAILABLE", response.taskResults().getFirst().safeFailureCode());
    }

    @Test
    void repeatedGemini429IsProviderBusyWithTelemetryAndNeverInvokesMedGemma() {
        var request = request(List.of(DoctorSupportTask.CONNECT_EVIDENCE), null, "rate-limited");
        var authorized = assembly(true);
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(authorized);
        HttpHeaders headers = new HttpHeaders();
        headers.set("Retry-After", "1");
        headers.set("X-Clinora-Provider-Attempts", "2");
        headers.set("X-Clinora-Successful-Generations", "0");
        when(ai.executeDoctorSupport(any())).thenThrow(HttpClientErrorException.create(
            HttpStatus.TOO_MANY_REQUESTS, "busy", headers, new byte[0], StandardCharsets.UTF_8
        ));

        DoctorSupportExecutionResponse response = service.execute(doctorId, appointmentId, request);

        var task = response.taskResults().getFirst();
        assertEquals(DoctorSupportExecutionStatus.FAILED_SAFE, response.status());
        assertEquals("GEMINI_RATE_LIMITED", task.safeFailureCode());
        assertEquals("GEMINI", task.provenance().executionProvider());
        assertEquals("NOT_RUN", task.provenance().groundingStatus());
        assertEquals(2, task.provenance().providerAttempts());
        assertEquals(0, task.provenance().successfulGenerations());
        verify(snapshotService).resolve(patientId, authorized.snapshot());
        verify(ai).executeDoctorSupport(any());
        verify(ai, never()).analyze(any(), any());
    }

    @Test
    void provider429ReturnsTaskSpecificReadySnapshotFallbacksWithAuthorizedDbEvidence() {
        var request = new DoctorSupportExecutionRequest(
            List.of(
                DoctorSupportTask.CROSS_CHECK_ASSESSMENT,
                DoctorSupportTask.FIND_GAPS,
                DoctorSupportTask.EXPLORE_EXPLANATIONS
            ),
            "Review the existing report analysis.", reportId, List.of(), List.of(),
            "Possible iron deficiency", "degraded-ready-snapshot"
        );
        var authorized = assembly(true);
        UUID observationId = authorized.snapshot().observations().getFirst().observationId();
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(authorized);
        when(snapshotService.resolve(patientId, authorized.snapshot())).thenReturn(
            readySnapshotsWithContent(authorized.snapshot(), observationId)
        );
        HttpHeaders headers = new HttpHeaders();
        headers.set("Retry-After", "20");
        headers.set("X-Clinora-Provider-Attempts", "2");
        headers.set("X-Clinora-Successful-Generations", "0");
        headers.set("X-Clinora-Rate-Limit-Category", "RESOURCE_EXHAUSTED:RATE_LIMIT_EXCEEDED");
        when(ai.executeDoctorSupport(any())).thenThrow(HttpClientErrorException.create(
            HttpStatus.TOO_MANY_REQUESTS, "busy", headers, new byte[0], StandardCharsets.UTF_8
        ));

        DoctorSupportExecutionResponse response = service.execute(doctorId, appointmentId, request);

        assertEquals(DoctorSupportExecutionStatus.DEGRADED, response.status());
        assertEquals(3, response.taskResults().size());
        response.taskResults().forEach(task -> {
            assertEquals(DoctorSupportTaskExecutionStatus.DEGRADED, task.status());
            assertEquals("GEMINI_RATE_LIMITED", task.safeFailureCode());
            assertEquals("MEDGEMMA_SNAPSHOT_FALLBACK", task.provenance().executionProvider());
            assertEquals("NOT_RUN", task.provenance().groundingStatus());
            assertEquals(2, task.provenance().providerAttempts());
            assertEquals(0, task.provenance().successfulGenerations());
        });
        var crossCheck = response.taskResults().stream()
            .filter(task -> task.taskId() == DoctorSupportTask.CROSS_CHECK_ASSESSMENT).findFirst().orElseThrow();
        assertEquals("MIXED_OR_LIMITED_EVIDENCE", crossCheck.result().path("evidenceFit").asText());
        assertEquals(observationId.toString(), crossCheck.result().path("points").get(0)
            .path("evidence").get(0).path("observationId").asText());
        var gaps = response.taskResults().stream()
            .filter(task -> task.taskId() == DoctorSupportTask.FIND_GAPS).findFirst().orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(gaps.result().path("gaps").size() >= 1);
        var explore = response.taskResults().stream()
            .filter(task -> task.taskId() == DoctorSupportTask.EXPLORE_EXPLANATIONS).findFirst().orElseThrow();
        assertEquals(observationId.toString(), explore.result().path("explanations").get(0)
            .path("supportingEvidence").get(0).path("observationId").asText());
        verify(ai).executeDoctorSupport(any());
        verify(ai, never()).analyze(any(), any());
    }

    @Test
    void unmatchedHypothesisFallbackDoesNotClaimTheHypothesisIsUnsupported() {
        var request = new DoctorSupportExecutionRequest(
            List.of(DoctorSupportTask.CROSS_CHECK_ASSESSMENT),
            "Check this hypothesis.", reportId, List.of(), List.of(),
            "A concept not present in the report analysis", "degraded-unmatched-hypothesis"
        );
        var authorized = assembly(true);
        UUID observationId = authorized.snapshot().observations().getFirst().observationId();
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(authorized);
        when(snapshotService.resolve(patientId, authorized.snapshot())).thenReturn(
            readySnapshotsWithContent(authorized.snapshot(), observationId)
        );
        when(ai.executeDoctorSupport(any())).thenThrow(new RestClientException("offline"));

        var task = service.execute(doctorId, appointmentId, request).taskResults().getFirst();

        assertEquals(DoctorSupportTaskExecutionStatus.DEGRADED, task.status());
        assertEquals("INSUFFICIENT_EVIDENCE", task.result().path("evidenceFit").asText());
        assertEquals(
            "Live hypothesis checking is temporarily unavailable, and the existing report-level analysis does not explicitly evaluate this hypothesis.",
            task.result().path("summary").asText()
        );
        assertEquals(0, task.result().path("points").size());
        verify(ai, never()).analyze(any(), any());
    }

    @Test
    void providerTimeoutUsesReadySnapshotFallbackWithoutInvokingMedGemma() {
        var request = request(List.of(DoctorSupportTask.FIND_GAPS), null, "degraded-timeout");
        var authorized = assembly(true);
        UUID observationId = authorized.snapshot().observations().getFirst().observationId();
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(authorized);
        when(snapshotService.resolve(patientId, authorized.snapshot())).thenReturn(
            readySnapshotsWithContent(authorized.snapshot(), observationId)
        );
        when(ai.executeDoctorSupport(any())).thenThrow(new RestClientException(
            "transport detail", new java.net.SocketTimeoutException("private")
        ));

        var task = service.execute(doctorId, appointmentId, request).taskResults().getFirst();

        assertEquals(DoctorSupportTaskExecutionStatus.DEGRADED, task.status());
        assertEquals("GEMINI_TIMEOUT", task.safeFailureCode());
        assertEquals("MEDGEMMA_SNAPSHOT_FALLBACK", task.provenance().executionProvider());
        org.junit.jupiter.api.Assertions.assertTrue(task.result().path("gaps").size() >= 1);
        verify(ai, never()).analyze(any(), any());
    }

    @Test
    void degradedFallbackImmediatelyExcludesRevokedReportSnapshotAndEvidence() {
        var request = request(List.of(DoctorSupportTask.EXPLORE_EXPLANATIONS), null, "revoked-fallback");
        var authorized = assemblyForReports(List.of(secondReportId));
        UUID authorizedObservation = authorized.snapshot().observations().getFirst().observationId();
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(authorized);
        when(snapshotService.resolve(patientId, authorized.snapshot())).thenReturn(
            readySnapshotsWithContent(authorized.snapshot(), authorizedObservation)
        );
        when(ai.executeDoctorSupport(any())).thenThrow(new RestClientException("offline"));

        DoctorSupportExecutionResponse response = service.execute(doctorId, appointmentId, request);

        assertEquals(List.of(secondReportId), response.reports().stream()
            .map(DoctorSupportEvidenceSnapshot.ReportEvidence::reportId).toList());
        assertEquals(1, response.taskResults().getFirst().result().path("explanations").size());
        assertEquals(authorizedObservation.toString(), response.taskResults().getFirst().result()
            .path("explanations").get(0).path("supportingEvidence").get(0).path("observationId").asText());
    }

    @Test
    void deterministicBriefCompareAndFactualEvidenceRemainAvailableDuringProviderRateLimiting() {
        var request = new DoctorSupportExecutionRequest(
            List.of(
                DoctorSupportTask.BRIEF_PATIENT,
                DoctorSupportTask.COMPARE_EVIDENCE,
                DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION
            ),
            "What is the latest MCV value?", reportId, List.of(), List.of(), null, "deterministic-during-429"
        );
        var firstObservation = UUID.randomUUID();
        var secondObservation = UUID.randomUUID();
        var reports = List.of(
            report(reportId, LocalDate.of(2026, 1, 1)),
            report(secondReportId, LocalDate.of(2026, 2, 1))
        );
        var observations = List.of(
            new DoctorSupportEvidenceSnapshot.ObservationEvidence(
                firstObservation, reportId, "MCV", "MCV", "NUMERIC", BigDecimal.valueOf(72), null, null,
                "fL", BigDecimal.valueOf(80), BigDecimal.valueOf(100), "80-100", "LOW", "PATIENT_CONFIRMED",
                BigDecimal.valueOf(72), "fl", "fl"),
            new DoctorSupportEvidenceSnapshot.ObservationEvidence(
                secondObservation, secondReportId, "MCV", "MCV", "NUMERIC", BigDecimal.valueOf(70), null, null,
                "fL", BigDecimal.valueOf(80), BigDecimal.valueOf(100), "80-100", "LOW", "DOCTOR_VERIFIED",
                BigDecimal.valueOf(70), "fl", "fl")
        );
        var fact = new DoctorSupportEvidenceSnapshot.ComparisonFact(
            "MCV", "MCV", firstObservation, secondObservation,
            LocalDate.of(2026, 1, 1), LocalDate.of(2026, 2, 1),
            BigDecimal.valueOf(72), BigDecimal.valueOf(70), "fl", "DECREASED"
        );
        var snapshot = new DoctorSupportEvidenceSnapshot("snapshot", reports, observations, List.of(fact));
        var authorized = new DoctorSupportEvidenceAssembler.Assembly(
            snapshot, List.of(), patientId,
            new DoctorSupportEvidenceAssembler.AppointmentContext(null, null, null, null)
        );
        when(assembler.assemble(doctorId, appointmentId, request)).thenReturn(authorized);

        DoctorSupportExecutionResponse response = service.execute(doctorId, appointmentId, request);

        assertEquals(DoctorSupportExecutionStatus.SUCCEEDED, response.status());
        assertEquals(3, response.taskResults().size());
        response.taskResults().forEach(task -> {
            assertEquals(DoctorSupportTaskExecutionStatus.SUCCEEDED, task.status());
            assertEquals("DETERMINISTIC", task.provenance().executionProvider());
            assertEquals(0, task.provenance().providerAttempts());
        });
        verify(snapshotService).resolveAvailable(patientId, snapshot);
        verify(snapshotService, never()).resolve(any(), any());
        verify(ai, never()).executeDoctorSupport(any());
        verify(ai, never()).analyze(any(), any());
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

    @Test
    void appointmentBrowserRequestForAllLiveTasksForwardsOneAuthoritativeSnapshot() {
        var tasks = List.of(
            DoctorSupportTask.CONNECT_EVIDENCE,
            DoctorSupportTask.CROSS_CHECK_ASSESSMENT,
            DoctorSupportTask.FIND_GAPS,
            DoctorSupportTask.EXPLORE_EXPLANATIONS,
            DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION
        );
        var browserRequest = new DoctorSupportExecutionRequest(
            tasks, "Review the appointment findings.", null, List.of(), List.of(),
            "Possible iron deficiency", "browser-shape"
        );
        var authoritative = assembly(true);
        when(assembler.assemble(doctorId, appointmentId, browserRequest)).thenReturn(authoritative);
        when(ai.executeDoctorSupport(any())).thenReturn(new MedGemmaClient.DoctorSupportExecutionResponse(
            tasks.stream().map(task -> aiResult(task.name(), "SUCCEEDED", null)).toList()
        ));

        DoctorSupportExecutionResponse response = service.execute(doctorId, appointmentId, browserRequest);

        assertEquals(DoctorSupportExecutionStatus.SUCCEEDED, response.status());
        assertEquals(authoritative.snapshot().reports().size(), response.reports().size());
        assertEquals(authoritative.snapshot().observations().size(), response.evidence().size());
        ArgumentCaptor<MedGemmaClient.DoctorSupportExecutionRequest> capture =
            ArgumentCaptor.forClass(MedGemmaClient.DoctorSupportExecutionRequest.class);
        verify(ai).executeDoctorSupport(capture.capture());
        var sent = capture.getValue();
        assertNull(browserRequest.currentReportId());
        assertEquals(tasks.stream().map(Enum::name).toList(), sent.tasks().stream()
            .map(MedGemmaClient.DoctorSupportTaskExecutionRequest::taskId).toList());
        assertEquals(mapper.valueToTree(authoritative.snapshot().observations()), sent.evidenceSnapshot().path("observations"));
        assertEquals(mapper.valueToTree(authoritative.snapshot().comparisonFacts()), sent.evidenceSnapshot().path("comparisonFacts"));
        assertEquals("snapshot", sent.evidenceSnapshot().path("snapshotHash").asText());
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
            List.of(new DoctorSupportExecutionResponse.CandidateReport(secondReportId, "LAB_RESULTS", LocalDate.of(2025, 12, 1))),
            patientId, new DoctorSupportEvidenceAssembler.AppointmentContext(null, null, null, null));
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
            failure, "gemini-2.5-flash", "api", "HOSTED", spec.promptVersion(), spec.responseSchemaVersion(),
            "GEMINI", "SUCCEEDED".equals(status) ? "PASSED" : "REJECTED", 5L, 0L, 1L,
            "SUCCEEDED".equals(status) ? 1 : 0,
            spec.ragPolicy() != DoctorSupportRagPolicy.DISABLED, spec.ragPolicy().name(),
            spec.ragPolicy() == DoctorSupportRagPolicy.DISABLED ? "NOT_REQUIRED" : "USED",
            spec.ragPolicy() == DoctorSupportRagPolicy.DISABLED ? null : "cki_test",
            spec.ragPolicy() == DoctorSupportRagPolicy.DISABLED ? List.of() : List.of("ck_test"),
            List.of(), 4L, List.of()
        );
    }

    private DoctorSupportEvidenceAssembler.Assembly assemblyForReports(List<UUID> reportIds) {
        var reports = reportIds.stream().map(id -> report(id, LocalDate.of(2026, 1, 1))).toList();
        var observations = reportIds.stream().map(id -> new DoctorSupportEvidenceSnapshot.ObservationEvidence(
            UUID.nameUUIDFromBytes(("observation:" + id).getBytes(java.nio.charset.StandardCharsets.UTF_8)),
            id, "MCV", "MCV", "NUMERIC", BigDecimal.valueOf(72), null, null,
            "fL", BigDecimal.valueOf(80), BigDecimal.valueOf(100), "80-100", "LOW", "PATIENT_CONFIRMED",
            BigDecimal.valueOf(72), "fl", "fl"
        )).toList();
        var snapshot = new DoctorSupportEvidenceSnapshot(
            UUID.nameUUIDFromBytes(reportIds.toString().getBytes()).toString().replace("-", "") + "a".repeat(32),
            reports, observations, List.of()
        );
        return new DoctorSupportEvidenceAssembler.Assembly(
            snapshot, List.of(), patientId, new DoctorSupportEvidenceAssembler.AppointmentContext(null, null, null, null)
        );
    }

    private List<UUID> jsonReportIds(com.fasterxml.jackson.databind.JsonNode snapshots) {
        List<UUID> values = new java.util.ArrayList<>();
        snapshots.forEach(item -> values.add(UUID.fromString(item.path("reportId").asText())));
        return values;
    }

    private DoctorClinicalReasoningSnapshotService.Resolution readySnapshots(DoctorSupportEvidenceSnapshot evidence) {
        var snapshots = evidence.reports().stream().map(report -> new DoctorClinicalReasoningSnapshotService.ClinicalReasoningSnapshot(
            UUID.nameUUIDFromBytes(report.reportId().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)),
            report.reportId(), "b".repeat(64), "google/medgemma-1.5-4b-it@main",
            "patient-lab-report-v5", "1.1", "READY", List.of(), List.of(), List.of(),
            Instant.parse("2026-09-17T09:00:00Z")
        )).toList();
        var provenance = snapshots.stream().map(item -> new DoctorClinicalReasoningSnapshotService.SnapshotProvenance(
            item.snapshotId(), UUID.nameUUIDFromBytes(("job:" + item.reportId()).getBytes(java.nio.charset.StandardCharsets.UTF_8)),
            item.reportId(), item.evidenceVersion(), item.status(), "google/medgemma-1.5-4b-it", "main",
            item.promptVersion(), item.schemaVersion(), item.generatedAt()
        )).toList();
        return new DoctorClinicalReasoningSnapshotService.Resolution(
            DoctorClinicalReasoningSnapshotService.Availability.READY, snapshots, provenance
        );
    }

    private DoctorClinicalReasoningSnapshotService.Resolution readySnapshotsWithContent(
        DoctorSupportEvidenceSnapshot evidence, UUID observationId
    ) {
        var snapshots = evidence.reports().stream().map(report -> {
            boolean hasEvidence = report.reportId().equals(
                evidence.observations().stream()
                    .filter(item -> item.observationId().equals(observationId))
                    .map(DoctorSupportEvidenceSnapshot.ObservationEvidence::reportId)
                    .findFirst().orElse(null)
            );
            return new DoctorClinicalReasoningSnapshotService.ClinicalReasoningSnapshot(
                UUID.nameUUIDFromBytes(report.reportId().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                report.reportId(), "b".repeat(64), "google/medgemma-1.5-4b-it@main",
                "patient-lab-report-v5", "1.1", "READY",
                hasEvidence ? List.of(new DoctorClinicalReasoningSnapshotService.ReasoningPattern(
                    "Iron deficiency", List.of(observationId), List.of()
                )) : List.of(),
                hasEvidence ? List.of(new DoctorClinicalReasoningSnapshotService.ReasoningPossibility(
                    "Iron deficiency", List.of(observationId), List.of(), List.of("Iron studies not present")
                )) : List.of(),
                hasEvidence ? List.of("Longitudinal context not present") : List.of(),
                Instant.parse("2026-09-17T09:00:00Z")
            );
        }).toList();
        var provenance = snapshots.stream().map(item -> new DoctorClinicalReasoningSnapshotService.SnapshotProvenance(
            item.snapshotId(), UUID.nameUUIDFromBytes(("job:" + item.reportId()).getBytes(java.nio.charset.StandardCharsets.UTF_8)),
            item.reportId(), item.evidenceVersion(), item.status(), "google/medgemma-1.5-4b-it", "main",
            item.promptVersion(), item.schemaVersion(), item.generatedAt()
        )).toList();
        return new DoctorClinicalReasoningSnapshotService.Resolution(
            DoctorClinicalReasoningSnapshotService.Availability.READY, snapshots, provenance
        );
    }
}
