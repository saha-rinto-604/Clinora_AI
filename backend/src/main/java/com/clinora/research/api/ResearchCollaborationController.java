package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.ResearchCollaborationModels.*;
import com.clinora.research.service.ResearchCollaborationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
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
@PreAuthorize("hasRole('RESEARCHER')")
public class ResearchCollaborationController {

    private final ResearchCollaborationService collaborationService;

    public ResearchCollaborationController(ResearchCollaborationService collaborationService) {
        this.collaborationService = collaborationService;
    }

    // ─── C1: Researcher Directory Search ────────────────────────────────────

    /**
     * Search verified researchers by name for invitation.
     * Min 2 chars, max 10 results. Excludes current user, existing members, pending invitees.
     */
    @GetMapping("/api/v1/research/researchers/search")
    public ApiResponse<List<ResearcherDirectoryEntry>> searchResearchers(
            @RequestParam @Size(min = 2, max = 100) String q,
            @RequestParam(required = false) UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<ResearcherDirectoryEntry> results =
                collaborationService.searchResearchers(q, projectId, userId(jwt));
        return ApiResponse.success("Researcher directory search results.", results);
    }

    // ─── C2: Invitation Lifecycle (project-scoped) ───────────────────────────

    @PostMapping("/api/v1/research/projects/{projectId}/invitations")
    public ApiResponse<InvitationResponse> sendInvitation(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody SendInvitationRequest request,
            HttpServletRequest servletRequest
    ) {
        InvitationResponse response = collaborationService.sendInvitation(
                projectId, userId(jwt), request, ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Invitation sent successfully.", response);
    }

    @GetMapping("/api/v1/research/projects/{projectId}/invitations")
    public ApiResponse<List<InvitationResponse>> listProjectInvitations(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<InvitationResponse> response =
                collaborationService.listProjectInvitations(projectId, userId(jwt));
        return ApiResponse.success("Project invitations retrieved.", response);
    }

    @DeleteMapping("/api/v1/research/projects/{projectId}/invitations/{invitationId}")
    public ApiResponse<Void> revokeInvitation(
            @PathVariable UUID projectId,
            @PathVariable UUID invitationId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        collaborationService.revokeInvitation(
                projectId, invitationId, userId(jwt), ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Invitation revoked.", null);
    }

    // ─── C2: Invitation Lifecycle (invitee-scoped) ────────────────────────────

    @GetMapping("/api/v1/research/invitations")
    public ApiResponse<List<InvitationResponse>> listMyInvitations(
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<InvitationResponse> response = collaborationService.listMyInvitations(userId(jwt));
        return ApiResponse.success("Your collaboration invitations.", response);
    }

    @PostMapping("/api/v1/research/invitations/{invitationId}/accept")
    public ApiResponse<InvitationResponse> acceptInvitation(
            @PathVariable UUID invitationId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        InvitationResponse response = collaborationService.acceptInvitation(
                invitationId, userId(jwt), ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Invitation accepted. You are now a project member.", response);
    }

    @PostMapping("/api/v1/research/invitations/{invitationId}/decline")
    public ApiResponse<InvitationResponse> declineInvitation(
            @PathVariable UUID invitationId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        InvitationResponse response = collaborationService.declineInvitation(
                invitationId, userId(jwt), ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Invitation declined.", response);
    }

    // ─── C3: Member Management ─────────────────────────────────────────────────

    @GetMapping("/api/v1/research/projects/{projectId}/members")
    public ApiResponse<List<ProjectMemberResponse>> listMembers(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<ProjectMemberResponse> response = collaborationService.listMembers(projectId, userId(jwt));
        return ApiResponse.success("Project collaborators retrieved.", response);
    }

    @PutMapping("/api/v1/research/projects/{projectId}/members/{memberId}")
    public ApiResponse<ProjectMemberResponse> updateMemberRole(
            @PathVariable UUID projectId,
            @PathVariable UUID memberId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateMemberRoleRequest request,
            HttpServletRequest servletRequest
    ) {
        ProjectMemberResponse response = collaborationService.updateMemberRole(
                projectId, userId(jwt), memberId, request, ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Collaborator role updated.", response);
    }

    @DeleteMapping("/api/v1/research/projects/{projectId}/members/{memberId}")
    public ApiResponse<Void> removeMember(
            @PathVariable UUID projectId,
            @PathVariable UUID memberId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        collaborationService.removeMember(
                projectId, userId(jwt), memberId, ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Collaborator removed. Active dataset grants revoked.", null);
    }

    private UUID userId(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
    private String ip(HttpServletRequest req) { return req.getRemoteAddr(); }
    private String userAgent(HttpServletRequest req) { return req.getHeader(HttpHeaders.USER_AGENT); }
}
