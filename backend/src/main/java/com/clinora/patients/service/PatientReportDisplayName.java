package com.clinora.patients.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.regex.Pattern;

public final class PatientReportDisplayName {
    private static final Pattern OPAQUE_HEX = Pattern.compile("^[0-9a-f]{24,}$", Pattern.CASE_INSENSITIVE);
    private static final Pattern CAPTURE_NAME = Pattern.compile(
        "^(?:(?:screen\\s*shot|screenshot|img|image|photo|pxl|scan|scanned|document|doc|report|file|medical\\s*report|whatsapp\\s+image|adobe\\s+scan|camscanner)[\\s_-]*(?:\\d|$).*|\\d{8,}(?:[\\s_-]\\d{4,})?)$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern GENERIC_NAME = Pattern.compile(
        "^(?:medical\\s*report|report|document|image|photo|scan|file)$",
        Pattern.CASE_INSENSITIVE
    );
    private static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH);

    private PatientReportDisplayName() {}

    public static String resolve(
        String reportName,
        String originalFilename,
        String reportType,
        LocalDate reportDate,
        String providerLaboratory
    ) {
        String stored = clean(reportName);
        if (isRecognizable(stored)) return stored;

        String filename = filenameStem(originalFilename);
        if (isRecognizable(filename)) return filename;

        String type = typeLabel(reportType);
        if (reportDate != null) return type + " · " + DISPLAY_DATE.format(reportDate);

        String provider = clean(providerLaboratory);
        if (provider != null) return type + " · " + provider;
        return type;
    }

    public static boolean isRecognizable(String value) {
        String cleaned = clean(value);
        if (cleaned == null) return false;
        String compact = cleaned.replaceAll("[\\s_-]", "");
        if (compact.length() >= 24 && OPAQUE_HEX.matcher(compact).matches()) return false;
        return !CAPTURE_NAME.matcher(cleaned).matches() && !GENERIC_NAME.matcher(cleaned).matches();
    }

    private static String filenameStem(String value) {
        String cleaned = clean(value);
        if (cleaned == null) return null;
        String normalized = cleaned.replace('\\', '/');
        String filename = normalized.substring(normalized.lastIndexOf('/') + 1);
        int extension = filename.lastIndexOf('.');
        if (extension > 0) filename = filename.substring(0, extension);
        filename = filename.replace('_', ' ').replace('-', ' ').replaceAll("\\s+", " ").trim();
        return filename.isEmpty() ? null : filename;
    }

    private static String typeLabel(String value) {
        if (value == null) return "Medical report";
        return switch (value.toUpperCase(Locale.ROOT)) {
            case "LAB_RESULTS" -> "Laboratory results";
            case "IMAGING" -> "Imaging";
            case "CARDIOLOGY" -> "Cardiology";
            case "PATHOLOGY" -> "Pathology";
            case "DISCHARGE_SUMMARY" -> "Discharge summary";
            case "OTHER" -> "Other medical report";
            default -> "Medical report";
        };
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim().replaceAll("\\s+", " ");
        return cleaned.isEmpty() ? null : cleaned;
    }
}
