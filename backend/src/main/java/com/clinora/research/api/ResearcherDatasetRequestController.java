package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.DatasetRequestModels.*;
import com.clinora.research.service.DatasetRequestService;
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
@RequestMapping("/api/v1/research")
@PreAuthorize("hasRole('RESEARCHER')")
public class ResearcherDatasetRequestController {

    private final DatasetRequestService requestService;

    public ResearcherDatasetRequestController(DatasetRequestService requestService) {
        this.requestService = requestService;
    }

    @PostMapping("/projects/{projectId}/dataset-requests")
    public ApiResponse<DatasetRequestResponse> createDraft(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @Valid @RequestBody CreateDatasetRequestInput input,
            HttpServletRequest request
    ) {
        DatasetRequestResponse response = requestService.createDraft(
                userId(jwt),
                projectId,
                input,
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Dataset request draft created successfully.", response);
    }

    @GetMapping("/projects/{projectId}/dataset-requests")
    public ApiResponse<DatasetRequestPageResponse> listByProject(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        DatasetRequestPageResponse response = requestService.listByProject(userId(jwt), projectId, page, size);
        return ApiResponse.success("Dataset requests retrieved successfully.", response);
    }

    @GetMapping("/dataset-requests/{requestId}")
    public ApiResponse<DatasetRequestResponse> detail(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId
    ) {
        DatasetRequestResponse response = requestService.getDetail(userId(jwt), requestId);
        return ApiResponse.success("Dataset request details retrieved successfully.", response);
    }

    @PatchMapping("/dataset-requests/{requestId}")
    public ApiResponse<DatasetRequestResponse> updateDraft(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId,
            @Valid @RequestBody UpdateDatasetRequestInput input,
            HttpServletRequest request
    ) {
        DatasetRequestResponse response = requestService.updateDraft(
                userId(jwt),
                requestId,
                input,
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Dataset request draft updated successfully.", response);
    }

    @PostMapping("/dataset-requests/{requestId}/submit")
    public ApiResponse<DatasetRequestResponse> submit(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId,
            HttpServletRequest request
    ) {
        DatasetRequestResponse response = requestService.submit(
                userId(jwt),
                requestId,
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Dataset request submitted for governance review.", response);
    }

    @PostMapping("/dataset-requests/{requestId}/cancel")
    public ApiResponse<DatasetRequestResponse> cancel(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId,
            HttpServletRequest request
    ) {
        DatasetRequestResponse response = requestService.cancel(
                userId(jwt),
                requestId,
                ip(request),
                userAgent(request)
        );
        return ApiResponse.success("Dataset request cancelled successfully.", response);
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
}
