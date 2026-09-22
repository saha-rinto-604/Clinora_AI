package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.DatasetRequestModels.*;
import com.clinora.research.domain.DatasetRequest;
import com.clinora.research.domain.DatasetRequestStatus;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.DatasetRequestRepository;
import com.clinora.research.repository.ResearchProjectRepository;
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
public class AdminDatasetRequestReviewService {

    private static final List<DatasetRequestStatus> DEFAULT_QUEUE_STATUSES = List.of(
            DatasetRequestStatus.SUBMITTED,
            DatasetRequestStatus.UNDER_REVIEW,
            DatasetRequestStatus.MORE_INFO_REQUIRED,
            DatasetRequestStatus.APPROVED,
            DatasetRequestStatus.REJECTED
    );

    private final DatasetRequestRepository requestRepository;
    private final ResearchProjectRepository projectRepository;
    private final UserAccountRepository userRepository;
    private final AuthAuditService auditService;
    private final Clock clock;

    public AdminDatasetRequestReviewService(
            DatasetRequestRepository requestRepository,
            ResearchProjectRepository projectRepository,
            UserAccountRepository userRepository,
            AuthAuditService auditService,
            Clock clock
    ) {
        this.requestRepository = requestRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<AdminDatasetRequestQueueItem> listQueue(
            DatasetRequestStatus status,
            int page,
            int size
    ) {
        int safePage = Math.max(0, page - 1);
        int safeSize = Math.clamp(size, 1, 50);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.ASC, "createdAt"));

        Page<DatasetRequest> requestPage = (status != null)
                ? requestRepository.findByStatus(status, pageRequest)
                : requestRepository.findByStatusIn(DEFAULT_QUEUE_STATUSES, pageRequest);

        Set<UUID> projectIds = requestPage.getContent().stream()
                .map(DatasetRequest::getProjectId)
                .collect(Collectors.toSet());

        Map<UUID, ResearchProject> projectsById = projectRepository.findAllById(projectIds).stream()
                .collect(Collectors.toMap(ResearchProject::getId, p -> p));

        Set<UUID> userIds = projectsById.values().stream()
                .map(ResearchProject::getOwnerUserId)
                .collect(Collectors.toSet());

        Map<UUID, UserAccount> usersById = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(UserAccount::getId, u -> u));

        return requestPage.getContent().stream()
                .map(req -> {
                    ResearchProject project = projectsById.get(req.getProjectId());
                    String projectTitle = (project != null) ? project.getTitle() : "Unknown Project";
                    UserAccount owner = (project != null) ? usersById.get(project.getOwnerUserId()) : null;
                    String researcherName = (owner != null)
                            ? owner.getFirstName() + " " + owner.getLastName()
                            : "Unknown Researcher";
                    String researcherEmail = (owner != null) ? owner.getEmail() : "unknown@clinora.local";

                    return new AdminDatasetRequestQueueItem(
                            req.getId(),
                            req.getProjectId(),
                            projectTitle,
                            researcherName,
                            researcherEmail,
                            req.getName(),
                            req.getRequestedFormat(),
                            req.getStatus(),
                            req.getSubmittedAt(),
                            req.getCreatedAt()
                    );
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminDatasetRequestDetailResponse getDetail(UUID requestId) {
        DatasetRequest request = findRequest(requestId);
        ResearchProject project = projectRepository.findById(request.getProjectId()).orElse(null);
        String projectTitle = (project != null) ? project.getTitle() : "Unknown Project";

        UserAccount owner = (project != null)
                ? userRepository.findById(project.getOwnerUserId()).orElse(null)
                : null;
        String researcherName = (owner != null)
                ? owner.getFirstName() + " " + owner.getLastName()
                : "Unknown Researcher";
        String researcherEmail = (owner != null) ? owner.getEmail() : "unknown@clinora.local";

        return new AdminDatasetRequestDetailResponse(
                DatasetRequestResponse.from(request),
                projectTitle,
                researcherName,
                researcherEmail
        );
    }

    public AdminDatasetRequestDetailResponse startReview(
            UUID adminUserId,
            UUID requestId,
            String ip,
            String userAgent
    ) {
        DatasetRequest request = findRequest(requestId);
        Instant now = Instant.now(clock);
        request.startReview(adminUserId, now);

        DatasetRequest saved = requestRepository.save(request);

        auditService.record(
                adminUserId,
                AuthAuditAction.DATASET_REQUEST_REVIEW_STARTED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "status=" + saved.getStatus()
        );

        return getDetail(requestId);
    }

    public AdminDatasetRequestDetailResponse requestInformation(
            UUID adminUserId,
            UUID requestId,
            String notes,
            String ip,
            String userAgent
    ) {
        DatasetRequest request = findRequest(requestId);
        Instant now = Instant.now(clock);
        request.requestMoreInfo(adminUserId, notes, now);

        DatasetRequest saved = requestRepository.save(request);

        auditService.record(
                adminUserId,
                AuthAuditAction.DATASET_REQUEST_MORE_INFO_REQUESTED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "notes=" + notes
        );

        return getDetail(requestId);
    }

    public AdminDatasetRequestDetailResponse approve(
            UUID adminUserId,
            UUID requestId,
            String notes,
            Instant expiresAt,
            String ip,
            String userAgent
    ) {
        DatasetRequest request = findRequest(requestId);
        Instant now = Instant.now(clock);
        request.approve(adminUserId, notes, expiresAt, now);

        DatasetRequest saved = requestRepository.save(request);

        auditService.record(
                adminUserId,
                AuthAuditAction.DATASET_REQUEST_APPROVED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "notes=" + notes + ";expiresAt=" + expiresAt
        );

        return getDetail(requestId);
    }

    public AdminDatasetRequestDetailResponse reject(
            UUID adminUserId,
            UUID requestId,
            String reason,
            String ip,
            String userAgent
    ) {
        DatasetRequest request = findRequest(requestId);
        Instant now = Instant.now(clock);
        request.reject(adminUserId, reason, now);

        DatasetRequest saved = requestRepository.save(request);

        auditService.record(
                adminUserId,
                AuthAuditAction.DATASET_REQUEST_REJECTED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "reason=" + reason
        );

        return getDetail(requestId);
    }

    private DatasetRequest findRequest(UUID requestId) {
        Objects.requireNonNull(requestId, "Dataset request ID cannot be null");
        return requestRepository.findById(requestId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND,
                        "Dataset request not found."
                ));
    }
}
