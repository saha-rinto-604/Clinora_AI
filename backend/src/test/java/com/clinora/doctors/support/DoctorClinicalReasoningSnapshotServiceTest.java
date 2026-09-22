package com.clinora.doctors.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.ai.client.MedGemmaClient.ClinicalCluster;
import com.clinora.ai.client.MedGemmaClient.ClusterCandidate;
import com.clinora.ai.client.MedGemmaClient.ClusterEvidence;
import com.clinora.ai.client.MedGemmaClient.ReportAnalysisResponse;
import com.clinora.ai.service.PatientReportAiAnalysisService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DoctorClinicalReasoningSnapshotServiceTest {
    private final UUID patient = UUID.randomUUID();
    private final UUID reportA = UUID.randomUUID();
    private final UUID reportB = UUID.randomUUID();
    private final UUID reportC = UUID.randomUUID();
    private final UUID observationA = UUID.randomUUID();
    private final UUID hiddenObservationA = UUID.randomUUID();
    private final UUID observationC = UUID.randomUUID();

    @Test
    void resolvesOnlyFreshlyAuthorizedReportsAndFiltersUnselectedObservationReasoning() {
        PatientReportAiAnalysisService analysis = mock(PatientReportAiAnalysisService.class);
        when(analysis.resolveDoctorSnapshot(patient, reportA)).thenReturn(ready(reportA, observationA, hiddenObservationA));
        when(analysis.resolveDoctorSnapshot(patient, reportC)).thenReturn(ready(reportC, observationC));
        var service = new DoctorClinicalReasoningSnapshotService(analysis);

        var result = service.resolve(patient, evidence(List.of(reportA, reportC), List.of(observationA, observationC)));

        assertEquals(DoctorClinicalReasoningSnapshotService.Availability.READY, result.availability());
        assertEquals(List.of(reportA, reportC), result.snapshots().stream()
            .map(DoctorClinicalReasoningSnapshotService.ClinicalReasoningSnapshot::reportId).toList());
        assertEquals(List.of(observationA), result.snapshots().getFirst().patterns().getFirst().support());
        assertFalse(result.snapshots().getFirst().patterns().getFirst().support().contains(hiddenObservationA));
        verify(analysis, never()).resolveDoctorSnapshot(patient, reportB);
    }

    @Test
    void differentPatientsResolveOnlyTheirOwnAuthorizedReportSets() {
        UUID secondPatient = UUID.randomUUID();
        PatientReportAiAnalysisService analysis = mock(PatientReportAiAnalysisService.class);
        when(analysis.resolveDoctorSnapshot(patient, reportA)).thenReturn(ready(reportA, observationA));
        when(analysis.resolveDoctorSnapshot(secondPatient, reportB)).thenReturn(ready(reportB, observationC));
        var service = new DoctorClinicalReasoningSnapshotService(analysis);

        var first = service.resolve(patient, evidence(List.of(reportA), List.of(observationA)));
        var second = service.resolve(secondPatient, evidence(List.of(reportB), List.of(observationC)));

        assertEquals(List.of(reportA), first.snapshots().stream()
            .map(DoctorClinicalReasoningSnapshotService.ClinicalReasoningSnapshot::reportId).toList());
        assertEquals(List.of(reportB), second.snapshots().stream()
            .map(DoctorClinicalReasoningSnapshotService.ClinicalReasoningSnapshot::reportId).toList());
        verify(analysis, never()).resolveDoctorSnapshot(patient, reportB);
        verify(analysis, never()).resolveDoctorSnapshot(secondPatient, reportA);
    }

    @Test
    void oneStaleReportPreventsTheCombinedReasoningSetFromBeingReady() {
        PatientReportAiAnalysisService analysis = mock(PatientReportAiAnalysisService.class);
        when(analysis.resolveDoctorSnapshot(patient, reportA)).thenReturn(ready(reportA, observationA));
        when(analysis.resolveDoctorSnapshot(patient, reportC)).thenReturn(new PatientReportAiAnalysisService.DoctorSnapshot(
            null, UUID.randomUUID(), reportC, "e".repeat(64), "STALE", null,
            "google/medgemma-1.5-4b-it", "main", "patient-lab-report-v5", "1.1", null, null
        ));

        var result = new DoctorClinicalReasoningSnapshotService(analysis)
            .resolve(patient, evidence(List.of(reportA, reportC), List.of(observationA, observationC)));

        assertEquals(DoctorClinicalReasoningSnapshotService.Availability.STALE, result.availability());
    }

    @Test
    void briefResolutionReadsOnlyExistingSnapshotsAndNeverQueuesMedGemma() {
        PatientReportAiAnalysisService analysis = mock(PatientReportAiAnalysisService.class);
        when(analysis.peekDoctorSnapshot(patient, reportA)).thenReturn(ready(reportA, observationA));
        var service = new DoctorClinicalReasoningSnapshotService(analysis);

        var result = service.resolveAvailable(patient, evidence(List.of(reportA), List.of(observationA)));

        assertEquals(DoctorClinicalReasoningSnapshotService.Availability.READY, result.availability());
        assertEquals("Report pattern", result.snapshots().getFirst().patterns().getFirst().concept());
        assertEquals(List.of("additional context"), result.snapshots().getFirst().gaps());
        verify(analysis, never()).resolveDoctorSnapshot(patient, reportA);
    }

    private PatientReportAiAnalysisService.DoctorSnapshot ready(UUID report, UUID... observationIds) {
        List<ClusterEvidence> evidence = java.util.Arrays.stream(observationIds)
            .map(id -> new ClusterEvidence(id, "SUPPORTS", "Advisory relevance.", "VERIFIED_ABNORMAL"))
            .toList();
        ClinicalCluster cluster = new ClinicalCluster(
            "Report pattern", "Advisory interpretation.", evidence,
            List.of(new ClusterCandidate(
                "Possible explanation", "Advisory rationale.", List.of(observationIds[0]), List.of(),
                List.of("additional context"), List.of(), "LIMITED"
            )),
            List.of("additional context"), List.of()
        );
        ReportAnalysisResponse reasoning = new ReportAnalysisResponse(
            "POSSIBLE_CLINICAL_PATTERN", "Summary", List.of(), List.of(), List.of(),
            "Patient explanation", List.of(), "google/medgemma-1.5-4b-it", "main",
            "patient-lab-report-v5", "1.1", List.of(cluster), "Overall"
        );
        return new PatientReportAiAnalysisService.DoctorSnapshot(
            UUID.nameUUIDFromBytes(report.toString().getBytes()), UUID.randomUUID(), report, "f".repeat(64),
            "READY", reasoning, "google/medgemma-1.5-4b-it", "main", "patient-lab-report-v5", "1.1",
            Instant.parse("2026-09-21T00:00:00Z"), null
        );
    }

    private DoctorSupportEvidenceSnapshot evidence(List<UUID> reports, List<UUID> observations) {
        List<DoctorSupportEvidenceSnapshot.ReportEvidence> reportEvidence = reports.stream().map(id ->
            new DoctorSupportEvidenceSnapshot.ReportEvidence(
                id, "LAB_RESULTS", LocalDate.of(2026, 9, 1), "REPORT_DATE", UUID.randomUUID(), "a".repeat(64), 1
            )
        ).toList();
        List<DoctorSupportEvidenceSnapshot.ObservationEvidence> observationEvidence = observations.stream().map(id -> {
            UUID report = id.equals(observationC) ? reports.getLast() : reports.getFirst();
            return new DoctorSupportEvidenceSnapshot.ObservationEvidence(
                id, report, "Finding", "FINDING", "NUMERIC", BigDecimal.ONE, null, null, "unit",
                BigDecimal.ZERO, BigDecimal.TEN, "0-10", "IN_RANGE", "PATIENT_CONFIRMED",
                BigDecimal.ONE, "unit", "unit"
            );
        }).toList();
        return new DoctorSupportEvidenceSnapshot("snapshot", reportEvidence, observationEvidence, List.of());
    }
}
