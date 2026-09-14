package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.NarrativeInput;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.NarrativeResult;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.GraphPoint;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.GraphView;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.HealthAreaView;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.HealthRecordSnapshot;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.LongitudinalHealthRecordView;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.MeasurementView;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.ObservationPoint;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.SummaryEvidenceFact;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.SummaryEvidenceSnapshot;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.SummaryEvidenceView;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.TrendView;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.HealthSummaryRequest;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;

class PatientPersonalHealthSummaryServiceTest {
    private static final UUID PATIENT = UUID.randomUUID();
    private final PatientLongitudinalHealthRecordService record = mock(PatientLongitudinalHealthRecordService.class);
    private final GeminiHealthSummaryNarrativeService narrative = mock(GeminiHealthSummaryNarrativeService.class);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<Clock> clocks = mock(ObjectProvider.class);

    @Test
    void verifiedUndatedLabAppearsInCurrentBriefingAndGeminiPayloadButNotChanges() {
        when(clocks.getIfAvailable(any())).thenReturn(Clock.fixed(Instant.parse("2026-09-15T00:00:00Z"), ZoneOffset.UTC));
        when(record.summaryEvidence(eq(PATIENT), any(), any())).thenReturn(projection(List.of(
            lab("E1", "HBA1C", "HbA1c", "GLUCOSE", "Glucose regulation", "6.8", "%", "HIGH", null, false),
            lab("E2", "TSH", "TSH", "THYROID", "Thyroid-related findings", "2.1", "mIU/L", "IN_RANGE", LocalDate.of(2026, 9, 10), true)
        ), List.of()));
        when(narrative.generate(any(), eq(false))).thenReturn(NarrativeResult.failed("PERMISSION_DENIED"));

        var summary = service().generate(PATIENT, new HealthSummaryRequest("LAST_12_MONTHS", null, null, false));

        assertTrue(summary.healthPicture().contains("HbA1c is 6.8 % (high)"));
        assertTrue(summary.keyThemes().stream().anyMatch(theme -> theme.title().equals("Glucose regulation")));
        assertTrue(summary.changes().isEmpty());
        assertTrue(summary.limitations().stream().anyMatch(item -> item.description().contains("current health picture")));
        assertEquals("PERMISSION_DENIED", summary.aiSummary().status());

        ArgumentCaptor<NarrativeInput> input = ArgumentCaptor.forClass(NarrativeInput.class);
        verify(narrative).generate(input.capture(), eq(false));
        assertTrue(input.getValue().evidence().stream().anyMatch(fact -> fact.name().equals("HbA1c") && !fact.dateReliable()));
        assertFalse(input.getValue().evidence().toString().contains("report-id"));
    }

    @Test
    void onlyReliablyDatedComparablePointsCreateAChange() {
        when(clocks.getIfAvailable(any())).thenReturn(Clock.fixed(Instant.parse("2026-09-15T00:00:00Z"), ZoneOffset.UTC));
        MeasurementView weight = measurementWithChange();
        when(record.summaryEvidence(eq(PATIENT), any(), any())).thenReturn(projection(List.of(
            lab("E1", "WEIGHT", "Weight", "BODY", "Body & Vitals", "54", "kg", "REPORTED", LocalDate.of(2026, 9, 1), true),
            lab("E2", "HBA1C", "HbA1c", "GLUCOSE", "Glucose regulation", "6.8", "%", "HIGH", null, false)
        ), List.of(new HealthAreaView("BODY", "Body & Vitals", List.of(weight)))));
        when(narrative.generate(any(), eq(true))).thenReturn(NarrativeResult.failed("NETWORK_ERROR"));

        var summary = service().generate(PATIENT, new HealthSummaryRequest("LAST_12_MONTHS", null, null, true));

        assertEquals(1, summary.changes().size());
        assertEquals("81 kg", summary.changes().getFirst().fromValue());
        assertEquals("54 kg", summary.changes().getFirst().toValue());
        assertEquals(LocalDate.of(2026, 1, 1), summary.changes().getFirst().fromDate());
        assertTrue(summary.evidence().stream().anyMatch(item -> item.measurementName().equals("HbA1c") && !item.chronologyEligible()));
        verify(narrative).generate(any(), eq(true));
    }

    private PatientPersonalHealthSummaryService service() {
        return new PatientPersonalHealthSummaryService(record, narrative, clocks);
    }

    private SummaryEvidenceView projection(List<SummaryEvidenceFact> facts, List<HealthAreaView> areas) {
        long uncertain = facts.stream().filter(fact -> !fact.dateReliable() && fact.sourceReportId() != null).count();
        SummaryEvidenceSnapshot snapshot = new SummaryEvidenceSnapshot(1, uncertain == 0 ? 1 : 0, (int) uncertain,
            facts.size(), (int) facts.stream().map(SummaryEvidenceFact::healthAreaCode).distinct().count(), areas.isEmpty() ? 0 : 1,
            0, 0, areas.isEmpty() ? null : LocalDate.of(2026, 1, 1), areas.isEmpty() ? null : LocalDate.of(2026, 9, 1));
        return new SummaryEvidenceView(snapshot, facts, List.of(), new LongitudinalHealthRecordView(
            new HealthRecordSnapshot(0, 0, 0, areas.stream().mapToInt(area -> area.measurements().size()).sum(), areas.size(), snapshot.coverageFrom(), snapshot.coverageTo()),
            areas, List.of(), List.of(), null));
    }

    private SummaryEvidenceFact lab(String id, String code, String name, String areaCode, String areaTitle, String value,
        String unit, String status, LocalDate clinicalDate, boolean reliable) {
        return new SummaryEvidenceFact(id, code, name, areaCode, areaTitle, new BigDecimal(value), null, null, unit,
            status.equals("HIGH") ? "4.0-5.6" : "0.4-4.0", status.equals("HIGH") ? new BigDecimal("4.0") : new BigDecimal("0.4"),
            status.equals("HIGH") ? new BigDecimal("5.6") : new BigDecimal("4.0"), status, clinicalDate,
            clinicalDate == null ? LocalDate.of(2026, 9, 14) : clinicalDate, reliable, reliable,
            reliable ? "REPORT_DATE" : "UPLOAD_FALLBACK", UUID.randomUUID(), "Verified lab report", "PATIENT_CONFIRMED", "MEDICAL_REPORT");
    }

    private MeasurementView measurementWithChange() {
        GraphPoint first = new GraphPoint(LocalDate.of(2026, 1, 1), new BigDecimal("81"), "kg", "PATIENT_PROFILE", UUID.randomUUID(), null, "Health Profile", "REPORTED", null);
        GraphPoint last = new GraphPoint(LocalDate.of(2026, 9, 1), new BigDecimal("54"), "kg", "PATIENT_PROFILE", UUID.randomUUID(), null, "Health Profile", "REPORTED", null);
        ObservationPoint latest = new ObservationPoint(UUID.randomUUID(), "PATIENT_PROFILE", UUID.randomUUID(), null, "Health Profile", "BODY_MEASUREMENT", null,
            last.date(), last.date(), true, "PROFILE_RECORDED_AT", null, "NUMERIC", last.value(), null, null, "kg", last.value(), "kg", "kg", null,
            null, null, "REPORTED", "PROFILE_RECORDED", false, Instant.parse("2026-09-01T00:00:00Z"));
        return new MeasurementView("WEIGHT", "Weight", "BODY", latest, new TrendView("DECREASING", new BigDecimal("-27"), null, 2, false, "kg"),
            new GraphView(true, false, false, null, List.of(first, last)), 2);
    }
}
