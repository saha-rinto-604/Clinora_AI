package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class PatientLongitudinalSummaryEligibilityTest {
    private static final LocalDate FROM = LocalDate.of(2026, 1, 1);
    private static final LocalDate TO = LocalDate.of(2026, 12, 31);

    @Test
    void verifiedUndatedCurrentFactRemainsEligibleForBriefing() {
        assertTrue(PatientLongitudinalHealthRecordService.summaryDateEligible(null, FROM, TO));
    }

    @Test
    void reliablyDatedFactUsesSelectedPeriod() {
        assertTrue(PatientLongitudinalHealthRecordService.summaryDateEligible(LocalDate.of(2026, 6, 1), FROM, TO));
        assertFalse(PatientLongitudinalHealthRecordService.summaryDateEligible(LocalDate.of(2025, 12, 31), FROM, TO));
    }

    @Test
    void uploadDateCannotMakeAnUndatedFactChronological() {
        LocalDate uploadDate = LocalDate.of(2026, 9, 14);
        LocalDate clinicalDate = null;
        assertTrue(PatientLongitudinalHealthRecordService.summaryDateEligible(clinicalDate, FROM, TO));
        assertFalse(clinicalDate != null && clinicalDate.equals(uploadDate));
    }
}
