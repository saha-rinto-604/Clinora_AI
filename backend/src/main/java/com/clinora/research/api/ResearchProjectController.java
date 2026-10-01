package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.ResearchProjectModels.*;
import com.clinora.research.domain.ResearchProjectStatus;
import com.clinora.research.service.ResearchProjectService;
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
@RequestMapping("/api/v1/research/projects")
@PreAuthorize("hasRole('RESEARCHER')")
public class ResearchProjectController {

    private final ResearchProjectService projectService;

    public ResearchProjectController(ResearchProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping
    public ApiResponse<ProjectResponse> createDraft(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateProjectRequest request,
            HttpServletRequest servletRequest
    ) {
        ProjectResponse project = projectService.createDraft(
                userId(jwt),
                request,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research project draft created successfully.", project);
    }

    @GetMapping
    public ApiResponse<ProjectPageResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) ResearchProjectStatus status,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        ProjectPageResponse response = projectService.listProjects(
                userId(jwt),
                status,
                page,
                size,
                sort
        );
        return ApiResponse.success("Research projects retrieved successfully.", response);
    }

    @GetMapping("/{projectId}")
    public ApiResponse<ProjectResponse> detail(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId
    ) {
        ProjectResponse project = projectService.getProject(userId(jwt), projectId);
        return ApiResponse.success("Research project details retrieved successfully.", project);
    }

    @PatchMapping("/{projectId}")
    public ApiResponse<ProjectResponse> update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @Valid @RequestBody UpdateProjectRequest request,
            HttpServletRequest servletRequest
    ) {
        ProjectResponse project = projectService.updateProject(
                userId(jwt),
                projectId,
                request,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research project updated successfully.", project);
    }

    @PostMapping("/{projectId}/submit")
    public ApiResponse<ProjectResponse> submit(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            HttpServletRequest servletRequest
    ) {
        ProjectResponse project = projectService.submitProject(
                userId(jwt),
                projectId,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research project submitted for administrative review.", project);
    }

    @PostMapping("/{projectId}/withdraw")
    public ApiResponse<ProjectResponse> withdraw(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            HttpServletRequest servletRequest
    ) {
        ProjectResponse project = projectService.withdrawProject(
                userId(jwt),
                projectId,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research project withdrawn successfully.", project);
    }

    @PostMapping("/{projectId}/complete")
    public ApiResponse<ProjectResponse> complete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            HttpServletRequest servletRequest
    ) {
        ProjectResponse project = projectService.completeProject(
                userId(jwt),
                projectId,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research project marked as completed.", project);
    }

    @PostMapping("/{projectId}/archive")
    public ApiResponse<ProjectResponse> archive(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            HttpServletRequest servletRequest
    ) {
        ProjectResponse project = projectService.archiveProject(
                userId(jwt),
                projectId,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research project archived successfully.", project);
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
