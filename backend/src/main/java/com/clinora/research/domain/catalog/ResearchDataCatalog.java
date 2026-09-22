package com.clinora.research.domain.catalog;

import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class ResearchDataCatalog {

    private static final List<String> NUMERIC_OPERATORS = List.of("GTE", "LTE", "EQ", "GT", "LT", "BETWEEN");
    private static final List<String> CATEGORICAL_OPERATORS = List.of("EQ", "IN");
    private static final List<String> DATE_OPERATORS = List.of("BETWEEN", "GTE", "LTE");

    private final Map<String, ResearchCatalogVariable> variablesByCode;
    private final List<ResearchCatalogVariable> allVariables;

    public ResearchDataCatalog() {
        Map<String, ResearchCatalogVariable> map = new LinkedHashMap<>();

        // Demographics & Temporal
        register(map, "AGE_BAND", "Age Band", "Demographics", "CATEGORICAL", "Years",
                "Patient age group at observation time", CATEGORICAL_OPERATORS, List.of("age", "age_band"));
        register(map, "SEX", "Sex / Biological Gender", "Demographics", "CATEGORICAL", null,
                "Patient biological sex recorded in verified clinical profile", CATEGORICAL_OPERATORS, List.of("gender", "sex"));
        register(map, "REPORT_DATE_PERIOD", "Observation Period", "Demographics", "DATE_PERIOD", "Date",
                "Clinical report date range", DATE_OPERATORS, List.of("report_date", "date"));

        // Blood & Hematology
        register(map, "HEMOGLOBIN", "Hemoglobin", "Hematology", "NUMERIC", "g/dL",
                "Total blood hemoglobin concentration", NUMERIC_OPERATORS,
                List.of("hemoglobin", "hb", "hgb", "total hemoglobin"));
        register(map, "WBC", "White Blood Cell Count (WBC)", "Hematology", "NUMERIC", "10^9/L",
                "Total leukocyte count", NUMERIC_OPERATORS,
                List.of("wbc", "white blood cell count", "leukocyte count", "white blood cells", "total leukocyte count"));
        register(map, "PLATELETS", "Platelet Count", "Hematology", "NUMERIC", "10^9/L",
                "Circulating thrombocyte count", NUMERIC_OPERATORS,
                List.of("platelets", "platelet count", "plt", "thrombocytes"));
        register(map, "RBC", "Red Blood Cell Count (RBC)", "Hematology", "NUMERIC", "10^12/L",
                "Total erythrocyte count", NUMERIC_OPERATORS,
                List.of("rbc", "red blood cell count", "erythrocyte count", "red blood cells"));

        // Glucose & Metabolic
        register(map, "HBA1C", "Glycated Hemoglobin (HbA1c)", "Metabolic", "NUMERIC", "%",
                "Long-term glycation measure of blood sugar over 2-3 months", NUMERIC_OPERATORS,
                List.of("hba1c", "hb a1c", "glycated hemoglobin", "glycated haemoglobin", "glycosylated hemoglobin", "a1c"));
        register(map, "FASTING_GLUCOSE", "Fasting Blood Glucose", "Metabolic", "NUMERIC", "mg/dL",
                "Blood plasma glucose measured after overnight fasting", NUMERIC_OPERATORS,
                List.of("fasting glucose", "fasting blood sugar", "fbs", "fasting plasma glucose"));
        register(map, "RANDOM_GLUCOSE", "Random Blood Glucose", "Metabolic", "NUMERIC", "mg/dL",
                "Blood plasma glucose drawn non-fasting", NUMERIC_OPERATORS,
                List.of("random glucose", "random blood sugar", "rbs", "glucose", "blood glucose", "serum glucose"));

        // Lipids
        register(map, "TOTAL_CHOLESTEROL", "Total Serum Cholesterol", "Lipids", "NUMERIC", "mg/dL",
                "Combined serum cholesterol level", NUMERIC_OPERATORS,
                List.of("total cholesterol", "cholesterol total", "cholesterol"));
        register(map, "LDL", "LDL Cholesterol", "Lipids", "NUMERIC", "mg/dL",
                "Low-density lipoprotein cholesterol", NUMERIC_OPERATORS,
                List.of("ldl", "ldl c", "ldl cholesterol", "low density lipoprotein"));
        register(map, "HDL", "HDL Cholesterol", "Lipids", "NUMERIC", "mg/dL",
                "High-density lipoprotein cholesterol", NUMERIC_OPERATORS,
                List.of("hdl", "hdl c", "hdl cholesterol", "high density lipoprotein"));
        register(map, "TRIGLYCERIDES", "Serum Triglycerides", "Lipids", "NUMERIC", "mg/dL",
                "Circulating blood fats", NUMERIC_OPERATORS,
                List.of("triglyceride", "triglycerides", "tg"));

        // Renal / Kidney
        register(map, "CREATININE", "Serum Creatinine", "Renal", "NUMERIC", "mg/dL",
                "Kidney breakdown byproduct for renal clearance evaluation", NUMERIC_OPERATORS,
                List.of("creatinine", "serum creatinine", "s creatinine", "s creat", "creat"));
        register(map, "EGFR", "Estimated GFR (eGFR)", "Renal", "NUMERIC", "mL/min/1.73m²",
                "Estimated glomerular filtration rate", NUMERIC_OPERATORS,
                List.of("egfr", "estimated glomerular filtration rate", "glomerular filtration rate"));
        register(map, "BUN", "Blood Urea Nitrogen (BUN)", "Renal", "NUMERIC", "mg/dL",
                "Nitrogen waste concentration from urea", NUMERIC_OPERATORS,
                List.of("bun", "blood urea nitrogen", "urea", "serum urea"));
        register(map, "URIC_ACID", "Serum Uric Acid", "Renal", "NUMERIC", "mg/dL",
                "Purine metabolic waste marker", NUMERIC_OPERATORS,
                List.of("uric acid", "serum uric acid"));

        // Liver & Hepatic
        register(map, "ALT", "Alanine Aminotransferase (ALT / SGPT)", "Liver", "NUMERIC", "U/L",
                "Liver parenchymal injury enzyme", NUMERIC_OPERATORS,
                List.of("alt", "sgpt", "alanine aminotransferase", "alanine transaminase"));
        register(map, "AST", "Aspartate Aminotransferase (AST / SGOT)", "Liver", "NUMERIC", "U/L",
                "Hepatic and cardiac cellular enzyme", NUMERIC_OPERATORS,
                List.of("ast", "sgot", "aspartate aminotransferase", "aspartate transaminase"));
        register(map, "ALP", "Alkaline Phosphatase (ALP)", "Liver", "NUMERIC", "U/L",
                "Biliary and osteoblastic enzyme marker", NUMERIC_OPERATORS,
                List.of("alp", "alkaline phosphatase"));
        register(map, "BILIRUBIN_TOTAL", "Total Serum Bilirubin", "Liver", "NUMERIC", "mg/dL",
                "Heme breakdown metabolite", NUMERIC_OPERATORS,
                List.of("total bilirubin", "bilirubin total", "t bilirubin"));
        register(map, "ALBUMIN", "Serum Albumin", "Liver", "NUMERIC", "g/dL",
                "Primary hepatic synthetic protein", NUMERIC_OPERATORS,
                List.of("albumin", "serum albumin"));

        // Thyroid
        register(map, "TSH", "Thyroid Stimulating Hormone (TSH)", "Thyroid", "NUMERIC", "uIU/mL",
                "Pituitary thyroid regulator", NUMERIC_OPERATORS,
                List.of("tsh", "thyroid stimulating hormone", "thyrotropin"));
        register(map, "FREE_T4", "Free Thyroxine (Free T4)", "Thyroid", "NUMERIC", "ng/dL",
                "Active unbound circulating thyroid hormone", NUMERIC_OPERATORS,
                List.of("free t4", "ft4", "free thyroxine"));

        // Inflammation & Nutrition
        register(map, "CRP", "C-Reactive Protein (CRP)", "Inflammation", "NUMERIC", "mg/L",
                "Acute systemic inflammation marker", NUMERIC_OPERATORS,
                List.of("crp", "c reactive protein", "hs crp", "high sensitivity crp"));
        register(map, "FERRITIN", "Serum Ferritin", "Nutrition", "NUMERIC", "ng/mL",
                "Body cellular iron storage protein", NUMERIC_OPERATORS,
                List.of("ferritin", "serum ferritin"));
        register(map, "VITAMIN_D", "25-Hydroxy Vitamin D", "Nutrition", "NUMERIC", "ng/mL",
                "Serum circulating vitamin D precursor", NUMERIC_OPERATORS,
                List.of("vitamin d", "25 oh vitamin d", "25 hydroxy vitamin d", "25oh vitamin d"));
        register(map, "VITAMIN_B12", "Vitamin B12 (Cobalamin)", "Nutrition", "NUMERIC", "pg/mL",
                "Neuro-hematologic cofactor vitamin", NUMERIC_OPERATORS,
                List.of("vitamin b12", "b12", "cobalamin"));

        this.variablesByCode = Map.copyOf(map);
        this.allVariables = List.copyOf(map.values());
    }

    private void register(
            Map<String, ResearchCatalogVariable> map,
            String code,
            String displayName,
            String category,
            String dataType,
            String unit,
            String description,
            List<String> operators,
            List<String> aliases
    ) {
        map.put(code, new ResearchCatalogVariable(code, displayName, category, dataType, unit, description, operators, aliases));
    }

    public List<ResearchCatalogVariable> getAllVariables() {
        return allVariables;
    }

    public Optional<ResearchCatalogVariable> getByCode(String code) {
        if (code == null) return Optional.empty();
        return Optional.ofNullable(variablesByCode.get(code.toUpperCase(Locale.ROOT)));
    }

    public boolean isValid(String code) {
        if (code == null) return false;
        return variablesByCode.containsKey(code.toUpperCase(Locale.ROOT));
    }

    public List<String> getMatchingAliases(String code) {
        return getByCode(code).map(ResearchCatalogVariable::labelAliases).orElse(List.of());
    }

    public Map<String, List<ResearchCatalogVariable>> getVariablesByCategory() {
        Map<String, List<ResearchCatalogVariable>> grouped = new LinkedHashMap<>();
        for (ResearchCatalogVariable var : allVariables) {
            grouped.computeIfAbsent(var.category(), k -> new ArrayList<>()).add(var);
        }
        return Collections.unmodifiableMap(grouped);
    }
}
