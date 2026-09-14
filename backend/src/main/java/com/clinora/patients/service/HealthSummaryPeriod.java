package com.clinora.patients.service;

import com.clinora.patients.api.PatientApiException;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;

public record HealthSummaryPeriod(String preset, LocalDate from, LocalDate to, String label) {
    public static final String LAST_3_MONTHS = "LAST_3_MONTHS";
    public static final String LAST_6_MONTHS = "LAST_6_MONTHS";
    public static final String LAST_12_MONTHS = "LAST_12_MONTHS";
    public static final String ALL_HISTORY = "ALL_HISTORY";
    public static final String CUSTOM = "CUSTOM";

    public static HealthSummaryPeriod resolve(String requestedPreset, LocalDate customFrom, LocalDate customTo, Clock clock) {
        LocalDate today = LocalDate.now(clock);
        String preset = requestedPreset == null || requestedPreset.isBlank() ? LAST_12_MONTHS : requestedPreset.trim().toUpperCase();
        return switch (preset) {
            case LAST_3_MONTHS -> new HealthSummaryPeriod(preset, today.minusMonths(3), today, "Last 3 months");
            case LAST_6_MONTHS -> new HealthSummaryPeriod(preset, today.minusMonths(6), today, "Last 6 months");
            case LAST_12_MONTHS -> new HealthSummaryPeriod(preset, today.minusMonths(12), today, "Last 12 months");
            case ALL_HISTORY -> new HealthSummaryPeriod(preset, null, today, "All available history");
            case CUSTOM -> custom(customFrom, customTo, today);
            default -> throw new PatientApiException(
                HttpStatus.BAD_REQUEST,
                "HEALTH_SUMMARY_PERIOD_INVALID",
                "Choose a valid health summary period."
            );
        };
    }

    private static HealthSummaryPeriod custom(LocalDate from, LocalDate to, LocalDate today) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new PatientApiException(
                HttpStatus.BAD_REQUEST,
                "HEALTH_SUMMARY_CUSTOM_PERIOD_INVALID",
                "Choose a valid start and end date for the health summary."
            );
        }
        if (to.isAfter(today)) {
            throw new PatientApiException(
                HttpStatus.BAD_REQUEST,
                "HEALTH_SUMMARY_FUTURE_PERIOD_INVALID",
                "The health summary end date cannot be in the future."
            );
        }
        if (from.isBefore(today.minusYears(20))) {
            throw new PatientApiException(
                HttpStatus.BAD_REQUEST,
                "HEALTH_SUMMARY_PERIOD_TOO_LARGE",
                "Choose a health summary period of 20 years or less."
            );
        }
        return new HealthSummaryPeriod(CUSTOM, from, to, "Custom period");
    }
}
