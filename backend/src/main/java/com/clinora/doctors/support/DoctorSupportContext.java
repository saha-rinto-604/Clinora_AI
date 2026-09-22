package com.clinora.doctors.support;

import java.util.List;
import java.util.UUID;

public record DoctorSupportContext(
    UUID doctorId,
    UUID appointmentId,
    DoctorSupportScreen currentScreen,
    UUID currentReportId,
    String currentReportType,
    List<UUID> authorizedReportIds,
    List<UUID> authorizedObservationIds,
    boolean doctorAssessmentPresent,
    boolean doctorNotesPresent,
    boolean comparableAuthorizedReportsAvailable,
    DoctorSupportSelectionType selectionType
) {
    public DoctorSupportContext {
        authorizedReportIds = List.copyOf(authorizedReportIds);
        authorizedObservationIds = List.copyOf(authorizedObservationIds);
    }

    public boolean hasAuthorizedEvidence() {
        return !authorizedReportIds.isEmpty() || !authorizedObservationIds.isEmpty();
    }
}
