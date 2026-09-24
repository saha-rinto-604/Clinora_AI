package com.clinora.appointments.api;

import com.clinora.appointments.service.PatientConsultationJoinService;
import com.clinora.common.api.ApiResponse;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/patient/appointments/{appointmentId}/join")
@PreAuthorize("hasRole('PATIENT')")
public class PatientConsultationJoinController {
    private final PatientConsultationJoinService join;
    public PatientConsultationJoinController(PatientConsultationJoinService join) { this.join = join; }
    @GetMapping
    public ResponseEntity<ApiResponse<PatientConsultationJoinService.JoinStatus>> status(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID appointmentId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.success("Join status loaded.", join.status(UUID.fromString(jwt.getSubject()), appointmentId)));
    }
    @PostMapping
    public ResponseEntity<ApiResponse<PatientConsultationJoinService.JoinRoom>> join(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID appointmentId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.success("Consultation room ready.", join.join(UUID.fromString(jwt.getSubject()), appointmentId)));
    }
}
