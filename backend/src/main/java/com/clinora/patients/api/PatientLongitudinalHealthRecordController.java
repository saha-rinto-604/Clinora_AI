package com.clinora.patients.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService;
import com.clinora.patients.service.GeminiHealthSummaryNarrativeService.ProviderReadiness;
import com.clinora.patients.service.PatientHealthSummaryPdfService;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService;
import com.clinora.patients.service.PatientLongitudinalHealthRecordService.LongitudinalHealthRecordView;
import com.clinora.patients.service.PatientPersonalHealthSummaryService;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.HealthSummaryRequest;
import com.clinora.patients.service.PatientPersonalHealthSummaryService.PersonalHealthSummaryView;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/patient/health-record")
@PreAuthorize("hasRole('PATIENT')")
public class PatientLongitudinalHealthRecordController {
    private final PatientLongitudinalHealthRecordService healthRecord;
    private final PatientPersonalHealthSummaryService healthSummary;
    private final PatientHealthSummaryPdfService pdf;
    private final GeminiHealthSummaryNarrativeService narrative;

    public PatientLongitudinalHealthRecordController(
        PatientLongitudinalHealthRecordService healthRecord,
        PatientPersonalHealthSummaryService healthSummary,
        PatientHealthSummaryPdfService pdf,
        GeminiHealthSummaryNarrativeService narrative
    ) {
        this.healthRecord = healthRecord;
        this.healthSummary = healthSummary;
        this.pdf = pdf;
        this.narrative = narrative;
    }

    @GetMapping("/labs")
    public ApiResponse<LongitudinalHealthRecordView> longitudinalLabRecord(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Longitudinal health record loaded.", healthRecord.record(userId(jwt)));
    }

    @GetMapping("/summary/provider")
    public ApiResponse<ProviderReadiness> summaryProvider() {
        return ApiResponse.success("Health summary provider status loaded.", narrative.readiness());
    }

    @PostMapping("/summary")
    public ApiResponse<PersonalHealthSummaryView> personalHealthSummary(
        @AuthenticationPrincipal Jwt jwt,
        @RequestBody(required = false) HealthSummaryRequest request
    ) {
        return ApiResponse.success("Personal health summary generated.", healthSummary.generate(userId(jwt), request));
    }

    @PostMapping(value = "/summary/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> personalHealthSummaryPdf(
        @AuthenticationPrincipal Jwt jwt,
        @RequestBody(required = false) HealthSummaryRequest request
    ) {
        byte[] content = pdf.render(userId(jwt), request);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename("clinora-personal-health-summary.pdf").build());
        headers.setCacheControl("private, no-store");
        headers.setContentLength(content.length);
        return ResponseEntity.ok().headers(headers).body(content);
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
