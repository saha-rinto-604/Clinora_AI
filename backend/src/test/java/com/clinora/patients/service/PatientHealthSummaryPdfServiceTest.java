package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.NarrativeResult;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.SummaryEvidenceSnapshot;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.BriefingItem;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.BriefingLimitation;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.BriefingTheme;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.PersonalHealthSummaryView;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.SummaryEvidence;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.SummaryPeriodView;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PatientHealthSummaryPdfServiceTest {
    @Test
    void pdfHtmlUsesBriefingStructureAndIncludesUndatedEvidenceWithoutFalseChronology() {
        SummaryEvidence evidence = new SummaryEvidence("E1", "HBA1C", "HbA1c", "GLUCOSE", "Glucose regulation",
            "6.8%", "%", "4.0-5.6", "HIGH", null, LocalDate.of(2026, 9, 14), false, false,
            "UPLOAD_FALLBACK", UUID.randomUUID(), "Verified lab report", "PATIENT_CONFIRMED", "MEDICAL_REPORT");
        PersonalHealthSummaryView summary = new PersonalHealthSummaryView(
            new SummaryPeriodView("LAST_12_MONTHS", "Last 12 months", LocalDate.of(2025, 9, 15), LocalDate.of(2026, 9, 15)),
            new SummaryEvidenceSnapshot(1, 0, 1, 1, 1, 0, 0, 0, null, null),
            "Your current verified record includes HbA1c at 6.8%.",
            List.of(new BriefingTheme("T-GLUCOSE", "Glucose regulation", "HbA1c is above its supplied range.", List.of("E1"))),
            List.of(), List.of(),
            List.of(new BriefingItem("F-1", "HbA1c of 6.8% may be worth discussing in clinical context.", List.of("E1"))),
            List.of(new BriefingItem("Q-1", "How should my HbA1c of 6.8% be interpreted?", List.of("E1"))),
            List.of(new BriefingLimitation("Clinical dates are missing", "This finding informs the current picture but not chronological trends.")),
            List.of(evidence), NarrativeResult.failed("PERMISSION_DENIED"), "Not a diagnosis.", Instant.parse("2026-09-15T00:00:00Z")
        );

        PatientPersonalHealthSummaryService summaries = mock(PatientPersonalHealthSummaryService.class);
        PatientHealthSummaryPdfService pdf = new PatientHealthSummaryPdfService(summaries);
        String html = pdf.html(summary);

        for (String heading : List.of("Your Health Picture", "What Stands Out", "What Changed", "What Looks Stable",
            "What May Deserve Follow-up", "Questions for Your Next Visit", "What Clinora Cannot Determine Yet", "Evidence appendix")) {
            assertTrue(html.contains(heading));
        }
        assertTrue(html.contains("HbA1c"));
        assertTrue(html.contains("clinical date unavailable"));
        assertFalse(html.contains("Latest values by health area"));
        assertFalse(html.contains("Source reports</h2><table"));
        assertFalse(html.contains("uploaded 14 Sep 2026 →"));

        when(summaries.generate(any(), any())).thenReturn(summary);
        byte[] rendered = pdf.render(UUID.randomUUID(), null);
        assertTrue(rendered.length > 1_000);
        assertTrue(new String(rendered, 0, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF"));
    }
}
