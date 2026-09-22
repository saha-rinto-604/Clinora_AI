package com.clinora.doctors.support;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record DoctorSupportExecutionRequest(
    @NotEmpty @Size(max = 4) List<DoctorSupportTask> taskIds,
    @NotBlank @Size(max = 4000) String originalQuestion,
    UUID currentReportId,
    @Size(max = 20) List<UUID> selectedReportIds,
    @Size(max = 250) List<UUID> selectedObservationIds,
    @Size(max = 4000) String doctorAssessment,
    @Size(max = 8000) String doctorNotes,
    @Size(max = 100) String clientExecutionKey
) {
    public DoctorSupportExecutionRequest {
        taskIds = taskIds == null ? List.of() : List.copyOf(taskIds);
        selectedReportIds = selectedReportIds == null ? List.of() : List.copyOf(selectedReportIds);
        selectedObservationIds = selectedObservationIds == null ? List.of() : List.copyOf(selectedObservationIds);
    }

    public DoctorSupportExecutionRequest(
        List<DoctorSupportTask> taskIds, String originalQuestion, UUID currentReportId,
        List<UUID> selectedReportIds, List<UUID> selectedObservationIds,
        String doctorAssessment, String clientExecutionKey
    ) {
        this(taskIds, originalQuestion, currentReportId, selectedReportIds, selectedObservationIds,
            doctorAssessment, null, clientExecutionKey);
    }
}
