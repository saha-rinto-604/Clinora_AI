package com.clinora.patients.service;

import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.service.HealthRecordLabTaxonomy.Category;
import com.clinora.patients.service.HealthRecordLabTaxonomy.Concept;
import com.clinora.patients.service.HealthRecordLabTaxonomy.NormalizedNumeric;
import com.clinora.patients.service.LongitudinalHealthMath.NumericPoint;
import com.clinora.patients.service.LongitudinalHealthMath.Trend;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only projection over existing verified report observations and existing
 * body measurement snapshots. It deliberately does not persist a second copy of
 * clinical facts and never calls OCR, MedGemma or Gemini.
 */
@Service
public class PatientLongitudinalHealthRecordService {
    private static final int MAX_SOURCE_OBSERVATIONS = 5_000;
    private static final int MAX_GRAPH_POINTS = 80;
    private static final int MAX_HIGHLIGHTS = 6;
    private static final Set<String> VERIFIED_OBSERVATION_STATUSES = Set.of(
        "PATIENT_CONFIRMED",
        "PATIENT_CORRECTED",
        "DOCTOR_VERIFIED"
    );

    private final JdbcTemplate jdbc;

    public PatientLongitudinalHealthRecordService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public LongitudinalHealthRecordView record(UUID patientUserId) {
        return record(patientUserId, null, null);
    }

