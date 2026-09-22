package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.DatasetRequestModels.*;
import com.clinora.research.domain.DatasetRequest;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.DatasetRequestRepository;
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
public class DatasetRequestService {

    private final DatasetRequestRepository requestRepository;
    private final ResearchProjectRepository projectRepository;
    private final AuthAuditService auditService;
    private final Clock clock;

    public DatasetRequestService(
            DatasetRequestRepository requestRepository,
            ResearchProjectRepository projectRepository,
            AuthAuditService auditService,
            Clock clock
    ) {
        this.requestRepository = requestRepository;
        this.projectRepository = projectRepository;
        this.auditService = auditService;
        this.clock = clock;
    }

    public DatasetRequestResponse createDraft(
            UUID researcherUserId,
            UUID projectId,
            CreateDatasetRequestInput input,
            String ip,
            String userAgent
    ) {
        ResearchProject project = findOwnedProject(researcherUserId, projectId);
        validateProjectEligibility(project);

        if (requestRepository.existsByProjectIdAndNameIgnoreCase(projectId, input.name().trim())) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.DUPLICATE_PROJECT_TITLE,
                    "A dataset request with this name already exists in this research project."
            );
        }

        Instant now = Instant.now(clock);
        DatasetRequest datasetRequest = DatasetRequest.createDraft(
                projectId,
                input.name(),
                input.purpose(),
                input.requestedPopulation(),
                input.requestedVariables(),
                input.requestedFilters(),
                input.requestedFormat(),
                now
        );

        DatasetRequest saved = requestRepository.save(datasetRequest);

        auditService.record(
                researcherUserId,
                AuthAuditAction.DATASET_REQUEST_CREATED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "project=" + projectId + ";name=" + saved.getName()
        );

        return DatasetRequestResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public DatasetRequestPageResponse listByProject(
            UUID researcherUserId,
            UUID projectId,
            int page,
            int size
    ) {
        findOwnedProject(researcherUserId, projectId);

        int safePage = Math.max(0, page - 1);
        int safeSize = Math.clamp(size, 1, 50);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<DatasetRequest> requestPage = requestRepository.findByProjectId(projectId, pageRequest);
        List<DatasetRequestResponse> items = requestPage.getContent().stream()
                .map(DatasetRequestResponse::from)
                .toList();

        return new DatasetRequestPageResponse(
                items,
                pageRequest.getPageNumber() + 1,
                pageRequest.getPageSize(),
                requestPage.getTotalElements(),
                requestPage.getTotalPages(),
                requestPage.hasPrevious(),
                requestPage.hasNext()
        );
    }

    @Transactional(readOnly = true)
    public DatasetRequestResponse getDetail(UUID researcherUserId, UUID requestId) {
        DatasetRequest request = findOwnedRequest(researcherUserId, requestId);
        return DatasetRequestResponse.from(request);
    }

    public DatasetRequestResponse updateDraft(
            UUID researcherUserId,
            UUID requestId,
            UpdateDatasetRequestInput input,
            String ip,
            String userAgent
    ) {
        DatasetRequest request = findOwnedRequest(researcherUserId, requestId);
        Instant now = Instant.now(clock);

        request.updateDraft(
                input.name(),
                input.purpose(),
                input.requestedPopulation(),
                input.requestedVariables(),
                input.requestedFilters(),
                input.requestedFormat(),
                now
        );

        DatasetRequest saved = requestRepository.save(request);

        auditService.record(
                researcherUserId,
                AuthAuditAction.DATASET_REQUEST_UPDATED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "name=" + saved.getName()
        );

        return DatasetRequestResponse.from(saved);
    }

    public DatasetRequestResponse submit(
            UUID researcherUserId,
            UUID requestId,
            String ip,
            String userAgent
    ) {
        DatasetRequest request = findOwnedRequest(researcherUserId, requestId);
        ResearchProject project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND, ResearchErrorCode.PROJECT_NOT_FOUND, "Project not found"));
        validateProjectEligibility(project);

        Instant now = Instant.now(clock);
        request.submit(now);
        DatasetRequest saved = requestRepository.save(request);

        auditService.record(
                researcherUserId,
                AuthAuditAction.DATASET_REQUEST_SUBMITTED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "status=" + saved.getStatus()
        );

        return DatasetRequestResponse.from(saved);
    }

    public DatasetRequestResponse cancel(
            UUID researcherUserId,
            UUID requestId,
            String ip,
            String userAgent
    ) {
        DatasetRequest request = findOwnedRequest(researcherUserId, requestId);
        Instant now = Instant.now(clock);
        request.cancel(now);
        DatasetRequest saved = requestRepository.save(request);

        auditService.record(
                researcherUserId,
                AuthAuditAction.DATASET_REQUEST_CANCELLED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                saved.getId().toString(),
                "status=" + saved.getStatus()
        );

        return DatasetRequestResponse.from(saved);
    }

    private ResearchProject findOwnedProject(UUID researcherUserId, UUID projectId) {
        Objects.requireNonNull(researcherUserId, "Researcher user ID cannot be null");
        Objects.requireNonNull(projectId, "Project ID cannot be null");

        return projectRepository.findByIdAndOwnerUserId(projectId, researcherUserId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND,
                        "Research project not found."
                ));
    }

    private DatasetRequest findOwnedRequest(UUID researcherUserId, UUID requestId) {
        Objects.requireNonNull(researcherUserId, "Researcher user ID cannot be null");
        Objects.requireNonNull(requestId, "Dataset request ID cannot be null");

        DatasetRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND,
                        "Dataset request not found."
                ));

        ResearchProject project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND,
                        "Associated research project not found."
                ));

        if (!project.getOwnerUserId().equals(researcherUserId)) {
            throw new ResearchApiException(
                    HttpStatus.NOT_FOUND,
                    ResearchErrorCode.PROJECT_NOT_FOUND,
                    "Dataset request not found."
            );
        }

        return request;
    }

    private void validateProjectEligibility(ResearchProject project) {
        if (!project.getStatus().isApprovedOrActive()) {
            throw new ResearchApiException(
                    HttpStatus.CONFLICT,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Dataset requests can only be initiated for APPROVED or ACTIVE research projects. Current project status: " + project.getStatus()
            );
        }
    }
}
