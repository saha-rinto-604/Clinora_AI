package com.clinora.research;

import com.clinora.research.api.CohortQueryModels.*;
import com.clinora.research.domain.catalog.ResearchCatalogVariable;
import com.clinora.research.domain.catalog.ResearchDataCatalog;
import com.clinora.research.service.DefaultCohortBuilderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CohortBuilderServiceTest {

    @Mock
    private NamedParameterJdbcTemplate jdbcTemplate;

    private ResearchDataCatalog catalog;
    private DefaultCohortBuilderService service;

    @BeforeEach
    void setUp() {
        catalog = new ResearchDataCatalog();
        service = new DefaultCohortBuilderService(jdbcTemplate, catalog);
    }

    @Test
    @DisplayName("Catalog contains real structured clinical variables and groups them by category")
    void catalogIntegrity() {
        CatalogResponse response = service.getCatalog();
        assertNotNull(response);
        assertTrue(response.totalVariables() >= 20);

        List<String> codes = catalog.getAllVariables().stream().map(ResearchCatalogVariable::code).toList();
        assertTrue(codes.contains("AGE_BAND"));
        assertTrue(codes.contains("SEX"));
        assertTrue(codes.contains("REPORT_DATE_PERIOD"));
        assertTrue(codes.contains("HEMOGLOBIN"));
        assertTrue(codes.contains("WBC"));
        assertTrue(codes.contains("PLATELETS"));
        assertTrue(codes.contains("FASTING_GLUCOSE"));
        assertTrue(codes.contains("HBA1C"));
        assertTrue(codes.contains("CREATININE"));
        assertTrue(codes.contains("EGFR"));
        assertTrue(codes.contains("ALT"));
        assertTrue(codes.contains("AST"));
        assertTrue(codes.contains("TSH"));

        // Verify categories exist
        List<String> categories = response.categories().stream().map(CatalogCategoryDto::category).toList();
        assertTrue(categories.contains("Demographics"));
        assertTrue(categories.contains("Metabolic"));
        assertTrue(categories.contains("Hematology"));
        assertTrue(categories.contains("Renal"));
        assertTrue(categories.contains("Liver"));
        assertTrue(categories.contains("Thyroid"));
    }

    @Test
    @DisplayName("Reject unknown variables not in controlled catalog")
    void rejectUnknownVariables() {
        CohortFilterCriteria criteria = new CohortFilterCriteria(
                40, 60,
                null,
                null, null,
                null,
                List.of("UNKNOWN_FUTURE_EXPERIMENTAL_GENE")
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.previewCohort(criteria));
        assertTrue(ex.getMessage().contains("Unknown research variable"));
    }

    @Test
    @DisplayName("Reject invalid age bounds")
    void rejectInvalidAgeBounds() {
        CohortFilterCriteria criteria = new CohortFilterCriteria(
                65, 45, // min > max
                null,
                null, null,
                null,
                List.of("HBA1C")
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.previewCohort(criteria));
        assertTrue(ex.getMessage().contains("Minimum age cannot exceed maximum age"));
    }

    @Test
    @DisplayName("Reject invalid date bounds")
    void rejectInvalidDateBounds() {
        CohortFilterCriteria criteria = new CohortFilterCriteria(
                null, null,
                null,
                LocalDate.of(2026, 9, 1), LocalDate.of(2026, 1, 1), // start after end
                null,
                List.of("HBA1C")
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.previewCohort(criteria));
        assertTrue(ex.getMessage().contains("Start date cannot be after end date"));
    }

    @Test
    @DisplayName("Reject unsupported operators on catalog variables")
    void rejectUnsupportedOperators() {
        ObservationCondition invalidCondition = new ObservationCondition(
                "HBA1C",
                "LIKE", // Unsupported operator on numeric lab
                new BigDecimal("6.5"),
                null
        );

        CohortFilterCriteria criteria = new CohortFilterCriteria(
                null, null,
                null,
                null, null,
                List.of(invalidCondition),
                List.of("HBA1C")
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.previewCohort(criteria));
        assertTrue(ex.getMessage().contains("Operator 'LIKE' is not supported"));
    }

    @Test
    @DisplayName("Reject BETWEEN operator when maxValue is missing or lower than lower bound")
    void rejectInvalidBetweenOperator() {
        ObservationCondition invalidCondition = new ObservationCondition(
                "HBA1C",
                "BETWEEN",
                new BigDecimal("8.0"),
                new BigDecimal("6.0") // max < min
        );

        CohortFilterCriteria criteria = new CohortFilterCriteria(
                null, null,
                null,
                null, null,
                List.of(invalidCondition),
                List.of("HBA1C")
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.previewCohort(criteria));
        assertTrue(ex.getMessage().contains("lower bound cannot exceed upper bound"));
    }

    @Test
    @DisplayName("Preview cohort generates safe parameterized query with eligibility boundary and returns privacy-safe metadata")
    void previewCohortExecution() {
        when(jdbcTemplate.queryForMap(anyString(), any(MapSqlParameterSource.class)))
                .thenReturn(Map.of("matching_patients", 142L, "eligible_records", 183L));

        ObservationCondition hba1cCondition = new ObservationCondition(
                "HBA1C",
                "GTE",
                new BigDecimal("6.5"),
                null
        );

        CohortFilterCriteria criteria = new CohortFilterCriteria(
                40, 60,
                List.of("MALE", "FEMALE"),
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 9, 1),
                List.of(hba1cCondition),
                List.of("AGE_BAND", "HBA1C")
        );

        CohortPreviewResponse response = service.previewCohort(criteria);

        assertNotNull(response);
        assertEquals(183L, response.eligibleRecordCount());
        assertEquals(142L, response.matchingPatientCount());
        assertEquals(List.of("AGE_BAND", "HBA1C"), response.variables());
        assertEquals(4, response.filtersApplied()); // age, sex, date, condition

        // Verify the SQL contains Phase R6 eligibility boundaries
        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<MapSqlParameterSource> paramCaptor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).queryForMap(sqlCaptor.capture(), paramCaptor.capture());

        String sql = sqlCaptor.getValue();
        assertTrue(sql.contains("rep.subject_type = 'SELF'"));
        assertTrue(sql.contains("rep.archived_at IS NULL"));
        assertTrue(sql.contains("obs.verification_status IN ('DOCTOR_VERIFIED', 'PATIENT_CONFIRMED', 'PATIENT_CORRECTED')"));
        assertTrue(sql.contains("obs.review_required = false"));
        assertTrue(sql.contains("obs.effective_numeric_value IS NOT NULL"));

        // Verify parameterized values
        MapSqlParameterSource params = paramCaptor.getValue();
        assertEquals(40, params.getValue("minAge"));
        assertEquals(60, params.getValue("maxAge"));
        assertEquals(List.of("MALE", "FEMALE"), params.getValue("sexes"));
        assertEquals(LocalDate.of(2026, 1, 1), params.getValue("dateFrom"));
        assertEquals(LocalDate.of(2026, 9, 1), params.getValue("dateTo"));
        assertEquals(new BigDecimal("6.5"), params.getValue("cond_val_0"));
    }

    @Test
    @DisplayName("Demographic-only queries equate record count to matching patient count")
    void demographicOnlyQuery() {
        when(jdbcTemplate.queryForMap(anyString(), any(MapSqlParameterSource.class)))
                .thenReturn(Map.of("matching_patients", 50L, "eligible_records", 0L));

        CohortFilterCriteria criteria = new CohortFilterCriteria(
                20, 30,
                null,
                null, null,
                null,
                List.of("AGE_BAND", "SEX")
        );

        CohortPreviewResponse response = service.previewCohort(criteria);

        assertNotNull(response);
        assertEquals(50L, response.matchingPatientCount());
        assertEquals(50L, response.eligibleRecordCount()); // mapped to matching patients
        assertEquals(List.of("AGE_BAND", "SEX"), response.variables());
    }
}
