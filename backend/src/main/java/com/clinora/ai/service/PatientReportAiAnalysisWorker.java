package com.clinora.ai.service;

import com.clinora.ai.client.MedGemmaClient;
import com.clinora.ai.service.PatientReportAiAnalysisService.WorkItem;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class PatientReportAiAnalysisWorker {

    private static final Logger LOGGER = LoggerFactory.getLogger(PatientReportAiAnalysisWorker.class);

    private final PatientReportAiAnalysisService analysis;
    private final MedGemmaClient medGemma;

    public PatientReportAiAnalysisWorker(PatientReportAiAnalysisService analysis, MedGemmaClient medGemma) {
        this.analysis = analysis;
        this.medGemma = medGemma;
    }

    @RabbitListener(queues = "${clinora.ai.queue:clinora.patient-report-ai-analysis}")
    public void process(String rawJobId) {
        UUID jobId;
        try {
            jobId = UUID.fromString(rawJobId);
        } catch (IllegalArgumentException exception) {
            LOGGER.warn("Ignoring invalid AI analysis job message.");
            return;
        }

        WorkItem work = analysis.claim(jobId);
        if (work == null) return;
        try {
            analysis.complete(work, medGemma.analyze(work.jobId(), work.input()));
        } catch (Exception exception) {
            LOGGER.warn(
                "Patient AI analysis failed for job {}: {}",
                jobId,
                exception.getClass().getSimpleName()
            );
            analysis.fail(work, failureCode(exception));
        }
    }

    private String failureCode(Exception exception) {
        if (exception instanceof ResourceAccessException) return "AI_SERVICE_UNAVAILABLE";
        if (exception instanceof RestClientResponseException responseException) {
            if (responseException.getStatusCode().value() == 503) return "AI_MODEL_UNAVAILABLE";
            if (responseException.getStatusCode().value() == 502) return "AI_RESPONSE_REJECTED";
            if (responseException.getStatusCode().value() == 401) return "AI_SERVICE_AUTH_FAILED";
        }
        String name = exception.getClass().getSimpleName().toUpperCase();
        if (name.contains("TIMEOUT")) return "AI_TIMEOUT";
        return "AI_PROCESSING_FAILED";
    }
}
