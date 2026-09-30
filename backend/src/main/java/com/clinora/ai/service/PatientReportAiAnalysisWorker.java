package com.clinora.ai.service;

import com.clinora.ai.client.MedGemmaClient;
import com.clinora.ai.service.PatientReportAiAnalysisService.WorkItem;
import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;
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

        long started = System.nanoTime();
        WorkItem work = analysis.claim(jobId);
        if (work == null) return;
        double inferenceMs = 0;
        double persistenceMs = 0;
        String outcome = "failed";
        try {
            com.clinora.ai.client.MedGemmaClient.ReportAnalysisResponse response;
            long stage = System.nanoTime();
            try {
                response = medGemma.analyze(work.jobId(), work.input());
            } finally {
                inferenceMs = elapsedMs(stage);
            }
            stage = System.nanoTime();
            try {
                analysis.complete(work, response);
                outcome = "completed";
            } finally {
                persistenceMs = elapsedMs(stage);
            }
        } catch (Exception exception) {
            LOGGER.warn(
                "Patient AI analysis failed for job {}: {}",
                jobId,
                exception.getClass().getSimpleName()
            );
            long failureStarted = System.nanoTime();
            try {
                analysis.fail(work, failureCode(exception));
            } finally {
                persistenceMs += elapsedMs(failureStarted);
            }
        } finally {
            double processingMs = elapsedMs(started);
            LOGGER.info("patient_ai_job_performance request_id={} queue_wait_ms={} ai_request_ms={} persistence_ms={} processing_ms={} total_ms={} outcome={}",
                jobId, work.queueWaitMs(), inferenceMs, persistenceMs, processingMs,
                work.queueWaitMs() == null ? null : work.queueWaitMs() + processingMs, outcome);
        }
    }

    private static double elapsedMs(long start) {
        return (System.nanoTime() - start) / 1_000_000.0;
    }

    private String failureCode(Exception exception) {
        if (exception instanceof ResourceAccessException) {
            Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
            for (Throwable cause = exception; cause != null && visited.add(cause); cause = cause.getCause()) {
                if (cause instanceof SocketTimeoutException || cause instanceof HttpTimeoutException) {
                    return "AI_TIMEOUT";
                }
            }
            return "AI_SERVICE_UNAVAILABLE";
        }
        if (exception instanceof RestClientResponseException responseException) {
            if (responseException.getStatusCode().value() == 504) return "AI_TIMEOUT";
            if (responseException.getStatusCode().value() == 503) return "AI_MODEL_UNAVAILABLE";
            if (responseException.getStatusCode().value() == 502) return "AI_RESPONSE_REJECTED";
            if (responseException.getStatusCode().value() == 401) return "AI_SERVICE_AUTH_FAILED";
        }
        String name = exception.getClass().getSimpleName().toUpperCase();
        if (name.contains("TIMEOUT")) return "AI_TIMEOUT";
        return "AI_PROCESSING_FAILED";
    }
}
