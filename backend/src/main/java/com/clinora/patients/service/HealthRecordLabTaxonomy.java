package com.clinora.patients.service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Conservative deterministic taxonomy and unit normalization for Patient
 * longitudinal health records. Unknown legitimate tests are preserved under
 * OTHER; classification is never delegated to an LLM.
 */
public final class HealthRecordLabTaxonomy {
    private static final MathContext MC = new MathContext(12, RoundingMode.HALF_UP);
    private static final Map<String, Concept> ALIASES = aliases();

    private HealthRecordLabTaxonomy() {
    }

    public enum Category {
        BODY("Body & Vitals", 5),
        HEMATOLOGY("Blood & Hematology", 10),
        GLUCOSE("Glucose & Metabolic", 20),
        LIPIDS("Lipids", 30),
        KIDNEY("Kidney & Urine", 40),
        LIVER("Liver", 50),
        THYROID("Thyroid", 60),
        INFLAMMATION("Inflammation", 70),
        NUTRITION("Vitamins & Nutrition", 80),
        INFECTIOUS("Infectious & Serology", 90),
        OTHER("Other Tests", 100);

        private final String displayName;
        private final int order;

        Category(String displayName, int order) {
            this.displayName = displayName;
            this.order = order;
        }

        public String displayName() {
            return displayName;
        }

        public int order() {
            return order;
        }
    }

    public enum UnitFamily {
        NONE,
        PERCENT,
        MASS_CONCENTRATION,
        GLUCOSE_MASS,
        LIPID_MASS,
        TRIGLYCERIDE_MASS,
        CREATININE_MASS,
        CELL_COUNT_9,
        RBC_COUNT_12,
        CONCENTRATION_MMOL,
        ENZYME,
        HORMONE,
        OTHER
    }

    public record Concept(String code, String displayName, Category category, UnitFamily preferredFamily, String preferredUnit) {
    }

    public record NormalizedNumeric(BigDecimal value, String unit, String comparisonKey, boolean converted) {
    }

    public static Concept resolve(String effectiveLabel, String normalizedLabel) {
        String first = normalizeLabel(effectiveLabel);
        String second = normalizeLabel(normalizedLabel);
        Concept concept = ALIASES.get(first);
        if (concept == null) concept = ALIASES.get(second);
        if (concept == null) concept = fuzzyKnownConcept(first);
        if (concept == null) concept = fuzzyKnownConcept(second);
        if (concept != null) return concept;

        String chosen = !first.isBlank() ? first : second;
        return new Concept(
            "OTHER_" + slug(chosen),
            humanize(effectiveLabel, normalizedLabel),
            Category.OTHER,
            UnitFamily.OTHER,
            null
        );
    }

    public static NormalizedNumeric normalizeNumeric(Concept concept, BigDecimal value, String rawUnit) {
        if (value == null) return null;
        String unit = normalizeUnit(rawUnit);
        if (unit.isBlank()) {
            return new NormalizedNumeric(value.stripTrailingZeros(), blankToNull(rawUnit), "NO_UNIT", false);
        }

        return switch (concept.code()) {
            case "HEMOGLOBIN", "MCHC" -> normalizeHemoglobin(value, unit, rawUnit);
            case "WBC", "PLATELET_COUNT", "NEUTROPHILS_ABS", "LYMPHOCYTES_ABS", "MONOCYTES_ABS",
                "EOSINOPHILS_ABS", "BASOPHILS_ABS" -> normalizeCellCount9(value, unit, rawUnit);
            case "RBC" -> normalizeRbc(value, unit, rawUnit);
            case "GLUCOSE", "FASTING_GLUCOSE", "RANDOM_GLUCOSE", "EAG" -> normalizeGlucose(value, unit, rawUnit);
            case "TOTAL_CHOLESTEROL", "LDL", "HDL", "VLDL", "NON_HDL" -> normalizeCholesterol(value, unit, rawUnit);
            case "TRIGLYCERIDES" -> normalizeTriglycerides(value, unit, rawUnit);
            case "CREATININE" -> normalizeCreatinine(value, unit, rawUnit);
            default -> normalizedExact(value, unit, rawUnit);
        };
    }

