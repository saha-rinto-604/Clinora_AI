package com.clinora.doctors.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.doctors.service.DoctorProfileModels;
import com.clinora.doctors.service.DoctorProfileService;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/patient/doctors")
@PreAuthorize("hasRole('PATIENT')")
public class PatientDoctorProfessionalProfileController {
    private final DoctorProfileService profiles;

    public PatientDoctorProfessionalProfileController(DoctorProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping("/{doctorId}/professional-profile")
    public ApiResponse<DoctorProfileModels.PatientFacingProfile> profile(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID doctorId
    ) {
        return ApiResponse.success(
            "Doctor professional profile loaded.",
            profiles.patientFacingProfile(UUID.fromString(jwt.getSubject()), doctorId)
        );
    }
}
