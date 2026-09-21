package com.clinora.doctors.support;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.clinora.ai.client.MedGemmaClient;
import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Real PostgreSQL queries against isolated synthetic evidence; no local Patient database. */
@Testcontainers
class DoctorSupportEvidenceScopeIntegrationTest {
    @Container static final PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16-alpine");
    JdbcTemplate jdbc;
    DoctorClinicalAccessService access;
    DoctorSupportContextService contexts;
    DoctorSupportEvidenceAssembler assembler;
    UUID doctor, patient, appointment, first, second, firstObservation;

    @BeforeEach void setUp() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword()));
        jdbc.execute("DROP SCHEMA public CASCADE");
        jdbc.execute("CREATE SCHEMA public");
        jdbc.execute("CREATE TABLE patient_medical_reports (id uuid PRIMARY KEY, patient_user_id uuid, report_type text, report_date date, archived_at timestamp, subject_type text, sha256_checksum text DEFAULT 'hash', version bigint DEFAULT 1)");
        jdbc.execute("CREATE TABLE appointment_report_shares (appointment_id uuid, report_id uuid, doctor_user_id uuid, patient_user_id uuid, revoked_at timestamp, shared_at timestamp DEFAULT now())");
        jdbc.execute("CREATE TABLE medical_report_extraction_jobs (id uuid PRIMARY KEY, report_id uuid, patient_user_id uuid, status text)");
        jdbc.execute("CREATE TABLE medical_report_extraction_results (id uuid PRIMARY KEY, report_id uuid, job_id uuid, review_status text, created_at timestamp DEFAULT now())");
        jdbc.execute("""
            CREATE TABLE medical_report_observations (id uuid PRIMARY KEY, extraction_result_id uuid,
            verification_status text, effective_label text DEFAULT 'MCV', normalized_label text DEFAULT 'mcv',
            effective_numeric_value numeric DEFAULT 72, effective_unit text DEFAULT 'fL', reference_low numeric DEFAULT 80,
            reference_high numeric DEFAULT 100, effective_text_value text, effective_value_type text DEFAULT 'NUMERIC',
            effective_comparator text, reference_range_raw text DEFAULT '80-100', derived_range_flag text DEFAULT 'LOW',
            source_flag text, page_number int DEFAULT 1, updated_at timestamp DEFAULT now())
            """);
        jdbc.execute("CREATE TABLE appointments (id uuid PRIMARY KEY, reason_for_visit text, scheduled_start timestamp, scheduled_end timestamp, booking_timezone text)");
        doctor = UUID.randomUUID(); patient = UUID.randomUUID(); appointment = UUID.randomUUID();
        jdbc.update("INSERT INTO appointments VALUES (?, 'Evidence review', now(), now() + interval '1 hour', 'UTC')", appointment);
        access = mock(DoctorClinicalAccessService.class);
        var owned = new DoctorClinicalAccessService.AppointmentAccess(appointment, patient, doctor, "BOOKED", Instant.now(), Instant.now().plusSeconds(3600), "UTC");
        when(access.requireActiveOwnedAppointment(doctor, appointment)).thenReturn(new DoctorClinicalAccessService.ActiveAppointmentAccess(owned));
        when(access.requireSharedReport(eq(doctor), eq(appointment), any())).thenAnswer(call -> {
            UUID report = call.getArgument(2);
            Integer count = jdbc.queryForObject("SELECT count(*) FROM appointment_report_shares s JOIN patient_medical_reports r ON r.id=s.report_id AND r.patient_user_id=s.patient_user_id WHERE s.appointment_id=? AND s.doctor_user_id=? AND s.patient_user_id=? AND s.report_id=? AND s.revoked_at IS NULL AND r.archived_at IS NULL AND r.subject_type='SELF'", Integer.class, appointment, doctor, patient, report);
            if (count == 0) throw new DoctorApiException(org.springframework.http.HttpStatus.NOT_FOUND, "SHARED_REPORT_NOT_AVAILABLE", "Unavailable");
            return new DoctorClinicalAccessService.SharedReportAccess(owned, report, Instant.now());
        });
        contexts = new DoctorSupportContextService(jdbc, access);
        assembler = new DoctorSupportEvidenceAssembler(access, jdbc, new ObjectMapper().findAndRegisterModules());
        first = report(appointment, doctor, patient, "2026-01-01");
        second = report(appointment, doctor, patient, "2026-02-01");
        firstObservation = observation(first);
    }

    UUID report(UUID appt, UUID doc, UUID owner, String date) {
        UUID report = UUID.randomUUID(), job = UUID.randomUUID(), extraction = UUID.randomUUID();
        jdbc.update("INSERT INTO patient_medical_reports (id, patient_user_id, report_type, report_date, subject_type) VALUES (?, ?, 'CBC', ?::date, 'SELF')", report, owner, date);
        jdbc.update("INSERT INTO appointment_report_shares (appointment_id, report_id, doctor_user_id, patient_user_id) VALUES (?,?,?,?)", appt, report, doc, owner);
        jdbc.update("INSERT INTO medical_report_extraction_jobs VALUES (?,?,?,'SUCCEEDED')", job, report, owner);
        jdbc.update("INSERT INTO medical_report_extraction_results (id, report_id, job_id, review_status) VALUES (?,?,?,'VERIFIED')", extraction, report, job);
        jdbc.update("INSERT INTO medical_report_observations (id, extraction_result_id, verification_status) VALUES (?,?,'DOCTOR_VERIFIED')", UUID.randomUUID(), extraction);
        return report;
    }
    UUID observation(UUID report) {
        return jdbc.queryForObject("SELECT o.id FROM medical_report_observations o JOIN medical_report_extraction_results e ON e.id=o.extraction_result_id WHERE e.report_id=?", UUID.class, report);
    }
    DoctorSupportRoutingRequest routing(String message, UUID current, List<UUID> reports, List<UUID> observations) {
        return new DoctorSupportRoutingRequest(message, null, DoctorSupportScreen.APPOINTMENT, current, reports, observations, true, false);
    }
    DoctorSupportExecutionRequest execution(DoctorSupportTask task, UUID current, List<UUID> reports, List<UUID> observations) {
        return new DoctorSupportExecutionRequest(List.of(task), "Review evidence", current, reports, observations, "Doctor hypothesis", null);
    }
    List<UUID> assembledReports(DoctorSupportExecutionRequest request) {
        return assembler.assemble(doctor, appointment, request).snapshot().reports().stream().map(DoctorSupportEvidenceSnapshot.ReportEvidence::reportId).toList();
    }

    @Test void appointmentScopeExcludesUnrelatedRevokedAndIneligibleShares() {
        report(UUID.randomUUID(), doctor, patient, "2026-03-01");
        report(appointment, UUID.randomUUID(), patient, "2026-03-01");
        report(appointment, doctor, UUID.randomUUID(), "2026-03-01");
        for (String mutation : List.of(
            "UPDATE appointment_report_shares SET revoked_at=now() WHERE report_id=?",
            "UPDATE patient_medical_reports SET archived_at=now() WHERE id=?",
            "UPDATE patient_medical_reports SET subject_type='OTHER' WHERE id=?",
            "UPDATE medical_report_extraction_results SET review_status='PENDING' WHERE report_id=?",
            "UPDATE medical_report_extraction_jobs SET status='FAILED' WHERE report_id=?",
            "UPDATE medical_report_observations SET verification_status='UNVERIFIED' WHERE extraction_result_id IN (SELECT id FROM medical_report_extraction_results WHERE report_id=?)"
        )) jdbc.update(mutation, report(appointment, doctor, patient, "2026-03-01"));
        var context = contexts.build(doctor, appointment, routing("What is missing?", null, List.of(), List.of()));
        assertEquals(Set.of(first, second), Set.copyOf(context.authorizedReportIds()));
        assertTrue(context.hasAuthorizedEvidence());
        assertTrue(context.comparableAuthorizedReportsAvailable());
        for (var task : List.of(DoctorSupportTask.CONNECT_EVIDENCE, DoctorSupportTask.FIND_GAPS,
            DoctorSupportTask.EXPLORE_EXPLANATIONS, DoctorSupportTask.CROSS_CHECK_ASSESSMENT, DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION)) {
            assertEquals(Set.copyOf(context.authorizedReportIds()), Set.copyOf(assembledReports(execution(task, null, List.of(), List.of()))));
        }
        jdbc.update("UPDATE appointment_report_shares SET revoked_at=now() WHERE report_id=?", second);
        assertEquals(List.of(first), contexts.build(doctor, appointment, routing("Review", null, List.of(), List.of())).authorizedReportIds());
        assertEquals(List.of(first), assembledReports(execution(DoctorSupportTask.CONNECT_EVIDENCE, null, List.of(), List.of())));
    }

    @Test void explicitScopesRemainNarrowAndShareResolverWithExecution() {
        for (var req : List.of(routing("Review", first, List.of(), List.of()),
            routing("Review", second, List.of(first), List.of()),
            routing("Review", null, List.of(), List.of(firstObservation)))) {
            var context = contexts.build(doctor, appointment, req);
            var assembled = assembler.assemble(doctor, appointment, execution(DoctorSupportTask.CONNECT_EVIDENCE,
                req.currentReportId(), req.selectedReportIds(), req.selectedObservationIds()));
            assertEquals(List.of(first), context.authorizedReportIds());
            assertEquals(context.authorizedReportIds(), assembled.snapshot().reports().stream().map(DoctorSupportEvidenceSnapshot.ReportEvidence::reportId).toList());
            assertEquals(List.of(firstObservation), assembled.snapshot().observations().stream().map(DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId).toList());
        }
        var compare = assembler.assemble(doctor, appointment, execution(DoctorSupportTask.COMPARE_EVIDENCE, first, List.of(), List.of()));
        assertEquals(1, compare.snapshot().reports().size());
        assertTrue(compare.snapshot().comparisonFacts().isEmpty());
    }

    @Test void guessedAndOutOfScopeObservationIdsRemainOpaque() {
        UUID hidden = report(UUID.randomUUID(), doctor, patient, "2026-03-01");
        for (UUID id : List.of(UUID.randomUUID(), observation(hidden), observation(second))) {
            var failure = assertThrows(DoctorApiException.class, () -> contexts.build(doctor, appointment, routing("Review", first, List.of(), List.of(id))));
            assertEquals("REPORT_OBSERVATION_NOT_AVAILABLE", failure.getErrorCode());
        }
    }

    @Test void supersededObservationsCannotReenterTheEvidenceScope() {
        UUID job = UUID.randomUUID(), latest = UUID.randomUUID(), current = UUID.randomUUID();
        jdbc.update("INSERT INTO medical_report_extraction_jobs VALUES (?,?,?,'SUCCEEDED')", job, first, patient);
        jdbc.update("INSERT INTO medical_report_extraction_results VALUES (?,?,?,'VERIFIED',now() + interval '1 minute')", latest, first, job);
        jdbc.update("INSERT INTO medical_report_observations (id, extraction_result_id, verification_status) VALUES (?,?,'DOCTOR_VERIFIED')", current, latest);
        assertEquals("REPORT_OBSERVATION_NOT_AVAILABLE", assertThrows(DoctorApiException.class,
            () -> contexts.build(doctor, appointment, routing("Review", first, List.of(), List.of(firstObservation)))).getErrorCode());
        assertEquals(List.of(current), assembler.assemble(doctor, appointment,
            execution(DoctorSupportTask.FIND_GAPS, first, List.of(), List.of())).snapshot().observations().stream()
            .map(DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId).toList());
        jdbc.update("UPDATE medical_report_observations SET verification_status='UNVERIFIED' WHERE id=?", current);
        assertFalse(contexts.build(doctor, appointment, routing("Review", first, List.of(), List.of())).hasAuthorizedEvidence());
    }

    @Test void broadAppointmentClarificationOffersClinicalOperationsAndExplicitBriefBypassesRouter() {
        var semantic = mock(DoctorSupportSemanticRouter.class);
        when(semantic.route(anyString(), any(), anyList())).thenReturn(new DoctorSupportSemanticRouter.SemanticDecision(
            DoctorSupportRoutingStatus.CLARIFICATION_REQUIRED, List.of(), List.of("EXPLORE_EXPLANATIONS", "CONNECT_EVIDENCE", "FIND_GAPS")));
        var router = new DoctorSupportRoutingService(contexts, new DoctorSupportTaskRegistry(), semantic);
        var result = router.route(doctor, appointment, routing("What do you think about the reports?", null, List.of(), List.of()));
        assertEquals(DoctorSupportRoutingStatus.CLARIFICATION_REQUIRED, result.status());
        assertTrue(result.clarificationOptions().stream().anyMatch(choice -> choice.taskId() == DoctorSupportTask.EXPLORE_EXPLANATIONS));
        clearInvocations(semantic);
        var brief = new DoctorSupportRoutingRequest("Brief me", DoctorSupportTask.BRIEF_PATIENT,
            DoctorSupportScreen.APPOINTMENT, null, List.of(), List.of(), false, false);
        assertEquals(List.of(DoctorSupportTask.BRIEF_PATIENT), router.route(doctor, appointment, brief).taskIds());
        verifyNoInteractions(semantic);
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"Diagnose this patient.", "Give treatment and dose."})
    void definitiveDiagnosisAndPrescribingRemainUnsupported(String question) {
        var semantic = mock(DoctorSupportSemanticRouter.class);
        when(semantic.route(anyString(), any(), anyList())).thenReturn(new DoctorSupportSemanticRouter.SemanticDecision(
            DoctorSupportRoutingStatus.UNSUPPORTED, List.of(), List.of()));
        var router = new DoctorSupportRoutingService(contexts, new DoctorSupportTaskRegistry(), semantic);
        assertEquals(DoctorSupportRoutingStatus.UNSUPPORTED, router.route(doctor, appointment,
            routing(question, null, List.of(), List.of())).status());
    }

    @Test void wholeCurrentReportAndManualSelectionUseLatestVerifiedFindings() {
        UUID extra = UUID.randomUUID();
        jdbc.update("INSERT INTO medical_report_observations (id, extraction_result_id, verification_status) SELECT ?, extraction_result_id, 'DOCTOR_VERIFIED' FROM medical_report_observations WHERE id=?", extra, firstObservation);
        assertEquals(2, assembler.assemble(doctor, appointment, execution(DoctorSupportTask.FIND_GAPS, first, List.of(), List.of())).snapshot().observations().size());
        assertEquals(1, assembler.assemble(doctor, appointment, execution(DoctorSupportTask.FIND_GAPS, first, List.of(), List.of(firstObservation))).snapshot().observations().size());
        assertTrue(assembler.assemble(doctor, appointment, execution(DoctorSupportTask.COMPARE_EVIDENCE, null, List.of(), List.of())).snapshot().comparisonFacts().isEmpty());
    }

    @Test void comparisonRequiresReliableDatesTypesAndUnambiguousPairs() {
        assertEquals(1, assembler.assemble(doctor, appointment, execution(DoctorSupportTask.COMPARE_EVIDENCE, null, List.of(), List.of())).snapshot().comparisonFacts().size());
        jdbc.update("UPDATE patient_medical_reports SET report_date='2026-01-01' WHERE id=?", second);
        assertFalse(contexts.build(doctor, appointment, routing("Compare", null, List.of(), List.of())).comparableAuthorizedReportsAvailable());
        jdbc.update("UPDATE patient_medical_reports SET report_date='2026-02-01', report_type='OTHER' WHERE id=?", second);
        assertFalse(contexts.build(doctor, appointment, routing("Compare", null, List.of(), List.of())).comparableAuthorizedReportsAvailable());
        jdbc.update("UPDATE patient_medical_reports SET report_type='CBC' WHERE id=?", second);
        report(appointment, doctor, patient, "2026-03-01");
        assertTrue(assembler.assemble(doctor, appointment, execution(DoctorSupportTask.COMPARE_EVIDENCE, null, List.of(), List.of())).snapshot().comparisonFacts().isEmpty());
    }

    @Test void comparisonCandidatesUseTheSameEligibilityRulesAndDoNotEnterEvidence() {
        UUID invalid = report(appointment, doctor, patient, "2025-12-01");
        jdbc.update("UPDATE medical_report_observations SET verification_status='UNVERIFIED' WHERE extraction_result_id IN (SELECT id FROM medical_report_extraction_results WHERE report_id=?)", invalid);
        var result = assembler.assemble(doctor, appointment, execution(DoctorSupportTask.COMPARE_EVIDENCE, second, List.of(), List.of()));
        assertEquals(List.of(first), result.selectionCandidates().stream().map(DoctorSupportExecutionResponse.CandidateReport::reportId).toList());
        assertEquals(List.of(second), result.snapshot().reports().stream().map(DoctorSupportEvidenceSnapshot.ReportEvidence::reportId).toList());
    }

    @Test void notesOnlyDoesNotSendUnnecessaryPatientEvidence() {
        var result = assembler.assemble(doctor, appointment, execution(DoctorSupportTask.STRUCTURE_NOTES, first, List.of(), List.of(firstObservation)));
        assertTrue(result.snapshot().reports().isEmpty());
        assertTrue(result.snapshot().observations().isEmpty());
    }

    @Test void deterministicBriefAndCompareNeedNoAiAndReauthorizeCachedRequests() {
        var ai = mock(MedGemmaClient.class);
        var service = new DoctorSupportExecutionService(
            new DoctorSupportTaskRegistry(), assembler, mock(DoctorClinicalReasoningSnapshotService.class),
            ai, new ObjectMapper().findAndRegisterModules(), Clock.systemUTC()
        );
        for (var task : List.of(DoctorSupportTask.BRIEF_PATIENT, DoctorSupportTask.COMPARE_EVIDENCE)) {
            var req = new DoctorSupportExecutionRequest(List.of(task), "Review", null, List.of(), List.of(), null, task.name());
            var result = service.execute(doctor, appointment, req);
            assertEquals(DoctorSupportExecutionStatus.SUCCEEDED, result.status());
            assertNull(result.taskResults().getFirst().provenance().modelName());
            assertEquals("NOT_RUN", result.taskResults().getFirst().provenance().groundingStatus());
            assertEquals(result.executionId(), service.execute(doctor, appointment, req).executionId());
            jdbc.update("UPDATE appointment_report_shares SET revoked_at=now() WHERE report_id=?", second);
            var fresh = service.execute(doctor, appointment, req);
            assertEquals(List.of(first), fresh.reports().stream().map(DoctorSupportEvidenceSnapshot.ReportEvidence::reportId).toList());
            assertNotEquals(result.executionId(), fresh.executionId());
            jdbc.update("UPDATE appointment_report_shares SET revoked_at=NULL WHERE report_id=?", second);
        }
        verifyNoInteractions(ai);
        verify(access, atLeast(6)).requireActiveOwnedAppointment(doctor, appointment);
    }

    @Test void geminiInputContainsOnlyCurrentlySharedSnapshotsAndEvidenceAfterRevocation() {
        UUID third = report(appointment, doctor, patient, "2026-03-01");
        jdbc.update("UPDATE appointment_report_shares SET revoked_at=now() WHERE report_id=?", second);
        var ai = mock(MedGemmaClient.class);
        var snapshots = mock(DoctorClinicalReasoningSnapshotService.class);
        when(snapshots.resolve(eq(patient), any())).thenAnswer(call -> readySnapshots(call.getArgument(1)));
        when(ai.executeDoctorSupport(any())).thenReturn(aiSuccess("CONNECT_EVIDENCE"));
        var service = new DoctorSupportExecutionService(
            new DoctorSupportTaskRegistry(), assembler, snapshots, ai,
            new ObjectMapper().findAndRegisterModules(), Clock.systemUTC()
        );

        service.execute(doctor, appointment, execution(DoctorSupportTask.CONNECT_EVIDENCE, null, List.of(), List.of()));
        jdbc.update("UPDATE appointment_report_shares SET revoked_at=now() WHERE report_id=?", first);
        service.execute(doctor, appointment, execution(DoctorSupportTask.CONNECT_EVIDENCE, null, List.of(), List.of()));

        var capture = org.mockito.ArgumentCaptor.forClass(MedGemmaClient.DoctorSupportExecutionRequest.class);
        verify(ai, times(2)).executeDoctorSupport(capture.capture());
        assertEquals(Set.of(first, third), reportIds(capture.getAllValues().get(0).reasoningSnapshots()));
        assertEquals(Set.of(first, third), reportIds(capture.getAllValues().get(0).evidenceSnapshot().path("reports")));
        assertEquals(Set.of(third), reportIds(capture.getAllValues().get(1).reasoningSnapshots()));
        assertEquals(Set.of(third), reportIds(capture.getAllValues().get(1).evidenceSnapshot().path("reports")));
        assertFalse(capture.getAllValues().get(0).toString().contains(second.toString()));
    }

    @Test void differentDoctorsReceiveOnlyReportsSharedToThatExactDoctor() {
        UUID doctorTwo = UUID.randomUUID(), appointmentTwo = UUID.randomUUID();
        jdbc.update("INSERT INTO appointments VALUES (?, 'Evidence review', now(), now() + interval '1 hour', 'UTC')", appointmentTwo);
        UUID doctorTwoReport = report(appointmentTwo, doctorTwo, patient, "2026-04-01");
        var ownedTwo = new DoctorClinicalAccessService.AppointmentAccess(
            appointmentTwo, patient, doctorTwo, "BOOKED", Instant.now(), Instant.now().plusSeconds(3600), "UTC"
        );
        when(access.requireActiveOwnedAppointment(doctorTwo, appointmentTwo))
            .thenReturn(new DoctorClinicalAccessService.ActiveAppointmentAccess(ownedTwo));
        when(access.requireSharedReport(doctorTwo, appointmentTwo, doctorTwoReport))
            .thenReturn(new DoctorClinicalAccessService.SharedReportAccess(ownedTwo, doctorTwoReport, Instant.now()));
        var ai = mock(MedGemmaClient.class);
        var snapshots = mock(DoctorClinicalReasoningSnapshotService.class);
        when(snapshots.resolve(eq(patient), any())).thenAnswer(call -> readySnapshots(call.getArgument(1)));
        when(ai.executeDoctorSupport(any())).thenReturn(aiSuccess("CONNECT_EVIDENCE"));
        var service = new DoctorSupportExecutionService(
            new DoctorSupportTaskRegistry(), assembler, snapshots, ai,
            new ObjectMapper().findAndRegisterModules(), Clock.systemUTC()
        );

        service.execute(doctor, appointment, execution(DoctorSupportTask.CONNECT_EVIDENCE, first, List.of(), List.of()));
        var requestTwo = new DoctorSupportExecutionRequest(
            List.of(DoctorSupportTask.CONNECT_EVIDENCE), "Review evidence", doctorTwoReport,
            List.of(), List.of(), "Doctor hypothesis", null
        );
        service.execute(doctorTwo, appointmentTwo, requestTwo);

        var capture = org.mockito.ArgumentCaptor.forClass(MedGemmaClient.DoctorSupportExecutionRequest.class);
        verify(ai, times(2)).executeDoctorSupport(capture.capture());
        assertEquals(Set.of(first), reportIds(capture.getAllValues().get(0).reasoningSnapshots()));
        assertEquals(Set.of(doctorTwoReport), reportIds(capture.getAllValues().get(1).reasoningSnapshots()));
    }

    @ParameterizedTest
    @CsvSource(delimiter='|', value={
        "What disease could explain these findings?|EXPLORE_EXPLANATIONS",
        "What conditions could fit this pattern?|EXPLORE_EXPLANATIONS",
        "Do these findings fit together?|CONNECT_EVIDENCE",
        "What information is missing?|FIND_GAPS",
        "What changed from the previous report?|COMPARE_EVIDENCE"
    })
    void appointmentQuestionsKeepApplicableOperations(String question, DoctorSupportTask task) {
        var semantic = mock(DoctorSupportSemanticRouter.class);
        when(semantic.route(anyString(), any(), anyList())).thenReturn(new DoctorSupportSemanticRouter.SemanticDecision(DoctorSupportRoutingStatus.ROUTED, List.of(task.name()), List.of()));
        var router = new DoctorSupportRoutingService(contexts, new DoctorSupportTaskRegistry(), semantic);
        var result = router.route(doctor, appointment, routing(question, null, List.of(), List.of()));
        assertEquals(DoctorSupportRoutingStatus.ROUTED, result.status());
        assertEquals(List.of(task), result.taskIds());
    }

    private DoctorClinicalReasoningSnapshotService.Resolution readySnapshots(DoctorSupportEvidenceSnapshot evidence) {
        var values = evidence.reports().stream().map(report -> new DoctorClinicalReasoningSnapshotService.ClinicalReasoningSnapshot(
            UUID.nameUUIDFromBytes(report.reportId().toString().getBytes()), report.reportId(), "e".repeat(64),
            "google/medgemma-1.5-4b-it@main", "patient-lab-report-v5", "1.1", "READY",
            List.of(), List.of(), List.of(), Instant.now()
        )).toList();
        var provenance = values.stream().map(value -> new DoctorClinicalReasoningSnapshotService.SnapshotProvenance(
            value.snapshotId(), UUID.randomUUID(), value.reportId(), value.evidenceVersion(), "READY",
            "google/medgemma-1.5-4b-it", "main", value.promptVersion(), value.schemaVersion(), value.generatedAt()
        )).toList();
        return new DoctorClinicalReasoningSnapshotService.Resolution(
            DoctorClinicalReasoningSnapshotService.Availability.READY, values, provenance
        );
    }

    private MedGemmaClient.DoctorSupportExecutionResponse aiSuccess(String taskId) {
        DoctorSupportTaskSpec spec = new DoctorSupportTaskRegistry().require(DoctorSupportTask.valueOf(taskId));
        var result = new ObjectMapper().createObjectNode().put("taskId", taskId);
        return new MedGemmaClient.DoctorSupportExecutionResponse(List.of(
            new MedGemmaClient.DoctorSupportTaskExecutionResponse(
                taskId, "SUCCEEDED", result, null, "gemini-2.5-flash", "api", "HOSTED",
                spec.promptVersion(), spec.responseSchemaVersion(), "GEMINI", "PASSED", 5, 0, 1, 1,
                true, spec.ragPolicy().name(), "USED", "cki_test", List.of("ck_test"), List.of(), 1, List.of()
            )
        ));
    }

    private Set<UUID> reportIds(com.fasterxml.jackson.databind.JsonNode values) {
        Set<UUID> result = new LinkedHashSet<>();
        values.forEach(item -> result.add(UUID.fromString(item.path("reportId").asText())));
        return result;
    }
}
