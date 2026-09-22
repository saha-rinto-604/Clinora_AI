package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.research.api.ResearchCollaborationModels.*;
import com.clinora.research.domain.ProjectMemberRole;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectMember;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.ResearchProjectMemberRepository;
import com.clinora.research.repository.ResearchProjectRepository;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Phase R14 — Research Project Collaboration Service.
 *
 * <p>Manages project-scoped membership roles:
 * - OWNER
 * - CO_RESEARCHER
 * - SUPERVISOR
 * - VIEWER
 *
 * <p>These roles are strictly project-level and do not alter global Clinora RBAC.
 */
@Service
public class ResearchCollaborationService {

    private static final Logger log = LoggerFactory.getLogger(ResearchCollaborationService.class);

    private final ResearchProjectMemberRepository memberRepository;
    private final ResearchProjectRepository projectRepository;
    private final UserAccountRepository userRepository;
    private final ResearchAuditService auditService;

    public ResearchCollaborationService(
            ResearchProjectMemberRepository memberRepository,
            ResearchProjectRepository projectRepository,
            UserAccountRepository userRepository,
            ResearchAuditService auditService
    ) {
        this.memberRepository = memberRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    @Transactional
    public ProjectMemberResponse addMember(
            UUID projectId,
            UUID requesterUserId,
            AddMemberRequest request,
            String ipAddress,
            String userAgent
    ) {
        ResearchProject project = verifyOwnerPermission(projectId, requesterUserId);

        UserAccount targetUser = null;
        if (request.userId() != null) {
            targetUser = userRepository.findById(request.userId())
                    .orElseThrow(() -> new ResearchApiException(
                            HttpStatus.NOT_FOUND,
                            "USER_NOT_FOUND",
                            "User not found with ID: " + request.userId()
                    ));
        } else {
            throw new ResearchApiException(
                    HttpStatus.BAD_REQUEST,
                    "USER_IDENTIFIER_REQUIRED",
                    "Target user ID is required to add collaborator"
            );
        }

        if (memberRepository.existsByProjectIdAndUserId(projectId, targetUser.getId())) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    "MEMBER_ALREADY_EXISTS",
                    "User is already a collaborator on this project"
            );
        }

        ResearchProjectMember member = new ResearchProjectMember(
                UUID.randomUUID(),
                projectId,
                targetUser.getId(),
                request.role(),
                requesterUserId
        );

        member = memberRepository.save(member);
        log.info("Added user {} as {} to research project {}", targetUser.getId(), request.role(), projectId);

        auditService.recordEvent(
                requesterUserId,
                AuthAuditAction.COLLABORATOR_ADDED,
                AuthAuditOutcome.SUCCESS,
                projectId.toString(),
                ipAddress,
                userAgent,
                Map.of(
                        "collaboratorUserId", targetUser.getId().toString(),
                        "role", request.role().name()
                )
        );

