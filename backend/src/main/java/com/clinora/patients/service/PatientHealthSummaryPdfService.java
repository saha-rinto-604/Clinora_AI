package com.clinora.patients.service;

import com.clinora.patients.service.PatientPersonalHealthSummaryService.BriefingChange;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.BriefingItem;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.BriefingLimitation;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.BriefingTheme;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.HealthSummaryRequest;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.PersonalHealthSummaryView;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.SummaryEvidence;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class PatientHealthSummaryPdfService {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM uuuu");
    private final PatientPersonalHealthSummaryService summaries;

    public PatientHealthSummaryPdfService(PatientPersonalHealthSummaryService summaries) {
        this.summaries = summaries;
    }

    public byte[] render(UUID patientUserId, HealthSummaryRequest request) {
        PersonalHealthSummaryView summary = summaries.generate(patientUserId, request);
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html(summary), null);
            builder.toStream(output);
            builder.run();
            return output.toByteArray();
        } catch (Exception exception) {
            throw new IllegalStateException("Could not render Personal Health Summary PDF.", exception);
        }
    }

    String html(PersonalHealthSummaryView summary) {
        Map<String, SummaryEvidence> evidence = new LinkedHashMap<>();
        summary.evidence().forEach(item -> evidence.put(item.evidenceId(), item));
        StringBuilder out = new StringBuilder(18_000);
        out.append("<!DOCTYPE html><html><head><meta charset='UTF-8'/><style>").append(styles()).append("</style></head><body>")
            .append("<header><div class='brand'>CLINORA</div><h1>Personal Health Summary</h1><p class='muted'>")
            .append(escape(period(summary))).append(" · Generated ").append(escape(DATE.format(summary.generatedAt().atZone(java.time.ZoneOffset.UTC))))
            .append("</p></header>");

        out.append("<table class='metrics'><tr>")
            .append(metric("Verified reports", summary.snapshot().verifiedReportsAvailable()))
            .append(metric("Reliably dated", summary.snapshot().reliablyDatedReports()))
            .append(metric("Date uncertain", summary.snapshot().dateUncertainVerifiedReports()))
            .append(metric("Tracked measurements", summary.snapshot().trackedVerifiedMeasurements()))
            .append(metric("Comparable history", summary.snapshot().measurementsWithComparableHistory()))
            .append("</tr></table>");

        sectionStart(out, "Your Health Picture", "ai");
        out.append("<p>").append(escape(summary.healthPicture())).append("</p>");
        out.append("<p class='small muted'>").append(aiLabel(summary)).append("</p></section>");

        sectionStart(out, "What Stands Out", null);
        if (summary.keyThemes().isEmpty()) empty(out, "No eligible verified themes are available yet.");
        for (BriefingTheme theme : summary.keyThemes()) {
            out.append("<div class='card'><h3>").append(escape(theme.title())).append("</h3><p>").append(escape(theme.description())).append("</p>");
            evidenceList(out, theme.evidenceIds(), evidence);
            out.append("</div>");
        }
        out.append("</section>");

        sectionStart(out, "What Changed", null);
        if (summary.changes().isEmpty()) empty(out, "There is not enough safely comparable, reliably dated history to show a qualifying change.");
        for (BriefingChange change : summary.changes()) {
            out.append("<div class='row'><strong>").append(escape(change.title())).append(": ")
                .append(escape(change.fromValue())).append(" → ").append(escape(change.toValue())).append("</strong><br/><span class='muted'>")
                .append(escape(change.description())).append("</span></div>");
        }
        out.append("</section>");

        itemSection(out, "What Looks Stable", summary.stableContext(), evidence, "No stable or in-range context qualifies yet.");
        itemSection(out, "What May Deserve Follow-up", summary.followUpItems(), evidence, "No current verified finding is outside a supplied range.");
        itemSection(out, "Questions for Your Next Visit", summary.visitQuestions(), evidence, "More verified information is needed to create personalized questions.");

        sectionStart(out, "What Clinora Cannot Determine Yet", null);
        if (summary.limitations().isEmpty()) empty(out, "No additional data limitations were identified for this briefing.");
        for (BriefingLimitation item : summary.limitations()) out.append("<div class='row'><strong>").append(escape(item.title()))
            .append("</strong><br/><span class='muted'>").append(escape(item.description())).append("</span></div>");
        out.append("</section>");

        out.append("<section class='appendix'><h2>Evidence appendix</h2><p class='small muted'>Only evidence referenced by this briefing is shown. Open Clinora Health Record for the full record.</p>");
        List<String> used = java.util.stream.Stream.of(
                summary.keyThemes().stream().flatMap(item -> item.evidenceIds().stream()),
                summary.changes().stream().flatMap(item -> item.evidenceIds().stream()),
                summary.stableContext().stream().flatMap(item -> item.evidenceIds().stream()),
                summary.followUpItems().stream().flatMap(item -> item.evidenceIds().stream()),
                summary.visitQuestions().stream().flatMap(item -> item.evidenceIds().stream()))
            .flatMap(stream -> stream).distinct().toList();
        evidenceList(out, used, evidence);
        out.append("</section><footer><p>").append(escape(summary.disclaimer())).append("</p></footer></body></html>");
        return out.toString();
    }

    private void itemSection(StringBuilder out, String title, List<BriefingItem> items, Map<String, SummaryEvidence> evidence, String empty) {
        sectionStart(out, title, null);
        if (items.isEmpty()) empty(out, empty);
        for (BriefingItem item : items) {
            out.append("<div class='row'><p>").append(escape(item.text())).append("</p>");
            evidenceList(out, item.evidenceIds(), evidence);
            out.append("</div>");
        }
        out.append("</section>");
    }

    private void evidenceList(StringBuilder out, List<String> ids, Map<String, SummaryEvidence> evidence) {
        if (ids == null || ids.isEmpty()) return;
        out.append("<ul class='evidence'>");
        ids.stream().map(evidence::get).filter(java.util.Objects::nonNull).limit(6).forEach(item -> out.append("<li><strong>")
            .append(escape(item.measurementName())).append(" ").append(escape(item.displayValue())).append("</strong> · ")
            .append(escape(status(item.status())))
            .append(item.suppliedRange() == null ? "" : " · supplied range " + escape(item.suppliedRange()))
            .append(" · ").append(item.dateReliable() && item.clinicalDate() != null ? escape(DATE.format(item.clinicalDate())) : "clinical date unavailable")
            .append(" · ").append(escape(item.sourceReportName())).append("</li>"));
        out.append("</ul>");
    }

    private String aiLabel(PersonalHealthSummaryView summary) {
        return switch (summary.aiSummary().status()) {
            case "AVAILABLE" -> "AI explanation generated from the deterministic evidence shown in this briefing.";
            case "INSUFFICIENT_DATA" -> "More verified information is needed for an AI explanation; deterministic sections remain available.";
            default -> "AI explanation was unavailable; deterministic sections remain available and no facts were replaced or guessed.";
        };
    }

    private String period(PersonalHealthSummaryView summary) {
        if (summary.period().from() == null || summary.period().to() == null) return summary.period().label();
        return summary.period().label() + ": " + DATE.format(summary.period().from()) + " – " + DATE.format(summary.period().to());
    }

    private void sectionStart(StringBuilder out, String title, String css) {
        out.append("<section").append(css == null ? "" : " class='" + css + "'").append("><h2>").append(escape(title)).append("</h2>");
    }
    private void empty(StringBuilder out, String text) { out.append("<p class='muted'>").append(escape(text)).append("</p>"); }
    private String metric(String label, int value) { return "<td><span>" + escape(label) + "</span><strong>" + value + "</strong></td>"; }
    private String status(String value) { return switch (value) { case "IN_RANGE" -> "In range"; case "HIGH" -> "High"; case "LOW" -> "Low"; default -> "Reported"; }; }
    private String escape(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }

    private String styles() {
        return """
            @page { size:A4; margin:13mm; }
            * { box-sizing:border-box; }
            body { margin:0; color:#172033; font:10pt/1.45 Arial, sans-serif; }
            header { border-bottom:2px solid #0f8fa3; margin-bottom:12px; padding-bottom:10px; }
            .brand { color:#087d91; font-size:8.5pt; font-weight:700; letter-spacing:.14em; }
            h1 { color:#0b1625; font-size:21pt; margin:3px 0; }
            h2 { color:#0b3440; font-size:13pt; margin:0 0 7px; }
            h3 { color:#15566a; font-size:11pt; margin:0 0 4px; }
            p { margin:3px 0; }
            section { margin:12px 0; }
            .metrics { border-collapse:separate; border-spacing:3px; table-layout:fixed; width:100%; }
            .metrics td { background:#f5fafb; border:1px solid #d9e5e8; padding:6px; vertical-align:top; }
            .metrics span { color:#687783; display:block; font-size:6.8pt; text-transform:uppercase; }
            .metrics strong { display:block; font-size:11pt; margin-top:2px; }
            .ai { background:#f1fbfc; border:1px solid #bfe3e9; border-radius:5px; padding:10px 11px; }
            .card { border:1px solid #dbe5e8; border-radius:4px; margin:7px 0; padding:8px 9px; page-break-inside:avoid; }
            .row { border-bottom:1px solid #e2e9ec; padding:6px 0; page-break-inside:avoid; }
            .evidence { color:#526474; font-size:8.2pt; margin:5px 0 0 16px; padding:0; }
            .evidence li { margin:2px 0; }
            .muted { color:#667584; }
            .small { font-size:8.2pt; }
            .appendix { border-top:1px solid #cbd8de; padding-top:10px; }
            footer { border-top:1px solid #cbd8de; color:#52606d; font-size:8.2pt; margin-top:12px; padding-top:8px; }
            """;
    }
}
