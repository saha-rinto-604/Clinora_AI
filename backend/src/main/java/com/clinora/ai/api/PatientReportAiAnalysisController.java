package com.clinora.ai.api;

import com.clinora.ai.service.PatientReportAiAnalysisService;
import com.clinora.ai.service.PatientReportAiAnalysisService.AnalysisView;
import com.clinora.common.api.ApiResponse;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/patient/reports/{reportId}/ai-analysis")
@PreAuthorize("hasRole('PATIENT')")
public class PatientReportAiAnalysisController {

    private final PatientReportAiAnalysisService analysis;

    public PatientReportAiAnalysisController(PatientReportAiAnalysisService analysis) {
        this.analysis = analysis;
    }

    @GetMapping
    public ApiResponse<AnalysisView> view(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId
    ) {
        return ApiResponse.success(
            "AI report insight loaded.",
            analysis.view(userId(jwt), reportId)
        );
    }

    @PostMapping
    public ApiResponse<AnalysisView> request(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId
    ) {
        return ApiResponse.success(
            "AI report insight queued.",
            analysis.request(userId(jwt), reportId)
        );
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