        return toResponse(member, targetUser);
    }

    @Transactional
    public ProjectMemberResponse updateMemberRole(
            UUID projectId,
            UUID requesterUserId,
            UUID memberId,
            UpdateMemberRoleRequest request,
            String ipAddress,
            String userAgent
    ) {
        ResearchProject project = verifyOwnerPermission(projectId, requesterUserId);

        ResearchProjectMember member = memberRepository.findById(memberId)
                .filter(m -> m.getProjectId().equals(projectId))
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "MEMBER_NOT_FOUND",
                        "Collaborator record not found: " + memberId
                ));

        // Prevent changing primary project owner's role to non-owner
        if (member.getUserId().equals(project.getOwnerUserId()) && request.role() != ProjectMemberRole.OWNER) {
            throw new ResearchApiException(
                    HttpStatus.BAD_REQUEST,
                    "CANNOT_DEMOTE_PRIMARY_OWNER",
                    "Primary study investigator must retain OWNER role"
            );
        }

        ProjectMemberRole oldRole = member.getRole();
        member.updateRole(request.role());
        member = memberRepository.save(member);

        auditService.recordEvent(
                requesterUserId,
                AuthAuditAction.RESEARCH_PROJECT_UPDATED,
                AuthAuditOutcome.SUCCESS,
                projectId.toString(),
                ipAddress,
                userAgent,
                Map.of(
                        "actionType", "MEMBER_ROLE_UPDATED",
                        "memberUserId", member.getUserId().toString(),
                        "oldRole", oldRole.name(),
                        "newRole", request.role().name()
                )
        );

        UserAccount user = userRepository.findById(member.getUserId()).orElse(null);
        return toResponse(member, user);
    }

    @Transactional
    public void removeMember(
            UUID projectId,
            UUID requesterUserId,
            UUID memberId,
            String ipAddress,
            String userAgent
    ) {
        ResearchProject project = verifyOwnerPermission(projectId, requesterUserId);

        ResearchProjectMember member = memberRepository.findById(memberId)
                .filter(m -> m.getProjectId().equals(projectId))
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "MEMBER_NOT_FOUND",
                        "Collaborator record not found: " + memberId
                ));

        if (member.getUserId().equals(project.getOwnerUserId())) {
            throw new ResearchApiException(
                    HttpStatus.BAD_REQUEST,
                    "CANNOT_REMOVE_PRIMARY_OWNER",
                    "Primary project owner cannot be removed from project"
            );
        }

        memberRepository.delete(member);
        log.info("Removed collaborator {} from project {}", member.getUserId(), projectId);

        auditService.recordEvent(
                requesterUserId,
                AuthAuditAction.COLLABORATOR_REMOVED,
                AuthAuditOutcome.SUCCESS,
                projectId.toString(),
                ipAddress,
                userAgent,
                Map.of(
                        "collaboratorUserId", member.getUserId().toString(),
                        "removedRole", member.getRole().name()
                )
        );
    }

    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> listMembers(UUID projectId, UUID requesterUserId) {
        verifyReadPermission(projectId, requesterUserId);

        List<ResearchProjectMember> members = memberRepository.findByProjectIdOrderByCreatedAtAsc(projectId);
        Set<UUID> userIds = new HashSet<>();
        members.forEach(m -> userIds.add(m.getUserId()));

        Map<UUID, UserAccount> userMap = new HashMap<>();
        userRepository.findAllById(userIds).forEach(u -> userMap.put(u.getId(), u));

        return members.stream()
                .map(m -> toResponse(m, userMap.get(m.getUserId())))
                .toList();
    }

    private ResearchProject verifyOwnerPermission(UUID projectId, UUID requesterUserId) {
        ResearchProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND,
                        "Research project not found: " + projectId
                ));

        boolean isPrimaryOwner = project.getOwnerUserId().equals(requesterUserId);
        boolean hasOwnerRole = memberRepository.findByProjectIdAndUserId(projectId, requesterUserId)
                .map(m -> m.getRole() == ProjectMemberRole.OWNER)
                .orElse(false);

        if (!isPrimaryOwner && !hasOwnerRole) {
            throw new ResearchApiException(
                    HttpStatus.FORBIDDEN,
                    ResearchErrorCode.PROJECT_ACCESS_DENIED,
                    "Only project owners can manage collaborators"
            );
        }
        return project;
    }

    private void verifyReadPermission(UUID projectId, UUID requesterUserId) {
        ResearchProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND,
                        "Research project not found: " + projectId
                ));

        if (project.getOwnerUserId().equals(requesterUserId)) {
            return;
        }

        boolean isMember = memberRepository.existsByProjectIdAndUserId(projectId, requesterUserId);
        if (!isMember) {
            throw new ResearchApiException(
                    HttpStatus.FORBIDDEN,
                    ResearchErrorCode.PROJECT_ACCESS_DENIED,
                    "User is not a member of project: " + projectId
            );
        }
    }

    private ProjectMemberResponse toResponse(ResearchProjectMember member, UserAccount user) {
        String email = (user != null) ? user.getEmail() : "user-" + member.getUserId();
        String name = (user != null) ? (user.getFirstName() + " " + user.getLastName()).trim() : "Researcher";
        return new ProjectMemberResponse(
                member.getId(),
                member.getProjectId(),
                member.getUserId(),
                email,
                name,
                member.getRole(),
                member.getAddedBy(),
                member.getCreatedAt(),
                member.getUpdatedAt()
        );
    }
}