    @Transactional(readOnly = true)
    public LongitudinalHealthRecordView record(UUID patientUserId, LocalDate from, LocalDate to) {
        requireActivePatient(patientUserId);
        if (from != null && to != null && from.isAfter(to)) {
            throw new PatientApiException(
                HttpStatus.BAD_REQUEST,
                "HEALTH_RECORD_PERIOD_INVALID",
                "The Health Record start date must be on or before the end date."
            );
        }

        List<ObservationRow> sourceRows = verifiedObservations(patientUserId, from, to);
        Map<String, List<ObservationPoint>> byConcept = new LinkedHashMap<>();
        Map<String, Concept> concepts = new LinkedHashMap<>();

        for (ObservationRow row : sourceRows) {
            Concept concept = HealthRecordLabTaxonomy.resolve(row.effectiveLabel(), row.normalizedLabel());
            HealthRecordObservationEligibility.Decision eligibility = HealthRecordObservationEligibility.evaluate(
                new HealthRecordObservationEligibility.Candidate(
                    row.sourceLabel(),
                    row.normalizedLabel(),
                    row.effectiveLabel(),
                    row.valueType(),
                    row.numericValue(),
                    row.textValue(),
                    row.rawValue(),
                    row.referenceLow(),
                    row.referenceHigh(),
                    row.reviewRequired()
                ),
                concept
            );
            if (!eligibility.eligible()) continue;
            concepts.putIfAbsent(concept.code(), concept);
            byConcept.computeIfAbsent(concept.code(), ignored -> new ArrayList<>()).add(observationPoint(row, concept));
        }

        Map<Category, List<MeasurementView>> byCategory = new LinkedHashMap<>();
        List<MeasurementView> allMeasurements = new ArrayList<>();
        for (Map.Entry<String, List<ObservationPoint>> entry : byConcept.entrySet()) {
            Concept concept = concepts.get(entry.getKey());
            MeasurementView measurement = measurement(concept, entry.getValue());
            if (measurement == null) continue;
            allMeasurements.add(measurement);
            byCategory.computeIfAbsent(concept.category(), ignored -> new ArrayList<>()).add(measurement);
        }

        List<MeasurementView> body = bodyMeasurements(patientUserId, from, to);
        if (!body.isEmpty()) {
            allMeasurements.addAll(body);
            byCategory.computeIfAbsent(Category.BODY, ignored -> new ArrayList<>()).addAll(body);
        }

        List<HealthAreaView> areas = byCategory.entrySet().stream()
            .filter(entry -> !entry.getValue().isEmpty())
            .sorted(Map.Entry.comparingByKey(Comparator.comparingInt(Category::order)))
            .map(entry -> new HealthAreaView(
                entry.getKey().name(),
                entry.getKey().displayName(),
                entry.getValue().stream().sorted(measurementOrder()).toList()
            ))
            .toList();

        Map<UUID, SourceReportView> sourceReportMap = new LinkedHashMap<>();
        for (ObservationRow row : sourceRows) {
            if (!byConcept.values().stream().flatMap(List::stream).anyMatch(point -> row.reportId().equals(point.reportId()))) continue;
            sourceReportMap.putIfAbsent(row.reportId(), new SourceReportView(
                row.reportId(),
                row.reportName(),
                row.reportType(),
                row.clinicalDate(),
                row.displayDate(),
                row.dateBasis(),
                row.providerLaboratory()
            ));
        }
        List<SourceReportView> sourceReports = sourceReportMap.values().stream()
            .sorted(Comparator.comparing(SourceReportView::displayDate, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(SourceReportView::reportName))
            .toList();

        DateCounts dateCounts = reportDateCounts(patientUserId);
        List<LocalDate> reliableDates = new ArrayList<>();
        sourceRows.stream().map(ObservationRow::clinicalDate).filter(date -> date != null).forEach(reliableDates::add);
        body.stream().flatMap(measurement -> measurement.graph().points().stream()).map(GraphPoint::date).forEach(reliableDates::add);
        LocalDate coverageFrom = reliableDates.stream().min(LocalDate::compareTo).orElse(null);
        LocalDate coverageTo = reliableDates.stream().max(LocalDate::compareTo).orElse(null);

        Instant labUpdated = sourceRows.stream().map(ObservationRow::updatedAt).max(Instant::compareTo).orElse(null);
        Instant bodyUpdated = bodyLastUpdated(patientUserId);
        Instant lastUpdatedAt = latestInstant(labUpdated, bodyUpdated);

        HealthRecordSnapshot snapshot = new HealthRecordSnapshot(
            sourceReports.size(),
            dateCounts.reliablyDated(),
            dateCounts.dateUncertain(),
            allMeasurements.size(),
            areas.size(),
            coverageFrom,
            coverageTo
        );
        return new LongitudinalHealthRecordView(snapshot, areas, highlights(allMeasurements), sourceReports, lastUpdatedAt);
    }

    /**
     * Summary-only projection of current verified evidence. Reliably dated
     * observations respect the selected period; verified observations without a
     * clinical date remain eligible as current facts, but are explicitly marked
     * as ineligible for chronology. This uses the same source query,
     * canonicalization, validation and per-report deduplication as Health Record.
     */
    @Transactional(readOnly = true)
    public SummaryEvidenceView summaryEvidence(UUID patientUserId, LocalDate from, LocalDate to) {
        requireActivePatient(patientUserId);
        if (from != null && to != null && from.isAfter(to)) {
            throw new PatientApiException(
                HttpStatus.BAD_REQUEST,
                "HEALTH_RECORD_PERIOD_INVALID",
                "The Health Record start date must be on or before the end date."
            );
        }

        List<ObservationRow> rows = verifiedObservations(patientUserId, null, null);
        Map<String, EvidenceCandidate> bestByConceptAndReport = new LinkedHashMap<>();
        int excludedByValidation = 0;
        for (ObservationRow row : rows) {
            if (!summaryDateEligible(row.clinicalDate(), from, to)) continue;
            Concept concept = HealthRecordLabTaxonomy.resolve(row.effectiveLabel(), row.normalizedLabel());
            HealthRecordObservationEligibility.Decision eligibility = HealthRecordObservationEligibility.evaluate(
                new HealthRecordObservationEligibility.Candidate(
                    row.sourceLabel(), row.normalizedLabel(), row.effectiveLabel(), row.valueType(), row.numericValue(),
                    row.textValue(), row.rawValue(), row.referenceLow(), row.referenceHigh(), row.reviewRequired()
                ),
                concept
            );
            if (!eligibility.eligible()) {
                excludedByValidation++;
                continue;
            }
            ObservationPoint point = observationPoint(row, concept);
            String key = concept.code() + "|" + row.reportId();
            EvidenceCandidate current = bestByConceptAndReport.get(key);
            if (current == null || pointQuality(point) >= pointQuality(current.point())) {
                bestByConceptAndReport.put(key, new EvidenceCandidate(concept, point));
            }
        }

        List<EvidenceCandidate> candidates = bestByConceptAndReport.values().stream()
            .sorted(Comparator
                .comparingInt((EvidenceCandidate item) -> item.concept().category().order())
                .thenComparing(item -> item.concept().displayName(), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(item -> item.point().dateReliable() ? 0 : 1)
                .thenComparing(item -> item.point().displayDate(), Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();

        List<SummaryEvidenceFact> facts = new ArrayList<>();
        int sequence = 1;
        for (EvidenceCandidate candidate : candidates) {
            facts.add(summaryFact("E" + sequence++, candidate.concept(), candidate.point()));
        }

        // Body & Vitals are reliable profile facts and remain period-scoped. They
        // are projected from the same snapshot source used by Health Record.
        List<MeasurementView> body = bodyMeasurements(patientUserId, from, to);
        for (MeasurementView measurement : body) {
            facts.add(summaryFact("E" + sequence++, measurement));
        }

        Set<UUID> reportIds = facts.stream().map(SummaryEvidenceFact::sourceReportId).filter(Objects::nonNull)
            .collect(java.util.stream.Collectors.toSet());
        Set<UUID> reliableReportIds = facts.stream().filter(SummaryEvidenceFact::dateReliable)
            .map(SummaryEvidenceFact::sourceReportId).filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());
        Set<UUID> uncertainReportIds = facts.stream().filter(fact -> !fact.dateReliable())
            .map(SummaryEvidenceFact::sourceReportId).filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());
        Set<String> measurementCodes = facts.stream().map(SummaryEvidenceFact::measurementCode)
            .collect(java.util.stream.Collectors.toSet());
        Set<String> areaCodes = facts.stream().map(SummaryEvidenceFact::healthAreaCode)
            .collect(java.util.stream.Collectors.toSet());

        LongitudinalHealthRecordView longitudinal = record(patientUserId, from, to);
        int comparable = (int) longitudinal.areas().stream().flatMap(area -> area.measurements().stream())
            .filter(measurement -> measurement.trend().comparableDataPoints() >= 2).count();
        int incompatible = (int) longitudinal.areas().stream().flatMap(area -> area.measurements().stream())
            .filter(measurement -> measurement.historyCount() >= 2 && measurement.trend().comparableDataPoints() < 2)
            .count();

        Map<UUID, SourceReportView> reports = new LinkedHashMap<>();
        for (ObservationRow row : rows) {
            if (!reportIds.contains(row.reportId())) continue;
            reports.putIfAbsent(row.reportId(), new SourceReportView(
                row.reportId(), row.reportName(), row.reportType(), row.clinicalDate(), row.displayDate(),
                row.dateBasis(), row.providerLaboratory()
            ));
        }

        SummaryEvidenceSnapshot snapshot = new SummaryEvidenceSnapshot(
            reportIds.size(), reliableReportIds.size(), uncertainReportIds.size(), measurementCodes.size(), areaCodes.size(),
            comparable, excludedByValidation, incompatible, longitudinal.snapshot().coverageFrom(), longitudinal.snapshot().coverageTo()
        );
        return new SummaryEvidenceView(
            snapshot,
            List.copyOf(facts),
            reports.values().stream().sorted(Comparator
                .comparing(SourceReportView::clinicalDate, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(SourceReportView::reportName)).toList(),
            longitudinal
        );
    }

    static boolean summaryDateEligible(LocalDate clinicalDate, LocalDate from, LocalDate to) {
        if (clinicalDate == null) return true;
        return (from == null || !clinicalDate.isBefore(from)) && (to == null || !clinicalDate.isAfter(to));
    }

    private SummaryEvidenceFact summaryFact(String evidenceId, Concept concept, ObservationPoint point) {
        return new SummaryEvidenceFact(
            evidenceId, concept.code(), concept.displayName(), concept.category().name(), concept.category().displayName(),
            point.numericValue(), point.textValue(), point.comparator(), point.unit(), point.referenceRangeRaw(),
            point.referenceLow(), point.referenceHigh(), point.status(), point.date(), point.displayDate(), point.dateReliable(),
            point.dateReliable(), point.dateBasis(), point.reportId(), point.reportName(), point.verificationStatus(), point.sourceType()
        );
    }

    private SummaryEvidenceFact summaryFact(String evidenceId, MeasurementView measurement) {
        ObservationPoint point = measurement.latest();
        return new SummaryEvidenceFact(
            evidenceId, measurement.code(), measurement.name(), Category.BODY.name(), Category.BODY.displayName(),
            point.numericValue(), point.textValue(), point.comparator(), point.unit(), point.referenceRangeRaw(),
            point.referenceLow(), point.referenceHigh(), point.status(), point.date(), point.displayDate(), true,
            true, point.dateBasis(), null, point.reportName(), point.verificationStatus(), point.sourceType()
        );
    }

    private List<ObservationRow> verifiedObservations(UUID patientUserId, LocalDate from, LocalDate to) {
        StringBuilder sql = new StringBuilder(
            """
            WITH latest_verified AS (
                SELECT er.report_id,
                       er.id AS extraction_result_id,
                       ROW_NUMBER() OVER (
                           PARTITION BY er.report_id
                           ORDER BY er.created_at DESC, er.id DESC
                       ) AS row_rank
                  FROM medical_report_extraction_results er
                  JOIN medical_report_extraction_jobs ej ON ej.id = er.job_id
                  JOIN patient_medical_reports pmr ON pmr.id = er.report_id
                 WHERE ej.patient_user_id = ?
                   AND ej.status = 'SUCCEEDED'
                   AND er.review_status = 'VERIFIED'
                   AND pmr.patient_user_id = ?
                   AND pmr.subject_type = 'SELF'
                   AND pmr.archived_at IS NULL
            )
            SELECT pmr.id AS report_id,
                   pmr.report_name,
                   pmr.report_type,
                   pmr.report_date AS clinical_date,
                   CAST(pmr.created_at AS date) AS upload_date,
                   COALESCE(pmr.report_date, CAST(pmr.created_at AS date)) AS display_date,
                   pmr.provider_laboratory,
                   pmr.created_at AS uploaded_at,
                   CASE WHEN pmr.report_date IS NULL THEN 'UPLOAD_FALLBACK' ELSE 'REPORT_DATE' END AS date_basis,
                   o.id AS observation_id,
                   o.source_label,
                   o.normalized_label,
                   o.effective_label,
                   o.effective_value_type,
                   o.effective_numeric_value,
                   o.effective_text_value,
                   o.ocr_raw_value,
                   o.effective_comparator,
                   o.effective_unit,
                   o.reference_range_raw,
                   o.reference_low,
                   o.reference_high,
                   o.source_flag,
                   o.derived_range_flag,
                   o.review_required,
                   o.verification_status,
                   GREATEST(o.updated_at, pmr.updated_at) AS updated_at
              FROM latest_verified lv
              JOIN patient_medical_reports pmr ON pmr.id = lv.report_id
              JOIN medical_report_observations o ON o.extraction_result_id = lv.extraction_result_id
             WHERE lv.row_rank = 1
               AND o.verification_status IN ('PATIENT_CONFIRMED', 'PATIENT_CORRECTED', 'DOCTOR_VERIFIED')
            """
        );
        List<Object> parameters = new ArrayList<>();
        parameters.add(patientUserId);
        parameters.add(patientUserId);
        // Period summaries use reliable report dates only. Upload dates are never
        // treated as clinical chronology.
        if (from != null) {
            sql.append(" AND pmr.report_date IS NOT NULL AND pmr.report_date >= ?");
            parameters.add(from);
        }
        if (to != null) {
            sql.append(" AND pmr.report_date IS NOT NULL AND pmr.report_date <= ?");
            parameters.add(to);
        }
        sql.append(
            """
             ORDER BY pmr.report_date DESC NULLS LAST, pmr.created_at DESC, pmr.id DESC,
                      o.page_number ASC, o.updated_at ASC, o.id ASC
             LIMIT ?
            """
        );
        parameters.add(MAX_SOURCE_OBSERVATIONS);
        return jdbc.query(sql.toString(), this::observationRow, parameters.toArray());
    }

    private ObservationRow observationRow(ResultSet rs, int rowNum) throws SQLException {
        return new ObservationRow(
            rs.getObject("report_id", UUID.class),
            rs.getString("report_name"),
            rs.getString("report_type"),
            rs.getObject("clinical_date", LocalDate.class),
            rs.getObject("display_date", LocalDate.class),
            rs.getString("provider_laboratory"),
            rs.getTimestamp("uploaded_at").toInstant(),
            rs.getString("date_basis"),
            rs.getObject("observation_id", UUID.class),
            rs.getString("source_label"),
            rs.getString("normalized_label"),
            rs.getString("effective_label"),
            rs.getString("effective_value_type"),
            rs.getBigDecimal("effective_numeric_value"),
            rs.getString("effective_text_value"),
            rs.getString("ocr_raw_value"),
            rs.getString("effective_comparator"),
            rs.getString("effective_unit"),
            rs.getString("reference_range_raw"),
            rs.getBigDecimal("reference_low"),
            rs.getBigDecimal("reference_high"),
            rs.getString("source_flag"),
            rs.getString("derived_range_flag"),
            rs.getBoolean("review_required"),
            rs.getString("verification_status"),
            rs.getTimestamp("updated_at").toInstant()
        );
    }

    private ObservationPoint observationPoint(ObservationRow row, Concept concept) {
        NormalizedNumeric normalized = null;
        if ("NUMERIC".equals(row.valueType()) && row.numericValue() != null) {
            normalized = HealthRecordLabTaxonomy.normalizeNumeric(concept, row.numericValue(), row.unit());
        }
        return new ObservationPoint(
            row.observationId(),
            "MEDICAL_REPORT",
            row.observationId(),
            row.reportId(),
            row.reportName(),
            row.reportType(),
            row.providerLaboratory(),
            row.clinicalDate(),
            row.displayDate(),
            "REPORT_DATE".equals(row.dateBasis()),
            row.dateBasis(),
            row.sourceLabel(),
            row.valueType(),
            row.numericValue(),
            row.textValue(),
            row.comparator(),
            row.unit(),
            normalized == null ? null : normalized.value(),
            normalized == null ? null : normalized.unit(),
            normalized == null ? null : normalized.comparisonKey(),
            row.referenceRangeRaw(),
            row.referenceLow(),
            row.referenceHigh(),
            rangeStatus(row),
            row.verificationStatus(),
            normalized != null && normalized.converted(),
            row.updatedAt()
        );
    }

    private MeasurementView measurement(Concept concept, List<ObservationPoint> rawPoints) {
        List<ObservationPoint> ordered = rawPoints.stream()
            .filter(point -> VERIFIED_OBSERVATION_STATUSES.contains(point.verificationStatus()))
            .sorted(pointOrder())
            .toList();
        if (ordered.isEmpty()) return null;

        Map<UUID, ObservationPoint> bestByReport = new LinkedHashMap<>();
        for (ObservationPoint point : ordered) {
            ObservationPoint current = bestByReport.get(point.reportId());
            if (current == null || pointQuality(point) >= pointQuality(current)) bestByReport.put(point.reportId(), point);
        }
        List<ObservationPoint> points = bestByReport.values().stream().sorted(pointOrder()).toList();
        ObservationPoint latest = latestPoint(points);
        List<ObservationPoint> comparable = comparableNumericPoints(points, latest);
        return measurementFromPoints(concept.code(), concept.displayName(), concept.category(), latest, points, comparable);
    }

    private MeasurementView measurementFromPoints(
        String code,
        String name,
        Category category,
        ObservationPoint latest,
        List<ObservationPoint> history,
        List<ObservationPoint> comparable
    ) {
        Trend trend = LongitudinalHealthMath.trend(
            comparable.stream().map(point -> new NumericPoint(point.normalizedValue(), point.comparisonKey())).toList()
        );
        List<GraphPoint> graphPoints = comparable.stream()
            .skip(Math.max(0, comparable.size() - MAX_GRAPH_POINTS))
            .map(point -> new GraphPoint(
                point.date(),
                point.normalizedValue(),
                point.normalizedUnit(),
                point.sourceType(),
                point.sourceId(),
                point.reportId(),
                point.reportName(),
                point.status(),
                point.referenceRangeRaw()
            ))
            .toList();
        long reliableNumeric = history.stream().filter(point -> point.dateReliable() && point.numericValue() != null).count();
        String graphReason = graphPoints.size() >= 2
            ? null
            : reliableNumeric >= 2
                ? "Measurements use units that cannot be compared safely."
                : history.stream().anyMatch(point -> !point.dateReliable())
                    ? "A reliable report date is needed before Clinora can compare these results over time."
                    : "Not enough comparable history yet.";
        GraphView graph = new GraphView(
            graphPoints.size() >= 2,
            graphPoints.size() >= 3,
            comparable.stream().anyMatch(ObservationPoint::unitConvertedForTrend),
            graphReason,
            graphPoints
        );
        TrendView trendView = new TrendView(
            trend.direction().name(),
            trend.absoluteChange(),
            trend.percentageChange(),
            trend.comparableDataPoints(),
            trend.trendQualified(),
            graphPoints.isEmpty() ? null : graphPoints.getLast().unit()
        );
        return new MeasurementView(code, name, category.name(), latest, trendView, graph, history.size());
    }

    private List<MeasurementView> bodyMeasurements(UUID patientUserId, LocalDate from, LocalDate to) {
        StringBuilder sql = new StringBuilder(
            """
            SELECT id, height_cm, weight_kg, recorded_at, source_type
              FROM patient_body_measurement_snapshots
             WHERE patient_user_id = ?
            """
        );
        List<Object> args = new ArrayList<>();
        args.add(patientUserId);
        if (from != null) {
            sql.append(" AND recorded_at >= ?");
            args.add(Timestamp.from(from.atStartOfDay(ZoneOffset.UTC).toInstant()));
        }
        if (to != null) {
            sql.append(" AND recorded_at < ?");
            args.add(Timestamp.from(to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()));
        }
        sql.append(" ORDER BY recorded_at ASC, id ASC LIMIT 500");
        List<BodyRow> rows = jdbc.query(sql.toString(), (rs, rowNum) -> new BodyRow(
            rs.getObject("id", UUID.class),
            rs.getBigDecimal("height_cm"),
            rs.getBigDecimal("weight_kg"),
            rs.getTimestamp("recorded_at").toInstant()
        ), args.toArray());
        if (rows.isEmpty()) return List.of();

        List<MeasurementView> result = new ArrayList<>();
        addBodyMeasurement(result, "WEIGHT", "Weight", "kg", rows, BodyRow::weightKg);
        addBodyMeasurement(result, "HEIGHT", "Height", "cm", rows, BodyRow::heightCm);
        List<ObservationPoint> bmi = new ArrayList<>();
        for (BodyRow row : rows) {
            BigDecimal value = PatientBodyMeasurementService.bmi(row.heightCm(), row.weightKg());
            if (value != null) bmi.add(bodyPoint(row, value, "BMI", "BMI"));
        }
        if (!bmi.isEmpty()) result.add(bodyMeasurement("BMI", "BMI", bmi));
        return List.copyOf(result);
    }

    private void addBodyMeasurement(
        List<MeasurementView> target,
        String code,
        String name,
        String unit,
        List<BodyRow> rows,
        java.util.function.Function<BodyRow, BigDecimal> extractor
    ) {
        List<ObservationPoint> points = rows.stream()
            .filter(row -> extractor.apply(row) != null)
            .map(row -> bodyPoint(row, extractor.apply(row), unit, unit))
            .toList();
        if (!points.isEmpty()) target.add(bodyMeasurement(code, name, points));
    }

    private MeasurementView bodyMeasurement(String code, String name, List<ObservationPoint> points) {
        ObservationPoint latest = points.getLast();
        return measurementFromPoints(code, name, Category.BODY, latest, points, points);
    }

    private ObservationPoint bodyPoint(BodyRow row, BigDecimal value, String unit, String comparisonKey) {
        LocalDate date = row.recordedAt().atZone(ZoneOffset.UTC).toLocalDate();
        return new ObservationPoint(
            row.id(),
            "PATIENT_PROFILE",
            row.id(),
            null,
            "Health Profile",
            "BODY_MEASUREMENT",
            null,
            date,
            date,
            true,
            "PROFILE_RECORDED_AT",
            null,
            "NUMERIC",
            value,
            null,
            null,
            unit,
            value,
            unit,
            comparisonKey,
            null,
            null,
            null,
            "REPORTED",
            "PROFILE_RECORDED",
            false,
            row.recordedAt()
        );
    }

    private List<ObservationPoint> comparableNumericPoints(List<ObservationPoint> points, ObservationPoint latest) {
        if (latest.normalizedValue() == null || latest.comparisonKey() == null) return List.of();
        String key = latest.comparisonKey();
        return points.stream()
            .filter(ObservationPoint::dateReliable)
            .filter(point -> point.date() != null)
            .filter(point -> point.normalizedValue() != null && key.equals(point.comparisonKey()))
            .sorted(Comparator.comparing(ObservationPoint::date).thenComparing(ObservationPoint::updatedAt))
            .toList();
    }

    private ObservationPoint latestPoint(List<ObservationPoint> points) {
        return points.stream()
            .filter(ObservationPoint::dateReliable)
            .filter(point -> point.date() != null)
            .max(Comparator.comparing(ObservationPoint::date).thenComparing(ObservationPoint::updatedAt))
            .orElseGet(() -> points.stream().max(Comparator.comparing(ObservationPoint::displayDate).thenComparing(ObservationPoint::updatedAt)).orElseThrow());
    }

    private Comparator<ObservationPoint> pointOrder() {
        return Comparator.comparing(ObservationPoint::displayDate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(ObservationPoint::updatedAt)
            .thenComparing(ObservationPoint::observationId);
    }

    private int pointQuality(ObservationPoint point) {
        int score = switch (point.verificationStatus()) {
            case "DOCTOR_VERIFIED" -> 40;
            case "PATIENT_CORRECTED" -> 30;
            case "PATIENT_CONFIRMED" -> 20;
            default -> 0;
        };
        if (point.numericValue() != null) score += 5;
        if (point.referenceLow() != null || point.referenceHigh() != null || point.referenceRangeRaw() != null) score += 2;
        return score;
    }

    private List<HealthRecordHighlight> highlights(List<MeasurementView> measurements) {
        List<HealthRecordHighlight> priority = new ArrayList<>();
        List<HealthRecordHighlight> trends = new ArrayList<>();
        for (MeasurementView measurement : measurements) {
            ObservationPoint latest = measurement.latest();
            List<GraphPoint> graph = measurement.graph().points();
            String previousStatus = graph.size() >= 2 ? graph.get(graph.size() - 2).status() : null;
            boolean latestAbnormal = abnormal(latest.status());
            boolean previousAbnormal = abnormal(previousStatus);
            if (latestAbnormal) {
                String type = previousStatus != null && !previousAbnormal ? "NEW_OUT_OF_RANGE" : "OUT_OF_RANGE";
                priority.add(new HealthRecordHighlight(
                    type,
                    measurement.code(),
                    measurement.name(),
                    latest.status(),
                    previousStatus == null
                        ? "Latest verified result is outside its supplied range."
                        : latestAbnormal && previousAbnormal
                            ? "Latest verified result remains outside its supplied range."
                            : "Latest verified result is outside its supplied range."
                ));
                continue;
            }
            if ("IN_RANGE".equals(latest.status()) && previousAbnormal) {
                priority.add(new HealthRecordHighlight(
                    "RETURNED_TO_RANGE",
                    measurement.code(),
                    measurement.name(),
                    latest.status(),
                    "Latest verified result returned to its supplied range."
                ));
                continue;
            }
            if (measurement.trend().trendQualified()
                && ("INCREASING".equals(measurement.trend().direction()) || "DECREASING".equals(measurement.trend().direction()))) {
                trends.add(new HealthRecordHighlight(
                    "TREND",
                    measurement.code(),
                    measurement.name(),
                    latest.status(),
                    "Verified values are " + measurement.trend().direction().toLowerCase().replace('_', ' ') + " across reliable dated history."
                ));
            }
        }
        List<HealthRecordHighlight> result = new ArrayList<>(MAX_HIGHLIGHTS);
        priority.stream().limit(MAX_HIGHLIGHTS).forEach(result::add);
        if (result.size() < MAX_HIGHLIGHTS) trends.stream().limit(MAX_HIGHLIGHTS - result.size()).forEach(result::add);
        return List.copyOf(result);
    }

    private Comparator<MeasurementView> measurementOrder() {
        return Comparator
            .comparing((MeasurementView measurement) -> abnormal(measurement.latest().status()) ? 0 : 1)
            .thenComparing((MeasurementView measurement) -> measurement.graph().available() ? 0 : 1)
            .thenComparing(MeasurementView::name, String.CASE_INSENSITIVE_ORDER);
    }

    private String rangeStatus(ObservationRow row) {
        if (!HealthRecordObservationEligibility.validReferenceBounds(row.referenceLow(), row.referenceHigh())) return "REPORTED";
        if (row.numericValue() != null) {
            if (row.referenceLow() != null && row.numericValue().compareTo(row.referenceLow()) < 0) return "LOW";
            if (row.referenceHigh() != null && row.numericValue().compareTo(row.referenceHigh()) > 0) return "HIGH";
            if (row.referenceLow() != null || row.referenceHigh() != null) return "IN_RANGE";
        }
        String flag = firstNonBlank(row.derivedRangeFlag(), row.sourceFlag());
        if (flag != null) {
            String upper = flag.toUpperCase();
            if (upper.contains("ABOVE") || upper.matches(".*\\bHIGH\\b.*") || upper.equals("H")) return "HIGH";
            if (upper.contains("BELOW") || upper.matches(".*\\bLOW\\b.*") || upper.equals("L")) return "LOW";
            if (upper.contains("WITHIN") || upper.contains("NORMAL") || upper.contains("IN_RANGE")) return "IN_RANGE";
        }
        return "REPORTED";
    }

    private DateCounts reportDateCounts(UUID patientUserId) {
        return jdbc.query(
            """
            WITH latest_verified AS (
                SELECT er.report_id,
                       ROW_NUMBER() OVER (PARTITION BY er.report_id ORDER BY er.created_at DESC, er.id DESC) row_rank
                  FROM medical_report_extraction_results er
                  JOIN medical_report_extraction_jobs ej ON ej.id = er.job_id
                 WHERE ej.patient_user_id = ? AND ej.status = 'SUCCEEDED' AND er.review_status = 'VERIFIED'
            )
            SELECT COUNT(*) FILTER (WHERE pmr.report_date IS NOT NULL) AS reliable,
                   COUNT(*) FILTER (WHERE pmr.report_date IS NULL) AS uncertain
              FROM latest_verified lv
              JOIN patient_medical_reports pmr ON pmr.id = lv.report_id
             WHERE lv.row_rank = 1
               AND pmr.patient_user_id = ?
               AND pmr.subject_type = 'SELF'
               AND pmr.archived_at IS NULL
            """,
            (rs, rowNum) -> new DateCounts(rs.getInt("reliable"), rs.getInt("uncertain")),
            patientUserId,
            patientUserId
        ).stream().findFirst().orElse(new DateCounts(0, 0));
    }

    private Instant bodyLastUpdated(UUID patientUserId) {
        return jdbc.query(
            "SELECT MAX(recorded_at) AS recorded_at FROM patient_body_measurement_snapshots WHERE patient_user_id = ?",
            (rs, rowNum) -> {
                Timestamp value = rs.getTimestamp("recorded_at");
                return value == null ? null : value.toInstant();
            },
            patientUserId
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private Instant latestInstant(Instant first, Instant second) {
        if (first == null) return second;
        if (second == null) return first;
        return first.isAfter(second) ? first : second;
    }

    private boolean abnormal(String status) {
        return "LOW".equals(status) || "HIGH".equals(status);
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) return first;
        if (second != null && !second.isBlank()) return second;
        return null;
    }

    private void requireActivePatient(UUID patientUserId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'PATIENT' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            patientUserId
        );
        if (count == null || count != 1) {
            throw new PatientApiException(
                HttpStatus.FORBIDDEN,
                "ACTIVE_PATIENT_REQUIRED",
                "An active Patient account is required."
            );
        }
    }

    private record ObservationRow(
        UUID reportId,
        String reportName,
        String reportType,
        LocalDate clinicalDate,
        LocalDate displayDate,
        String providerLaboratory,
        Instant uploadedAt,
        String dateBasis,
        UUID observationId,
        String sourceLabel,
        String normalizedLabel,
        String effectiveLabel,
        String valueType,
        BigDecimal numericValue,
        String textValue,
        String rawValue,
        String comparator,
        String unit,
        String referenceRangeRaw,
        BigDecimal referenceLow,
        BigDecimal referenceHigh,
        String sourceFlag,
        String derivedRangeFlag,
        boolean reviewRequired,
        String verificationStatus,
        Instant updatedAt
    ) {
    }

    private record BodyRow(UUID id, BigDecimal heightCm, BigDecimal weightKg, Instant recordedAt) {
    }

    private record DateCounts(int reliablyDated, int dateUncertain) {
    }

    private record EvidenceCandidate(Concept concept, ObservationPoint point) {
    }

    public record SummaryEvidenceView(
        SummaryEvidenceSnapshot snapshot,
        List<SummaryEvidenceFact> facts,
        List<SourceReportView> sourceReports,
        LongitudinalHealthRecordView longitudinal
    ) {
    }

    public record SummaryEvidenceSnapshot(
        int verifiedReportsAvailable,
        int reliablyDatedReports,
        int dateUncertainVerifiedReports,
        int trackedVerifiedMeasurements,
        int healthAreasRepresented,
        int measurementsWithComparableHistory,
        int observationsExcludedByValidation,
        int measurementsWithIncompatibleHistory,
        LocalDate coverageFrom,
        LocalDate coverageTo
    ) {
    }

    public record SummaryEvidenceFact(
        String evidenceId,
        String measurementCode,
        String measurementName,
        String healthAreaCode,
        String healthAreaTitle,
        BigDecimal numericValue,
        String textValue,
        String comparator,
        String unit,
        String referenceRangeRaw,
        BigDecimal referenceLow,
        BigDecimal referenceHigh,
        String status,
        LocalDate clinicalDate,
        LocalDate displayDate,
        boolean dateReliable,
        boolean chronologyEligible,
        String dateBasis,
        UUID sourceReportId,
        String sourceReportName,
        String verificationStatus,
        String sourceType
    ) {
    }

    public record LongitudinalHealthRecordView(
        HealthRecordSnapshot snapshot,
        List<HealthAreaView> areas,
        List<HealthRecordHighlight> highlights,
        List<SourceReportView> sourceReports,
        Instant lastUpdatedAt
    ) {
        static LongitudinalHealthRecordView empty() {
            return new LongitudinalHealthRecordView(
                new HealthRecordSnapshot(0, 0, 0, 0, 0, null, null),
                List.of(),
                List.of(),
                List.of(),
                null
            );
        }
    }

    public record HealthRecordSnapshot(
        int reportsIncluded,
        int reliablyDatedReports,
        int dateUncertainReports,
        int trackedMeasurements,
        int healthAreas,
        LocalDate coverageFrom,
        LocalDate coverageTo
    ) {
    }

    public record HealthAreaView(String code, String title, List<MeasurementView> measurements) {
    }

    public record MeasurementView(
        String code,
        String name,
        String category,
        ObservationPoint latest,
        TrendView trend,
        GraphView graph,
        int historyCount
    ) {
    }

    public record ObservationPoint(
        UUID observationId,
        String sourceType,
        UUID sourceId,
        UUID reportId,
        String reportName,
        String reportType,
        String providerLaboratory,
        LocalDate date,
        LocalDate displayDate,
        boolean dateReliable,
        String dateBasis,
        String sourceLabel,
        String valueType,
        BigDecimal numericValue,
        String textValue,
        String comparator,
        String unit,
        BigDecimal normalizedValue,
        String normalizedUnit,
        String comparisonKey,
        String referenceRangeRaw,
        BigDecimal referenceLow,
        BigDecimal referenceHigh,
        String status,
        String verificationStatus,
        boolean unitConvertedForTrend,
        Instant updatedAt
    ) {
    }

    public record TrendView(
        String direction,
        BigDecimal absoluteChange,
        BigDecimal percentageChange,
        int comparableDataPoints,
        boolean trendQualified,
        String chartUnit
    ) {
    }

    public record GraphView(
        boolean available,
        boolean fullGraphAvailable,
        boolean normalizedUnits,
        String reason,
        List<GraphPoint> points
    ) {
    }

    public record GraphPoint(
        LocalDate date,
        BigDecimal value,
        String unit,
        String sourceType,
        UUID sourceId,
        UUID reportId,
        String reportName,
        String status,
        String referenceRangeRaw
    ) {
    }

    public record SourceReportView(
        UUID reportId,
        String reportName,
        String reportType,
        LocalDate clinicalDate,
        LocalDate displayDate,
        String dateBasis,
        String providerLaboratory
    ) {
    }

    public record HealthRecordHighlight(
        String type,
        String measurementCode,
        String title,
        String status,
        String detail
    ) {
    }
}
