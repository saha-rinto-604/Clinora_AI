package com.clinora.patients.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.patients.domain.BloodGroup;
import com.clinora.patients.domain.PatientGender;
import com.clinora.patients.service.PatientProfileMutationService;
import com.clinora.patients.service.PatientProfileService;
import com.clinora.patients.service.PatientProfileService.PatientDashboardView;
import com.clinora.patients.service.PatientProfileService.PatientProfileView;
import com.clinora.patients.service.PatientProfileService.UpdatePatientProfileCommand;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/patient")
@PreAuthorize("hasRole('PATIENT')")
public class PatientProfileController {

    private static final String PHONE_PATTERN = "^[+0-9() .-]{7,32}$";

    private final PatientProfileService profiles;
    private final PatientProfileMutationService mutations;

    public PatientProfileController(PatientProfileService profiles, PatientProfileMutationService mutations) {
        this.profiles = profiles;
        this.mutations = mutations;
    }

    @GetMapping("/profile")
    public ApiResponse<PatientProfileView> profile(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Patient profile.", profiles.profile(userId(jwt)));
    }

    @PatchMapping("/profile")
    public ApiResponse<PatientProfileView> updateProfile(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody UpdatePatientProfileRequest request,
        HttpServletRequest http
    ) {
        PatientProfileView profile = mutations.update(
            userId(jwt),
            request.toCommand(),
            http.getRemoteAddr(),
            http.getHeader(HttpHeaders.USER_AGENT)
        );
        return ApiResponse.success("Patient health profile updated.", profile);
    }

    @GetMapping("/dashboard")
    public ApiResponse<PatientDashboardView> dashboard(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Patient dashboard foundation.", profiles.dashboard(userId(jwt)));
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    public record UpdatePatientProfileRequest(
        @PastOrPresent(message = "Date of birth cannot be in the future.") LocalDate dateOfBirth,
        PatientGender gender,
        BloodGroup bloodGroup,
        @Pattern(regexp = PHONE_PATTERN, message = "Enter a valid phone number.") String phone,
        @Size(max = 500, message = "Address must be 500 characters or fewer.") String address,
        @DecimalMin(value = "30.0", message = "Height must be at least 30 cm.")
        @DecimalMax(value = "300.0", message = "Height must be 300 cm or less.") BigDecimal heightCm,
        @DecimalMin(value = "1.0", message = "Weight must be at least 1 kg.")
        @DecimalMax(value = "700.0", message = "Weight must be 700 kg or less.") BigDecimal weightKg,
        @Size(max = 2000, message = "Family medical history must be 2000 characters or fewer.") String familyMedicalHistory,
        @Size(max = 2000, message = "Lifestyle information must be 2000 characters or fewer.") String lifestyleInformation,
        @Size(max = 160, message = "Emergency contact name must be 160 characters or fewer.") String emergencyContactName,
        @Pattern(regexp = PHONE_PATTERN, message = "Enter a valid emergency contact phone number.") String emergencyContactPhone,
        @Size(max = 100, message = "Emergency contact relationship must be 100 characters or fewer.") String emergencyContactRelationship,
        @Size(max = 30, message = "Add at most 30 allergies.") List<@Size(max = 160) String> allergies,
        @Size(max = 30, message = "Add at most 30 chronic conditions.") List<@Size(max = 160) String> chronicConditions,
        @Size(max = 30, message = "Add at most 30 current medications.") List<@Size(max = 200) String> currentMedications
    ) {
        UpdatePatientProfileCommand toCommand() {
            return new UpdatePatientProfileCommand(
                dateOfBirth,
                gender,
                bloodGroup,
                phone,
                address,
                heightCm,
                weightKg,
                familyMedicalHistory,
                lifestyleInformation,
                emergencyContactName,
                emergencyContactPhone,
                emergencyContactRelationship,
                allergies,
                chronicConditions,
                currentMedications
            );
        }
    }
}
