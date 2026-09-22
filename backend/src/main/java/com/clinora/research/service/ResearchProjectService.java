package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.ResearchProjectModels.*;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectStatus;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.ResearchProjectRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@Transactional
public class ResearchProjectService {

    private final ResearchProjectRepository repository;
    private final AuthAuditService auditService;
    private final Clock clock;

    public ResearchProjectService(
            ResearchProjectRepository repository,
            AuthAuditService auditService,
            Clock clock
    ) {
        this.repository = repository;
        this.auditService = auditService;
        this.clock = clock;
    }

    public ProjectResponse createDraft(
            UUID researcherUserId,
            CreateProjectRequest request,
            String ip,
            String userAgent
    ) {
        Objects.requireNonNull(researcherUserId, "Researcher user ID cannot be null");
        Objects.requireNonNull(request, "Create request cannot be null");

        if (repository.existsByOwnerUserIdAndTitleIgnoreCase(researcherUserId, request.title().trim())) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.DUPLICATE_PROJECT_TITLE,
                    "A research project with this title already exists in your workspace."
            );
        }

        Instant now = Instant.now(clock);
        ResearchProject project = ResearchProject.createDraft(
                researcherUserId,
                request.title(),
                request.objective(),
                request.description(),
                request.researchField(),
                request.methodologySummary(),
                request.institutionName(),
                request.ethicsReference(),
                now
        );

        ResearchProject saved = repository.save(project);

        auditService.record(
                researcherUserId,
                AuthAuditAction.RESEARCH_PROJECT_CREATED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "title=" + saved.getTitle() + ";field=" + saved.getResearchField()
        );

        return ProjectResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public ProjectPageResponse listProjects(
            UUID researcherUserId,
            ResearchProjectStatus status,
            int page,
            int size,
            String sortParam
    ) {
        Objects.requireNonNull(researcherUserId, "Researcher user ID cannot be null");

        int safePage = Math.max(0, page - 1);
        int safeSize = Math.clamp(size, 1, 50);
        Sort sort = parseSort(sortParam);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, sort);

        Page<ResearchProject> projectPage = (status != null)
                ? repository.findByOwnerUserIdAndStatus(researcherUserId, status, pageRequest)
                : repository.findByOwnerUserId(researcherUserId, pageRequest);

        List<ProjectResponse> items = projectPage.getContent().stream()
                .map(ProjectResponse::from)
                .toList();

        return new ProjectPageResponse(
                items,
                pageRequest.getPageNumber() + 1,
                pageRequest.getPageSize(),
                projectPage.getTotalElements(),
                projectPage.getTotalPages(),
                projectPage.hasPrevious(),
                projectPage.hasNext()
        );
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProject(UUID researcherUserId, UUID projectId) {
        ResearchProject project = findOwnedProject(researcherUserId, projectId);
        return ProjectResponse.from(project);
    }

    public ProjectResponse updateProject(
            UUID researcherUserId,
            UUID projectId,
            UpdateProjectRequest request,
            String ip,
            String userAgent
    ) {
        ResearchProject project = findOwnedProject(researcherUserId, projectId);

        if (!project.getTitle().equalsIgnoreCase(request.title().trim())
                && repository.existsByOwnerUserIdAndTitleIgnoreCase(researcherUserId, request.title().trim())) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.DUPLICATE_PROJECT_TITLE,
                    "Another research project with this title already exists in your workspace."
            );
        }

        Instant now = Instant.now(clock);
        project.updateDraft(
                request.title(),
                request.objective(),
                request.description(),
                request.researchField(),
                request.methodologySummary(),
                request.institutionName(),
                request.ethicsReference(),
                now
        );

        ResearchProject saved = repository.save(project);

        auditService.record(
                researcherUserId,
                AuthAuditAction.RESEARCH_PROJECT_UPDATED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "title=" + saved.getTitle()
        );

        return ProjectResponse.from(saved);
    }

    public ProjectResponse submitProject(UUID researcherUserId, UUID projectId, String ip, String userAgent) {
        ResearchProject project = findOwnedProject(researcherUserId, projectId);
        Instant now = Instant.now(clock);
        project.submit(now);

        ResearchProject saved = repository.save(project);

        auditService.record(
                researcherUserId,
                AuthAuditAction.RESEARCH_PROJECT_SUBMITTED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "status=" + saved.getStatus()
        );

        return ProjectResponse.from(saved);
    }

    public ProjectResponse withdrawProject(UUID researcherUserId, UUID projectId, String ip, String userAgent) {
        ResearchProject project = findOwnedProject(researcherUserId, projectId);
        Instant now = Instant.now(clock);
        project.withdraw(now);

        ResearchProject saved = repository.save(project);

        auditService.record(
                researcherUserId,
                AuthAuditAction.RESEARCH_PROJECT_WITHDRAWN,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "status=" + saved.getStatus()
        );

        return ProjectResponse.from(saved);
    }

    public ProjectResponse completeProject(UUID researcherUserId, UUID projectId, String ip, String userAgent) {
        ResearchProject project = findOwnedProject(researcherUserId, projectId);
        Instant now = Instant.now(clock);
        project.complete(now);

        ResearchProject saved = repository.save(project);

        auditService.record(
                researcherUserId,
                AuthAuditAction.RESEARCH_PROJECT_COMPLETED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "status=" + saved.getStatus()
        );

        return ProjectResponse.from(saved);
    }

    public ProjectResponse archiveProject(UUID researcherUserId, UUID projectId, String ip, String userAgent) {
        ResearchProject project = findOwnedProject(researcherUserId, projectId);
        Instant now = Instant.now(clock);
        project.archive(now);

        ResearchProject saved = repository.save(project);

        auditService.record(
                researcherUserId,
                AuthAuditAction.RESEARCH_PROJECT_ARCHIVED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "status=" + saved.getStatus()
        );

        return ProjectResponse.from(saved);
    }

    private ResearchProject findOwnedProject(UUID researcherUserId, UUID projectId) {
        Objects.requireNonNull(researcherUserId, "Researcher user ID cannot be null");
        Objects.requireNonNull(projectId, "Project ID cannot be null");

        return repository.findByIdAndOwnerUserId(projectId, researcherUserId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND,
                        "Research project not found."
                ));
    }

    private Sort parseSort(String sortParam) {
        if (sortParam == null || sortParam.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }

        String[] parts = sortParam.split(",");
        String property = parts[0].trim();
        Sort.Direction direction = (parts.length > 1 && parts[1].equalsIgnoreCase("asc"))
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

        return switch (property) {
            case "updatedAt" -> Sort.by(direction, "updatedAt");
            case "title" -> Sort.by(direction, "title");
            default -> Sort.by(direction, "createdAt");
        };
    }
}
