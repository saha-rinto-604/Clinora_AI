package com.clinora.research.api;

import java.util.List;

/**
 * Immutable response models for the Dataset Statistics API (Phase R11).
 * All values are computed from the finalized, de-identified dataset payload.
 * No individual patient rows are ever exposed.
 */
public final class DatasetStatisticsModels {

    private DatasetStatisticsModels() {}

    /** Summary statistics for a single de-identified variable across all records in the version. */
    public record VariableSummary(
            String variableCode,
            String displayName,
            String unit,
            long count,
            long missingCount,
            double mean,
            double median,
            double min,
            double max,
            double stdDev,
            List<FrequencyBin> distribution
    ) {}

    /** A single histogram bin from real data. Never synthesized. */
    public record FrequencyBin(
            String label,
            double lowerBound,
            double upperBound,
            long count
    ) {}

    /** Aggregate observation for one real time period (e.g. 2026-Q1). */
    public record TrendPoint(
            String period,
            double mean,
            long count
    ) {}

    /** Per-group aggregate for group comparison analytics (by SEX or AGE_BAND). */
    public record GroupComparisonRow(
            String group,
            double mean,
            long count,
            double stdDev
    ) {}

    /** Top-level statistics summary for a dataset version. */
    public record DatasetStatsSummary(
            String datasetId,
            int versionNumber,
            long totalRecords,
            long uniqueSubjects,
            List<String> availablePeriods,
            List<VariableSummary> variables
    ) {}
}