    static String normalizeLabel(String value) {
        if (value == null) return "";
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKC)
            .toLowerCase(Locale.ROOT)
            .replace('&', ' ')
            .replaceAll("\\([^)]*\\)", " ")
            .replaceAll("[^a-z0-9%]+", " ")
            .replaceAll("\\s+", " ")
            .trim();
        normalized = normalized
            .replaceFirst("^(serum|s|plasma|blood)\\s+", "")
            .replaceAll("\\b(test\\s*name|result|profile)\\b$", "")
            .replaceAll("\\s+", " ")
            .trim();
        return normalized;
    }

    static String normalizeUnit(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFKC)
            .toLowerCase(Locale.ROOT)
            .replace('µ', 'u')
            .replace('μ', 'u')
            .replace('×', 'x')
            .replace("per", "/")
            .replaceAll("\\s+", "")
            .replace("litre", "l")
            .replace("liter", "l")
            .replace("cumm", "cmm")
            .replace("cu.mm", "cmm")
            .replace("mm^3", "mm3")
            .replace("mm³", "mm3")
            .trim();
    }

    private static Concept fuzzyKnownConcept(String label) {
        if (label == null || label.isBlank()) return null;
        if (label.matches("^(?:wbc|white blood cell|white blood cells|total leucocyte count|total leukocyte count).*")) return ALIASES.get("wbc");
        if (label.matches("^(?:hba1c|hb a1c|glycated hemoglobin|glycated haemoglobin|glycosylated hemoglobin).*")) return ALIASES.get("hba1c");
        if (label.matches("^(?:platelet|platelets|plt).*")) return ALIASES.get("platelet count");
        if (label.matches("^(?:hematocrit|haematocrit|hct|rbc profile hct).*")) return ALIASES.get("hct");
        if (label.matches("^(?:hemoglobin|haemoglobin|hgb|hb)(?:\\s.*)?")) return ALIASES.get("hemoglobin");
        if (label.matches("^(?:creatinine|serum creatinine|s creat|creat)(?:\\s.*)?")) return ALIASES.get("creatinine");
        return null;
    }

    private static NormalizedNumeric normalizeHemoglobin(BigDecimal value, String unit, String rawUnit) {
        if (Set.of("g/dl", "gm/dl", "gdl").contains(unit)) {
            return canonical(value, "g/dL", "g/dL", false);
        }
        if (Set.of("g/l", "gm/l", "gl").contains(unit)) {
            return canonical(value.divide(BigDecimal.TEN, MC), "g/dL", "g/dL", true);
        }
        return normalizedExact(value, unit, rawUnit);
    }

    private static NormalizedNumeric normalizeCellCount9(BigDecimal value, String unit, String rawUnit) {
        if (isExponentUnit(unit, 9, "l") || Set.of("10^3/ul", "x10^3/ul", "10e3/ul", "k/ul", "10^3/mm3", "x10^3/mm3").contains(unit)) {
            return canonical(value, "10^9/L", "10^9/L", false);
        }
        if (Set.of("/ul", "cells/ul", "cell/ul", "/cmm", "cells/cmm", "cell/cmm", "/mm3", "cells/mm3", "cell/mm3").contains(unit)) {
            return canonical(value.divide(BigDecimal.valueOf(1000), MC), "10^9/L", "10^9/L", true);
        }
        return normalizedExact(value, unit, rawUnit);
    }

    private static NormalizedNumeric normalizeRbc(BigDecimal value, String unit, String rawUnit) {
        if (isExponentUnit(unit, 12, "l") || Set.of("10^6/ul", "x10^6/ul", "10e6/ul", "m/ul", "million/cmm", "million/mm3").contains(unit)) {
            return canonical(value, "10^12/L", "10^12/L", false);
        }
        if (Set.of("/ul", "cells/ul", "cell/ul", "/cmm", "/mm3").contains(unit) && value.abs().compareTo(BigDecimal.valueOf(1000)) > 0) {
            return canonical(value.divide(BigDecimal.valueOf(1_000_000), MC), "10^12/L", "10^12/L", true);
        }
        return normalizedExact(value, unit, rawUnit);
    }

    private static NormalizedNumeric normalizeGlucose(BigDecimal value, String unit, String rawUnit) {
        if (Set.of("mg/dl", "mgdl").contains(unit)) return canonical(value, "mg/dL", "mg/dL", false);
        if (Set.of("mmol/l", "mmoll").contains(unit)) {
            return canonical(value.multiply(new BigDecimal("18.0182"), MC), "mg/dL", "mg/dL", true);
        }
        return normalizedExact(value, unit, rawUnit);
    }

    private static NormalizedNumeric normalizeCholesterol(BigDecimal value, String unit, String rawUnit) {
        if (Set.of("mg/dl", "mgdl").contains(unit)) return canonical(value, "mg/dL", "mg/dL", false);
        if (Set.of("mmol/l", "mmoll").contains(unit)) {
            return canonical(value.multiply(new BigDecimal("38.67"), MC), "mg/dL", "mg/dL", true);
        }
        return normalizedExact(value, unit, rawUnit);
    }

    private static NormalizedNumeric normalizeTriglycerides(BigDecimal value, String unit, String rawUnit) {
        if (Set.of("mg/dl", "mgdl").contains(unit)) return canonical(value, "mg/dL", "mg/dL", false);
        if (Set.of("mmol/l", "mmoll").contains(unit)) {
            return canonical(value.multiply(new BigDecimal("88.57"), MC), "mg/dL", "mg/dL", true);
        }
        return normalizedExact(value, unit, rawUnit);
    }

    private static NormalizedNumeric normalizeCreatinine(BigDecimal value, String unit, String rawUnit) {
        if (Set.of("mg/dl", "mgdl").contains(unit)) return canonical(value, "mg/dL", "mg/dL", false);
        if (Set.of("umol/l", "umoll").contains(unit)) {
            return canonical(value.divide(new BigDecimal("88.4"), MC), "mg/dL", "mg/dL", true);
        }
        return normalizedExact(value, unit, rawUnit);
    }

    private static NormalizedNumeric normalizedExact(BigDecimal value, String normalizedUnit, String rawUnit) {
        if (normalizedUnit.equals("%") || normalizedUnit.equals("percent")) {
            return canonical(value, "%", "%", false);
        }
        if (Set.of("u/l", "iu/l", "ul").contains(normalizedUnit)) {
            return canonical(value, "U/L", "U/L", false);
        }
        if (Set.of("mmol/l", "mmoll").contains(normalizedUnit)) {
            return canonical(value, "mmol/L", "mmol/L", false);
        }
        String display = blankToNull(rawUnit);
        return new NormalizedNumeric(value.stripTrailingZeros(), display, "RAW:" + normalizedUnit, false);
    }

    private static NormalizedNumeric canonical(BigDecimal value, String unit, String key, boolean converted) {
        return new NormalizedNumeric(value.stripTrailingZeros(), unit, key, converted);
    }

    private static boolean isExponentUnit(String unit, int exponent, String denominator) {
        String compact = unit.replace("×", "x");
        return compact.equals("10^" + exponent + "/" + denominator)
            || compact.equals("x10^" + exponent + "/" + denominator)
            || compact.equals("10e" + exponent + "/" + denominator)
            || compact.equals("x10e" + exponent + "/" + denominator)
            || compact.equals("10" + exponent + "/" + denominator);
    }

    private static Map<String, Concept> aliases() {
        Map<String, Concept> map = new LinkedHashMap<>();

        Concept hb = concept("HEMOGLOBIN", "Hemoglobin", Category.HEMATOLOGY, UnitFamily.MASS_CONCENTRATION, "g/dL");
        add(map, hb, "hemoglobin", "haemoglobin", "hb", "hgb", "hemoglobin hb", "haemoglobin hb");
        Concept rbc = concept("RBC", "Red Blood Cell Count", Category.HEMATOLOGY, UnitFamily.RBC_COUNT_12, "10^12/L");
        add(map, rbc, "rbc", "rbc count", "red blood cell", "red blood cells", "red blood cell count", "erythrocyte count", "tc of rbc");
        Concept wbc = concept("WBC", "White Blood Cell Count", Category.HEMATOLOGY, UnitFamily.CELL_COUNT_9, "10^9/L");
        add(map, wbc, "wbc", "wbc count", "white blood cell", "white blood cells", "white blood cell count", "total leucocyte count", "total leukocyte count", "tlc", "wbc total");
        add(map, concept("PLATELET_COUNT", "Platelet Count", Category.HEMATOLOGY, UnitFamily.CELL_COUNT_9, "10^9/L"), "platelet", "platelets", "platelet count", "plt", "platelet profile");
        add(map, concept("HEMATOCRIT", "Hematocrit", Category.HEMATOLOGY, UnitFamily.PERCENT, "%"), "hematocrit", "haematocrit", "hct", "packed cell volume", "pcv", "rbc profile hct");
        add(map, concept("MCV", "MCV", Category.HEMATOLOGY, UnitFamily.OTHER, "fL"), "mcv", "mean corpuscular volume");
        add(map, concept("MCH", "MCH", Category.HEMATOLOGY, UnitFamily.OTHER, "pg"), "mch", "mean corpuscular hemoglobin", "mean corpuscular haemoglobin");
        add(map, concept("MCHC", "MCHC", Category.HEMATOLOGY, UnitFamily.MASS_CONCENTRATION, "g/dL"), "mchc", "mean corpuscular hemoglobin concentration", "mean corpuscular haemoglobin concentration");
        add(map, concept("RDW", "RDW", Category.HEMATOLOGY, UnitFamily.PERCENT, "%"), "rdw", "rdw cv", "red cell distribution width");
        add(map, concept("MPV", "MPV", Category.HEMATOLOGY, UnitFamily.OTHER, "fL"), "mpv", "mean platelet volume");
        add(map, concept("PDW", "PDW", Category.HEMATOLOGY, UnitFamily.OTHER, null), "pdw", "platelet distribution width");
        add(map, concept("PCT", "Plateletcrit", Category.HEMATOLOGY, UnitFamily.PERCENT, "%"), "pct", "plateletcrit", "platelet crit");
        addDifferential(map, "NEUTROPHILS", "Neutrophils", "neutrophil", "neutrophils", "neutrophil percent", "neutrophils percent");
        addDifferential(map, "LYMPHOCYTES", "Lymphocytes", "lymphocyte", "lymphocytes", "lymphocyte percent", "lymphocytes percent");
        addDifferential(map, "MONOCYTES", "Monocytes", "monocyte", "monocytes", "monocyte percent", "monocytes percent");
        addDifferential(map, "EOSINOPHILS", "Eosinophils", "eosinophil", "eosinophils", "eosinophil percent", "eosinophils percent");
        addDifferential(map, "BASOPHILS", "Basophils", "basophil", "basophils", "basophil percent", "basophils percent");
        add(map, concept("NEUTROPHILS_ABS", "Absolute Neutrophil Count", Category.HEMATOLOGY, UnitFamily.CELL_COUNT_9, "10^9/L"), "absolute neutrophil count", "anc", "neutrophils absolute");
        add(map, concept("LYMPHOCYTES_ABS", "Absolute Lymphocyte Count", Category.HEMATOLOGY, UnitFamily.CELL_COUNT_9, "10^9/L"), "absolute lymphocyte count", "alc", "lymphocytes absolute");
        add(map, concept("MONOCYTES_ABS", "Absolute Monocyte Count", Category.HEMATOLOGY, UnitFamily.CELL_COUNT_9, "10^9/L"), "absolute monocyte count", "monocytes absolute");
        add(map, concept("EOSINOPHILS_ABS", "Absolute Eosinophil Count", Category.HEMATOLOGY, UnitFamily.CELL_COUNT_9, "10^9/L"), "absolute eosinophil count", "eosinophils absolute");
        add(map, concept("BASOPHILS_ABS", "Absolute Basophil Count", Category.HEMATOLOGY, UnitFamily.CELL_COUNT_9, "10^9/L"), "absolute basophil count", "basophils absolute");

        add(map, concept("HBA1C", "HbA1c", Category.GLUCOSE, UnitFamily.PERCENT, "%"), "hba1c", "hb a1c", "glycated hemoglobin", "glycated haemoglobin", "glycosylated hemoglobin", "a1c");
        add(map, concept("EAG", "Estimated Average Glucose", Category.GLUCOSE, UnitFamily.GLUCOSE_MASS, "mg/dL"), "estimated average glucose", "estimated average blood glucose", "eag");
        add(map, concept("GLUCOSE", "Glucose", Category.GLUCOSE, UnitFamily.GLUCOSE_MASS, "mg/dL"), "glucose", "blood glucose", "serum glucose");
        add(map, concept("FASTING_GLUCOSE", "Fasting Glucose", Category.GLUCOSE, UnitFamily.GLUCOSE_MASS, "mg/dL"), "fasting glucose", "fasting blood sugar", "fbs", "fasting plasma glucose");
        add(map, concept("RANDOM_GLUCOSE", "Random Glucose", Category.GLUCOSE, UnitFamily.GLUCOSE_MASS, "mg/dL"), "random glucose", "random blood sugar", "rbs", "random plasma glucose");

        add(map, concept("TOTAL_CHOLESTEROL", "Total Cholesterol", Category.LIPIDS, UnitFamily.LIPID_MASS, "mg/dL"), "total cholesterol", "cholesterol total", "cholesterol");
        add(map, concept("LDL", "LDL Cholesterol", Category.LIPIDS, UnitFamily.LIPID_MASS, "mg/dL"), "ldl", "ldl c", "ldl cholesterol", "low density lipoprotein");
        add(map, concept("HDL", "HDL Cholesterol", Category.LIPIDS, UnitFamily.LIPID_MASS, "mg/dL"), "hdl", "hdl c", "hdl cholesterol", "high density lipoprotein");
        add(map, concept("VLDL", "VLDL Cholesterol", Category.LIPIDS, UnitFamily.LIPID_MASS, "mg/dL"), "vldl", "vldl c", "vldl cholesterol");
        add(map, concept("TRIGLYCERIDES", "Triglycerides", Category.LIPIDS, UnitFamily.TRIGLYCERIDE_MASS, "mg/dL"), "triglyceride", "triglycerides", "tg");
        add(map, concept("NON_HDL", "Non-HDL Cholesterol", Category.LIPIDS, UnitFamily.LIPID_MASS, "mg/dL"), "non hdl", "non hdl cholesterol");

        add(map, concept("CREATININE", "Creatinine", Category.KIDNEY, UnitFamily.CREATININE_MASS, "mg/dL"), "creatinine", "serum creatinine", "s creatinine", "s creat", "creat");
        add(map, concept("EGFR", "eGFR", Category.KIDNEY, UnitFamily.OTHER, "mL/min/1.73m²"), "egfr", "estimated glomerular filtration rate", "glomerular filtration rate");
        add(map, concept("UREA", "Urea", Category.KIDNEY, UnitFamily.MASS_CONCENTRATION, "mg/dL"), "urea", "serum urea");
        add(map, concept("BUN", "Blood Urea Nitrogen", Category.KIDNEY, UnitFamily.MASS_CONCENTRATION, "mg/dL"), "bun", "blood urea nitrogen");
        add(map, concept("URIC_ACID", "Uric Acid", Category.KIDNEY, UnitFamily.MASS_CONCENTRATION, "mg/dL"), "uric acid", "serum uric acid");
        add(map, concept("MICROALBUMIN", "Urine Microalbumin", Category.KIDNEY, UnitFamily.MASS_CONCENTRATION, null), "microalbumin", "urine microalbumin", "urinary microalbumin", "micro albumin");
        add(map, concept("ACR", "Urine Albumin/Creatinine Ratio", Category.KIDNEY, UnitFamily.OTHER, null), "acr", "albumin creatinine ratio", "urine albumin creatinine ratio");
        add(map, concept("SODIUM", "Sodium", Category.KIDNEY, UnitFamily.CONCENTRATION_MMOL, "mmol/L"), "sodium", "na", "serum sodium");
        add(map, concept("POTASSIUM", "Potassium", Category.KIDNEY, UnitFamily.CONCENTRATION_MMOL, "mmol/L"), "potassium", "k", "serum potassium");
        add(map, concept("CHLORIDE", "Chloride", Category.KIDNEY, UnitFamily.CONCENTRATION_MMOL, "mmol/L"), "chloride", "cl", "serum chloride");

        add(map, concept("ALT", "ALT", Category.LIVER, UnitFamily.ENZYME, "U/L"), "alt", "sgpt", "alanine aminotransferase", "alanine transaminase");
        add(map, concept("AST", "AST", Category.LIVER, UnitFamily.ENZYME, "U/L"), "ast", "sgot", "aspartate aminotransferase", "aspartate transaminase");
        add(map, concept("ALP", "Alkaline Phosphatase", Category.LIVER, UnitFamily.ENZYME, "U/L"), "alp", "alkaline phosphatase");
        add(map, concept("GGT", "GGT", Category.LIVER, UnitFamily.ENZYME, "U/L"), "ggt", "gamma glutamyl transferase", "gamma gt");
        add(map, concept("BILIRUBIN_TOTAL", "Total Bilirubin", Category.LIVER, UnitFamily.MASS_CONCENTRATION, "mg/dL"), "total bilirubin", "bilirubin total", "t bilirubin");
        add(map, concept("BILIRUBIN_DIRECT", "Direct Bilirubin", Category.LIVER, UnitFamily.MASS_CONCENTRATION, "mg/dL"), "direct bilirubin", "bilirubin direct", "d bilirubin");
        add(map, concept("ALBUMIN", "Albumin", Category.LIVER, UnitFamily.MASS_CONCENTRATION, "g/dL"), "albumin", "serum albumin");
        add(map, concept("TOTAL_PROTEIN", "Total Protein", Category.LIVER, UnitFamily.MASS_CONCENTRATION, "g/dL"), "total protein", "serum total protein", "protein total");

        add(map, concept("TSH", "TSH", Category.THYROID, UnitFamily.HORMONE, null), "tsh", "thyroid stimulating hormone", "thyrotropin");
        add(map, concept("FREE_T4", "Free T4", Category.THYROID, UnitFamily.HORMONE, null), "free t4", "ft4", "free thyroxine");
        add(map, concept("TOTAL_T4", "Total T4", Category.THYROID, UnitFamily.HORMONE, null), "t4", "total t4", "thyroxine");
        add(map, concept("FREE_T3", "Free T3", Category.THYROID, UnitFamily.HORMONE, null), "free t3", "ft3", "free triiodothyronine");
        add(map, concept("TOTAL_T3", "Total T3", Category.THYROID, UnitFamily.HORMONE, null), "t3", "total t3", "triiodothyronine");

        add(map, concept("ESR", "ESR", Category.INFLAMMATION, UnitFamily.OTHER, "mm/hr"), "esr", "erythrocyte sedimentation rate");
        add(map, concept("CRP", "C-Reactive Protein", Category.INFLAMMATION, UnitFamily.MASS_CONCENTRATION, null), "crp", "c reactive protein", "c reactive protein crp");
        add(map, concept("HS_CRP", "High-Sensitivity CRP", Category.INFLAMMATION, UnitFamily.MASS_CONCENTRATION, null), "hs crp", "high sensitivity crp", "high sensitivity c reactive protein");

        add(map, concept("FERRITIN", "Ferritin", Category.NUTRITION, UnitFamily.OTHER, null), "ferritin", "serum ferritin");
        add(map, concept("IRON", "Iron", Category.NUTRITION, UnitFamily.OTHER, null), "iron", "serum iron");
        add(map, concept("TIBC", "TIBC", Category.NUTRITION, UnitFamily.OTHER, null), "tibc", "total iron binding capacity");
        add(map, concept("TRANSFERRIN_SATURATION", "Transferrin Saturation", Category.NUTRITION, UnitFamily.PERCENT, "%"), "transferrin saturation", "iron saturation");
        add(map, concept("VITAMIN_D", "Vitamin D", Category.NUTRITION, UnitFamily.OTHER, null), "vitamin d", "25 oh vitamin d", "25 hydroxy vitamin d", "25oh vitamin d");
        add(map, concept("VITAMIN_B12", "Vitamin B12", Category.NUTRITION, UnitFamily.OTHER, null), "vitamin b12", "b12", "cobalamin");
        add(map, concept("FOLATE", "Folate", Category.NUTRITION, UnitFamily.OTHER, null), "folate", "folic acid");

        add(map, concept("DENGUE_NS1", "Dengue NS1 Antigen", Category.INFECTIOUS, UnitFamily.OTHER, null), "dengue ns1", "ns1 antigen", "dengue ns1 antigen", "ns1 antigen elisa");
        add(map, concept("DENGUE_IGM", "Dengue IgM", Category.INFECTIOUS, UnitFamily.OTHER, null), "dengue igm", "dengue igm antibody", "igm dengue");
        add(map, concept("DENGUE_IGG", "Dengue IgG", Category.INFECTIOUS, UnitFamily.OTHER, null), "dengue igg", "dengue igg antibody", "igg dengue");

        return Map.copyOf(map);
    }

    private static void addDifferential(Map<String, Concept> map, String code, String displayName, String... aliases) {
        add(map, concept(code, displayName, Category.HEMATOLOGY, UnitFamily.PERCENT, "%"), aliases);
    }

    private static Concept concept(String code, String displayName, Category category, UnitFamily family, String preferredUnit) {
        return new Concept(code, displayName, category, family, preferredUnit);
    }

    private static void add(Map<String, Concept> map, Concept concept, String... aliases) {
        for (String alias : aliases) {
            map.put(normalizeLabel(alias), concept);
        }
    }

    private static String slug(String value) {
        String slug = value == null ? "UNCLASSIFIED" : value.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
        slug = slug.replaceAll("^_+|_+$", "");
        if (slug.isBlank()) return "UNCLASSIFIED";
        return slug.length() > 72 ? slug.substring(0, 72) : slug;
    }

    private static String humanize(String effectiveLabel, String normalizedLabel) {
        String value = effectiveLabel == null || effectiveLabel.isBlank() ? normalizedLabel : effectiveLabel;
        if (value == null || value.isBlank()) return "Unclassified measurement";
        return value.trim().replaceAll("(?i)\\s+(?:test\\s*name|result)$", "").trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
