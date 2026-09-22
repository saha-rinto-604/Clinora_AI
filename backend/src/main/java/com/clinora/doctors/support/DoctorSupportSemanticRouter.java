package com.clinora.doctors.support;

import java.util.List;

public interface DoctorSupportSemanticRouter {
    SemanticDecision route(String doctorMessage, DoctorSupportContext context, List<DoctorSupportTaskSpec> catalog);

    record SemanticDecision(
        DoctorSupportRoutingStatus status,
        List<String> taskIds,
        List<String> clarificationOptionTaskIds
    ) {
        public SemanticDecision {
            taskIds = taskIds == null ? List.of() : List.copyOf(taskIds);
            clarificationOptionTaskIds = clarificationOptionTaskIds == null
                ? List.of()
                : List.copyOf(clarificationOptionTaskIds);
        }
    }
}
