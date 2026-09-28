package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.research.api.ResearchPublicationModels.*;
import com.clinora.research.domain.*;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Scientific Literature & Clinora Library Service.
 *
 * <p>Manages research publications, research outputs, and the global Clinora Library
 * discovery space.
 *
 * <p><strong>CRITICAL PRIVACY BOUNDARY:</strong>
 * Library outputs expose metadata, methodology, and safe provenance only. Under no
 * circumstances may Library responses contain storage keys, direct file links,
 * raw CSV/JSON, signed URLs, patient-level rows, or create DatasetAccessGrant records.
 */
@Service
public class ResearchPublicationService {

    private static final Logger log = LoggerFactory.getLogger(ResearchPublicationService.class);

    private final ResearchPublicationRepository publicationRepository;
    private final ResearchProjectRepository projectRepository;
    private final ResearchProjectMemberRepository memberRepository;
    private final DatasetVersionRepository datasetVersionRepository;
    private final ResearchDatasetRepository researchDatasetRepository;
    private final AIEvaluationRunRepository evaluationRunRepository;
    private final ResearchAuditService auditService;
    private final ObjectMapper objectMapper;

    public ResearchPublicationService(
            ResearchPublicationRepository publicationRepository,
            ResearchProjectRepository projectRepository,
            ResearchProjectMemberRepository memberRepository,
            DatasetVersionRepository datasetVersionRepository,
            ResearchDatasetRepository researchDatasetRepository,
            AIEvaluationRunRepository evaluationRunRepository,
            ResearchAuditService auditService,
            ObjectMapper objectMapper
    ) {
        this.publicationRepository = publicationRepository;
        this.projectRepository = projectRepository;
        this.memberRepository = memberRepository;
        this.datasetVersionRepository = datasetVersionRepository;
        this.researchDatasetRepository = researchDatasetRepository;
        this.evaluationRunRepository = evaluationRunRepository;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
    }

    // =========================================================================
    // 1. GLOBAL CLINORA LIBRARY (DISCOVERY)
    // =========================================================================

    @Transactional(readOnly = true)
    public Page<LibraryPublicationSummary> searchPublishedLibrary(
            String search,
            PublicationType publicationType,
            String researchField,
            Integer year,
            Pageable pageable
    ) {
        Page<ResearchPublication> page = publicationRepository.searchPublished(
                (search != null && !search.isBlank()) ? search.trim() : null,
                publicationType,
                (researchField != null && !researchField.isBlank()) ? researchField.trim() : null,
                year,
                pageable
        );

        Map<UUID, String> projectTitleMap = fetchProjectTitles(
                page.getContent().stream().map(ResearchPublication::getProjectId).collect(Collectors.toSet())
        );

        return page.map(pub -> toLibrarySummary(pub, projectTitleMap.getOrDefault(pub.getProjectId(), "Clinora Study")));
    }

    @Transactional(readOnly = true)
    public LibraryPublicationDetail getPublishedLibraryDetail(UUID publicationId, UUID currentUserId) {
        ResearchPublication pub = publicationRepository.findById(publicationId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "PUBLICATION_NOT_FOUND",
                        "Publication not found: " + publicationId
                ));

        // Visibility check: If not PUBLISHED or not CLINORA_RESEARCHERS, caller must be owner or project member
        if (pub.getStatus() != PublicationStatus.PUBLISHED || pub.getLibraryVisibility() != LibraryVisibility.CLINORA_RESEARCHERS) {
            boolean isOwnerOrMember = isUserProjectMemberOrOwner(pub.getProjectId(), currentUserId);
            if (!isOwnerOrMember) {
                throw new ResearchApiException(
                        HttpStatus.FORBIDDEN,
                        "PUBLICATION_ACCESS_DENIED",
                        "Publication is not published in Clinora Library"
                );
            }
        }

