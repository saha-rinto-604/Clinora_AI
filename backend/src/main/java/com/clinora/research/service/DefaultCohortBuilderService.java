package com.clinora.research.service;

import com.clinora.research.api.CohortQueryModels.*;
import com.clinora.research.domain.catalog.ResearchCatalogVariable;
import com.clinora.research.domain.catalog.ResearchDataCatalog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
public class DefaultCohortBuilderService implements CohortBuilderService {

    private static final Logger LOGGER = LoggerFactory.getLogger(DefaultCohortBuilderService.class);

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ResearchDataCatalog catalog;

    public DefaultCohortBuilderService(NamedParameterJdbcTemplate jdbcTemplate, ResearchDataCatalog catalog) {
        this.jdbcTemplate = jdbcTemplate;
        this.catalog = catalog;
    }

    @Override
    public CatalogResponse getCatalog() {
        Map<String, List<ResearchCatalogVariable>> grouped = catalog.getVariablesByCategory();
        List<CatalogCategoryDto> categories = new ArrayList<>();

        for (Map.Entry<String, List<ResearchCatalogVariable>> entry : grouped.entrySet()) {
            List<CatalogVariableDto> dtoList = entry.getValue().stream()
                    .map(CatalogVariableDto::from)
                    .toList();
            categories.add(new CatalogCategoryDto(entry.getKey(), dtoList));
        }

        return new CatalogResponse(categories, catalog.getAllVariables().size());
    }

    @Override
    @Transactional(readOnly = true)
    public CohortPreviewResponse previewCohort(CohortFilterCriteria criteria) {
        long startTime = System.currentTimeMillis();

        validateCriteria(criteria);

        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder whereClause = new StringBuilder();
        int filtersApplied = 0;

        // Eligibility baseline rules with fail-closed patient research consent
        whereClause.append("rep.subject_type = 'SELF' ")
                .append("AND rep.archived_at IS NULL ")
                .append("AND obs.verification_status IN ('DOCTOR_VERIFIED', 'PATIENT_CONFIRMED', 'PATIENT_CORRECTED') ")
                .append("AND obs.review_required = false ")
                .append("AND obs.effective_numeric_value IS NOT NULL ")
                .append("AND EXISTS (SELECT 1 FROM patient_research_consents prc WHERE prc.patient_user_id = rep.patient_user_id AND prc.consent_status = 'CONSENTED' AND prc.revoked_at IS NULL) ");

        // Age bounds relative to observation/report date
        if (criteria.ageMin() != null) {
            whereClause.append("AND EXTRACT(YEAR FROM age(rep.report_date, p.date_of_birth)) >= :minAge ");
            params.addValue("minAge", criteria.ageMin());
            filtersApplied++;
        }
        if (criteria.ageMax() != null) {
            whereClause.append("AND EXTRACT(YEAR FROM age(rep.report_date, p.date_of_birth)) <= :maxAge ");
            params.addValue("maxAge", criteria.ageMax());
            if (criteria.ageMin() == null) filtersApplied++;
        }

        // Biological Sex
        if (criteria.sexes() != null && !criteria.sexes().isEmpty()) {
            List<String> upperSexes = criteria.sexes().stream()
                    .map(s -> s.toUpperCase(Locale.ROOT).trim())
                    .toList();
            whereClause.append("AND UPPER(p.gender) IN (:sexes) ");
            params.addValue("sexes", upperSexes);
            filtersApplied++;
        }

        // Temporal Date Range
        if (criteria.dateFrom() != null) {
            whereClause.append("AND rep.report_date >= :dateFrom ");
            params.addValue("dateFrom", criteria.dateFrom());
            filtersApplied++;
        }
        if (criteria.dateTo() != null) {
            whereClause.append("AND rep.report_date <= :dateTo ");
            params.addValue("dateTo", criteria.dateTo());
            if (criteria.dateFrom() == null) filtersApplied++;
        }

        // Observation conditions (e.g. HbA1c >= 6.5)
        if (criteria.conditions() != null && !criteria.conditions().isEmpty()) {
            int conditionIndex = 0;
            for (ObservationCondition condition : criteria.conditions()) {
                ResearchCatalogVariable var = catalog.getByCode(condition.variableCode()).orElseThrow();
                List<String> aliases = var.labelAliases().stream().map(String::toLowerCase).toList();

                String aliasParam = "cond_alias_" + conditionIndex;
                String valParam = "cond_val_" + conditionIndex;
                String maxParam = "cond_max_" + conditionIndex;

                params.addValue(aliasParam, aliases);
                params.addValue(valParam, condition.value());

                String opSql = mapOperatorSql(condition.operator(), valParam, maxParam);
                if ("BETWEEN".equalsIgnoreCase(condition.operator())) {
                    params.addValue(maxParam, condition.maxValue());
                }

                whereClause.append("AND EXISTS (")
                        .append("SELECT 1 FROM patient_medical_reports crep ")
                        .append("JOIN medical_report_extraction_results cres ON cres.report_id = crep.id ")
                        .append("JOIN medical_report_observations cobs ON cobs.extraction_result_id = cres.id ")
                        .append("WHERE crep.patient_user_id = rep.patient_user_id ")
                        .append("AND crep.subject_type = 'SELF' ")
                        .append("AND crep.archived_at IS NULL ")
                        .append("AND cobs.verification_status IN ('DOCTOR_VERIFIED', 'PATIENT_CONFIRMED', 'PATIENT_CORRECTED') ")
                        .append("AND cobs.review_required = false ")
                        .append("AND (LOWER(cobs.normalized_label) IN (:").append(aliasParam).append(") OR LOWER(cobs.effective_label) IN (:").append(aliasParam).append(")) ")
                        .append("AND cobs.effective_numeric_value ").append(opSql).append(" ")
                        .append(") ");

                filtersApplied++;
                conditionIndex++;
            }
        }

        // Requested variables filter on observation records
        Set<String> clinicalAliases = new LinkedHashSet<>();
        boolean hasClinicalVars = false;
        for (String varCode : criteria.requestedVariables()) {
            ResearchCatalogVariable var = catalog.getByCode(varCode).orElseThrow();
            if (!"Demographics".equalsIgnoreCase(var.category())) {
                hasClinicalVars = true;
                for (String alias : var.labelAliases()) {
                    clinicalAliases.add(alias.toLowerCase(Locale.ROOT));
                }
            }
        }

        if (hasClinicalVars && !clinicalAliases.isEmpty()) {
            whereClause.append("AND (LOWER(obs.normalized_label) IN (:reqAliases) OR LOWER(obs.effective_label) IN (:reqAliases)) ");
            params.addValue("reqAliases", new ArrayList<>(clinicalAliases));
        }

        String sql = """
            SELECT 
                COUNT(DISTINCT rep.patient_user_id) AS matching_patients,
                COUNT(DISTINCT obs.id) AS eligible_records
            FROM patient_medical_reports rep
            JOIN users u ON rep.patient_user_id = u.id
            LEFT JOIN patient_profiles p ON p.user_id = rep.patient_user_id
            JOIN medical_report_extraction_results res ON res.report_id = rep.id
            JOIN medical_report_observations obs ON obs.extraction_result_id = res.id
            WHERE %s
            """.formatted(whereClause.toString());

        LOGGER.debug("Executing cohort query preview with filters applied: {}", filtersApplied);

        long matchingPatients = 0;
        long eligibleRecords = 0;

        try {
            Map<String, Object> result = jdbcTemplate.queryForMap(sql, params);
            matchingPatients = ((Number) result.getOrDefault("matching_patients", 0)).longValue();
            eligibleRecords = ((Number) result.getOrDefault("eligible_records", 0)).longValue();

            // If only demographic variables requested, record count matches patient count
            if (!hasClinicalVars) {
                eligibleRecords = matchingPatients;
            }
        } catch (Exception e) {
            LOGGER.error("Cohort preview query execution failed: {}", e.getMessage(), e);
        }

        long executionMs = System.currentTimeMillis() - startTime;
        final int minSafeCohortSize = 10;
        boolean underThreshold = matchingPatients > 0 && matchingPatients < minSafeCohortSize;
        long reportedPatients = underThreshold ? 0 : matchingPatients;
        long reportedRecords = underThreshold ? 0 : eligibleRecords;
        String privacyNotice = underThreshold
                ? "Matching cohort is fewer than the minimum safe privacy threshold (" + minSafeCohortSize + " subjects). Exact counts are suppressed to protect patient privacy."
                : null;

        // Return privacy-preserving aggregate metadata with strictly zero PII
        return new CohortPreviewResponse(
                reportedRecords,
                reportedPatients,
                criteria.requestedVariables(),
                filtersApplied,
                executionMs,
                underThreshold,
                privacyNotice
        );
    }

