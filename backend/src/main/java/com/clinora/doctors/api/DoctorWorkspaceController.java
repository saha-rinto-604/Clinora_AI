package com.clinora.doctors.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.doctors.service.DoctorWorkspaceModels;
import com.clinora.doctors.service.DoctorWorkspaceService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/doctor")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorWorkspaceController {
    private final DoctorWorkspaceService workspace;

    public DoctorWorkspaceController(DoctorWorkspaceService workspace) {
        this.workspace = workspace;
    }

    @GetMapping("/dashboard")
    public ApiResponse<DoctorWorkspaceModels.DashboardView> dashboard(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Doctor workspace loaded.", workspace.dashboard(userId(jwt)));
    }

    @GetMapping("/appointments")
    public ApiResponse<DoctorWorkspaceModels.AppointmentPage> appointments(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "upcoming") String scope,
        @RequestParam(defaultValue = "20") int limit,
        @RequestParam(defaultValue = "0") int offset
    ) {
        return ApiResponse.success("Doctor appointments loaded.", workspace.appointments(userId(jwt), scope, limit, offset));
    }

    @GetMapping("/appointments/{appointmentId}")
    public ApiResponse<DoctorWorkspaceModels.AppointmentDetail> appointment(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Appointment loaded.",
            workspace.appointment(userId(jwt), appointmentId, clientIp(request), request.getHeader(HttpHeaders.USER_AGENT))
        );
    }

    @PostMapping("/appointments/{appointmentId}/cancel")
    public ApiResponse<DoctorWorkspaceModels.AppointmentDetail> cancel(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @RequestBody(required = false) DoctorWorkspaceModels.CancelAppointmentRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Appointment cancelled.",
            workspace.cancel(
                userId(jwt),
                appointmentId,
                body == null ? null : body.reason(),
                clientIp(request),
                request.getHeader(HttpHeaders.USER_AGENT)
            )
        );
    }

    @PostMapping("/appointments/{appointmentId}/reschedule")
    public ApiResponse<DoctorWorkspaceModels.AppointmentDetail> reschedule(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @RequestBody DoctorWorkspaceModels.RescheduleAppointmentRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Appointment rescheduled.",
            workspace.reschedule(
                userId(jwt),
                appointmentId,
                body.slotId(),
                body.timezone(),
                clientIp(request),
                request.getHeader(HttpHeaders.USER_AGENT)
            )
        );
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded.split(",", 2)[0].trim();
    }
}
