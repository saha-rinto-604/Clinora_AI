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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/doctor")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorConsultationController {
    private final ConsultationService consultations;

    public DoctorConsultationController(ConsultationService consultations) {
        this.consultations = consultations;
    }

    @GetMapping("/appointments/{appointmentId}/consultation")
    public ApiResponse<ConsultationModels.ConsultationView> consultation(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId
    ) {
        return ApiResponse.success(
            "Consultation loaded.",
            consultations.findForDoctor(userId(jwt), appointmentId)
        );
    }

    @PostMapping("/appointments/{appointmentId}/consultation/start")
    public ApiResponse<ConsultationModels.ConsultationView> start(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId
    ) {
        return ApiResponse.success(
            "Consultation started.",
            consultations.start(userId(jwt), appointmentId)
        );
    }

    @PutMapping("/consultations/{consultationId}")
    public ApiResponse<ConsultationModels.ConsultationView> save(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID consultationId,
        @RequestBody ConsultationModels.ConsultationDraftRequest request
    ) {
        return ApiResponse.success(
            "Consultation draft saved.",
            consultations.saveDraft(userId(jwt), consultationId, request)
        );
    }

    @PostMapping("/consultations/{consultationId}/complete")
    public ApiResponse<ConsultationModels.ConsultationView> complete(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID consultationId,
        @RequestBody ConsultationModels.ConsultationDraftRequest request
    ) {
        return ApiResponse.success(
            "Consultation completed.",
            consultations.complete(userId(jwt), consultationId, request)
        );
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
