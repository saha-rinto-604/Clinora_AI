package com.clinora.patients.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.patients.service.PatientPortalSummaryService;
import com.clinora.patients.service.PatientPortalSummaryService.PortalSummaryView;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/patient")
@PreAuthorize("hasRole('PATIENT')")
public class PatientPortalSummaryController {
    private final PatientPortalSummaryService portal;

    public PatientPortalSummaryController(PatientPortalSummaryService portal) {
        this.portal = portal;
    }

    @GetMapping("/portal-summary")
    public ApiResponse<PortalSummaryView> summary(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Patient portal summary loaded.", portal.summary(UUID.fromString(jwt.getSubject())));
    }
}

