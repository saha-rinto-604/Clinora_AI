package com.clinora.access.api;

import com.clinora.access.service.ApplicantOriginGuard;
import com.clinora.access.service.ApplicantSessionService;
import com.clinora.access.service.DoctorInterviewModels;
import com.clinora.access.service.DoctorInterviewService;
import com.clinora.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/access-applications/me/interview")
public class ApplicantDoctorInterviewController {
    private final ApplicantSessionService sessions;
    private final ApplicantOriginGuard originGuard;
    private final DoctorInterviewService interviews;

    public ApplicantDoctorInterviewController(
        ApplicantSessionService sessions,
        ApplicantOriginGuard originGuard,
        DoctorInterviewService interviews
    ) {
        this.sessions = sessions;
        this.originGuard = originGuard;
        this.interviews = interviews;
    }

    @GetMapping
    public ApiResponse<DoctorInterviewModels.InterviewView> interview(
        @CookieValue(name = ApplicantSessionService.COOKIE_NAME, required = false) String cookie
    ) {
        var applicationId = sessions.requireApplication(cookie);
        return ApiResponse.success("Doctor interview loaded.", interviews.applicantView(applicationId).orElse(null));
    }

    @PostMapping("/reschedule-request")
    public ApiResponse<DoctorInterviewModels.InterviewView> requestReschedule(
        @CookieValue(name = ApplicantSessionService.COOKIE_NAME, required = false) String cookie,
        @RequestHeader(name = HttpHeaders.ORIGIN, required = false) String origin,
        @Valid @RequestBody RescheduleRequest body,
        HttpServletRequest request
    ) {
        originGuard.requireAllowed(origin);
        var applicationId = sessions.requireApplication(cookie);
        return ApiResponse.success(
            "Interview reschedule request submitted.",
            interviews.requestReschedule(applicationId, body.message(), request.getRemoteAddr(), request.getHeader(HttpHeaders.USER_AGENT))
        );
    }

    public record RescheduleRequest(@NotBlank @Size(max = 500) String message) {}
}
