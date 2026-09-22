package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.DatasetRequestModels.*;
import com.clinora.research.domain.DatasetRequestStatus;
import com.clinora.research.service.AdminDatasetRequestReviewService;
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

import java.util.List;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/admin/research/dataset-requests")
@PreAuthorize("hasRole('SYSTEM_ADMIN')")
public class AdminDatasetRequestReviewController {

    private final AdminDatasetRequestReviewService reviewService;

    public AdminDatasetRequestReviewController(AdminDatasetRequestReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @GetMapping
    public ApiResponse<List<AdminDatasetRequestQueueItem>> queue(
            @RequestParam(required = false) DatasetRequestStatus status,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        List<AdminDatasetRequestQueueItem> queue = reviewService.listQueue(status, page, size);
        return ApiResponse.success("Dataset request review queue loaded.", queue);
    }

    @GetMapping("/{requestId}")
    public ApiResponse<AdminDatasetRequestDetailResponse> detail(@PathVariable UUID requestId) {
        AdminDatasetRequestDetailResponse response = reviewService.getDetail(requestId);
        return ApiResponse.success("Dataset request details loaded.", response);
    }

    @PostMapping("/{requestId}/start-review")
    public ApiResponse<AdminDatasetRequestDetailResponse> startReview(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId,
            HttpServletRequest request
    ) {
        AdminDatasetRequestDetailResponse response = reviewService.startReview(
                adminUserId(jwt),
                requestId,
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Dataset request review started.", response);
    }

    @PostMapping("/{requestId}/request-info")
    public ApiResponse<AdminDatasetRequestDetailResponse> requestInfo(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId,
            @Valid @RequestBody DatasetReviewDecisionInput body,
            HttpServletRequest request
    ) {
        AdminDatasetRequestDetailResponse response = reviewService.requestInformation(
                adminUserId(jwt),
                requestId,
                body.reviewNotes(),
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Additional information requested for dataset request.", response);
    }

    @PostMapping("/{requestId}/approve")
    public ApiResponse<AdminDatasetRequestDetailResponse> approve(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId,
            @Valid @RequestBody(required = false) DatasetReviewDecisionInput body,
            HttpServletRequest request
    ) {
        String notes = (body != null && body.reviewNotes() != null) ? body.reviewNotes() : "Dataset request approved by system administrator.";
        var expiresAt = (body != null) ? body.expiresAt() : null;
        AdminDatasetRequestDetailResponse response = reviewService.approve(
                adminUserId(jwt),
                requestId,
                notes,
                expiresAt,
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Dataset request approved successfully.", response);
    }

    @PostMapping("/{requestId}/reject")
    public ApiResponse<AdminDatasetRequestDetailResponse> reject(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId,
            @Valid @RequestBody DatasetReviewDecisionInput body,
            HttpServletRequest request
    ) {
        String reason = (body != null && body.reviewNotes() != null && !body.reviewNotes().isBlank())
                ? body.reviewNotes()
                : "Dataset request rejected by system administrator.";
        AdminDatasetRequestDetailResponse response = reviewService.reject(
                adminUserId(jwt),
                requestId,
                reason,
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Dataset request rejected.", response);
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
