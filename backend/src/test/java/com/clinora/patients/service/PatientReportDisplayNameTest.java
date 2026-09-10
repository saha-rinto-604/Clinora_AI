package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class PatientReportDisplayNameTest {
    @Test
    void keepsRecognizablePatientTitle() {
        assertEquals(
            "Dengue follow-up",
            PatientReportDisplayName.resolve(
                "Dengue follow-up",
                "Screenshot 2026-09-07.png",
                "LAB_RESULTS",
                LocalDate.of(2026, 9, 7),
                "City Lab"
            )
        );
    }

    @Test
    void replacesHashAndScreenshotWithMedicalContext() {
        assertEquals(
            "Laboratory results · 7 Sep 2026",
            PatientReportDisplayName.resolve(
                "33806e7015fbfcaf33806e7015fbfcaf",
                "Screenshot 2026 09 07 113913.png",
                "LAB_RESULTS",
                LocalDate.of(2026, 9, 7),
                "City Lab"
            )
        );
    }

    @Test
    void usesReadableOriginalFilenameBeforeBroadCategory() {
        assertEquals(
            "annual blood panel",
            PatientReportDisplayName.resolve(
                "22222222-2222-2222-2222-222222222222",
                "annual_blood-panel.pdf",
                "LAB_RESULTS",
                null,
                null
            )
        );
    }

    @Test
    void distinguishesTechnicalCaptureNames() {
        assertFalse(PatientReportDisplayName.isRecognizable("Screenshot 2026 09 07 113913"));
        assertFalse(PatientReportDisplayName.isRecognizable("22222222-2222-2222-2222-222222222222"));
        assertFalse(PatientReportDisplayName.isRecognizable("WhatsApp Image 20260907 113913"));
        assertFalse(PatientReportDisplayName.isRecognizable("20260907_113913"));
        assertTrue(PatientReportDisplayName.isRecognizable("Thyroid follow-up"));
    }
}
