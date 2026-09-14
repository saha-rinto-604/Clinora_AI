package com.clinora.patients.service;

import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.EvidenceFact;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.InsightCandidate;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.NarrativeInput;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.NarrativeItem;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.NarrativeResult;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.NarrativeTheme;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.PeriodFacts;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.SnapshotFacts;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.ThemeCandidate;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.GraphPoint;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.HealthAreaView;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.MeasurementView;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.SummaryEvidenceFact;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.SummaryEvidenceSnapshot;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.SummaryEvidenceView;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Builds a concise evidence-backed briefing from the existing Health Record projection. */
@Service
public class PatientPersonalHealthSummaryService {
    private static final int MAX_THEMES = 5;
    private static final int MAX_THEME_EVIDENCE = 6;
    private static final int MAX_CHANGES = 5;
    private static final int MAX_STABLE = 4;
    private static final int MAX_FOLLOW_UP = 4;
    private static final String DISCLAIMER =
        "This briefing reflects verified information available in Clinora. A result outside its supplied range does not by itself establish a diagnosis or urgency. Clinora does not replace advice from a qualified healthcare professional.";

    private final PatientLongitudinalHealthRecordService healthRecord;
    private final GeminiHealthSummaryNarrativeService narrative;
    private final Clock clock;

    public PatientPersonalHealthSummaryService(
        PatientLongitudinalHealthRecordService healthRecord,
        GeminiHealthSummaryNarrativeService narrative,
        ObjectProvider<Clock> clockProvider
    ) {
        this.healthRecord = healthRecord;
        this.narrative = narrative;
        this.clock = clockProvider.getIfAvailable(Clock::systemUTC);
    }

    @Transactional(readOnly = true)
    public PersonalHealthSummaryView generate(UUID patientUserId, HealthSummaryRequest request) {
        HealthSummaryRequest safe = request == null ? new HealthSummaryRequest(null, null, null, false) : request;
        HealthSummaryPeriod period = HealthSummaryPeriod.resolve(safe.period(), safe.from(), safe.to(), clock);
        SummaryEvidenceView projection = healthRecord.summaryEvidence(patientUserId, period.from(), period.to());

        List<SummaryEvidence> evidence = projection.facts().stream().map(this::evidence).collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        List<BriefingTheme> themes = themes(evidence);
        List<BriefingChange> changes = changes(projection.longitudinal().areas(), evidence);
        List<BriefingItem> stable = stable(evidence, projection.longitudinal().areas());
        List<BriefingItem> followUps = followUps(themes, evidence);
        List<BriefingItem> questions = questions(themes, changes, evidence);
        List<BriefingLimitation> limitations = limitations(projection.snapshot(), evidence);

        NarrativeInput input = narrativeInput(period, projection.snapshot(), evidence, themes, stable, followUps, limitations);
        NarrativeResult ai = narrative.generate(input, Boolean.TRUE.equals(safe.forceRefresh()));

        String healthPicture = "AVAILABLE".equals(ai.status())
            ? ai.overallHealthView()
            : deterministicHealthPicture(evidence, projection.snapshot());
        List<BriefingTheme> finalThemes = mergeThemes(themes, ai);
        List<BriefingItem> finalStable = mergeItems(stable, ai.stableContext());
        List<BriefingItem> finalFollowUps = mergeItems(followUps, ai.followUpItems());
        List<BriefingItem> finalQuestions = ai.visitQuestions().size() >= 2
            ? ai.visitQuestions().stream().map(item -> new BriefingItem(item.itemId(), item.text(), item.evidenceIds())).toList()
            : questions;

        return new PersonalHealthSummaryView(
            new SummaryPeriodView(period.preset(), period.label(), period.from(), period.to()),
            projection.snapshot(),
            healthPicture,
            finalThemes,
            changes,
            finalStable,
            finalFollowUps,
            finalQuestions,
            limitations,
            List.copyOf(evidence),
            ai,
            DISCLAIMER,
            clock.instant()
        );
    }

