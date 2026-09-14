package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.clinora.patients.api.PatientApiException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class HealthSummaryPeriodTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-09-14T08:00:00Z"), ZoneOffset.UTC);

    @Test
    void defaultsToLastTwelveMonths() {
        HealthSummaryPeriod period = HealthSummaryPeriod.resolve(null, null, null, CLOCK);

        assertEquals(HealthSummaryPeriod.LAST_12_MONTHS, period.preset());
        assertEquals(LocalDate.parse("2025-09-14"), period.from());
        assertEquals(LocalDate.parse("2026-09-14"), period.to());
    }

    @Test
    void allHistoryHasNoArtificialStartDate() {
        HealthSummaryPeriod period = HealthSummaryPeriod.resolve(HealthSummaryPeriod.ALL_HISTORY, null, null, CLOCK);

        assertNull(period.from());
        assertEquals(LocalDate.parse("2026-09-14"), period.to());
    }

    @Test
    void customRangeIsValidated() {
        assertThrows(
            PatientApiException.class,
            () -> HealthSummaryPeriod.resolve(
                HealthSummaryPeriod.CUSTOM,
                LocalDate.parse("2026-09-10"),
                LocalDate.parse("2026-09-01"),
                CLOCK
            )
        );
    }
}
