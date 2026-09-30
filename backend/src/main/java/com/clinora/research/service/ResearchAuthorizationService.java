package com.clinora.research.service;

import com.clinora.research.domain.ProjectMemberRole;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectMember;
import com.clinora.research.domain.ResearchProjectStatus;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.ResearchProjectMemberRepository;
import com.clinora.research.repository.ResearchProjectRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/**
 * Centralized authorization service for research project collaboration.
 * Enforces project-scoped roles (OWNER, CO_RESEARCHER, SUPERVISOR, VIEWER)
 * and project status boundaries across all workspace resources.
 */
@Service
public class ResearchAuthorizationService {
    private final com.clinora.research.service.ResearchAccessGuard accessGuard;

    private final ResearchProjectRepository projectRepository;
    private final ResearchProjectMemberRepository memberRepository;

    public ResearchAuthorizationService(
            ResearchProjectRepository projectRepository,
            ResearchProjectMemberRepository memberRepository,
            com.clinora.research.service.ResearchAccessGuard accessGuard
    ) {
        this.accessGuard = accessGuard;
        this.projectRepository = projectRepository;
        this.memberRepository = memberRepository;
    }

    public boolean canReadDataset(UUID datasetId, UUID userId) {
        return accessGuard.canReadDataset(datasetId, userId);
    }

    /**
     * Resolves the user's role on the project.
     * Returns OWNER if user is the project owner (or has an OWNER membership record),
     * or the active membership role, or empty if not a member.
     */
    @Transactional(readOnly = true)
    public Optional<ProjectMemberRole> resolveProjectRole(UUID projectId, UUID userId) {
        accessGuard.activeResearcher(userId);
        ResearchProject project = projectRepository.findById(projectId).orElse(null);
        if (project == null) {
            return Optional.empty();
        }

        if (project.getOwnerUserId().equals(userId)) {
            return Optional.of(ProjectMemberRole.OWNER);
        }

        return memberRepository.findActiveByProjectIdAndUserId(projectId, userId)
                .map(ResearchProjectMember::getRole);
    }

    /**
     * Verifies that the user has at least read/view access to the project.
     * Allowed: OWNER, CO_RESEARCHER, SUPERVISOR, VIEWER.
     */
    @Transactional(readOnly = true)
    public ResearchProject requireReadAccess(UUID projectId, UUID userId) {
        accessGuard.activeResearcher(userId);
        ResearchProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND, "Research project not found."));

        if (project.getOwnerUserId().equals(userId)) {
            return project;
        }

        boolean isMember = memberRepository.existsActiveByProjectIdAndUserId(projectId, userId);
        if (!isMember) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    ResearchErrorCode.PROJECT_ACCESS_DENIED, "Access denied: You are not an active member of this project.");
        }

        return project;
    }

    /**
     * Verifies owner permission for operations like managing team, submitting, archiving.
     */
    @Transactional(readOnly = true)
    public ResearchProject requireOwnerAccess(UUID projectId, UUID userId) {
        accessGuard.activeResearcher(userId);
        ResearchProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND, "Research project not found."));

        boolean isOwner = project.getOwnerUserId().equals(userId) ||
                memberRepository.findActiveByProjectIdAndUserId(projectId, userId)
                        .map(m -> m.getRole() == ProjectMemberRole.OWNER)
                        .orElse(false);

        if (!isOwner) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    ResearchErrorCode.PROJECT_ACCESS_DENIED, "Only the project owner can perform this operation.");
        }

        return project;
    }

    /**
     * Verifies permission to manage dataset requests for a project (create, edit, submit, cancel).
     * Allowed: OWNER, CO_RESEARCHER.
     * Disallowed: SUPERVISOR, VIEWER.
     */
    @Transactional(readOnly = true)
    public ResearchProject requireDatasetRequestPermission(UUID projectId, UUID userId) {
        ResearchProject project = requireReadAccess(projectId, userId);
        ProjectMemberRole role = resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role != ProjectMemberRole.OWNER && role != ProjectMemberRole.CO_RESEARCHER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Only project Owners and Co-Researchers can manage dataset requests.");
        }

        return project;
    }

    /**
     * Verifies permission to create notes.
     * Allowed: OWNER, CO_RESEARCHER.
     * Disallowed: SUPERVISOR, VIEWER.
     */
    @Transactional(readOnly = true)
    public ProjectMemberRole requireNoteCreationPermission(UUID projectId, UUID userId) {
        requireReadAccess(projectId, userId);
        ProjectMemberRole role = resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role != ProjectMemberRole.OWNER && role != ProjectMemberRole.CO_RESEARCHER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Only project Owners and Co-Researchers can create research notes.");
        }

        return role;
    }

    /**
     * Verifies permission to edit a note.
     * Allowed: Note author (if active member) or project OWNER.
     */
    @Transactional(readOnly = true)
    public void requireNoteEditPermission(UUID projectId, UUID authorUserId, UUID requesterUserId) {
        requireReadAccess(projectId, requesterUserId);
        ProjectMemberRole role = resolveProjectRole(projectId, requesterUserId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role == ProjectMemberRole.OWNER) {
            return; // Owner can edit any note
        }

        if (authorUserId.equals(requesterUserId) && role == ProjectMemberRole.CO_RESEARCHER) {
            return; // Author can edit own note
        }

        throw new ResearchApiException(HttpStatus.FORBIDDEN,
                "INSUFFICIENT_ROLE", "Only the note author or project owner can edit this note.");
    }

    /**
     * Verifies permission to comment on notes.
     * Allowed: OWNER, CO_RESEARCHER, SUPERVISOR.
     * Disallowed: VIEWER.
     */
    @Transactional(readOnly = true)
    public ProjectMemberRole requireCommentPermission(UUID projectId, UUID userId) {
        requireReadAccess(projectId, userId);
        ProjectMemberRole role = resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role == ProjectMemberRole.VIEWER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Viewers have read-only access and cannot comment on research notes.");
        }

        return role;
    }

    /**
     * Verifies permission to upload files.
     * Allowed: OWNER, CO_RESEARCHER.
     * Disallowed: SUPERVISOR, VIEWER.
     */
    @Transactional(readOnly = true)
    public ProjectMemberRole requireFileUploadPermission(UUID projectId, UUID userId) {
        requireReadAccess(projectId, userId);
        ProjectMemberRole role = resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role != ProjectMemberRole.OWNER && role != ProjectMemberRole.CO_RESEARCHER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Only project Owners and Co-Researchers can upload project documents.");
        }

        return role;
    }

    /**
     * Verifies permission to archive/delete a file.
     * Allowed: Uploader or project OWNER.
     */
    @Transactional(readOnly = true)
    public void requireFileArchivePermission(UUID projectId, UUID uploaderUserId, UUID requesterUserId) {
        requireReadAccess(projectId, requesterUserId);
        ProjectMemberRole role = resolveProjectRole(projectId, requesterUserId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role == ProjectMemberRole.OWNER || uploaderUserId.equals(requesterUserId)) {
            return;
        }

        throw new ResearchApiException(HttpStatus.FORBIDDEN,
                "INSUFFICIENT_ROLE", "Only the file uploader or project owner can archive this file.");
    }
}