    private List<BriefingTheme> themes(List<SummaryEvidence> evidence) {
        Map<String, List<SummaryEvidence>> byArea = new LinkedHashMap<>();
        evidence.forEach(item -> byArea.computeIfAbsent(item.healthAreaTitle(), ignored -> new ArrayList<>()).add(item));
        return byArea.entrySet().stream()
            .sorted(Comparator
                .comparingInt((Map.Entry<String, List<SummaryEvidence>> entry) -> abnormalCount(entry.getValue())).reversed()
                .thenComparingInt(entry -> -entry.getValue().size())
                .thenComparing(Map.Entry::getKey))
            .limit(MAX_THEMES)
            .map(entry -> {
                List<SummaryEvidence> selected = entry.getValue().stream()
                    .sorted(Comparator.comparing((SummaryEvidence item) -> abnormal(item.status()) ? 0 : 1)
                        .thenComparing(SummaryEvidence::measurementName))
                    .limit(MAX_THEME_EVIDENCE).toList();
                return new BriefingTheme(
                    "T-" + slug(entry.getKey()),
                    entry.getKey(),
                    themeDescription(entry.getKey(), selected),
                    selected.stream().map(SummaryEvidence::evidenceId).toList()
                );
            }).toList();
    }

    private String themeDescription(String title, List<SummaryEvidence> items) {
        long outside = items.stream().filter(item -> abnormal(item.status())).count();
        long inRange = items.stream().filter(item -> "IN_RANGE".equals(item.status())).count();
        if (outside > 0 && inRange > 0) {
            return title + " includes findings both outside and within their supplied ranges. Reviewing the related values together gives a more balanced current picture.";
        }
        if (outside > 0) return title + " includes verified findings outside their supplied ranges that may be useful to review together.";
        if (inRange > 0) return title + " is represented by verified findings within their supplied ranges. These results provide context but do not establish overall health on their own.";
        return title + " is represented by verified information without a validated supplied range for classification.";
    }

    private List<BriefingChange> changes(List<HealthAreaView> areas, List<SummaryEvidence> evidence) {
        List<BriefingChange> result = new ArrayList<>();
        for (HealthAreaView area : areas) {
            for (MeasurementView measurement : area.measurements()) {
                List<GraphPoint> points = measurement.graph().points();
                if (points.size() < 2) continue;
                if ("INSUFFICIENT_DATA".equals(measurement.trend().direction()) || "NOT_COMPARABLE".equals(measurement.trend().direction())) continue;
                GraphPoint first = points.getFirst();
                GraphPoint last = points.getLast();
                GraphPoint previous = points.get(points.size() - 2);
                boolean returnedToRange = "IN_RANGE".equals(last.status()) && abnormal(previous.status());
                if ("STABLE".equals(measurement.trend().direction()) && !returnedToRange) continue;
                if (first.value().compareTo(last.value()) == 0) continue;
                String firstId = ensureGraphEvidence(evidence, measurement, area, first);
                String lastId = ensureGraphEvidence(evidence, measurement, area, last);
                String qualifier = returnedToRange
                    ? "The most recent comparable reliably dated result returned inside its supplied range after the previous result was outside it."
                    : measurement.trend().trendQualified()
                        ? "Comparable reliably dated results support a " + measurement.trend().direction().toLowerCase().replace('_', ' ') + " pattern."
                        : "This is a change between two comparable reliably dated results; more history is needed before calling it a trend.";
                result.add(new BriefingChange(
                    "C-" + measurement.code(), measurement.name(), qualifier,
                    value(first.value(), first.unit()), value(last.value(), last.unit()), first.date(), last.date(),
                    measurement.trend().direction(), measurement.trend().trendQualified(), List.of(firstId, lastId)
                ));
            }
        }
        return result.stream().limit(MAX_CHANGES).toList();
    }

    private String ensureGraphEvidence(List<SummaryEvidence> evidence, MeasurementView measurement, HealthAreaView area, GraphPoint point) {
        return evidence.stream()
            .filter(item -> item.measurementCode().equals(measurement.code()) && Objects.equals(item.clinicalDate(), point.date()))
            .map(SummaryEvidence::evidenceId).findFirst().orElseGet(() -> {
                String id = "E" + (evidence.size() + 1);
                evidence.add(new SummaryEvidence(
                    id, measurement.code(), measurement.name(), area.code(), area.title(), value(point.value(), point.unit()),
                    point.unit(), point.referenceRangeRaw(), point.status(), point.date(), point.date(), true, true,
                    "REPORT_DATE", point.reportId(), point.reportName(), "VERIFIED_LONGITUDINAL", point.sourceType()
                ));
                return id;
            });
    }

