package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.research.api.ResearchCollaborationModels.*;
import com.clinora.research.domain.*;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.*;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * C1-C6: Research Project Collaboration Service — Invitation Lifecycle.
 *
 * <p>Core security rules:
 * <ul>
 *   <li>PROJECT MEMBERSHIP != DATASET ACCESS. Accepting an invitation grants project-level
 *       access only; clinical dataset downloads always require a separate DatasetAccessGrant.</li>
 *   <li>Team changes are locked while project is SUBMITTED or UNDER_REVIEW.</li>
 *   <li>On member removal, all active DatasetAccessGrants for that member are revoked atomically.</li>
 *   <li>Membership history is soft-deleted, never physically destroyed (audit/provenance).</li>
 *   <li>Only accounts with global role RESEARCHER and status ACTIVE may be invited.</li>
 * </ul>
 */
@Service
public class ResearchCollaborationService {

    private static final Logger log = LoggerFactory.getLogger(ResearchCollaborationService.class);
    private static final int INVITATION_TTL_DAYS = 14;
    private static final int DIRECTORY_PAGE_SIZE = 10;

    private final ResearchProjectMemberRepository memberRepository;
    private final ResearchProjectRepository projectRepository;
    private final ResearchProjectInvitationRepository invitationRepository;
    private final UserAccountRepository userRepository;
    private final DatasetAccessGrantRepository grantRepository;
    private final ResearchAuditService auditService;

    public ResearchCollaborationService(
            ResearchProjectMemberRepository memberRepository,
            ResearchProjectRepository projectRepository,
            ResearchProjectInvitationRepository invitationRepository,
            UserAccountRepository userRepository,
            DatasetAccessGrantRepository grantRepository,
            ResearchAuditService auditService
    ) {
        this.memberRepository = memberRepository;
        this.projectRepository = projectRepository;
        this.invitationRepository = invitationRepository;
        this.userRepository = userRepository;
        this.grantRepository = grantRepository;
        this.auditService = auditService;
    }

    // ─── C1: Researcher Directory Search ─────────────────────────────────────

    /**
     * Search approved Researchers for invitation. Returns safe professional profiles only.
     * Minimum query length: 2. Page size capped at DIRECTORY_PAGE_SIZE.
     * Excludes: current user, existing active members, pending invitees.
     */
    @Transactional(readOnly = true)
    public List<ResearcherDirectoryEntry> searchResearchers(
            String query, UUID projectId, UUID requesterUserId) {

        if (query == null || query.trim().length() < 2) {
            return List.of();
        }

        // Collect IDs to exclude: requester, active members, pending invitees
        Set<UUID> excludedIds = new HashSet<>();
        excludedIds.add(requesterUserId);

        if (projectId != null) {
            memberRepository.findActiveByProjectIdOrderByCreatedAtAsc(projectId)
                    .forEach(m -> excludedIds.add(m.getUserId()));

            invitationRepository.findByProjectIdOrderByInvitedAtDesc(projectId).stream()
                    .filter(i -> i.getStatus() == InvitationStatus.PENDING)
                    .forEach(i -> excludedIds.add(i.getInviteeUserId()));
        }

        List<UserAccount> results = userRepository.searchResearchers(
                query.trim(),
                UserRole.RESEARCHER,
                AccountStatus.ACTIVE,
                PageRequest.of(0, DIRECTORY_PAGE_SIZE)
        );

        return results.stream()
                .filter(u -> !excludedIds.contains(u.getId()))
                .map(this::toDirectoryEntry)
                .collect(Collectors.toList());
    }

    // ─── C2: Invitation Lifecycle ─────────────────────────────────────────────

