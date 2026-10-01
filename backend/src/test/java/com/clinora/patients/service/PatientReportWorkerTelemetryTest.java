package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.clinora.ai.client.MedGemmaClient;
import com.clinora.ai.service.PatientReportAiAnalysisService;
import com.clinora.ai.service.PatientReportAiAnalysisWorker;
import com.clinora.ocr.client.OcrClient;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

class PatientReportWorkerTelemetryTest {
    @Test
    void ocrRecordsStagesWithoutSourceOrExceptionContent() {
        var service = mock(PatientReportExtractionService.class);
        var client = mock(OcrClient.class);
        UUID id = UUID.randomUUID();
        var work = new PatientReportExtractionService.WorkItem(id, UUID.randomUUID(), UUID.randomUUID(),
            "private-object", "private-patient.pdf", "application/pdf", "INITIAL", null, 125L);
        when(service.claim(id)).thenReturn(work);
        when(service.source(work)).thenThrow(new IllegalStateException("private report contents"));
        Logger logger = (Logger) LoggerFactory.getLogger(PatientReportExtractionWorker.class);
        var appender = new ListAppender<ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        try {
            new PatientReportExtractionWorker(service, client).process(id.toString());
            verify(service).fail(work, "PROCESSING_FAILED");
            verifyNoInteractions(client);
            String logs = appender.list.stream().map(ILoggingEvent::getFormattedMessage)
                .reduce("", (a, b) -> a + b);
            assertFalse(logs.contains("private"));
            assertTrue(logs.contains("request_id=" + id));
            assertTrue(logs.contains("queue_wait_ms=125"));
            assertTrue(logs.contains("source_load_ms="));
            assertTrue(logs.contains("persistence_ms="));
            assertTrue(logs.contains("total_ms="));
            assertTrue(logs.contains("outcome=failed"));
        } finally {
            logger.detachAppender(appender);
        }
    }

    @Test
    void aiKeepsOneCallAndPersistsTheIdenticalResponse() {
        var service = mock(PatientReportAiAnalysisService.class);
        var client = mock(MedGemmaClient.class);
        UUID id = UUID.randomUUID();
        var work = new PatientReportAiAnalysisService.WorkItem(id, UUID.randomUUID(), UUID.randomUUID(),
            UUID.randomUUID(), null, "model", "revision", "prompt", "schema", 50L);
        var response = mock(MedGemmaClient.ReportAnalysisResponse.class);
        when(service.claim(id)).thenReturn(work);
        when(client.analyze(id, null)).thenReturn(response);
        Logger logger = (Logger) LoggerFactory.getLogger(PatientReportAiAnalysisWorker.class);
        var appender = new ListAppender<ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        try {
            new PatientReportAiAnalysisWorker(service, client).process(id.toString());
            verify(client, times(1)).analyze(id, null);
            verify(service).complete(work, response);
            verify(service, never()).fail(any(), any());
            String logs = appender.list.stream().map(ILoggingEvent::getFormattedMessage)
                .reduce("", (a, b) -> a + b);
            assertTrue(logs.contains("queue_wait_ms=50"));
            assertTrue(logs.contains("ai_request_ms="));
            assertTrue(logs.contains("persistence_ms="));
            assertTrue(logs.contains("outcome=completed"));
        } finally {
            logger.detachAppender(appender);
        }
    }
}