    private List<BriefingItem> stable(List<SummaryEvidence> evidence, List<HealthAreaView> areas) {
        List<BriefingItem> result = new ArrayList<>();
        for (HealthAreaView area : areas) {
            for (MeasurementView measurement : area.measurements()) {
                if (!measurement.trend().trendQualified() || !"STABLE".equals(measurement.trend().direction())) continue;
                evidence.stream().filter(item -> item.measurementCode().equals(measurement.code())).findFirst().ifPresent(item ->
                    result.add(new BriefingItem("S-" + measurement.code(),
                        item.measurementName() + " has remained relatively stable across comparable reliably dated results; its current verified value is " + item.displayValue() + ".",
                        List.of(item.evidenceId()))));
            }
        }
        evidence.stream().filter(item -> "IN_RANGE".equals(item.status()))
            .filter(item -> result.stream().noneMatch(existing -> existing.evidenceIds().contains(item.evidenceId())))
            .limit(Math.max(0, MAX_STABLE - result.size()))
            .forEach(item -> result.add(new BriefingItem("S-" + item.evidenceId(),
                item.measurementName() + " is " + item.displayValue() + ", within its supplied range. This is useful context but does not establish overall health by itself.",
                List.of(item.evidenceId()))));
        return result.stream().limit(MAX_STABLE).toList();
    }

    private List<BriefingItem> followUps(List<BriefingTheme> themes, List<SummaryEvidence> evidence) {
        Map<String, SummaryEvidence> byId = evidenceMap(evidence);
        List<BriefingItem> result = new ArrayList<>();
        for (BriefingTheme theme : themes) {
            List<SummaryEvidence> abnormal = theme.evidenceIds().stream().map(byId::get).filter(Objects::nonNull)
                .filter(item -> abnormal(item.status())).toList();
            if (abnormal.isEmpty()) continue;
            String values = abnormal.stream().limit(3).map(item -> item.measurementName() + " " + item.displayValue() + " (" + statusLabel(item.status()) + ")")
                .collect(java.util.stream.Collectors.joining(" and "));
            result.add(new BriefingItem("F-" + theme.id(), values + " form a " + theme.title().toLowerCase()
                + " pattern that may be worth discussing in clinical context.", abnormal.stream().limit(3).map(SummaryEvidence::evidenceId).toList()));
        }
        return result.stream().limit(MAX_FOLLOW_UP).toList();
    }

    private List<BriefingItem> questions(List<BriefingTheme> themes, List<BriefingChange> changes, List<SummaryEvidence> evidence) {
        Map<String, SummaryEvidence> byId = evidenceMap(evidence);
        List<BriefingItem> result = new ArrayList<>();
        for (BriefingTheme theme : themes) {
            List<SummaryEvidence> items = theme.evidenceIds().stream().map(byId::get).filter(Objects::nonNull).limit(3).toList();
            if (items.isEmpty()) continue;
            String values = items.stream().map(item -> item.measurementName() + " of " + item.displayValue()).collect(java.util.stream.Collectors.joining(" and "));
            result.add(new BriefingItem("Q-" + theme.id(), "How should " + values + " be interpreted together in my clinical context?",
                items.stream().map(SummaryEvidence::evidenceId).toList()));
            if (result.size() == 3) break;
        }
        if (result.size() < 2 && !changes.isEmpty()) {
            BriefingChange change = changes.getFirst();
            result.add(new BriefingItem("Q-" + change.id(), "Is the recorded change in " + change.title() + " from " + change.fromValue()
                + " to " + change.toValue() + " expected in my situation?", change.evidenceIds()));
        }
        return result.stream().limit(4).toList();
    }

    private List<BriefingLimitation> limitations(SummaryEvidenceSnapshot snapshot, List<SummaryEvidence> evidence) {
        List<BriefingLimitation> result = new ArrayList<>();
        if (snapshot.dateUncertainVerifiedReports() > 0) result.add(new BriefingLimitation(
            "Clinical dates are missing",
            snapshot.dateUncertainVerifiedReports() + " verified report" + (snapshot.dateUncertainVerifiedReports() == 1 ? " has" : "s have")
                + " no reliable clinical date. Its findings can appear in the current health picture, but cannot safely be used for chronological trends or period-specific change claims."
        ));
        if (snapshot.measurementsWithComparableHistory() == 0 && !evidence.isEmpty()) result.add(new BriefingLimitation(
            "Comparable history is limited", "Clinora does not yet have two safely comparable, reliably dated results for a change calculation."
        ));
        if (snapshot.measurementsWithIncompatibleHistory() > 0) result.add(new BriefingLimitation(
            "Some units cannot be compared", snapshot.measurementsWithIncompatibleHistory() + " measurement history cannot be compared safely because its units are incompatible or incomplete."
        ));
        if (snapshot.observationsExcludedByValidation() > 0) result.add(new BriefingLimitation(
            "Some extracted values were excluded", "Clinora omitted values that did not pass current canonicalization or clinical-data validation rules."
        ));
        if (evidence.isEmpty()) result.add(new BriefingLimitation(
            "Not enough verified information", "There is not enough eligible verified health information to create a health briefing yet."
        ));
        return List.copyOf(result);
    }

