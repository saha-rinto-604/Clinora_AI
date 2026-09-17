package com.clinora.doctors.support;

public interface DoctorQueryInterpreter {
    Interpretation interpret(String message, DoctorSupportContext context);

    record Interpretation(
        DoctorClinicalQueryFrame frame,
        String promptVersion,
        String schemaVersion,
        String finishReason,
        Integer promptTokens,
        Integer completionTokens,
        long durationMs
    ) {}
}
