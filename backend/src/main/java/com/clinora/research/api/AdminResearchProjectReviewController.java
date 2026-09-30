package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.AdminResearchProjectModels.*;
import com.clinora.research.domain.ResearchProjectStatus;
import com.clinora.research.service.AdminResearchProjectReviewService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/admin/research/projects")
@PreAuthorize("hasRole('SYSTEM_ADMIN')")
public class AdminResearchProjectReviewController {

    private final AdminResearchProjectReviewService reviewService;

    public AdminResearchProjectReviewController(AdminResearchProjectReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @GetMapping
    public ApiResponse<AdminProjectPageResponse> queue(
            @RequestParam(required = false) ResearchProjectStatus status,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            @RequestParam(defaultValue = "submittedAt,asc") String sort
    ) {
        AdminProjectPageResponse response = reviewService.listReviewQueue(status, page, size, sort);
        return ApiResponse.success("Research project review queue loaded.", response);
    }

    @GetMapping("/{projectId}")
    public ApiResponse<AdminProjectDetailResponse> detail(@PathVariable UUID projectId) {
        AdminProjectDetailResponse response = reviewService.getProjectDetail(projectId);
        return ApiResponse.success("Research project review details loaded.", response);
    }

    @PostMapping("/{projectId}/start-review")
    public ApiResponse<AdminProjectDetailResponse> startReview(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            HttpServletRequest request
    ) {
        AdminProjectDetailResponse response = reviewService.startReview(
                adminUserId(jwt),
                projectId,
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Research project review started.", response);
    }

    @PostMapping("/{projectId}/request-info")
    public ApiResponse<AdminProjectDetailResponse> requestInfo(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @Valid @RequestBody ReviewActionRequest body,
            HttpServletRequest request
    ) {
        AdminProjectDetailResponse response = reviewService.requestInformation(
                adminUserId(jwt),
                projectId,
                body.comment(),
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Additional information requested from researcher.", response);
    }

    @PostMapping("/{projectId}/approve")
    public ApiResponse<AdminProjectDetailResponse> approve(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @Valid @RequestBody(required = false) ReviewActionRequest body,
            HttpServletRequest request
    ) {
        String comment = (body != null) ? body.comment() : "Project approved by system administrator.";
        AdminProjectDetailResponse response = reviewService.approve(
                adminUserId(jwt),
                projectId,
                comment,
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Research project approved successfully.", response);
    }

    @PostMapping("/{projectId}/reject")
    public ApiResponse<AdminProjectDetailResponse> reject(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @Valid @RequestBody ReviewActionRequest body,
            HttpServletRequest request
    ) {
        String reason = (body != null && body.comment() != null && !body.comment().isBlank())
                ? body.comment()
                : "Project rejected by system administrator.";
        AdminProjectDetailResponse response = reviewService.reject(
                adminUserId(jwt),
                projectId,
                reason,
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Research project review finalized as rejected.", response);
    }

    private UUID adminUserId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private String ip(HttpServletRequest request) {
        return request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        return request.getHeader(HttpHeaders.USER_AGENT);
    }
}