    private NarrativeInput narrativeInput(HealthSummaryPeriod period, SummaryEvidenceSnapshot snapshot, List<SummaryEvidence> evidence,
        List<BriefingTheme> themes, List<BriefingItem> stable, List<BriefingItem> followUps, List<BriefingLimitation> limitations) {
        return new NarrativeInput(
            new PeriodFacts(period.label(), string(period.from()), string(period.to())),
            new SnapshotFacts(snapshot.verifiedReportsAvailable(), snapshot.reliablyDatedReports(), snapshot.dateUncertainVerifiedReports(),
                snapshot.trackedVerifiedMeasurements(), snapshot.healthAreasRepresented(), snapshot.measurementsWithComparableHistory()),
            evidence.stream().limit(80).map(item -> new EvidenceFact(item.evidenceId(), item.healthAreaTitle(), item.measurementName(),
                item.displayValue(), item.suppliedRange(), item.status(), string(item.clinicalDate()), item.dateReliable(), item.chronologyEligible())).toList(),
            themes.stream().map(item -> new ThemeCandidate(item.id(), item.title(), item.description(), item.evidenceIds())).toList(),
            stable.stream().map(item -> new InsightCandidate(item.id(), item.text(), item.evidenceIds())).toList(),
            followUps.stream().map(item -> new InsightCandidate(item.id(), item.text(), item.evidenceIds())).toList(),
            limitations.stream().map(BriefingLimitation::description).toList()
        );
    }

    private String deterministicHealthPicture(List<SummaryEvidence> evidence, SummaryEvidenceSnapshot snapshot) {
        if (evidence.isEmpty()) return "There is not enough eligible verified health information to describe your current health picture yet.";
        List<SummaryEvidence> highlights = evidence.stream().sorted(Comparator
            .comparing((SummaryEvidence item) -> abnormal(item.status()) ? 0 : 1)
            .thenComparing(SummaryEvidence::healthAreaTitle).thenComparing(SummaryEvidence::measurementName)).limit(5).toList();
        String facts = highlights.stream().map(item -> item.measurementName() + " is " + item.displayValue() + " (" + statusLabel(item.status()) + ")")
            .collect(java.util.stream.Collectors.joining(", "));
        String context = snapshot.dateUncertainVerifiedReports() > 0
            ? " Some verified findings do not have reliable clinical dates, so they inform this current picture but not chronological conclusions."
            : snapshot.measurementsWithComparableHistory() == 0 ? " Reliable longitudinal evidence is currently limited." : "";
        return "Your current verified record includes " + facts + "." + context;
    }

    private List<BriefingTheme> mergeThemes(List<BriefingTheme> deterministic, NarrativeResult ai) {
        if (!"AVAILABLE".equals(ai.status()) || ai.keyThemes().isEmpty()) return deterministic;
        Map<String, BriefingTheme> byId = new LinkedHashMap<>();
        deterministic.forEach(item -> byId.put(item.id(), item));
        List<BriefingTheme> merged = new ArrayList<>();
        for (NarrativeTheme item : ai.keyThemes()) {
            BriefingTheme base = byId.get(item.themeId());
            if (base != null) merged.add(new BriefingTheme(base.id(), base.title(), item.description(), item.evidenceIds()));
        }
        return merged.isEmpty() ? deterministic : List.copyOf(merged);
    }

    private List<BriefingItem> mergeItems(List<BriefingItem> deterministic, List<NarrativeItem> modelItems) {
        if (modelItems == null || modelItems.isEmpty()) return deterministic;
        Map<String, BriefingItem> byId = new LinkedHashMap<>();
        deterministic.forEach(item -> byId.put(item.id(), item));
        List<BriefingItem> result = new ArrayList<>();
        for (NarrativeItem item : modelItems) if (byId.containsKey(item.itemId())) result.add(new BriefingItem(item.itemId(), item.text(), item.evidenceIds()));
        return result.isEmpty() ? deterministic : List.copyOf(result);
    }

