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

        WorkItem work = extraction.claim(jobId);
        if (work == null) return;
        try {
            SourceObject source = extraction.source(work);
            var response = ocr.extract(
                work.jobId(),
                source.bytes(),
                source.filename(),
                source.contentType()
            );
            extraction.complete(work, response);
        } catch (Exception exception) {
            log.warn("Patient report extraction failed for job {}: {}", jobId, exception.getClass().getSimpleName());
            extraction.fail(work, failureCode(exception));
        }
    }

    private String failureCode(Exception exception) {
        String name = exception.getClass().getSimpleName().toUpperCase();
        if (name.contains("TIMEOUT")) return "OCR_TIMEOUT";
        if (name.contains("RESOURCEACCESS") || name.contains("CONNECT")) return "OCR_SERVICE_UNAVAILABLE";
        return "PROCESSING_FAILED";
    }
}