    private void validateCriteria(CohortFilterCriteria criteria) {
        if (criteria == null) {
            throw new IllegalArgumentException("Cohort criteria must be provided");
        }
        if (criteria.requestedVariables() == null || criteria.requestedVariables().isEmpty()) {
            throw new IllegalArgumentException("At least one requested variable is required");
        }
        for (String varCode : criteria.requestedVariables()) {
            if (!catalog.isValid(varCode)) {
                throw new IllegalArgumentException("Unknown research variable code: " + varCode);
            }
        }
        if (criteria.ageMin() != null && criteria.ageMax() != null && criteria.ageMin() > criteria.ageMax()) {
            throw new IllegalArgumentException("Minimum age cannot exceed maximum age");
        }
        if (criteria.dateFrom() != null && criteria.dateTo() != null && criteria.dateFrom().isAfter(criteria.dateTo())) {
            throw new IllegalArgumentException("Start date cannot be after end date");
        }
        if (criteria.conditions() != null) {
            for (ObservationCondition condition : criteria.conditions()) {
                ResearchCatalogVariable var = catalog.getByCode(condition.variableCode())
                        .orElseThrow(() -> new IllegalArgumentException("Unknown condition variable: " + condition.variableCode()));

                String op = condition.operator().toUpperCase(Locale.ROOT);
                if (!var.supportedOperators().contains(op)) {
                    throw new IllegalArgumentException("Operator '" + op + "' is not supported for variable " + var.code());
                }
                if (condition.value() == null) {
                    throw new IllegalArgumentException("Condition value is required for variable " + var.code());
                }
                if ("BETWEEN".equalsIgnoreCase(op)) {
                    if (condition.maxValue() == null) {
                        throw new IllegalArgumentException("Condition maxValue is required for BETWEEN operator");
                    }
                    if (condition.value().compareTo(condition.maxValue()) > 0) {
                        throw new IllegalArgumentException("Condition lower bound cannot exceed upper bound in BETWEEN operator");
                    }
                }
            }
        }
    }

    private String mapOperatorSql(String operator, String valParam, String maxParam) {
        return switch (operator.toUpperCase(Locale.ROOT)) {
            case "GTE" -> ">= :" + valParam;
            case "LTE" -> "<= :" + valParam;
            case "GT" -> "> :" + valParam;
            case "LT" -> "< :" + valParam;
            case "EQ" -> "= :" + valParam;
            case "BETWEEN" -> "BETWEEN :" + valParam + " AND :" + maxParam;
            default -> throw new IllegalArgumentException("Unsupported SQL operator: " + operator);
        };
    }
}
