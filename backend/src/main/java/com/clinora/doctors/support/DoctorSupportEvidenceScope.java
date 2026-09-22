package com.clinora.doctors.support;

import java.util.List;
import java.util.UUID;

/** Explicitly describes which appointment-authorized evidence a Doctor request targets. */
public enum DoctorSupportEvidenceScope {
    APPOINTMENT_AUTHORIZED,
    CURRENT_REPORT,
    SELECTED_REPORTS,
    SELECTED_OBSERVATIONS;

    public static DoctorSupportEvidenceScope resolve(
        UUID currentReportId,
        List<UUID> selectedReportIds,
        List<UUID> selectedObservationIds
    ) {
        if (selectedObservationIds != null && !selectedObservationIds.isEmpty()) return SELECTED_OBSERVATIONS;
        if (selectedReportIds != null && !selectedReportIds.isEmpty()) return SELECTED_REPORTS;
        if (currentReportId != null) return CURRENT_REPORT;
        return APPOINTMENT_AUTHORIZED;
    }
}
