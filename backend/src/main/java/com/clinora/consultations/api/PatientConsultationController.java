package com.clinora.consultations.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.consultations.service.ConsultationModels;
import com.clinora.consultations.service.ConsultationService;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/patient")
@PreAuthorize("hasRole('PATIENT')")
public class PatientConsultationController {
    private final ConsultationService consultations;

    public PatientConsultationController(ConsultationService consultations) {
        this.consultations = consultations;
    }

    @GetMapping("/appointments/{appointmentId}/consultation-summary")
    public ApiResponse<ConsultationModels.PatientConsultationSummary> summary(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId
    ) {
        return ApiResponse.success(
            "Consultation summary loaded.",
            consultations.patientSummary(userId(jwt), appointmentId)
        );
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
