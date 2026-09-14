package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class HealthRecordLabTaxonomyTest {

    @Test
    void commonLabAliasesResolveToOneCanonicalConcept() {
        assertEquals("HEMOGLOBIN", HealthRecordLabTaxonomy.resolve("Hb", null).code());
        assertEquals("HEMOGLOBIN", HealthRecordLabTaxonomy.resolve("Haemoglobin", null).code());
        assertEquals("PLATELET_COUNT", HealthRecordLabTaxonomy.resolve("PLT", null).code());
        assertEquals("CREATININE", HealthRecordLabTaxonomy.resolve("S. Creat.", null).code());
        assertEquals("HBA1C", HealthRecordLabTaxonomy.resolve("Glycated Hemoglobin", null).code());
        assertEquals("WBC", HealthRecordLabTaxonomy.resolve("WBC (Total) Test Name", null).code());
        assertEquals("WBC", HealthRecordLabTaxonomy.resolve("Total Leucocyte Count", null).code());
        assertEquals("HEMATOCRIT", HealthRecordLabTaxonomy.resolve("RBC Profile HCT", null).code());
    }

    @Test
    void metabolicKidneyInflammationAndSerologyUseUsefulHealthAreas() {
        assertEquals(HealthRecordLabTaxonomy.Category.GLUCOSE, HealthRecordLabTaxonomy.resolve("Estimated Average Glucose", null).category());
        assertEquals(HealthRecordLabTaxonomy.Category.KIDNEY, HealthRecordLabTaxonomy.resolve("Urine Microalbumin", null).category());
        assertEquals(HealthRecordLabTaxonomy.Category.INFLAMMATION, HealthRecordLabTaxonomy.resolve("ESR", null).category());
        assertEquals(HealthRecordLabTaxonomy.Category.INFECTIOUS, HealthRecordLabTaxonomy.resolve("Dengue NS1 Antigen", null).category());
    }

    @Test
    void unknownLabelsArePreservedInsteadOfGuessed() {
        HealthRecordLabTaxonomy.Concept concept = HealthRecordLabTaxonomy.resolve("Novel Lab Marker X", null);
        assertEquals(HealthRecordLabTaxonomy.Category.OTHER, concept.category());
        assertTrue(concept.code().startsWith("OTHER_"));
        assertEquals("Novel Lab Marker X", concept.displayName());
    }

    @Test
    void safeUnitConversionsProduceComparableValues() {
        HealthRecordLabTaxonomy.Concept glucose = HealthRecordLabTaxonomy.resolve("Fasting glucose", null);
        HealthRecordLabTaxonomy.NormalizedNumeric mmol = HealthRecordLabTaxonomy.normalizeNumeric(glucose, new BigDecimal("5.2"), "mmol/L");
        HealthRecordLabTaxonomy.NormalizedNumeric mgdl = HealthRecordLabTaxonomy.normalizeNumeric(glucose, new BigDecimal("94"), "mg/dL");

        assertEquals("mg/dL", mmol.comparisonKey());
        assertEquals("mg/dL", mgdl.comparisonKey());
        assertEquals(0, new BigDecimal("93.69464").compareTo(mmol.value()));
        assertTrue(mmol.converted());
        assertFalse(mgdl.converted());
    }

    @Test
    void commonCellCountUnitsNormalizeWithoutMixingAbsoluteAndPercentageConcepts() {
        HealthRecordLabTaxonomy.Concept wbc = HealthRecordLabTaxonomy.resolve("WBC", null);
        assertEquals("10^9/L", HealthRecordLabTaxonomy.normalizeNumeric(wbc, new BigDecimal("7.2"), "10^3/mm3").comparisonKey());
        assertEquals("10^9/L", HealthRecordLabTaxonomy.normalizeNumeric(wbc, new BigDecimal("7200"), "/cumm").comparisonKey());
        assertEquals("NEUTROPHILS", HealthRecordLabTaxonomy.resolve("Neutrophils", null).code());
        assertEquals("NEUTROPHILS_ABS", HealthRecordLabTaxonomy.resolve("Absolute Neutrophil Count", null).code());
    }

    @Test
    void unsupportedUnitsAreNotSilentlyMixed() {
        HealthRecordLabTaxonomy.Concept tsh = HealthRecordLabTaxonomy.resolve("TSH", null);
        HealthRecordLabTaxonomy.NormalizedNumeric first = HealthRecordLabTaxonomy.normalizeNumeric(tsh, new BigDecimal("2.1"), "mIU/L");
        HealthRecordLabTaxonomy.NormalizedNumeric second = HealthRecordLabTaxonomy.normalizeNumeric(tsh, new BigDecimal("2.2"), "uIU/mL");
        assertFalse(first.comparisonKey().equals(second.comparisonKey()));
    }
}
