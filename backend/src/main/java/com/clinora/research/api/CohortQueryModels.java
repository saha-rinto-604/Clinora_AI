package com.clinora.research.api;

import com.clinora.research.domain.catalog.ResearchCatalogVariable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class CohortQueryModels {

    private CohortQueryModels() {}

    public record CatalogVariableDto(
            String code,
            String displayName,
            String category,
            String dataType,
            String preferredUnit,
            String description,
            List<String> supportedOperators
    ) {
        public static CatalogVariableDto from(ResearchCatalogVariable var) {
            return new CatalogVariableDto(
                    var.code(),
                    var.displayName(),
                    var.category(),
                    var.dataType(),
                    var.preferredUnit(),
                    var.description(),
                    var.supportedOperators()
            );
        }
    }

    public record CatalogCategoryDto(
            String category,
            List<CatalogVariableDto> variables
    ) {}

    public record CatalogResponse(
            List<CatalogCategoryDto> categories,
            int totalVariables
    ) {}

    public record ObservationCondition(
            @NotBlank(message = "Observation variable code is required")
            String variableCode,

            @NotBlank(message = "Comparison operator is required")
            String operator,

            BigDecimal value,
            BigDecimal maxValue
    ) {}

    public record CohortFilterCriteria(
            @Min(value = 0, message = "Minimum age cannot be negative")
            @Max(value = 130, message = "Minimum age exceeds realistic bound")
            Integer ageMin,

            @Min(value = 0, message = "Maximum age cannot be negative")
            @Max(value = 130, message = "Maximum age exceeds realistic bound")
            Integer ageMax,

            List<String> sexes,

            LocalDate dateFrom,
            LocalDate dateTo,

            List<@Valid ObservationCondition> conditions,

            @NotEmpty(message = "At least one catalog variable must be requested")
            List<String> requestedVariables
    ) {}

    public record CohortPreviewResponse(
            long eligibleRecordCount,
            long matchingPatientCount,
            List<String> variables,
            int filtersApplied,
            long queryExecutionMs,
            boolean underPrivacyThreshold,
            String privacyNotice
    ) {
        public CohortPreviewResponse(
                long eligibleRecordCount,
                long matchingPatientCount,
                List<String> variables,
                int filtersApplied,
                long queryExecutionMs
        ) {
            this(eligibleRecordCount, matchingPatientCount, variables, filtersApplied, queryExecutionMs, false, null);
        }
    }
}
