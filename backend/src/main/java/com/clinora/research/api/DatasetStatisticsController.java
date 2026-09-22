package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.DatasetStatisticsModels.*;
import com.clinora.research.service.DatasetStatisticsService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Phase R11 — Dataset Statistics API
 *
 * All statistics are computed from the immutable de-identified dataset payload.
 * No individual patient rows or personally identifiable information are ever returned.
 * Access requires project ownership or an active DatasetAccessGrant.
 */
@RestController
@RequestMapping("/api/v1/research/datasets/{datasetId}/versions/{versionNumber}/stats")
@PreAuthorize("hasAnyRole('RESEARCHER', 'ADMIN')")
public class DatasetStatisticsController {

    private final DatasetStatisticsService statisticsService;

    public DatasetStatisticsController(DatasetStatisticsService statisticsService) {
        this.statisticsService = statisticsService;
    }

    /**
     * GET /api/v1/research/datasets/{datasetId}/versions/{versionNumber}/stats
     * Full descriptive statistics summary for all variables in the dataset version.
     */
    @GetMapping
    public ApiResponse<DatasetStatsSummary> getSummary(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID datasetId,
            @PathVariable int versionNumber
    ) {
        DatasetStatsSummary summary = statisticsService.getSummary(datasetId, versionNumber, userId(jwt));
        return ApiResponse.success("Dataset statistics computed successfully.", summary);
    }

    /**
     * GET .../stats/{variableCode}/distribution
     * Frequency histogram bins for a single variable. Only real bins from actual data.
     */
    @GetMapping("/{variableCode}/distribution")
    public ApiResponse<List<FrequencyBin>> getDistribution(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID datasetId,
            @PathVariable int versionNumber,
            @PathVariable String variableCode
    ) {
        List<FrequencyBin> bins = statisticsService.getDistribution(datasetId, versionNumber, variableCode, userId(jwt));
        return ApiResponse.success("Distribution computed for " + variableCode + ".", bins);
    }

    /**
     * GET .../stats/{variableCode}/trend
     * Mean per real observation period (e.g. 2026-Q1). Sorted chronologically.
     * Never interpolated — only periods actually present in the data.
     */
    @GetMapping("/{variableCode}/trend")
    public ApiResponse<List<TrendPoint>> getTrend(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID datasetId,
            @PathVariable int versionNumber,
            @PathVariable String variableCode
    ) {
        List<TrendPoint> trend = statisticsService.getTrend(datasetId, versionNumber, variableCode, userId(jwt));
        return ApiResponse.success("Time trend computed for " + variableCode + ".", trend);
    }

    /**
     * GET .../stats/compare?variable={code}&groupBy={SEX|AGE_BAND}
     * Per-group descriptive comparison for a variable. Supports SEX or AGE_BAND grouping.
     */
    @GetMapping("/compare")
    public ApiResponse<List<GroupComparisonRow>> getGroupComparison(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID datasetId,
            @PathVariable int versionNumber,
            @RequestParam String variable,
            @RequestParam(defaultValue = "SEX") String groupBy
    ) {
        List<GroupComparisonRow> comparison = statisticsService.getGroupComparison(
                datasetId, versionNumber, variable, groupBy, userId(jwt));
        return ApiResponse.success(
                "Group comparison computed for " + variable + " grouped by " + groupBy + ".", comparison);
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
