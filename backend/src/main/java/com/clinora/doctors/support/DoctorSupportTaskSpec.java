package com.clinora.doctors.support;

import java.util.List;
import java.util.Set;

public record DoctorSupportTaskSpec(
    DoctorSupportTask taskId,
    String purpose,
    String routingDescription,
    List<String> exampleUtterances,
    Set<DoctorSupportRequiredContext> requiredContext,
    boolean multipleInstancesAllowed,
    String label,
    String shortDescription,
    boolean executable,
    String promptVersion,
    String responseSchemaVersion,
    DoctorSupportRagPolicy ragPolicy
) {
    public DoctorSupportTaskSpec {
        exampleUtterances = List.copyOf(exampleUtterances);
        requiredContext = Set.copyOf(requiredContext);
    }
}
