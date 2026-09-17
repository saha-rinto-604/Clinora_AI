package com.clinora.doctors.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.doctors.support.DoctorSupportRoutingDecision;
import com.clinora.doctors.support.DoctorSupportRoutingRequest;
import com.clinora.doctors.support.DoctorSupportRoutingService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/doctor/appointments/{appointmentId}/clinical-support")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorClinicalSupportController {
    private final DoctorSupportRoutingService routing;

    public DoctorClinicalSupportController(DoctorSupportRoutingService routing) {
        this.routing = routing;
    }

    @PostMapping("/route")
    public ApiResponse<DoctorSupportRoutingDecision> route(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @Valid @RequestBody DoctorSupportRoutingRequest request
    ) {
        return ApiResponse.success(
            "Clinora request routing completed.",
            routing.route(UUID.fromString(jwt.getSubject()), appointmentId, request)
        );
    }
}
