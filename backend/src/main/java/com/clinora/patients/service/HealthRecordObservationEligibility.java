package com.clinora.patients.service;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Conservative gate for observations that may participate in the Patient's
 * longitudinal Health Record. The extraction record itself is never deleted or
 * rewritten here; questionable rows remain available in report review.
 */
final class HealthRecordObservationEligibility {
    private static final Pattern ADDRESS_OR_CONTACT = Pattern.compile(
        "\\b(address|road|rd|street|st|avenue|ave|lane|ln|dhaka|shahbagh|secretariat|phone|mobile|tel|email|e-mail|location)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern ADMINISTRATIVE = Pattern.compile(
        "\\b(track|tracking|barcode|accession|lab\\s*(?:no|number|id)|patient\\s*(?:id|name|no|number)|sample\\s*(?:id|no|number)|receipt|invoice|registration|date\\s*of\\s*birth|birth\\s*date|dob|age|sex|gender|doctor|physician)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DATE_METADATA = Pattern.compile(
        "\\b(collection|collected|specimen|report|reported|issued|received|printed|upload(?:ed)?)\\s*(?:date|time)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern NON_RESULT_HEADING = Pattern.compile(
        "^(?:test\\s*name|result|results|investigation|investigations|reference\\s*range|normal\\s*range|unit|units|method|remarks?|profile)$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern CONTAMINATED_RAW_VALUE = Pattern.compile(
        "(?:\\b(?:male|female|adult|child|year|years|month|months)\\b.*[-–—:]\\s*[+-]?\\d)|(?:[+-]?\\d+(?:\\.\\d+)?\\s*[-–—]\\s*[+-]?\\d+(?:\\.\\d+)?)",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DATE_LIKE_VALUE = Pattern.compile(
        "^\\s*(?:\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2})(?:\\s+\\d{1,2}:\\d{2}(?::\\d{2})?)?\\s*$"
    );
    private static final Set<String> ALLOWED_VALUE_TYPES = Set.of("NUMERIC", "TEXT", "QUALITATIVE");

    private HealthRecordObservationEligibility() {
    }

    static Decision evaluate(Candidate candidate, HealthRecordLabTaxonomy.Concept concept) {
        if (candidate == null) return Decision.reject("OBSERVATION_MISSING");
        if (candidate.reviewRequired()) return Decision.reject("OBSERVATION_REVIEW_REQUIRED");
        if (!ALLOWED_VALUE_TYPES.contains(blank(candidate.valueType()).toUpperCase(Locale.ROOT))) {
            return Decision.reject("VALUE_TYPE_UNSUPPORTED");
        }

        String label = normalizeText(firstNonBlank(candidate.effectiveLabel(), candidate.normalizedLabel(), candidate.sourceLabel()));
        if (label.isBlank()) return Decision.reject("LABEL_MISSING");
        if (label.length() > 160) return Decision.reject("LABEL_TOO_LONG");
        if (NON_RESULT_HEADING.matcher(label).matches()) return Decision.reject("REPORT_HEADING");
        if (ADMINISTRATIVE.matcher(label).find()) return Decision.reject("ADMINISTRATIVE_METADATA");
        if (DATE_METADATA.matcher(label).find()) return Decision.reject("DATE_METADATA");
        if (ADDRESS_OR_CONTACT.matcher(label).find()) return Decision.reject("ADDRESS_OR_CONTACT_METADATA");

        String rawValue = blank(candidate.rawValue());
        String textValue = blank(candidate.textValue());
        String combinedValue = !rawValue.isBlank() ? rawValue : textValue;
        if (!combinedValue.isBlank() && DATE_LIKE_VALUE.matcher(combinedValue).matches()) {
            return Decision.reject("DATE_VALUE_METADATA");
        }
        if (!combinedValue.isBlank() && CONTAMINATED_RAW_VALUE.matcher(combinedValue).find()) {
            return Decision.reject("VALUE_RANGE_CONTAMINATED");
        }

        if ("NUMERIC".equalsIgnoreCase(candidate.valueType())) {
            if (candidate.numericValue() == null) return Decision.reject("NUMERIC_VALUE_MISSING");
            if (!label.matches(".*[a-z].*[a-z].*")) return Decision.reject("LABEL_NOT_CLINICAL");
            if (!validReferenceBounds(candidate.referenceLow(), candidate.referenceHigh())) {
                return Decision.reject("REFERENCE_RANGE_INVALID");
            }
            return Decision.allow();
        }

        if (textValue.isBlank()) return Decision.reject("TEXT_VALUE_MISSING");
        if (textValue.length() > 180) return Decision.reject("TEXT_VALUE_TOO_LONG");

        // Unknown free-text rows are too risky for a longitudinal medical record.
        // Qualitative/text observations are accepted only when the taxonomy knows
        // the concept or the label clearly looks like a clinical assay.
        if (concept != null && concept.category() != HealthRecordLabTaxonomy.Category.OTHER) {
            return Decision.allow();
        }
        if (looksLikeClinicalAssay(label)) return Decision.allow();
        return Decision.reject("UNCLASSIFIED_TEXT_NOT_CLINICAL");
    }

    static boolean validReferenceBounds(BigDecimal low, BigDecimal high) {
        return low == null || high == null || low.compareTo(high) <= 0;
    }

    private static boolean looksLikeClinicalAssay(String label) {
        return label.matches(".*\\b(antigen|antibody|igg|igm|iga|reactive|serology|culture|pcr|screen|assay|test)\\b.*");
    }

    private static String normalizeText(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFKC)
            .replaceAll("\\s+", " ")
            .trim()
            .toLowerCase(Locale.ROOT);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }

    private static String blank(String value) {
        return value == null ? "" : value.trim();
    }

    record Candidate(
        String sourceLabel,
        String normalizedLabel,
        String effectiveLabel,
        String valueType,
        BigDecimal numericValue,
        String textValue,
        String rawValue,
        BigDecimal referenceLow,
        BigDecimal referenceHigh,
        boolean reviewRequired
    ) {
    }

    record Decision(boolean eligible, String reason) {
        static Decision allow() {
            return new Decision(true, null);
        }

        static Decision reject(String reason) {
            return new Decision(false, reason);
        }
    }
}
