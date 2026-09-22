package com.clinora.doctors.support;

import java.util.List;

public record DoctorSupportRoutingDecision(
    DoctorSupportRoutingStatus status,
    List<DoctorSupportTask> taskIds,
    ReferencedContext referencedContext,
    List<ClarificationOption> clarificationOptions,
    DoctorSupportClarificationReason clarificationReason,
    List<DoctorSupportRequiredContext> missingRequiredContext
) {
    public DoctorSupportRoutingDecision {
        taskIds = List.copyOf(taskIds);
        clarificationOptions = List.copyOf(clarificationOptions);
        missingRequiredContext = List.copyOf(missingRequiredContext);
    }

    public record ReferencedContext(
        DoctorSupportScreen currentScreen,
        String currentReportType,
        int authorizedReportCount,
        int authorizedObservationCount,
        boolean doctorAssessmentPresent,
        boolean doctorNotesPresent,
        boolean comparableAuthorizedReportsAvailable,
        DoctorSupportSelectionType selectionType
    ) {}

    public record ClarificationOption(DoctorSupportTask taskId, String label, String shortDescription) {}
}
