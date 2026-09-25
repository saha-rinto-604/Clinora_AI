package com.clinora.patients.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.service.PatientResearchConsentService;
import com.clinora.research.service.PatientResearchConsentService.PatientResearchConsentDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient/privacy/research-consent")
@PreAuthorize("hasRole('PATIENT')")
public class PatientResearchConsentController {

    private final PatientResearchConsentService consentService;

    public PatientResearchConsentController(PatientResearchConsentService consentService) {
        this.consentService = consentService;
    }

    @GetMapping
    public ApiResponse<PatientResearchConsentDto> getConsent(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ApiResponse.success("Patient research consent status.", consentService.getConsent(userId));
    }

    @PostMapping
    public ApiResponse<PatientResearchConsentDto> updateConsent(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateConsentRequest request,
            HttpServletRequest http
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());
        PatientResearchConsentDto updated = consentService.updateConsent(
                userId,
                request.consented(),
                http.getRemoteAddr(),
                http.getHeader(HttpHeaders.USER_AGENT)
        );
        String msg = request.consented()
                ? "Research consent granted. Thank you for contributing to clinical research."
                : "Research consent revoked. Your records will be excluded from future research datasets.";
        return ApiResponse.success(msg, updated);
    }

    public record UpdateConsentRequest(
            @NotNull(message = "consented boolean field is required")
            Boolean consented
    ) {}
}
