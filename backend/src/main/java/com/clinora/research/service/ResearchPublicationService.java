package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.research.api.ResearchPublicationModels.*;
import com.clinora.research.domain.ProjectMemberRole;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectMember;
import com.clinora.research.domain.ResearchPublication;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.ResearchProjectMemberRepository;
import com.clinora.research.repository.ResearchProjectRepository;
import com.clinora.research.repository.ResearchPublicationRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phase R15 — Research Publication & Scientific Output Tracking Service.
 *
 * <p>Tracks verified research literature, preprints, journal articles, and citation
 * metadata originating from approved Clinora studies.
 */
@Service
public class ResearchPublicationService {

    private static final Logger log = LoggerFactory.getLogger(ResearchPublicationService.class);

    private final ResearchPublicationRepository publicationRepository;
    private final ResearchProjectRepository projectRepository;
    private final ResearchProjectMemberRepository memberRepository;
    private final ResearchAuditService auditService;
    private final ObjectMapper objectMapper;

    public ResearchPublicationService(
            ResearchPublicationRepository publicationRepository,
            ResearchProjectRepository projectRepository,
            ResearchProjectMemberRepository memberRepository,
            ResearchAuditService auditService,
            ObjectMapper objectMapper
    ) {
        this.publicationRepository = publicationRepository;
        this.projectRepository = projectRepository;
        this.memberRepository = memberRepository;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public PublicationResponse createPublication(
            UUID projectId,
            UUID userId,
            CreatePublicationRequest request,
            String ipAddress,
            String userAgent
    ) {
        ResearchProject project = verifyWritePermission(projectId, userId);

        String citationMetaJson = "{}";
        if (request.citationMetadata() != null && !request.citationMetadata().isEmpty()) {
            try {
                citationMetaJson = objectMapper.writeValueAsString(request.citationMetadata());
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize publication citation metadata, using default {}", e.getMessage());
            }
        }

        ResearchPublication pub = new ResearchPublication(
                UUID.randomUUID(),
                projectId,
                request.title(),
                request.abstractText(),
                request.publicationType(),
                request.doi(),
                request.journal(),
                request.conference(),
                request.publicationDate(),
                request.externalUrl(),
                citationMetaJson,
                userId
        );

        pub = publicationRepository.save(pub);
        log.info("Registered research publication {} for project {}", pub.getId(), projectId);

        auditService.recordEvent(
                userId,
                AuthAuditAction.PUBLICATION_REGISTERED,
                AuthAuditOutcome.SUCCESS,
                projectId.toString(),
                ipAddress,
                userAgent,
                Map.of(
                        "publicationId", pub.getId().toString(),
                        "title", pub.getTitle(),
                        "publicationType", pub.getPublicationType().name()
                )
        );

        return toResponse(pub, project);
    }

    @Transactional
    public PublicationResponse updatePublication(
            UUID projectId,
            UUID publicationId,
            UUID userId,
            UpdatePublicationRequest request,
            String ipAddress,
            String userAgent
    ) {
        ResearchProject project = verifyWritePermission(projectId, userId);

        ResearchPublication pub = publicationRepository.findByIdAndProjectId(publicationId, projectId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "PUBLICATION_NOT_FOUND",
                        "Publication not found: " + publicationId
                ));

        String citationMetaJson = pub.getCitationMetadata();
        if (request.citationMetadata() != null && !request.citationMetadata().isEmpty()) {
            try {
                citationMetaJson = objectMapper.writeValueAsString(request.citationMetadata());
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize citation metadata update {}", e.getMessage());
            }
        }

        pub.update(
                request.title(),
                request.abstractText(),
                request.publicationType(),
                request.doi(),
                request.journal(),
                request.conference(),
                request.publicationDate(),
                request.externalUrl(),
                citationMetaJson
        );

        pub = publicationRepository.save(pub);

        auditService.recordEvent(
                userId,
                AuthAuditAction.PUBLICATION_UPDATED,
                AuthAuditOutcome.SUCCESS,
                projectId.toString(),
                ipAddress,
                userAgent,
                Map.of(
                        "publicationId", pub.getId().toString(),
                        "title", pub.getTitle()
                )
        );

        return toResponse(pub, project);
    }

    @Transactional
    public void deletePublication(
            UUID projectId,
            UUID publicationId,
            UUID userId,
            String ipAddress,
            String userAgent
    ) {
        ResearchProject project = verifyWritePermission(projectId, userId);

        ResearchPublication pub = publicationRepository.findByIdAndProjectId(publicationId, projectId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "PUBLICATION_NOT_FOUND",
                        "Publication not found: " + publicationId
                ));

        publicationRepository.delete(pub);
        log.info("Deleted publication {} from project {}", publicationId, projectId);

