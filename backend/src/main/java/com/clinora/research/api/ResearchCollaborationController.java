package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.ResearchCollaborationModels.*;
import com.clinora.research.service.ResearchCollaborationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
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
@RequestMapping("/api/v1/research/projects/{projectId}/members")
@PreAuthorize("hasRole('RESEARCHER')")
public class ResearchCollaborationController {

    private final ResearchCollaborationService collaborationService;

    public ResearchCollaborationController(ResearchCollaborationService collaborationService) {
        this.collaborationService = collaborationService;
    }

    @PostMapping
    public ApiResponse<ProjectMemberResponse> addMember(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AddMemberRequest request,
            HttpServletRequest servletRequest
    ) {
        ProjectMemberResponse response = collaborationService.addMember(
                projectId,
                userId(jwt),
                request,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Collaborator added to project successfully.", response);
    }

    @GetMapping
    public ApiResponse<List<ProjectMemberResponse>> listMembers(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<ProjectMemberResponse> response = collaborationService.listMembers(projectId, userId(jwt));
        return ApiResponse.success("Project collaborators retrieved successfully.", response);
    }

    @PutMapping("/{memberId}")
    public ApiResponse<ProjectMemberResponse> updateMemberRole(
            @PathVariable UUID projectId,
            @PathVariable UUID memberId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateMemberRoleRequest request,
            HttpServletRequest servletRequest
    ) {
        ProjectMemberResponse response = collaborationService.updateMemberRole(
                projectId,
                userId(jwt),
                memberId,
                request,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Collaborator role updated successfully.", response);
    }

    @DeleteMapping("/{memberId}")
    public ApiResponse<Void> removeMember(
            @PathVariable UUID projectId,
            @PathVariable UUID memberId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        collaborationService.removeMember(
                projectId,
                userId(jwt),
                memberId,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Collaborator removed from project successfully.", null);
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
