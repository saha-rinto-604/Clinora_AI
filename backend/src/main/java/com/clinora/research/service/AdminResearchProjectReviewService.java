package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.AdminResearchProjectModels.*;
import com.clinora.research.api.ResearchProjectModels.ProjectResponse;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectReview;
import com.clinora.research.domain.ResearchProjectReviewAction;
import com.clinora.research.domain.ResearchProjectStatus;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.ResearchProjectRepository;
import com.clinora.research.repository.ResearchProjectReviewRepository;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.repository.UserAccountRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class AdminResearchProjectReviewService {

    private static final List<ResearchProjectStatus> DEFAULT_QUEUE_STATUSES = List.of(
            ResearchProjectStatus.SUBMITTED,
            ResearchProjectStatus.UNDER_REVIEW,
            ResearchProjectStatus.MORE_INFO_REQUIRED,
            ResearchProjectStatus.APPROVED,
            ResearchProjectStatus.REJECTED
    );

    private final ResearchProjectRepository projectRepository;
    private final ResearchProjectReviewRepository reviewRepository;
    private final UserAccountRepository userRepository;
    private final AuthAuditService auditService;
    private final Clock clock;

    public AdminResearchProjectReviewService(
            ResearchProjectRepository projectRepository,
            ResearchProjectReviewRepository reviewRepository,
            UserAccountRepository userRepository,
            AuthAuditService auditService,
            Clock clock
    ) {
        this.projectRepository = projectRepository;
        this.reviewRepository = reviewRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AdminProjectPageResponse listReviewQueue(
            ResearchProjectStatus status,
            int page,
            int size,
            String sortParam
    ) {
        int safePage = Math.max(0, page - 1);
        int safeSize = Math.clamp(size, 1, 50);
        Sort sort = parseSort(sortParam);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, sort);

        Page<ResearchProject> projectPage = (status != null)
                ? projectRepository.findByStatus(status, pageRequest)
                : projectRepository.findByStatusIn(DEFAULT_QUEUE_STATUSES, pageRequest);

        Set<UUID> ownerUserIds = projectPage.getContent().stream()
                .map(ResearchProject::getOwnerUserId)
                .collect(Collectors.toSet());

        Map<UUID, UserAccount> usersById = userRepository.findAllById(ownerUserIds).stream()
                .collect(Collectors.toMap(UserAccount::getId, u -> u));

        List<AdminProjectQueueItem> items = projectPage.getContent().stream()
                .map(project -> {
                    UserAccount owner = usersById.get(project.getOwnerUserId());
                    String ownerName = (owner != null)
                            ? owner.getFirstName() + " " + owner.getLastName()
                            : "Unknown Researcher";
                    String ownerEmail = (owner != null) ? owner.getEmail() : "unknown@clinora.local";
                    return AdminProjectQueueItem.of(project, ownerName, ownerEmail);
                })
                .toList();

        return new AdminProjectPageResponse(
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
    public AdminProjectDetailResponse getProjectDetail(UUID projectId) {
        ResearchProject project = findProject(projectId);
        List<ProjectReviewRecord> reviewHistory = reviewRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .map(ProjectReviewRecord::from)
                .toList();

        UserAccount owner = userRepository.findById(project.getOwnerUserId()).orElse(null);
        String ownerName = (owner != null)
                ? owner.getFirstName() + " " + owner.getLastName()
                : "Unknown Researcher";
        String ownerEmail = (owner != null) ? owner.getEmail() : "unknown@clinora.local";

        return new AdminProjectDetailResponse(
                ProjectResponse.from(project),
                ownerName,
                ownerEmail,
                reviewHistory
        );
    }

    public AdminProjectDetailResponse startReview(
            UUID adminUserId,
            UUID projectId,
            String ip,
            String userAgent
    ) {
        ResearchProject project = findProject(projectId);
        Instant now = Instant.now(clock);

        project.startReview(adminUserId, now);
        projectRepository.save(project);

        ResearchProjectReview review = ResearchProjectReview.record(
                projectId,
                adminUserId,
                ResearchProjectReviewAction.REVIEW_STARTED,
                null,
                now
        );
        reviewRepository.save(review);

        auditService.record(
                adminUserId,
                AuthAuditAction.RESEARCH_PROJECT_REVIEW_STARTED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                projectId.toString(),
                "status=" + project.getStatus()
        );

        return getProjectDetail(projectId);
    }

    public AdminProjectDetailResponse requestInformation(
            UUID adminUserId,
            UUID projectId,
            String comment,
            String ip,
            String userAgent
    ) {
        ResearchProject project = findProject(projectId);
        Instant now = Instant.now(clock);

        project.requestMoreInfo(adminUserId, comment, now);
        projectRepository.save(project);

        ResearchProjectReview review = ResearchProjectReview.record(
                projectId,
                adminUserId,
                ResearchProjectReviewAction.INFORMATION_REQUESTED,
                comment,
                now
        );
        reviewRepository.save(review);

        auditService.record(
                adminUserId,
                AuthAuditAction.RESEARCH_PROJECT_MORE_INFO_REQUESTED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                projectId.toString(),
                "reason=" + comment
        );

        return getProjectDetail(projectId);
    }

    public AdminProjectDetailResponse approve(
            UUID adminUserId,
            UUID projectId,
            String comment,
            String ip,
            String userAgent
    ) {
        ResearchProject project = findProject(projectId);
        Instant now = Instant.now(clock);

        project.approve(adminUserId, comment, now);
        projectRepository.save(project);

        ResearchProjectReview review = ResearchProjectReview.record(
                projectId,
                adminUserId,
                ResearchProjectReviewAction.APPROVED,
                comment,
                now
        );
        reviewRepository.save(review);

        auditService.record(
                adminUserId,
                AuthAuditAction.RESEARCH_PROJECT_APPROVED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                projectId.toString(),
                "note=" + comment
        );

        return getProjectDetail(projectId);
    }

    public AdminProjectDetailResponse reject(
            UUID adminUserId,
            UUID projectId,
            String reason,
            String ip,
            String userAgent
    ) {
        ResearchProject project = findProject(projectId);
        Instant now = Instant.now(clock);

        project.reject(adminUserId, reason, now);
        projectRepository.save(project);

        ResearchProjectReview review = ResearchProjectReview.record(
                projectId,
                adminUserId,
                ResearchProjectReviewAction.REJECTED,
                reason,
                now
        );
        reviewRepository.save(review);

        auditService.record(
                adminUserId,
                AuthAuditAction.RESEARCH_PROJECT_REJECTED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                projectId.toString(),
                "reason=" + reason
        );

        return getProjectDetail(projectId);
    }

    private ResearchProject findProject(UUID projectId) {
        Objects.requireNonNull(projectId, "Project ID cannot be null");
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND,
                        "Research project not found."
                ));
    }

    private Sort parseSort(String sortParam) {
        if (sortParam == null || sortParam.isBlank()) {
            return Sort.by(Sort.Direction.ASC, "submittedAt");
        }

        String[] parts = sortParam.split(",");
        String property = parts[0].trim();
        Sort.Direction direction = (parts.length > 1 && parts[1].equalsIgnoreCase("desc"))
                ? Sort.Direction.DESC
                : Sort.Direction.ASC;

        return switch (property) {
            case "createdAt" -> Sort.by(direction, "createdAt");
            case "title" -> Sort.by(direction, "title");
            default -> Sort.by(direction, "submittedAt");
        };
    }
}