    @Transactional
    public InvitationResponse sendInvitation(
            UUID projectId,
            UUID requesterUserId,
            SendInvitationRequest request,
            String ipAddress,
            String userAgent
    ) {
        ResearchProject project = verifyOwnerAndMutableTeam(projectId, requesterUserId);

        // Validate proposed role — cannot invite as OWNER via invitation flow
        if (request.proposedRole() == ProjectMemberRole.OWNER) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "INVALID_ROLE", "Cannot invite a researcher as OWNER. OWNER is set at project creation.");
        }

        // Validate invitee is different from requester
        if (request.inviteeUserId().equals(requesterUserId)) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "SELF_INVITE", "You cannot invite yourself.");
        }

        // Validate invitee is an active approved Researcher
        UserAccount invitee = userRepository.findById(request.inviteeUserId())
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "USER_NOT_FOUND", "Researcher not found."));

        if (invitee.getRole() != UserRole.RESEARCHER) {
            throw new ResearchApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "NOT_A_RESEARCHER", "Only users with the RESEARCHER role can be invited.");
        }
        if (invitee.getAccountStatus() != AccountStatus.ACTIVE) {
            throw new ResearchApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "RESEARCHER_NOT_ACTIVE", "The selected researcher's account is not active.");
        }

        // Check not already an active member
        if (memberRepository.existsActiveByProjectIdAndUserId(projectId, request.inviteeUserId())) {
            throw new ResearchApiException(HttpStatus.CONFLICT,
                    "ALREADY_A_MEMBER", "This researcher is already an active member of the project.");
        }

        // Check for existing pending invitation (the DB constraint also enforces this, but fail fast)
        invitationRepository
                .findByProjectIdAndInviteeUserIdAndStatus(projectId, request.inviteeUserId(), InvitationStatus.PENDING)
                .ifPresent(i -> {
                    throw new ResearchApiException(HttpStatus.CONFLICT,
                            "INVITATION_ALREADY_PENDING",
                            "A pending invitation already exists for this researcher on this project.");
                });

        Instant expiresAt = Instant.now().plus(INVITATION_TTL_DAYS, ChronoUnit.DAYS);
        ResearchProjectInvitation invitation = new ResearchProjectInvitation(
                UUID.randomUUID(), projectId, request.inviteeUserId(), requesterUserId,
                request.proposedRole(), request.message(), expiresAt);

        invitation = invitationRepository.save(invitation);
        log.info("Invitation {} sent to researcher {} for project {}", invitation.getId(),
                request.inviteeUserId(), projectId);

        UserAccount inviter = userRepository.findById(requesterUserId).orElse(null);

        auditService.recordEvent(requesterUserId, AuthAuditAction.COLLABORATOR_INVITED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("invitationId", invitation.getId().toString(),
                       "inviteeUserId", request.inviteeUserId().toString(),
                       "proposedRole", request.proposedRole().name()));

        return toInvitationResponse(invitation, project, invitee, inviter);
    }

    @Transactional(readOnly = true)
    public List<InvitationResponse> listProjectInvitations(UUID projectId, UUID requesterUserId) {
        verifyOwnerPermission(projectId, requesterUserId);
        List<ResearchProjectInvitation> invitations =
                invitationRepository.findByProjectIdOrderByInvitedAtDesc(projectId);

        Set<UUID> userIds = new HashSet<>();
        invitations.forEach(i -> { userIds.add(i.getInviteeUserId()); userIds.add(i.getInvitedBy()); });

        Map<UUID, UserAccount> userMap = new HashMap<>();
        userRepository.findAllById(userIds).forEach(u -> userMap.put(u.getId(), u));

        ResearchProject project = projectRepository.findById(projectId).orElse(null);

        return invitations.stream()
                .map(i -> toInvitationResponse(i, project,
                        userMap.get(i.getInviteeUserId()), userMap.get(i.getInvitedBy())))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<InvitationResponse> listMyInvitations(UUID inviteeUserId) {
        List<ResearchProjectInvitation> invitations =
                invitationRepository.findByInviteeUserIdOrderByInvitedAtDesc(inviteeUserId);

        Set<UUID> projectIds = invitations.stream()
                .map(ResearchProjectInvitation::getProjectId).collect(Collectors.toSet());
        Set<UUID> inviterIds = invitations.stream()
                .map(ResearchProjectInvitation::getInvitedBy).collect(Collectors.toSet());

        Map<UUID, ResearchProject> projectMap = new HashMap<>();
        projectRepository.findAllById(projectIds).forEach(p -> projectMap.put(p.getId(), p));

        Map<UUID, UserAccount> inviterMap = new HashMap<>();
        userRepository.findAllById(inviterIds).forEach(u -> inviterMap.put(u.getId(), u));

        UserAccount me = userRepository.findById(inviteeUserId).orElse(null);

        return invitations.stream()
                .map(i -> toInvitationResponse(i, projectMap.get(i.getProjectId()),
                        me, inviterMap.get(i.getInvitedBy())))
                .collect(Collectors.toList());
    }

    @Transactional
    public InvitationResponse acceptInvitation(UUID invitationId, UUID inviteeUserId,
                                               String ipAddress, String userAgent) {
        ResearchProjectInvitation invitation = loadAndValidateInviteeAccess(invitationId, inviteeUserId);
        UUID projectId = invitation.getProjectId();

        // Guard: project must still allow team membership
        ResearchProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND, "Project not found."));

        // Accepting invitation during review lock is still fine — just can't make NEW invitations
        // The invitee might be responding to a pre-lock invitation
        invitation.accept();
        invitationRepository.save(invitation);

        // Create active membership
        ResearchProjectMember member = new ResearchProjectMember(
                UUID.randomUUID(), projectId, inviteeUserId,
                invitation.getProposedRole(), invitation.getInvitedBy());
        memberRepository.save(member);

        log.info("Researcher {} accepted invitation {} and joined project {} as {}",
                inviteeUserId, invitationId, projectId, invitation.getProposedRole());

        UserAccount inviter = userRepository.findById(invitation.getInvitedBy()).orElse(null);
        UserAccount invitee = userRepository.findById(inviteeUserId).orElse(null);

        auditService.recordEvent(inviteeUserId, AuthAuditAction.COLLABORATOR_INVITATION_ACCEPTED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("invitationId", invitationId.toString(),
                       "role", invitation.getProposedRole().name()));

        auditService.recordEvent(inviteeUserId, AuthAuditAction.COLLABORATOR_ADDED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("collaboratorUserId", inviteeUserId.toString(),
                       "role", invitation.getProposedRole().name()));

        return toInvitationResponse(invitation, project, invitee, inviter);
    }

    @Transactional
    public InvitationResponse declineInvitation(UUID invitationId, UUID inviteeUserId,
                                                String ipAddress, String userAgent) {
        ResearchProjectInvitation invitation = loadAndValidateInviteeAccess(invitationId, inviteeUserId);

        invitation.decline();
        invitationRepository.save(invitation);

        UserAccount inviter = userRepository.findById(invitation.getInvitedBy()).orElse(null);
        UserAccount invitee = userRepository.findById(inviteeUserId).orElse(null);
        ResearchProject project = projectRepository.findById(invitation.getProjectId()).orElse(null);

        auditService.recordEvent(inviteeUserId, AuthAuditAction.COLLABORATOR_INVITATION_DECLINED,
                AuthAuditOutcome.SUCCESS, invitation.getProjectId().toString(), ipAddress, userAgent,
                Map.of("invitationId", invitationId.toString()));

        return toInvitationResponse(invitation, project, invitee, inviter);
    }

    @Transactional
    public void revokeInvitation(UUID projectId, UUID invitationId, UUID requesterUserId,
                                 String ipAddress, String userAgent) {
        verifyOwnerPermission(projectId, requesterUserId);

        ResearchProjectInvitation invitation = invitationRepository.findById(invitationId)
                .filter(i -> i.getProjectId().equals(projectId))
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "INVITATION_NOT_FOUND", "Invitation not found on this project."));

        invitation.revoke();
        invitationRepository.save(invitation);

        auditService.recordEvent(requesterUserId, AuthAuditAction.COLLABORATOR_INVITATION_REVOKED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("invitationId", invitationId.toString(),
                       "inviteeUserId", invitation.getInviteeUserId().toString()));
    }

    // ─── C3: Member Management ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> listMembers(UUID projectId, UUID requesterUserId) {
        verifyReadPermission(projectId, requesterUserId);
        List<ResearchProjectMember> members =
                memberRepository.findActiveByProjectIdOrderByCreatedAtAsc(projectId);

        Set<UUID> userIds = new HashSet<>();
        members.forEach(m -> userIds.add(m.getUserId()));

        Map<UUID, UserAccount> userMap = new HashMap<>();
        userRepository.findAllById(userIds).forEach(u -> userMap.put(u.getId(), u));

        return members.stream()
                .map(m -> toMemberResponse(m, userMap.get(m.getUserId())))
                .collect(Collectors.toList());
    }

    @Transactional
    public ProjectMemberResponse updateMemberRole(
            UUID projectId, UUID requesterUserId, UUID memberId,
            UpdateMemberRoleRequest request, String ipAddress, String userAgent) {

        ResearchProject project = verifyOwnerAndMutableTeam(projectId, requesterUserId);

        if (request.role() == ProjectMemberRole.OWNER) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "CANNOT_ASSIGN_OWNER", "OWNER role cannot be assigned through role update. Use project transfer.");
        }

        ResearchProjectMember member = memberRepository.findById(memberId)
                .filter(m -> m.getProjectId().equals(projectId) && m.isActive())
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "MEMBER_NOT_FOUND", "Active collaborator not found: " + memberId));

        if (member.getUserId().equals(project.getOwnerUserId())) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "CANNOT_CHANGE_OWNER_ROLE", "Project owner's role cannot be changed.");
        }

        if (member.getUserId().equals(requesterUserId)) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "CANNOT_CHANGE_OWN_ROLE", "You cannot change your own project role.");
        }

        ProjectMemberRole oldRole = member.getRole();
        member.updateRole(request.role());
        member = memberRepository.save(member);

        auditService.recordEvent(requesterUserId, AuthAuditAction.COLLABORATOR_ROLE_CHANGED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("memberUserId", member.getUserId().toString(),
                       "oldRole", oldRole.name(), "newRole", request.role().name()));

        UserAccount user = userRepository.findById(member.getUserId()).orElse(null);
        return toMemberResponse(member, user);
    }

    @Transactional
    public void removeMember(UUID projectId, UUID requesterUserId, UUID memberId,
                             String ipAddress, String userAgent) {
        ResearchProject project = verifyOwnerAndMutableTeam(projectId, requesterUserId);

        ResearchProjectMember member = memberRepository.findById(memberId)
                .filter(m -> m.getProjectId().equals(projectId) && m.isActive())
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "MEMBER_NOT_FOUND", "Active collaborator not found: " + memberId));

        if (member.getUserId().equals(project.getOwnerUserId())) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "CANNOT_REMOVE_PRIMARY_OWNER", "Project owner cannot be removed.");
        }

        UUID removedUserId = member.getUserId();
        String removedRole = member.getRole().name();

        // Soft-delete the membership (preserves history)
        member.remove(requesterUserId);
        memberRepository.save(member);

        // C5: Atomically revoke all active DatasetAccessGrants for the removed member
        List<DatasetAccessGrant> activeGrants = grantRepository.findActiveByResearcherUserId(removedUserId);
        Instant now = Instant.now();
        int revokedGrantCount = 0;
        for (DatasetAccessGrant grant : activeGrants) {
            grant.revoke(now);
            grantRepository.save(grant);
            revokedGrantCount++;
        }

        if (revokedGrantCount > 0) {
            log.info("Revoked {} dataset access grant(s) for removed member {} from project {}",
                    revokedGrantCount, removedUserId, projectId);
        }

        auditService.recordEvent(requesterUserId, AuthAuditAction.COLLABORATOR_REMOVED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("collaboratorUserId", removedUserId.toString(),
                       "removedRole", removedRole,
                       "datasetGrantsRevoked", String.valueOf(revokedGrantCount)));
    }

    // ─── C6: Scheduled expiry ─────────────────────────────────────────────────

    /** Runs every hour to expire overdue pending invitations. */
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void expireOverdueInvitations() {
        List<ResearchProjectInvitation> expired =
                invitationRepository.findExpiredPending(Instant.now());
        for (ResearchProjectInvitation inv : expired) {
            inv.expire();
            invitationRepository.save(inv);
            log.info("Expired invitation {} for project {}", inv.getId(), inv.getProjectId());

            auditService.recordEvent(null, AuthAuditAction.COLLABORATOR_INVITATION_EXPIRED,
                    AuthAuditOutcome.SUCCESS, inv.getProjectId().toString(), null, null,
                    Map.of("invitationId", inv.getId().toString()));
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private ResearchProject verifyOwnerPermission(UUID projectId, UUID requesterUserId) {
        ResearchProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND, "Research project not found: " + projectId));

        boolean isPrimaryOwner = project.getOwnerUserId().equals(requesterUserId);
        boolean hasOwnerRole = memberRepository
                .findActiveByProjectIdAndUserId(projectId, requesterUserId)
                .map(m -> m.getRole() == ProjectMemberRole.OWNER)
                .orElse(false);

        if (!isPrimaryOwner && !hasOwnerRole) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    ResearchErrorCode.PROJECT_ACCESS_DENIED, "Only project owners can manage collaborators.");
        }
        return project;
    }

    /**
     * Verifies owner permission AND checks project status allows team mutations.
     * Team changes are locked during SUBMITTED and UNDER_REVIEW to keep the reviewed team stable.
     */
    private ResearchProject verifyOwnerAndMutableTeam(UUID projectId, UUID requesterUserId) {
        ResearchProject project = verifyOwnerPermission(projectId, requesterUserId);
        ResearchProjectStatus status = project.getStatus();
        if (status == ResearchProjectStatus.SUBMITTED || status == ResearchProjectStatus.UNDER_REVIEW) {
            throw new ResearchApiException(HttpStatus.CONFLICT,
                    "TEAM_LOCKED_DURING_REVIEW",
                    "Team changes are locked while the project is under governance review (" + status + "). " +
                    "Withdraw the project or wait for the review to complete.");
        }
        if (status.isTerminal()) {
            throw new ResearchApiException(HttpStatus.CONFLICT,
                    "TEAM_LOCKED_TERMINAL",
                    "Team changes are not permitted on a " + status + " project.");
        }
        return project;
    }

    private void verifyReadPermission(UUID projectId, UUID requesterUserId) {
        ResearchProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND, "Research project not found: " + projectId));

        if (project.getOwnerUserId().equals(requesterUserId)) return;
        if (!memberRepository.existsActiveByProjectIdAndUserId(projectId, requesterUserId)) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    ResearchErrorCode.PROJECT_ACCESS_DENIED, "User is not an active member of this project.");
        }
    }

    private ResearchProjectInvitation loadAndValidateInviteeAccess(UUID invitationId, UUID inviteeUserId) {
        ResearchProjectInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "INVITATION_NOT_FOUND", "Invitation not found."));

        if (!invitation.getInviteeUserId().equals(inviteeUserId)) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INVITATION_ACCESS_DENIED", "You are not the recipient of this invitation.");
        }

        if (invitation.isExpiredByTime()) {
            invitation.expire();
            invitationRepository.save(invitation);
            throw new ResearchApiException(HttpStatus.GONE,
                    "INVITATION_EXPIRED", "This invitation has expired.");
        }

        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ResearchApiException(HttpStatus.CONFLICT,
                    "INVITATION_NOT_PENDING", "Invitation status is " + invitation.getStatus() + ".");
        }

        return invitation;
    }

    private ResearcherDirectoryEntry toDirectoryEntry(UserAccount u) {
        String displayName = (u.getFirstName() + " " + u.getLastName()).trim();
        String initials = buildInitials(u.getFirstName(), u.getLastName());
        return new ResearcherDirectoryEntry(u.getId(), displayName, initials);
    }

    private String buildInitials(String first, String last) {
        String f = (first != null && !first.isBlank()) ? first.substring(0, 1).toUpperCase() : "";
        String l = (last != null && !last.isBlank()) ? last.substring(0, 1).toUpperCase() : "";
        return f + l;
    }

    private InvitationResponse toInvitationResponse(
            ResearchProjectInvitation inv, ResearchProject project,
            UserAccount invitee, UserAccount inviter) {
        String projectTitle = (project != null) ? project.getTitle() : null;
        String inviteeDisplayName = (invitee != null)
                ? (invitee.getFirstName() + " " + invitee.getLastName()).trim() : "Researcher";
        String inviterDisplayName = (inviter != null)
                ? (inviter.getFirstName() + " " + inviter.getLastName()).trim() : "Researcher";
        return new InvitationResponse(
                inv.getId(), inv.getProjectId(), projectTitle,
                inv.getInviteeUserId(), inviteeDisplayName,
                inv.getInvitedBy(), inviterDisplayName,
                inv.getProposedRole(), inv.getStatus(), inv.getMessage(),
                inv.getInvitedAt(), inv.getExpiresAt(), inv.getRespondedAt());
    }

    private ProjectMemberResponse toMemberResponse(ResearchProjectMember member, UserAccount user) {
        String name = (user != null) ? (user.getFirstName() + " " + user.getLastName()).trim() : "Researcher";
        return new ProjectMemberResponse(
                member.getId(), member.getProjectId(), member.getUserId(),
                name, member.getRole(), member.getAddedBy(),
                member.getCreatedAt(), member.getUpdatedAt());
    }
}