        auditService.recordEvent(
                userId,
                AuthAuditAction.PUBLICATION_REMOVED,
                AuthAuditOutcome.SUCCESS,
                projectId.toString(),
                ipAddress,
                userAgent,
                Map.of("publicationId", publicationId.toString())
        );
    }

    @Transactional(readOnly = true)
    public PublicationResponse getPublication(UUID projectId, UUID publicationId, UUID userId) {
        ResearchProject project = verifyReadPermission(projectId, userId);
        ResearchPublication pub = publicationRepository.findByIdAndProjectId(publicationId, projectId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "PUBLICATION_NOT_FOUND",
                        "Publication not found: " + publicationId
                ));
        return toResponse(pub, project);
    }

    @Transactional(readOnly = true)
    public List<PublicationResponse> listPublications(UUID projectId, UUID userId) {
        ResearchProject project = verifyReadPermission(projectId, userId);
        return publicationRepository.findByProjectIdOrderByCreatedAtDesc(projectId)
                .stream()
                .map(p -> toResponse(p, project))
                .toList();
    }

    public CitationFormatsResponse generateCitations(ResearchPublication pub, ResearchProject project) {
        String year = (pub.getPublicationDate() != null)
                ? String.valueOf(pub.getPublicationDate().getYear())
                : "n.d.";
        String venue = (pub.getJournal() != null && !pub.getJournal().isBlank())
                ? pub.getJournal()
                : (pub.getConference() != null ? pub.getConference() : "Clinora Research Repository");
        String doiPart = (pub.getDoi() != null && !pub.getDoi().isBlank())
                ? " https://doi.org/" + pub.getDoi()
                : "";

        // APA Format
        String apa = String.format("Clinora Research Team (%s). %s. %s.%s", year, pub.getTitle(), venue, doiPart);

        // IEEE Format
        String ieeeDoi = (pub.getDoi() != null && !pub.getDoi().isBlank()) ? ", doi: " + pub.getDoi() : "";
        String ieee = String.format("Clinora Research Team, \"%s,\" in %s, %s%s.", pub.getTitle(), venue, year, ieeeDoi);

        // BibTeX Format
        String citeKey = "clinora_" + pub.getId().toString().substring(0, 8);
        String bibtex = String.format(
                """
                @article{%s,
                  title = {%s},
                  author = {Clinora Research Consortium},
                  journal = {%s},
                  year = {%s},
                  doi = {%s}
                }""",
                citeKey,
                pub.getTitle(),
                venue,
                year,
                pub.getDoi() != null ? pub.getDoi() : ""
        );

        return new CitationFormatsResponse(apa, ieee, bibtex);
    }

    private ResearchProject verifyWritePermission(UUID projectId, UUID userId) {
        ResearchProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND,
                        "Research project not found: " + projectId
                ));

        if (project.getOwnerUserId().equals(userId)) {
            return project;
        }

        boolean canWrite = memberRepository.findByProjectIdAndUserId(projectId, userId)
                .map(m -> m.getRole() == ProjectMemberRole.OWNER || m.getRole() == ProjectMemberRole.CO_RESEARCHER)
                .orElse(false);

        if (!canWrite) {
            throw new ResearchApiException(
                    HttpStatus.FORBIDDEN,
                    ResearchErrorCode.PROJECT_ACCESS_DENIED,
                    "Only project owners and co-researchers can manage publications"
            );
        }
        return project;
    }

    private ResearchProject verifyReadPermission(UUID projectId, UUID userId) {
        ResearchProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        ResearchErrorCode.PROJECT_NOT_FOUND,
                        "Research project not found: " + projectId
                ));

        if (project.getOwnerUserId().equals(userId)) {
            return project;
        }

        boolean isMember = memberRepository.existsByProjectIdAndUserId(projectId, userId);
        if (!isMember) {
            throw new ResearchApiException(
                    HttpStatus.FORBIDDEN,
                    ResearchErrorCode.PROJECT_ACCESS_DENIED,
                    "User is not authorized to view publications for project: " + projectId
            );
        }
        return project;
    }

    private PublicationResponse toResponse(ResearchPublication pub, ResearchProject project) {
        CitationFormatsResponse citations = generateCitations(pub, project);
        return new PublicationResponse(
                pub.getId(),
                pub.getProjectId(),
                pub.getTitle(),
                pub.getAbstractText(),
                pub.getPublicationType(),
                pub.getDoi(),
                pub.getJournal(),
                pub.getConference(),
                pub.getPublicationDate(),
                pub.getExternalUrl(),
                pub.getCitationMetadata(),
                citations,
                pub.getCreatedBy(),
                pub.getCreatedAt(),
                pub.getUpdatedAt()
        );
    }
}
