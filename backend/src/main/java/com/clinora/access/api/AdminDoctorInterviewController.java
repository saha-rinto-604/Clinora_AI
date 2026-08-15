package com.clinora.access.api;

import com.clinora.access.domain.InterviewMeetingProvider;
import com.clinora.access.service.DoctorInterviewModels;
import com.clinora.access.service.DoctorInterviewService;
import com.clinora.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
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
@RequestMapping("/api/v1/admin/access-applications/{applicationId}/interview")
public class AdminDoctorInterviewController {
    private final DoctorInterviewService interviews;

    public AdminDoctorInterviewController(DoctorInterviewService interviews) {
        this.interviews = interviews;
    }

    @GetMapping
    public ApiResponse<DoctorInterviewModels.InterviewView> interview(@PathVariable UUID applicationId) {
        return ApiResponse.success("Doctor interview loaded.", interviews.adminView(applicationId).orElse(null));
    }

    @PostMapping("/require")
    public ApiResponse<Void> requireInterview(
        @PathVariable UUID applicationId,
        @AuthenticationPrincipal Jwt jwt,
        HttpServletRequest request
    ) {
        interviews.requireInterview(applicationId, userId(jwt), ip(request), userAgent(request));
        return ApiResponse.success("Doctor interview is now required.", null);
    }

    @PostMapping("/schedule")
    public ApiResponse<DoctorInterviewModels.InterviewView> schedule(
        @PathVariable UUID applicationId,
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody ScheduleRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Doctor interview scheduled.",
            interviews.schedule(applicationId, userId(jwt), body.toModel(), ip(request), userAgent(request))
        );
    }

    @PutMapping("/reschedule")
    public ApiResponse<DoctorInterviewModels.InterviewView> reschedule(
        @PathVariable UUID applicationId,
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody ScheduleRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Doctor interview rescheduled.",
            interviews.reschedule(applicationId, userId(jwt), body.toModel(), ip(request), userAgent(request))
        );
    }

    @PostMapping("/cancel")
    public ApiResponse<DoctorInterviewModels.InterviewView> cancel(
        @PathVariable UUID applicationId,
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody CancelRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Doctor interview cancelled.",
            interviews.cancel(applicationId, userId(jwt), body.reason(), ip(request), userAgent(request))
        );
    }

    @PostMapping("/complete")
    public ApiResponse<DoctorInterviewModels.InterviewView> complete(
        @PathVariable UUID applicationId,
        @AuthenticationPrincipal Jwt jwt,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Doctor interview completed.",
            interviews.complete(applicationId, userId(jwt), ip(request), userAgent(request))
        );
    }

    @PostMapping("/no-show")
    public ApiResponse<DoctorInterviewModels.InterviewView> noShow(
        @PathVariable UUID applicationId,
        @AuthenticationPrincipal Jwt jwt,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Doctor interview marked as no-show.",
            interviews.noShow(applicationId, userId(jwt), ip(request), userAgent(request))
        );
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private String ip(HttpServletRequest request) {
        return request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        return request.getHeader(HttpHeaders.USER_AGENT);
    }

    public record ScheduleRequest(
        LocalDateTime scheduledLocalDateTime,
        @NotBlank @Size(max = 80) String timezone,
        Integer durationMinutes,
        InterviewMeetingProvider meetingProvider,
        @NotBlank @Size(max = 1000) String meetingUrl,
        @Size(max = 2000) String instructions
    ) {
        DoctorInterviewModels.ScheduleInput toModel() {
            return new DoctorInterviewModels.ScheduleInput(
                scheduledLocalDateTime,
                timezone,
                durationMinutes,
                meetingProvider,
                meetingUrl,
                instructions
            );
        }
    }

    public record CancelRequest(@Size(max = 500) String reason) {}
}
