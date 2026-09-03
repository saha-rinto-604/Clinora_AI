package com.clinora.patients.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.patients.service.PatientReportExtractionService;
import com.clinora.patients.service.PatientReportExtractionService.CorrectionCommand;
import com.clinora.patients.service.PatientReportExtractionService.ExtractionView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/patient/reports/{reportId}/extraction")
@PreAuthorize("hasRole('PATIENT')")
public class PatientReportExtractionController {

    private final PatientReportExtractionService extraction;

    public PatientReportExtractionController(PatientReportExtractionService extraction) {
        this.extraction = extraction;
    }

    @PostMapping
    public ApiResponse<ExtractionView> request(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId
    ) {
        return ApiResponse.success(
            "Report data extraction queued.",
            extraction.request(userId(jwt), reportId)
        );
    }

    @GetMapping
    public ApiResponse<ExtractionView> view(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId
    ) {
        return ApiResponse.success(
            "Report extraction loaded.",
            extraction.view(userId(jwt), reportId)
        );
    }

    @PatchMapping("/observations/{observationId}")
    public ApiResponse<ExtractionView> correct(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId,
        @PathVariable UUID observationId,
        @Valid @RequestBody CorrectionRequest body
    ) {
        return ApiResponse.success(
            "Extracted value corrected.",
            extraction.correct(userId(jwt), reportId, observationId, body.toCommand())
        );
    }

    @PostMapping("/observations/{observationId}/confirm")
    public ApiResponse<ExtractionView> confirmObservation(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId,
        @PathVariable UUID observationId
    ) {
        return ApiResponse.success(
            "Extracted value confirmed.",
            extraction.confirmObservation(userId(jwt), reportId, observationId)
        );
    }

    @PostMapping("/confirm")
    public ApiResponse<ExtractionView> confirm(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId
    ) {
        return ApiResponse.success(
            "Extracted report data confirmed.",
            extraction.confirm(userId(jwt), reportId)
        );
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    public record CorrectionRequest(
        @Size(min = 1, max = 160) String label,
        @Size(min = 4, max = 12) String valueType,
        BigDecimal numericValue,
        @Size(max = 400) String textValue,
        @Size(max = 8) String comparator,
        @Size(max = 80) String unit,
        @Size(max = 160) String referenceRangeRaw,
        BigDecimal referenceLow,
        BigDecimal referenceHigh,
        @Size(max = 40) String sourceFlag
    ) {
        CorrectionCommand toCommand() {
            return new CorrectionCommand(
                label,
                valueType,
                numericValue,
                textValue,
                comparator,
                unit,
                referenceRangeRaw,
                referenceLow,
                referenceHigh,
                sourceFlag
            );
        }
    }
}
