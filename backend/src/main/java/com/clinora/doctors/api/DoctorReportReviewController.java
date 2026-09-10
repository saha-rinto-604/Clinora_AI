package com.clinora.doctors.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.doctors.service.DoctorReportReviewService;
import com.clinora.doctors.service.DoctorWorkspaceModels;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/doctor/appointments/{appointmentId}/reports")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorReportReviewController {
    private final DoctorReportReviewService reviews;

    public DoctorReportReviewController(DoctorReportReviewService reviews) {
        this.reviews = reviews;
    }

    @GetMapping("/{reportId}/review")
    public ApiResponse<DoctorWorkspaceModels.ReportReviewView> review(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @PathVariable UUID reportId,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Shared report review loaded.",
            reviews.review(userId(jwt), appointmentId, reportId, clientIp(request), request.getHeader(HttpHeaders.USER_AGENT))
        );
    }

    @GetMapping("/compare")
    public ApiResponse<DoctorWorkspaceModels.ReportComparisonView> compare(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @RequestParam UUID leftReportId,
        @RequestParam UUID rightReportId,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Shared reports loaded for comparison.",
            reviews.compare(
                userId(jwt),
                appointmentId,
                leftReportId,
                rightReportId,
                clientIp(request),
                request.getHeader(HttpHeaders.USER_AGENT)
            )
        );
    }

    @PutMapping("/{reportId}/review/observations/{observationId}")
    public ApiResponse<DoctorWorkspaceModels.ObservationReviewView> reviewObservation(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @PathVariable UUID reportId,
        @PathVariable UUID observationId,
        @RequestBody DoctorWorkspaceModels.ObservationReviewRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Result review saved.",
            reviews.reviewObservation(
                userId(jwt),
                appointmentId,
                reportId,
                observationId,
                body,
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