    private SummaryEvidence evidence(SummaryEvidenceFact fact) {
        return new SummaryEvidence(fact.evidenceId(), fact.measurementCode(), fact.measurementName(), fact.healthAreaCode(), fact.healthAreaTitle(),
            displayValue(fact), fact.unit(), range(fact), fact.status(), fact.clinicalDate(), fact.displayDate(), fact.dateReliable(),
            fact.chronologyEligible(), fact.dateBasis(), fact.sourceReportId(), fact.sourceReportName(), fact.verificationStatus(), fact.sourceType());
    }

    private String displayValue(SummaryEvidenceFact fact) {
        if (fact.numericValue() != null) return (fact.comparator() == null ? "" : fact.comparator()) + number(fact.numericValue())
            + (fact.unit() == null || fact.unit().isBlank() ? "" : " " + fact.unit());
        return fact.textValue() == null || fact.textValue().isBlank() ? "Reported" : fact.textValue().trim();
    }

    private String range(SummaryEvidenceFact fact) {
        if (fact.referenceRangeRaw() != null && !fact.referenceRangeRaw().isBlank()) return fact.referenceRangeRaw();
        if (fact.referenceLow() != null && fact.referenceHigh() != null) return number(fact.referenceLow()) + "–" + number(fact.referenceHigh());
        if (fact.referenceLow() != null) return "≥ " + number(fact.referenceLow());
        if (fact.referenceHigh() != null) return "≤ " + number(fact.referenceHigh());
        return null;
    }

    private Map<String, SummaryEvidence> evidenceMap(List<SummaryEvidence> evidence) {
        Map<String, SummaryEvidence> result = new LinkedHashMap<>();
        evidence.forEach(item -> result.put(item.evidenceId(), item));
        return result;
    }

    private int abnormalCount(List<SummaryEvidence> values) { return (int) values.stream().filter(item -> abnormal(item.status())).count(); }
    private boolean abnormal(String status) { return "LOW".equals(status) || "HIGH".equals(status); }
    private String statusLabel(String status) { return switch (status) { case "LOW" -> "low"; case "HIGH" -> "high"; case "IN_RANGE" -> "in range"; default -> "reported"; }; }
    private String value(BigDecimal value, String unit) { return number(value) + (unit == null || unit.isBlank() ? "" : " " + unit); }
    private String number(BigDecimal value) {
        BigDecimal display = value.stripTrailingZeros();
        if (display.scale() < 0) display = display.setScale(0, RoundingMode.UNNECESSARY);
        return display.toPlainString();
    }
    private String string(LocalDate value) { return value == null ? null : value.toString(); }
    private String slug(String value) { return value.toUpperCase().replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", ""); }

    public record HealthSummaryRequest(String period, LocalDate from, LocalDate to, Boolean forceRefresh) { }
    public record SummaryPeriodView(String preset, String label, LocalDate from, LocalDate to) { }
    public record SummaryEvidence(String evidenceId, String measurementCode, String measurementName, String healthAreaCode,
        String healthAreaTitle, String displayValue, String unit, String suppliedRange, String status, LocalDate clinicalDate,
        LocalDate displayDate, boolean dateReliable, boolean chronologyEligible, String dateBasis, UUID sourceReportId,
        String sourceReportName, String verificationStatus, String sourceType) { }
    public record BriefingTheme(String id, String title, String description, List<String> evidenceIds) { }
    public record BriefingChange(String id, String title, String description, String fromValue, String toValue, LocalDate fromDate,
        LocalDate toDate, String direction, boolean trendQualified, List<String> evidenceIds) { }
    public record BriefingItem(String id, String text, List<String> evidenceIds) { }
    public record BriefingLimitation(String title, String description) { }
    public record PersonalHealthSummaryView(SummaryPeriodView period, SummaryEvidenceSnapshot snapshot, String healthPicture,
        List<BriefingTheme> keyThemes, List<BriefingChange> changes, List<BriefingItem> stableContext,
        List<BriefingItem> followUpItems, List<BriefingItem> visitQuestions, List<BriefingLimitation> limitations,
        List<SummaryEvidence> evidence, NarrativeResult aiSummary, String disclaimer, Instant generatedAt) { }
}
