package com.clinora.consultations.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.consultations.service.ConsultationModels;
import com.clinora.consultations.service.DoctorCareWorkflowService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/doctor")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorCareWorkflowController {
    private final DoctorCareWorkflowService care;

    public DoctorCareWorkflowController(DoctorCareWorkflowService care) {
        this.care = care;
    }

    @GetMapping("/clinical-inbox")
    public ApiResponse<ConsultationModels.ClinicalInboxView> inbox(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Clinical Inbox loaded.", care.inbox(userId(jwt)));
    }

    @GetMapping("/patients")
    public ApiResponse<List<ConsultationModels.DoctorPatientListItem>> patients(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Doctor Patients loaded.", care.patients(userId(jwt)));
    }

    @GetMapping("/patients/{patientId}")
    public ApiResponse<ConsultationModels.DoctorPatientDetail> patient(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID patientId
    ) {
        return ApiResponse.success("Patient care workspace loaded.", care.patient(userId(jwt), patientId));
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