        ResearchProject project = projectRepository.findById(pub.getProjectId()).orElse(null);
        String projectTitle = project != null ? project.getTitle() : "Clinora Study";
        return toLibraryDetail(pub, projectTitle);
    }

    // =========================================================================
    // 2. MY RESEARCH OUTPUTS (MANAGEMENT)
    // =========================================================================

    @Transactional(readOnly = true)
    public List<MyResearchOutputSummary> listMyOutputs(UUID userId) {
        // Collect projects where user is owner or member
        Set<UUID> userProjectIds = new HashSet<>(projectRepository.findByOwnerUserIdOrderByCreatedAtDesc(userId)
                .stream().map(ResearchProject::getId).toList());

        userProjectIds.addAll(memberRepository.findByUserId(userId)
                .stream().map(ResearchProjectMember::getProjectId).toList());

        List<ResearchPublication> outputs;
        if (userProjectIds.isEmpty()) {
            outputs = publicationRepository.findByCreatedByOrderByUpdatedAtDesc(userId);
        } else {
            outputs = publicationRepository.findMyOutputs(userId, userProjectIds);
        }

        Map<UUID, String> projectTitles = fetchProjectTitles(
                outputs.stream().map(ResearchPublication::getProjectId).collect(Collectors.toSet())
        );

        return outputs.stream()
                .map(pub -> new MyResearchOutputSummary(
                        pub.getId(),
                        pub.getProjectId(),
                        projectTitles.getOrDefault(pub.getProjectId(), "Research Project"),
                        pub.getTitle(),
                        pub.getPublicationType(),
                        pub.getStatus(),
                        pub.getLibraryVisibility(),
                        pub.getAuthors(),
                        resolveVenue(pub),
                        pub.getPublicationDate(),
                        pub.getUpdatedAt(),
                        pub.getCreatedAt()
                ))
                .toList();
    }

    @Transactional
    public LibraryPublicationDetail registerOutput(
            UUID userId,
            RegisterResearchOutputRequest request,
            String ipAddress,
            String userAgent
    ) {
        ResearchProject project = verifyWritePermission(request.projectId(), userId);

        // Validate provenance links
        validateProvenanceBelongsToProject(request.projectId(), request.linkedDatasetVersionIds(), request.linkedEvaluationRunIds());

        String citationMetaJson = serializeJson(request.citationMetadata(), "{}");
        String dsVersionsJson = serializeJson(request.linkedDatasetVersionIds(), "[]");
        String evalRunsJson = serializeJson(request.linkedEvaluationRunIds(), "[]");

        ResearchPublication pub = new ResearchPublication(
                UUID.randomUUID(),
                request.projectId(),
                request.title(),
                request.abstractText(),
                request.publicationType(),
                request.status(),
                request.libraryVisibility() != null ? request.libraryVisibility() : LibraryVisibility.CLINORA_RESEARCHERS,
                request.methodologySummary(),
                request.studyDesign(),
                request.analysisSummary(),
                request.keywords(),
                request.authors(),
                request.researchField(),
                request.doi(),
                request.journal(),
                request.conference(),
                request.publicationDate(),
                request.publishedUrl(),
                citationMetaJson,
                dsVersionsJson,
                evalRunsJson,
                userId
        );

        pub = publicationRepository.save(pub);
        log.info("Registered research output {} for project {} by user {}", pub.getId(), request.projectId(), userId);

        auditService.recordEvent(
                userId,
                AuthAuditAction.PUBLICATION_CREATED,
                AuthAuditOutcome.SUCCESS,
                request.projectId().toString(),
                ipAddress,
                userAgent,
                Map.of(
                        "publicationId", pub.getId().toString(),
                        "title", pub.getTitle(),
                        "status", pub.getStatus().name(),
                        "visibility", pub.getLibraryVisibility().name()
                )
        );

        if (pub.getStatus() == PublicationStatus.PUBLISHED && pub.getLibraryVisibility() == LibraryVisibility.CLINORA_RESEARCHERS) {
            auditService.recordEvent(
                    userId,
                    AuthAuditAction.PUBLICATION_PUBLISHED_TO_LIBRARY,
                    AuthAuditOutcome.SUCCESS,
                    request.projectId().toString(),
                    ipAddress,
                    userAgent,
                    Map.of("publicationId", pub.getId().toString(), "title", pub.getTitle())
            );
        }

        if (request.linkedDatasetVersionIds() != null && !request.linkedDatasetVersionIds().isEmpty()) {
            auditService.recordEvent(
                    userId,
                    AuthAuditAction.PUBLICATION_DATASET_LINKED,
                    AuthAuditOutcome.SUCCESS,
                    request.projectId().toString(),
                    ipAddress,
                    userAgent,
                    Map.of("publicationId", pub.getId().toString(), "datasetVersionCount", String.valueOf(request.linkedDatasetVersionIds().size()))
            );
        }

        if (request.linkedEvaluationRunIds() != null && !request.linkedEvaluationRunIds().isEmpty()) {
            auditService.recordEvent(
                    userId,
                    AuthAuditAction.PUBLICATION_EVALUATION_LINKED,
                    AuthAuditOutcome.SUCCESS,
                    request.projectId().toString(),
                    ipAddress,
                    userAgent,
                    Map.of("publicationId", pub.getId().toString(), "evaluationRunCount", String.valueOf(request.linkedEvaluationRunIds().size()))
            );
        }

        return toLibraryDetail(pub, project.getTitle());
    }

    @Transactional
    public LibraryPublicationDetail updateOutput(
            UUID publicationId,
            UUID userId,
            UpdateResearchOutputRequest request,
            String ipAddress,
            String userAgent
    ) {
        ResearchPublication pub = publicationRepository.findById(publicationId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "PUBLICATION_NOT_FOUND",
                        "Publication not found: " + publicationId
                ));

        ResearchProject project = verifyWritePermission(pub.getProjectId(), userId);

        validateProvenanceBelongsToProject(pub.getProjectId(), request.linkedDatasetVersionIds(), request.linkedEvaluationRunIds());

        PublicationStatus oldStatus = pub.getStatus();
        LibraryVisibility oldVisibility = pub.getLibraryVisibility();

        String citationMetaJson = request.citationMetadata() != null ? serializeJson(request.citationMetadata(), pub.getCitationMetadata()) : pub.getCitationMetadata();
        String dsVersionsJson = request.linkedDatasetVersionIds() != null ? serializeJson(request.linkedDatasetVersionIds(), pub.getLinkedDatasetVersionIds()) : pub.getLinkedDatasetVersionIds();
        String evalRunsJson = request.linkedEvaluationRunIds() != null ? serializeJson(request.linkedEvaluationRunIds(), pub.getLinkedEvaluationRunIds()) : pub.getLinkedEvaluationRunIds();

        pub.update(
                request.title(),
                request.abstractText(),
                request.publicationType(),
                request.status(),
                request.libraryVisibility() != null ? request.libraryVisibility() : pub.getLibraryVisibility(),
                request.methodologySummary(),
                request.studyDesign(),
                request.analysisSummary(),
                request.keywords(),
                request.authors(),
                request.researchField(),
                request.doi(),
                request.journal(),
                request.conference(),
                request.publicationDate(),
                request.publishedUrl(),
                citationMetaJson,
                dsVersionsJson,
                evalRunsJson
        );

        pub = publicationRepository.save(pub);

        auditService.recordEvent(
                userId,
                AuthAuditAction.PUBLICATION_UPDATED,
                AuthAuditOutcome.SUCCESS,
                pub.getProjectId().toString(),
                ipAddress,
                userAgent,
                Map.of("publicationId", pub.getId().toString(), "title", pub.getTitle())
        );

        if (oldStatus != pub.getStatus()) {
            auditService.recordEvent(
                    userId,
                    AuthAuditAction.PUBLICATION_STATUS_CHANGED,
                    AuthAuditOutcome.SUCCESS,
                    pub.getProjectId().toString(),
                    ipAddress,
                    userAgent,
                    Map.of("publicationId", pub.getId().toString(), "oldStatus", oldStatus.name(), "newStatus", pub.getStatus().name())
            );
        }

        if (oldVisibility != pub.getLibraryVisibility()) {
            auditService.recordEvent(
                    userId,
                    AuthAuditAction.PUBLICATION_LIBRARY_VISIBILITY_CHANGED,
                    AuthAuditOutcome.SUCCESS,
                    pub.getProjectId().toString(),
                    ipAddress,
                    userAgent,
                    Map.of("publicationId", pub.getId().toString(), "oldVisibility", oldVisibility.name(), "newVisibility", pub.getLibraryVisibility().name())
            );
        }

        if (pub.getStatus() == PublicationStatus.PUBLISHED && pub.getLibraryVisibility() == LibraryVisibility.CLINORA_RESEARCHERS
                && (oldStatus != PublicationStatus.PUBLISHED || oldVisibility != LibraryVisibility.CLINORA_RESEARCHERS)) {
            auditService.recordEvent(
                    userId,
                    AuthAuditAction.PUBLICATION_PUBLISHED_TO_LIBRARY,
                    AuthAuditOutcome.SUCCESS,
                    pub.getProjectId().toString(),
                    ipAddress,
                    userAgent,
                    Map.of("publicationId", pub.getId().toString(), "title", pub.getTitle())
            );
        }

        return toLibraryDetail(pub, project.getTitle());
    }

    @Transactional
    public void deleteOutput(
            UUID publicationId,
            UUID userId,
            String ipAddress,
            String userAgent
    ) {
        ResearchPublication pub = publicationRepository.findById(publicationId)
                .orElseThrow(() -> new ResearchApiException(
                        HttpStatus.NOT_FOUND,
                        "PUBLICATION_NOT_FOUND",
                        "Publication not found: " + publicationId
                ));

        verifyWritePermission(pub.getProjectId(), userId);

        publicationRepository.delete(pub);
        log.info("Deleted research publication {} by user {}", publicationId, userId);

        auditService.recordEvent(
                userId,
                AuthAuditAction.PUBLICATION_REMOVED,
                AuthAuditOutcome.SUCCESS,
                pub.getProjectId().toString(),
                ipAddress,
                userAgent,
                Map.of("publicationId", publicationId.toString())
        );
    }

    @Transactional(readOnly = true)
    public List<ProjectSelectOption> getAuthorizedProjectsForRegistration(UUID userId) {
        List<ResearchProject> ownedProjects = projectRepository.findByOwnerUserIdOrderByCreatedAtDesc(userId);
        List<UUID> memberProjectIds = memberRepository.findByUserId(userId).stream()
                .filter(m -> m.getRole() == ProjectMemberRole.OWNER || m.getRole() == ProjectMemberRole.CO_RESEARCHER)
                .map(ResearchProjectMember::getProjectId)
                .toList();

        Set<ResearchProject> allProjects = new LinkedHashSet<>(ownedProjects);
        if (!memberProjectIds.isEmpty()) {
            allProjects.addAll(projectRepository.findAllById(memberProjectIds));
        }

        List<ProjectSelectOption> result = new ArrayList<>();
        for (ResearchProject p : allProjects) {
            // Find datasets for this project
            List<ResearchDataset> datasets = researchDatasetRepository.findByProjectIdOrderByCreatedAtDesc(p.getId());
            List<DatasetVersionSelectOption> dsOptions = new ArrayList<>();
            for (ResearchDataset d : datasets) {
                List<DatasetVersion> versions = datasetVersionRepository.findByDatasetIdOrderByVersionNumberDesc(d.getId());
                for (DatasetVersion v : versions) {
                    dsOptions.add(new DatasetVersionSelectOption(
                            v.getId(),
                            d.getName(),
                            v.getVersionNumber(),
                            v.getGeneratedAt()
                    ));
                }
            }

            // Find evaluation runs for this project
            List<AIEvaluationRun> runs = evaluationRunRepository.findByProjectIdOrderByCreatedAtDesc(p.getId());
            List<EvaluationRunSelectOption> runOptions = runs.stream()
                    .map(r -> new EvaluationRunSelectOption(r.getId(), r.getModelId(), r.getModelVersion(), r.getTaskType().name()))
                    .toList();

            result.add(new ProjectSelectOption(
                    p.getId(),
                    p.getTitle(),
                    p.getStatus().name(),
                    dsOptions,
                    runOptions
            ));
        }

        return result;
    }

    // =========================================================================
    // 3. PROJECT-SCOPED LEGACY / COMPATIBILITY
    // =========================================================================

    @Transactional
    public PublicationResponse createPublication(
            UUID projectId,
            UUID userId,
            CreatePublicationRequest request,
            String ipAddress,
            String userAgent
    ) {
        ResearchProject project = verifyWritePermission(projectId, userId);

        String citationMetaJson = serializeJson(request.citationMetadata(), "{}");

        ResearchPublication pub = new ResearchPublication(
                UUID.randomUUID(),
                projectId,
                request.title(),
                request.abstractText(),
                request.publicationType(),
                PublicationStatus.PUBLISHED,
                LibraryVisibility.CLINORA_RESEARCHERS,
                null,
                null,
                null,
                null,
                "Clinora Research Consortium",
                null,
                request.doi(),
                request.journal(),
                request.conference(),
                request.publicationDate(),
                request.externalUrl(),
                citationMetaJson,
                "[]",
                "[]",
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

        return toLegacyResponse(pub, project);
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

        String citationMetaJson = request.citationMetadata() != null ? serializeJson(request.citationMetadata(), pub.getCitationMetadata()) : pub.getCitationMetadata();

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

        return toLegacyResponse(pub, project);
    }

    @Transactional
    public void deletePublication(
            UUID projectId,
            UUID publicationId,
            UUID userId,
            String ipAddress,
            String userAgent
    ) {
        deleteOutput(publicationId, userId, ipAddress, userAgent);
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
        return toLegacyResponse(pub, project);
    }

    @Transactional(readOnly = true)
    public List<PublicationResponse> listPublications(UUID projectId, UUID userId) {
        ResearchProject project = verifyReadPermission(projectId, userId);
        return publicationRepository.findByProjectIdOrderByCreatedAtDesc(projectId)
                .stream()
                .map(p -> toLegacyResponse(p, project))
                .toList();
    }

    // =========================================================================
    // 4. CITATION & PROVENANCE HELPERS
    // =========================================================================

    public CitationFormatsResponse generateCitations(ResearchPublication pub, String projectTitle) {
        String year = (pub.getPublicationDate() != null)
                ? String.valueOf(pub.getPublicationDate().getYear())
                : "n.d.";
        String authors = (pub.getAuthors() != null && !pub.getAuthors().isBlank())
                ? pub.getAuthors()
                : "Clinora Research Consortium";
        String venue = resolveVenue(pub);
        String doiPart = (pub.getDoi() != null && !pub.getDoi().isBlank())
                ? " https://doi.org/" + pub.getDoi()
                : "";

        // APA Format
        String apa = String.format("%s (%s). %s. %s.%s", authors, year, pub.getTitle(), venue, doiPart);

        // IEEE Format
        String ieeeDoi = (pub.getDoi() != null && !pub.getDoi().isBlank()) ? ", doi: " + pub.getDoi() : "";
        String ieee = String.format("%s, \"%s,\" in %s, %s%s.", authors, pub.getTitle(), venue, year, ieeeDoi);

        // BibTeX Format
        String citeKey = "clinora_" + pub.getId().toString().substring(0, 8);
        String bibtex = String.format(
                """
                @article{%s,
                  title = {%s},
                  author = {%s},
                  journal = {%s},
                  year = {%s},
                  doi = {%s}
                }""",
                citeKey,
                pub.getTitle(),
                authors,
                venue,
                year,
                pub.getDoi() != null ? pub.getDoi() : ""
        );

        return new CitationFormatsResponse(apa, ieee, bibtex);
    }

    private LibraryPublicationSummary toLibrarySummary(ResearchPublication pub, String projectTitle) {
        Integer year = pub.getPublicationDate() != null ? pub.getPublicationDate().getYear() : null;
        List<LibraryDatasetProvenance> dsProv = resolveSafeDatasetProvenance(pub.getLinkedDatasetVersionIds());
        List<LibraryEvaluationProvenance> evalProv = resolveSafeEvaluationProvenance(pub.getLinkedEvaluationRunIds());

        return new LibraryPublicationSummary(
                pub.getId(),
                pub.getTitle(),
                pub.getAuthors(),
                resolveVenue(pub),
                year,
                pub.getPublicationDate(),
                pub.getPublicationType(),
                pub.getResearchField(),
                pub.getKeywords(),
                pub.getMethodologySummary(),
                pub.getDoi(),
                pub.getExternalUrl(),
                pub.getProjectId(),
                projectTitle,
                dsProv,
                evalProv
        );
    }

    private LibraryPublicationDetail toLibraryDetail(ResearchPublication pub, String projectTitle) {
        Integer year = pub.getPublicationDate() != null ? pub.getPublicationDate().getYear() : null;
        CitationFormatsResponse citations = generateCitations(pub, projectTitle);
        List<LibraryDatasetProvenance> dsProv = resolveSafeDatasetProvenance(pub.getLinkedDatasetVersionIds());
        List<LibraryEvaluationProvenance> evalProv = resolveSafeEvaluationProvenance(pub.getLinkedEvaluationRunIds());

        return new LibraryPublicationDetail(
                pub.getId(),
                pub.getProjectId(),
                projectTitle,
                pub.getTitle(),
                pub.getAbstractText(),
                pub.getMethodologySummary(),
                pub.getStudyDesign(),
                pub.getAnalysisSummary(),
                pub.getAuthors(),
                pub.getPublicationType(),
                pub.getStatus(),
                pub.getLibraryVisibility(),
                pub.getResearchField(),
                pub.getKeywords(),
                pub.getJournal(),
                pub.getConference(),
                resolveVenue(pub),
                pub.getPublicationDate(),
                year,
                pub.getDoi(),
                pub.getExternalUrl(),
                citations,
                dsProv,
                evalProv,
                pub.getCreatedBy(),
                pub.getCreatedAt(),
                pub.getUpdatedAt()
        );
    }

    private PublicationResponse toLegacyResponse(ResearchPublication pub, ResearchProject project) {
        CitationFormatsResponse citations = generateCitations(pub, project.getTitle());
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

    /**
     * Resolves safe dataset provenance metadata (datasetDisplayName, versionNumber, generatedAt).
     * NEVER returns storage keys, raw files, or patient rows.
     */
    private List<LibraryDatasetProvenance> resolveSafeDatasetProvenance(String versionIdsJson) {
        List<UUID> versionIds = deserializeUuidList(versionIdsJson);
        if (versionIds.isEmpty()) return Collections.emptyList();

        List<LibraryDatasetProvenance> results = new ArrayList<>();
        for (UUID vId : versionIds) {
            datasetVersionRepository.findById(vId).ifPresent(version -> {
                String dsName = researchDatasetRepository.findById(version.getDatasetId())
                        .map(ResearchDataset::getName)
                        .orElse("Clinora Research Dataset");
                results.add(new LibraryDatasetProvenance(
                        version.getId(),
                        dsName,
                        version.getVersionNumber(),
                        version.getGeneratedAt()
                ));
            });
        }
        return results;
    }

    /**
     * Resolves safe evaluation provenance metadata.
     */
    private List<LibraryEvaluationProvenance> resolveSafeEvaluationProvenance(String runIdsJson) {
        List<UUID> runIds = deserializeUuidList(runIdsJson);
        if (runIds.isEmpty()) return Collections.emptyList();

        List<LibraryEvaluationProvenance> results = new ArrayList<>();
        for (UUID runId : runIds) {
            evaluationRunRepository.findById(runId).ifPresent(run -> {
                results.add(new LibraryEvaluationProvenance(
                        run.getId(),
                        run.getModelId(),
                        run.getModelVersion(),
                        run.getTaskType().name(),
                        run.getStatus().name()
                ));
            });
        }
        return results;
    }

    private void validateProvenanceBelongsToProject(
            UUID projectId,
            List<UUID> linkedDatasetVersionIds,
            List<UUID> linkedEvaluationRunIds
    ) {
        if (linkedDatasetVersionIds != null) {
            for (UUID vId : linkedDatasetVersionIds) {
                DatasetVersion version = datasetVersionRepository.findById(vId)
                        .orElseThrow(() -> new ResearchApiException(
                                HttpStatus.BAD_REQUEST,
                                "INVALID_PROVENANCE_LINK",
                                "Linked dataset version not found: " + vId
                        ));
                ResearchDataset ds = researchDatasetRepository.findById(version.getDatasetId())
                        .orElseThrow(() -> new ResearchApiException(
                                HttpStatus.BAD_REQUEST,
                                "INVALID_PROVENANCE_LINK",
                                "Dataset for version not found: " + vId
                        ));
                if (!ds.getProjectId().equals(projectId)) {
                    throw new ResearchApiException(
                            HttpStatus.BAD_REQUEST,
                            "INVALID_PROVENANCE_LINK",
                            "Linked dataset version " + vId + " does not belong to project: " + projectId
                    );
                }
            }
        }

        if (linkedEvaluationRunIds != null) {
            for (UUID runId : linkedEvaluationRunIds) {
                AIEvaluationRun run = evaluationRunRepository.findById(runId)
                        .orElseThrow(() -> new ResearchApiException(
                                HttpStatus.BAD_REQUEST,
                                "INVALID_PROVENANCE_LINK",
                                "Linked evaluation run not found: " + runId
                        ));
                if (!run.getProjectId().equals(projectId)) {
                    throw new ResearchApiException(
                            HttpStatus.BAD_REQUEST,
                            "INVALID_PROVENANCE_LINK",
                            "Linked evaluation run " + runId + " does not belong to project: " + projectId
                    );
                }
            }
        }
    }

    private boolean isUserProjectMemberOrOwner(UUID projectId, UUID userId) {
        return projectRepository.findById(projectId)
                .map(p -> p.getOwnerUserId().equals(userId) || memberRepository.existsByProjectIdAndUserId(projectId, userId))
                .orElse(false);
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
                    "Only project owners and co-researchers can manage research publications"
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

        if (project.getOwnerUserId().equals(userId) || memberRepository.existsByProjectIdAndUserId(projectId, userId)) {
            return project;
        }

        throw new ResearchApiException(
                HttpStatus.FORBIDDEN,
                ResearchErrorCode.PROJECT_ACCESS_DENIED,
                "User is not authorized to view publications for project: " + projectId
        );
    }

    private Map<UUID, String> fetchProjectTitles(Set<UUID> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) return Collections.emptyMap();
        return projectRepository.findAllById(projectIds).stream()
                .collect(Collectors.toMap(ResearchProject::getId, ResearchProject::getTitle));
    }

    private String resolveVenue(ResearchPublication pub) {
        if (pub.getJournal() != null && !pub.getJournal().isBlank()) {
            return pub.getJournal();
        }
        if (pub.getConference() != null && !pub.getConference().isBlank()) {
            return pub.getConference();
        }
        return "Clinora Research Repository";
    }

    private String serializeJson(Object value, String fallback) {
        if (value == null) return fallback;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize json property: {}", e.getMessage());
            return fallback;
        }
    }

    private List<UUID> deserializeUuidList(String json) {
        if (json == null || json.isBlank() || "[]".equals(json.trim())) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<UUID>>() {});
        } catch (Exception e) {
            log.warn("Failed to deserialize UUID list: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
}
