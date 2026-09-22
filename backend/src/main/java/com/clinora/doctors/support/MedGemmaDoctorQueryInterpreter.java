package com.clinora.doctors.support;

import com.clinora.ai.client.MedGemmaClient;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class MedGemmaDoctorQueryInterpreter implements DoctorQueryInterpreter {
    private final MedGemmaClient client;
    private final ObjectMapper objectMapper;

    public MedGemmaDoctorQueryInterpreter(MedGemmaClient client, ObjectMapper objectMapper) {
        this.client = client;
        this.objectMapper = objectMapper;
    }

    @Override
    public Interpretation interpret(String message, DoctorSupportContext context) {
        MedGemmaClient.DoctorQueryInterpretationResponse response = client.interpretDoctorQuery(
            new MedGemmaClient.DoctorQueryInterpretationRequest(
                UUID.randomUUID(),
                message,
                new MedGemmaClient.DoctorQueryMinimalContext(
                    "APPOINTMENT_CARE_CONTEXT",
                    context.currentScreen().name(),
                    context.currentReportType(),
                    context.authorizedReportIds().size(),
                    context.authorizedObservationIds().size(),
                    context.doctorAssessmentPresent(),
                    context.doctorNotesPresent(),
                    context.comparableAuthorizedReportsAvailable(),
                    context.selectionType().name()
                )
            )
        );
        try {
            DoctorClinicalQueryFrame frame = objectMapper.treeToValue(
                response.frame(), DoctorClinicalQueryFrame.class
            );
            return new Interpretation(
                frame,
                response.promptVersion(),
                response.schemaVersion(),
                response.finishReason(),
                response.promptTokens(),
                response.completionTokens(),
                response.durationMs()
            );
        } catch (JsonProcessingException | IllegalArgumentException exception) {
            throw new IllegalArgumentException("AI service returned an invalid Doctor query frame.", exception);
        }
    }
}
