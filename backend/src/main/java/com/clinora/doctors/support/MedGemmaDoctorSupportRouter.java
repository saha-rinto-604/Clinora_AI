package com.clinora.doctors.support;

import com.clinora.ai.client.MedGemmaClient;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class MedGemmaDoctorSupportRouter implements DoctorSupportSemanticRouter {
    private final MedGemmaClient client;

    public MedGemmaDoctorSupportRouter(MedGemmaClient client) {
        this.client = client;
    }

    @Override
    public SemanticDecision route(
        String doctorMessage,
        DoctorSupportContext context,
        List<DoctorSupportTaskSpec> catalog
    ) {
        MedGemmaClient.DoctorSupportRoutingResponse response = client.routeDoctorSupport(
            new MedGemmaClient.DoctorSupportRoutingRequest(
                UUID.randomUUID(),
                doctorMessage,
                new MedGemmaClient.DoctorSupportMinimalContext(
                    "APPOINTMENT_CARE_CONTEXT",
                    context.currentScreen().name(),
                    context.currentReportType(),
                    context.authorizedReportIds().size(),
                    context.authorizedObservationIds().size(),
                    context.doctorAssessmentPresent(),
                    context.doctorNotesPresent(),
                    context.comparableAuthorizedReportsAvailable(),
                    context.selectionType().name()
                ),
                catalog.stream()
                    .map(spec -> new MedGemmaClient.DoctorSupportTaskCatalogEntry(
                        spec.taskId().name(),
                        spec.purpose(),
                        spec.routingDescription(),
                        spec.exampleUtterances()
                    ))
                    .toList()
            )
        );
        return new SemanticDecision(
            DoctorSupportRoutingStatus.valueOf(response.status()),
            response.taskIds(),
            response.clarificationOptionTaskIds()
        );
    }
}
