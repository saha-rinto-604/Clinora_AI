package com.clinora.patients.service;

import com.clinora.ocr.client.OcrClient;
import com.clinora.patients.service.PatientReportExtractionService.SourceObject;
import com.clinora.patients.service.PatientReportExtractionService.WorkItem;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class PatientReportExtractionWorker {

    private static final Logger log = LoggerFactory.getLogger(PatientReportExtractionWorker.class);

    private final PatientReportExtractionService extraction;
    private final OcrClient ocr;

    public PatientReportExtractionWorker(PatientReportExtractionService extraction, OcrClient ocr) {
        this.extraction = extraction;
        this.ocr = ocr;
    }

    @RabbitListener(queues = "${clinora.ocr.queue:clinora.patient-report-extraction}")
    public void process(String rawJobId) {
        UUID jobId;
        try {
            jobId = UUID.fromString(rawJobId);
        } catch (IllegalArgumentException exception) {
            log.warn("Ignoring invalid OCR job message.");
            return;
        }

        long started = System.nanoTime();
        WorkItem work = extraction.claim(jobId);
        if (work == null) return;
        double sourceLoadMs = 0;
        double ocrRequestMs = 0;
        double persistenceMs = 0;
        String outcome = "failed";
        try {
            SourceObject source;
            long stage = System.nanoTime();
            try {
                source = extraction.source(work);
            } finally {
                sourceLoadMs = elapsedMs(stage);
            }
            com.clinora.ocr.client.OcrClient.ExtractionResponse response;
            stage = System.nanoTime();
            try {
                response = ocr.extract(work.jobId(), source.bytes(), source.filename(), source.contentType());
            } finally {
                ocrRequestMs = elapsedMs(stage);
            }
            stage = System.nanoTime();
            try {
                extraction.complete(work, response);
                outcome = "INSUFFICIENT".equals(response.qualityState())
                    || response.warnings() != null && response.warnings().contains("EXTRACTION_QUALITY_INSUFFICIENT")
                    ? "quality_rejected" : "completed";
            } finally {
                persistenceMs = elapsedMs(stage);
            }
        } catch (Exception exception) {
            log.warn("Patient report extraction failed for job {}: {}", jobId, exception.getClass().getSimpleName());
            long failureStarted = System.nanoTime();
            try {
                extraction.fail(work, failureCode(exception));
            } finally {
                persistenceMs += elapsedMs(failureStarted);
            }
        } finally {
            double processingMs = elapsedMs(started);
            log.info("ocr_job_performance request_id={} queue_wait_ms={} source_load_ms={} ocr_request_ms={} persistence_ms={} processing_ms={} total_ms={} outcome={}",
                jobId, work.queueWaitMs(), sourceLoadMs, ocrRequestMs, persistenceMs, processingMs,
                work.queueWaitMs() == null ? null : work.queueWaitMs() + processingMs, outcome);
        }
    }

    private static double elapsedMs(long start) {
        return (System.nanoTime() - start) / 1_000_000.0;
    }

    private String failureCode(Exception exception) {
        String name = exception.getClass().getSimpleName().toUpperCase();
        if (name.contains("TIMEOUT")) return "OCR_TIMEOUT";
        if (name.contains("RESOURCEACCESS") || name.contains("CONNECT")) return "OCR_SERVICE_UNAVAILABLE";
        return "PROCESSING_FAILED";
    }
}
