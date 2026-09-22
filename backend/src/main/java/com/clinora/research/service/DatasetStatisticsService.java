package com.clinora.research.service;

import com.clinora.research.api.DatasetStatisticsModels.*;
import com.clinora.research.domain.DatasetVersion;
import com.clinora.research.domain.ResearchDataset;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.DatasetVersionRepository;
import com.clinora.research.storage.ResearchDatasetStoragePort;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Phase R11 — DatasetStatisticsService
 *
 * Computes descriptive statistics, distribution histograms, time-period trends,
 * and group comparisons from the immutable de-identified dataset payload stored in MinIO.
 *
 * Operates entirely on the finalised dataset bytes — never re-queries the live clinical database.
 * Never exposes individual subject rows; all outputs are aggregate.
 */
@Service
public class DatasetStatisticsService {

    private static final Logger LOGGER = LoggerFactory.getLogger(DatasetStatisticsService.class);

    /** Number of bins for distribution histograms (Sturges-like default). */
    private static final int DEFAULT_BIN_COUNT = 10;

    private final DatasetVersionRepository versionRepository;
    private final ResearchDatasetStoragePort storagePort;
    private final DatasetGenerationService generationService;
    private final ObjectMapper objectMapper;

    public DatasetStatisticsService(
            DatasetVersionRepository versionRepository,
            ResearchDatasetStoragePort storagePort,
            DatasetGenerationService generationService,
            ObjectMapper objectMapper
    ) {
        this.versionRepository = versionRepository;
        this.storagePort = storagePort;
        this.generationService = generationService;
        this.objectMapper = objectMapper;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /** Full summary: all variables with descriptive stats. */
    public DatasetStatsSummary getSummary(UUID datasetId, int versionNumber, UUID requestingUserId) {
        List<ParsedRecord> records = loadRecords(datasetId, versionNumber, requestingUserId);

        long uniqueSubjects = records.stream()
                .map(ParsedRecord::subjectId)
                .distinct()
                .count();

        List<String> availablePeriods = records.stream()
                .map(ParsedRecord::observationPeriod)
                .filter(p -> p != null && !p.isBlank() && !"UNKNOWN".equals(p))
                .distinct()
                .sorted(Comparator.naturalOrder())
                .toList();

        // Group records by variableCode
        Map<String, List<ParsedRecord>> byVariable = records.stream()
                .filter(r -> r.variableCode() != null)
                .collect(Collectors.groupingBy(ParsedRecord::variableCode));

        List<VariableSummary> variables = byVariable.entrySet().stream()
                .map(e -> computeVariableSummary(e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(VariableSummary::variableCode))
                .toList();

        return new DatasetStatsSummary(
                datasetId.toString(),
                versionNumber,
                records.size(),
                uniqueSubjects,
                availablePeriods,
                variables
        );
    }

    /** Distribution histogram bins for one variable. */
    public List<FrequencyBin> getDistribution(UUID datasetId, int versionNumber, String variableCode, UUID requestingUserId) {
        List<ParsedRecord> records = loadRecords(datasetId, versionNumber, requestingUserId);
        List<Double> values = extractValues(records, variableCode);
        if (values.isEmpty()) return List.of();
        return computeHistogramBins(values, DEFAULT_BIN_COUNT);
    }

    /** Time trend: mean per observation period (only real periods, never interpolated). */
    public List<TrendPoint> getTrend(UUID datasetId, int versionNumber, String variableCode, UUID requestingUserId) {
        List<ParsedRecord> records = loadRecords(datasetId, versionNumber, requestingUserId);

        Map<String, List<Double>> byPeriod = records.stream()
                .filter(r -> variableCode.equalsIgnoreCase(r.variableCode()))
                .filter(r -> r.value() != null)
                .filter(r -> r.observationPeriod() != null && !"UNKNOWN".equals(r.observationPeriod()))
                .collect(Collectors.groupingBy(
                        ParsedRecord::observationPeriod,
                        Collectors.mapping(r -> r.value().doubleValue(), Collectors.toList())
                ));

        return byPeriod.entrySet().stream()
                .map(e -> {
                    List<Double> vals = e.getValue();
                    double mean = vals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
                    return new TrendPoint(e.getKey(), round2(mean), vals.size());
                })
                .sorted(Comparator.comparing(TrendPoint::period))
                .toList();
    }

    /** Group comparison: per-group (SEX or AGE_BAND) descriptive stats for one variable. */
    public List<GroupComparisonRow> getGroupComparison(
            UUID datasetId, int versionNumber,
            String variableCode, String groupBy,
            UUID requestingUserId
    ) {
        List<ParsedRecord> records = loadRecords(datasetId, versionNumber, requestingUserId);

        Map<String, List<Double>> byGroup = records.stream()
                .filter(r -> variableCode.equalsIgnoreCase(r.variableCode()))
                .filter(r -> r.value() != null)
                .collect(Collectors.groupingBy(
                        r -> resolveGroup(r, groupBy),
                        Collectors.mapping(r -> r.value().doubleValue(), Collectors.toList())
                ));

        return byGroup.entrySet().stream()
                .map(e -> {
                    List<Double> vals = e.getValue();
                    double mean = vals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
                    double stdDev = computeStdDev(vals, mean);
                    return new GroupComparisonRow(e.getKey(), round2(mean), vals.size(), round2(stdDev));
                })
                .sorted(Comparator.comparing(GroupComparisonRow::group))
                .toList();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal: Load & parse dataset payload from MinIO
    // ─────────────────────────────────────────────────────────────────────────

    private List<ParsedRecord> loadRecords(UUID datasetId, int versionNumber, UUID requestingUserId) {
        // Access check — reuse existing security gate
        ResearchDataset dataset = generationService.getDataset(datasetId, requestingUserId);

        DatasetVersion version = versionRepository.findByDatasetIdAndVersionNumber(datasetId, versionNumber)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND, ResearchErrorCode.DATASET_REQUEST_NOT_FOUND,
                        "Dataset version v" + versionNumber + " not found"));

        ResearchDatasetStoragePort.StoredDataset stored = storagePort.get(version.getStorageObjectKey());

        String format = version.getFormat();
        try {
            if ("JSON".equalsIgnoreCase(format)) {
                return parseJson(stored.bytes());
            } else {
                return parseCsv(stored.bytes());
            }
        } catch (Exception e) {
            LOGGER.error("Failed to parse dataset payload for version {}: {}", version.getId(), e.getMessage(), e);
            throw new ResearchApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    ResearchErrorCode.DATASET_REQUEST_NOT_FOUND, "Failed to parse dataset for statistics");
        }
    }

