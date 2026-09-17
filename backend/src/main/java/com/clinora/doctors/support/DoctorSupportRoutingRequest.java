package com.clinora.doctors.support;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record DoctorSupportRoutingRequest(
    @NotBlank @Size(max = 4000) String message,
    DoctorSupportTask explicitTaskId,
    DoctorSupportScreen currentScreen,
    UUID currentReportId,
    @Size(max = 20) List<UUID> selectedReportIds,
    @Size(max = 250) List<UUID> selectedObservationIds,
    boolean doctorAssessmentPresent,
    boolean doctorNotesPresent
) {
    public DoctorSupportRoutingRequest {
        selectedReportIds = selectedReportIds == null ? List.of() : List.copyOf(selectedReportIds);
        selectedObservationIds = selectedObservationIds == null ? List.of() : List.copyOf(selectedObservationIds);
        currentScreen = currentScreen == null ? DoctorSupportScreen.UNKNOWN : currentScreen;
    }
}