    private List<ParsedRecord> parseJson(byte[] bytes) throws Exception {
        List<Map<String, Object>> rows = objectMapper.readValue(bytes, new TypeReference<>() {});
        return rows.stream().map(row -> new ParsedRecord(
                str(row, "subjectId"),
                str(row, "ageBand"),
                str(row, "sex"),
                str(row, "observationPeriod"),
                str(row, "variableCode"),
                toBigDecimal(row.get("value")),
                str(row, "unit")
        )).toList();
    }

    private List<ParsedRecord> parseCsv(byte[] bytes) {
        String csv = new String(bytes, StandardCharsets.UTF_8);
        String[] lines = csv.split("\\r?\\n");
        if (lines.length < 2) return List.of();

        List<ParsedRecord> result = new ArrayList<>();
        // CSV header: subject_id,age_band,sex,observation_period,variable_code,value,unit,reference_range,flag
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isBlank()) continue;
            String[] cols = splitCsvLine(line);
            if (cols.length < 7) continue;
            BigDecimal value = null;
            try {
                String valStr = cols[5].trim();
                if (!valStr.isEmpty()) value = new BigDecimal(valStr);
            } catch (NumberFormatException ignored) {}

            result.add(new ParsedRecord(
                    cols[0].trim(), // subject_id
                    cols[1].trim(), // age_band
                    cols[2].trim(), // sex
                    cols[3].trim(), // observation_period
                    cols[4].trim(), // variable_code
                    value,
                    cols[6].trim()  // unit
            ));
        }
        return result;
    }

    /** Simple CSV field splitter (handles quoted fields). */
    private String[] splitCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                fields.add(sb.toString());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        fields.add(sb.toString());
        return fields.toArray(new String[0]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Statistics computations
    // ─────────────────────────────────────────────────────────────────────────

    private VariableSummary computeVariableSummary(String variableCode, List<ParsedRecord> records) {
        List<Double> values = records.stream()
                .filter(r -> r.value() != null)
                .map(r -> r.value().doubleValue())
                .toList();

        long total = records.size();
        long missingCount = total - values.size();
        String unit = records.stream()
                .filter(r -> r.unit() != null && !r.unit().isBlank())
                .map(ParsedRecord::unit)
                .findFirst().orElse(null);

        if (values.isEmpty()) {
            return new VariableSummary(variableCode, variableCode, unit, total, missingCount,
                    0, 0, 0, 0, 0, List.of());
        }

        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);

        double mean = sorted.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double median = computeMedian(sorted);
        double min = sorted.get(0);
        double max = sorted.get(sorted.size() - 1);
        double stdDev = computeStdDev(sorted, mean);
        List<FrequencyBin> distribution = computeHistogramBins(sorted, DEFAULT_BIN_COUNT);

        return new VariableSummary(variableCode, variableCode, unit,
                values.size(), missingCount,
                round2(mean), round2(median), round2(min), round2(max), round2(stdDev),
                distribution);
    }

    private List<Double> extractValues(List<ParsedRecord> records, String variableCode) {
        return records.stream()
                .filter(r -> variableCode.equalsIgnoreCase(r.variableCode()))
                .filter(r -> r.value() != null)
                .map(r -> r.value().doubleValue())
                .toList();
    }

    private double computeMedian(List<Double> sorted) {
        int n = sorted.size();
        if (n == 0) return 0;
        if (n % 2 == 1) return sorted.get(n / 2);
        return (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    private double computeStdDev(List<Double> values, double mean) {
        if (values.size() < 2) return 0;
        double variance = values.stream()
                .mapToDouble(v -> Math.pow(v - mean, 2))
                .sum() / (values.size() - 1); // Sample std dev
        return Math.sqrt(variance);
    }

    private List<FrequencyBin> computeHistogramBins(List<Double> sortedValues, int targetBins) {
        if (sortedValues.isEmpty()) return List.of();
        double min = sortedValues.get(0);
        double max = sortedValues.get(sortedValues.size() - 1);

        // All same value → single bin
        if (min == max) {
            return List.of(new FrequencyBin(String.valueOf(min), min, min, sortedValues.size()));
        }

        int bins = Math.min(targetBins, Math.max(1, (int) Math.ceil(1 + 3.322 * Math.log10(sortedValues.size()))));
        double binWidth = (max - min) / bins;
        List<FrequencyBin> result = new ArrayList<>();

        for (int i = 0; i < bins; i++) {
            double lo = min + i * binWidth;
            double hi = (i == bins - 1) ? max + 0.0001 : lo + binWidth;
            final int binIndex = i;
            long count = sortedValues.stream()
                    .filter(v -> v >= lo && v < (binIndex == bins - 1 ? hi : lo + binWidth))
                    .count();
            if (i == bins - 1) {
                count = sortedValues.stream().filter(v -> v >= lo && v <= max).count();
            }
            String label = String.format("%.1f–%.1f", lo, lo + binWidth);
            result.add(new FrequencyBin(label, round2(lo), round2(lo + binWidth), count));
        }
        return result;
    }

    private String resolveGroup(ParsedRecord r, String groupBy) {
        if ("AGE_BAND".equalsIgnoreCase(groupBy)) {
            return r.ageBand() != null && !r.ageBand().isBlank() ? r.ageBand() : "UNKNOWN";
        }
        // Default: SEX
        return r.sex() != null && !r.sex().isBlank() ? r.sex() : "UNKNOWN";
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private String str(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private BigDecimal toBigDecimal(Object val) {
        if (val == null) return null;
        try {
            return new BigDecimal(val.toString());
        } catch (Exception e) {
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal parsed record (not exposed in API)
    // ─────────────────────────────────────────────────────────────────────────

    private record ParsedRecord(
            String subjectId,
            String ageBand,
            String sex,
            String observationPeriod,
            String variableCode,
            BigDecimal value,
            String unit
    ) {}
}
