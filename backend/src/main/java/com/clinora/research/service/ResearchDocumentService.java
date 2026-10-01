package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.research.api.ResearchDocumentModels.*;
import com.clinora.research.domain.*;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.*;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ResearchDocumentService {

    private static final Logger log = LoggerFactory.getLogger(ResearchDocumentService.class);

    private final ResearchDocumentRepository documentRepository;
    private final ResearchDocumentRevisionRepository revisionRepository;
    private final ResearchDocumentCommentRepository commentRepository;
    private final ResearchAuthorizationService authz;
    private final UserAccountRepository userRepository;
    private final ResearchAuditService auditService;
    private final ResearchDatasetRepository datasetRepository;
    private final AIEvaluationRunRepository evaluationRunRepository;

    public ResearchDocumentService(
            ResearchDocumentRepository documentRepository,
            ResearchDocumentRevisionRepository revisionRepository,
            ResearchDocumentCommentRepository commentRepository,
            ResearchAuthorizationService authz,
            UserAccountRepository userRepository,
            ResearchAuditService auditService,
            ResearchDatasetRepository datasetRepository,
            AIEvaluationRunRepository evaluationRunRepository
    ) {
        this.documentRepository = documentRepository;
        this.revisionRepository = revisionRepository;
        this.commentRepository = commentRepository;
        this.authz = authz;
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.datasetRepository = datasetRepository;
        this.evaluationRunRepository = evaluationRunRepository;
    }

    @Transactional
    public DocumentDetailDto createDocument(UUID projectId, CreateDocumentRequest request, UUID userId, String ipAddress, String userAgent) {
        authz.requireReadAccess(projectId, userId);
        ProjectMemberRole role = authz.resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role != ProjectMemberRole.OWNER && role != ProjectMemberRole.CO_RESEARCHER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Only project Owners and Co-Researchers can create research documents.");
        }

        UUID documentId = UUID.randomUUID();
        byte[] crdtState = decodeBase64(request.crdtStateBase64());
        ResearchDocument document = new ResearchDocument(
                documentId,
                projectId,
                request.title(),
                request.documentType(),
                request.contentJson(),
                crdtState,
                userId
        );
        document = documentRepository.save(document);

        ResearchDocumentRevision initialRevision = new ResearchDocumentRevision(
                UUID.randomUUID(),
                documentId,
                1,
                userId,
                document.getTitle(),
                document.getContentJson(),
                crdtState,
                "Initial document creation"
        );
        revisionRepository.save(initialRevision);

        Map<String, Object> meta = new HashMap<>();
        meta.put("projectId", projectId.toString());
        meta.put("documentId", documentId.toString());
        meta.put("title", document.getTitle());
        meta.put("documentType", document.getDocumentType().name());
        auditService.recordEvent(userId, AuthAuditAction.RESEARCH_DOCUMENT_CREATED, AuthAuditOutcome.SUCCESS,
                documentId.toString(), ipAddress, userAgent, meta);

        log.info("Created research document {} in project {} by user {}", documentId, projectId, userId);
        return toDetailDto(document, Collections.singletonList(userId), 1, 1L);
    }

    @Transactional(readOnly = true)
    public List<DocumentSummaryDto> listDocuments(UUID projectId, UUID userId) {
        authz.requireReadAccess(projectId, userId);
        List<ResearchDocument> docs = documentRepository.findByProjectIdOrderByUpdatedAtDesc(projectId);

        Set<UUID> allUserIds = new HashSet<>();
        Map<UUID, List<UUID>> docContributorsMap = new HashMap<>();
        Map<UUID, Long> docRevisionCountMap = new HashMap<>();

        for (ResearchDocument doc : docs) {
            allUserIds.add(doc.getCreatedByUserId());
            allUserIds.add(doc.getLastEditedByUserId());
            List<UUID> editors = revisionRepository.findDistinctEditorIdsByDocumentId(doc.getId());
            Set<UUID> contributorsSet = new LinkedHashSet<>(editors);
            contributorsSet.add(doc.getCreatedByUserId());
            allUserIds.addAll(contributorsSet);
            docContributorsMap.put(doc.getId(), new ArrayList<>(contributorsSet));
            docRevisionCountMap.put(doc.getId(), revisionRepository.countByDocumentId(doc.getId()));
        }

        Map<UUID, UserAccount> userMap = getUserMap(allUserIds);

        return docs.stream().map(doc -> {
            UserAccount creator = userMap.get(doc.getCreatedByUserId());
            UserAccount lastEditor = userMap.get(doc.getLastEditedByUserId());
            List<UUID> contributorIds = docContributorsMap.getOrDefault(doc.getId(), Collections.emptyList());
            List<ContributorDto> contributors = contributorIds.stream()
                    .map(userMap::get)
                    .filter(Objects::nonNull)
                    .map(this::toContributorDto)
                    .toList();
            long revisionCount = docRevisionCountMap.getOrDefault(doc.getId(), 1L);

            return new DocumentSummaryDto(
                    doc.getId(),
                    doc.getProjectId(),
                    doc.getTitle(),
                    doc.getDocumentType(),
                    doc.getCreatedByUserId(),
                    resolveName(creator),
                    null,
                    doc.getLastEditedByUserId(),
                    resolveName(lastEditor),
                    null,
                    doc.getCreatedAt(),
                    doc.getUpdatedAt(),
                    doc.getArchivedAt(),
                    doc.isArchived(),
                    contributors,
                    revisionCount
            );
        }).toList();
    }

    @Transactional(readOnly = true)
    public DocumentDetailDto getDocument(UUID projectId, UUID documentId, UUID userId) {
        authz.requireReadAccess(projectId, userId);
        ResearchDocument document = findDocumentOrThrow(projectId, documentId);

        List<UUID> editors = revisionRepository.findDistinctEditorIdsByDocumentId(document.getId());
        Set<UUID> contributorsSet = new LinkedHashSet<>(editors);
        contributorsSet.add(document.getCreatedByUserId());

        int currentRevisionNumber = revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(document.getId())
                .map(ResearchDocumentRevision::getRevisionNumber).orElse(1);
        long revisionCount = revisionRepository.countByDocumentId(document.getId());

        return toDetailDto(document, new ArrayList<>(contributorsSet), currentRevisionNumber, revisionCount);
    }

    @Transactional
    public DocumentDetailDto updateDocument(
            UUID projectId,
            UUID documentId,
            UpdateDocumentRequest request,
            UUID userId,
            String ipAddress,
            String userAgent
    ) {
        authz.requireReadAccess(projectId, userId);
        ProjectMemberRole role = authz.resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role == ProjectMemberRole.VIEWER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Viewers have read-only access and cannot edit documents.");
        }

        ResearchDocument document = findDocumentForUpdate(projectId, documentId);
        if (document.isArchived()) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "DOCUMENT_ARCHIVED", "Archived documents are read-only and cannot be modified.");
        }

        int latestRevision = revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(document.getId())
                .map(ResearchDocumentRevision::getRevisionNumber).orElse(1);
        requireRevision(request.expectedRevisionNumber(), latestRevision);

        String previousTitle = document.getTitle();
        byte[] crdtUpdate = decodeBase64(request.crdtUpdateBase64());
        document.updateContent(request.title(), request.documentType(), request.contentJson(), crdtUpdate, userId);
        document = documentRepository.save(document);

        int nextRevisionNumber = latestRevision + 1;
        ResearchDocumentRevision revision = new ResearchDocumentRevision(
                UUID.randomUUID(),
                documentId,
                nextRevisionNumber,
                userId,
                document.getTitle(),
                document.getContentJson(),
                crdtUpdate,
                (request.changeSummary() != null && !request.changeSummary().isBlank())
                        ? request.changeSummary().trim()
                        : "Document updated by collaborator"
        );
        revisionRepository.save(revision);

        if (request.title() != null && !request.title().isBlank() && !request.title().equals(previousTitle)) {
            Map<String, Object> meta = new HashMap<>();
            meta.put("projectId", projectId.toString());
            meta.put("documentId", documentId.toString());
            meta.put("oldTitle", previousTitle);
            meta.put("newTitle", document.getTitle());
            auditService.recordEvent(userId, AuthAuditAction.RESEARCH_DOCUMENT_RENAMED, AuthAuditOutcome.SUCCESS,
                    documentId.toString(), ipAddress, userAgent, meta);
        }

        List<UUID> editors = revisionRepository.findDistinctEditorIdsByDocumentId(document.getId());
        Set<UUID> contributorsSet = new LinkedHashSet<>(editors);
        contributorsSet.add(document.getCreatedByUserId());

        return toDetailDto(document, new ArrayList<>(contributorsSet), nextRevisionNumber, nextRevisionNumber);
    }

    @Transactional
    public DocumentDetailDto renameDocument(
            UUID projectId,
            UUID documentId,
            RenameDocumentRequest request,
            UUID userId,
            String ipAddress,
            String userAgent
    ) {
        authz.requireReadAccess(projectId, userId);
        ProjectMemberRole role = authz.resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role != ProjectMemberRole.OWNER && role != ProjectMemberRole.CO_RESEARCHER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Only Owners and Co-Researchers can rename research documents.");
        }

        ResearchDocument document = findDocumentForUpdate(projectId, documentId);
        if (document.isArchived()) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "DOCUMENT_ARCHIVED", "Archived documents cannot be renamed.");
        }

        int latestRevision = revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(documentId)
                .map(ResearchDocumentRevision::getRevisionNumber).orElse(1);
        requireRevision(request.expectedRevisionNumber(), latestRevision);
        String oldTitle = document.getTitle();
        document.rename(request.title(), userId);
        document = documentRepository.save(document);
        revisionRepository.save(new ResearchDocumentRevision(UUID.randomUUID(), documentId, latestRevision + 1,
            userId, document.getTitle(), document.getContentJson(), document.getCrdtState(), "Document renamed"));

        Map<String, Object> meta = new HashMap<>();
        meta.put("projectId", projectId.toString());
        meta.put("documentId", documentId.toString());
        meta.put("oldTitle", oldTitle);
        meta.put("newTitle", document.getTitle());
        auditService.recordEvent(userId, AuthAuditAction.RESEARCH_DOCUMENT_RENAMED, AuthAuditOutcome.SUCCESS,
                documentId.toString(), ipAddress, userAgent, meta);

        List<UUID> editors = revisionRepository.findDistinctEditorIdsByDocumentId(document.getId());
        Set<UUID> contributorsSet = new LinkedHashSet<>(editors);
        contributorsSet.add(document.getCreatedByUserId());
        long revCount = latestRevision + 1;

        return toDetailDto(document, new ArrayList<>(contributorsSet), (int) revCount, revCount);
    }

    @Transactional
    public DocumentDetailDto archiveDocument(
            UUID projectId,
            UUID documentId,
            Integer expectedRevisionNumber,
            UUID userId,
            String ipAddress,
            String userAgent
    ) {
        authz.requireReadAccess(projectId, userId);
        ProjectMemberRole role = authz.resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role != ProjectMemberRole.OWNER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Only project Owners can archive research documents.");
        }

        ResearchDocument document = findDocumentForUpdate(projectId, documentId);
        if (document.isArchived()) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "DOCUMENT_ALREADY_ARCHIVED", "This document is already archived.");
        }

        int latestRevision = revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(documentId)
                .map(ResearchDocumentRevision::getRevisionNumber).orElse(1);
        requireRevision(expectedRevisionNumber, latestRevision);
        document.archive(userId);
        document = documentRepository.save(document);
        revisionRepository.save(new ResearchDocumentRevision(UUID.randomUUID(), documentId, latestRevision + 1,
            userId, document.getTitle(), document.getContentJson(), document.getCrdtState(), "Document archived"));

        Map<String, Object> meta = new HashMap<>();
        meta.put("projectId", projectId.toString());
        meta.put("documentId", documentId.toString());
        meta.put("title", document.getTitle());
        auditService.recordEvent(userId, AuthAuditAction.RESEARCH_DOCUMENT_ARCHIVED, AuthAuditOutcome.SUCCESS,
                documentId.toString(), ipAddress, userAgent, meta);

        List<UUID> editors = revisionRepository.findDistinctEditorIdsByDocumentId(document.getId());
        Set<UUID> contributorsSet = new LinkedHashSet<>(editors);
        contributorsSet.add(document.getCreatedByUserId());
        long revCount = latestRevision + 1;

        return toDetailDto(document, new ArrayList<>(contributorsSet), (int) revCount, revCount);
    }

    @Transactional(readOnly = true)
    public List<DocumentRevisionDto> listRevisions(UUID projectId, UUID documentId, UUID userId) {
        authz.requireReadAccess(projectId, userId);
        findDocumentOrThrow(projectId, documentId);

        List<ResearchDocumentRevision> revisions = revisionRepository.findByDocumentIdOrderByRevisionNumberDesc(documentId);
        Set<UUID> editorIds = revisions.stream().map(ResearchDocumentRevision::getEditedByUserId).collect(Collectors.toSet());
        Map<UUID, UserAccount> userMap = getUserMap(editorIds);

        return revisions.stream().map(rev -> {
            UserAccount editor = userMap.get(rev.getEditedByUserId());
            return new DocumentRevisionDto(
                    rev.getId(),
                    rev.getDocumentId(),
                    rev.getRevisionNumber(),
                    rev.getEditedByUserId(),
                    resolveName(editor),
                    null,
                    rev.getTitle(),
                    rev.getContentJson(),
                    rev.getChangeSummary(),
                    rev.getCreatedAt()
            );
        }).toList();
    }

    @Transactional(readOnly = true)
    public DocumentRevisionDto getRevision(UUID projectId, UUID documentId, int revisionNumber, UUID userId) {
        authz.requireReadAccess(projectId, userId);
        findDocumentOrThrow(projectId, documentId);

        ResearchDocumentRevision revision = revisionRepository.findByDocumentIdAndRevisionNumber(documentId, revisionNumber)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "REVISION_NOT_FOUND", "Revision not found for this document."));

        UserAccount editor = userRepository.findById(revision.getEditedByUserId()).orElse(null);
        return new DocumentRevisionDto(
                revision.getId(),
                revision.getDocumentId(),
                revision.getRevisionNumber(),
                revision.getEditedByUserId(),
                resolveName(editor),
                null,
                revision.getTitle(),
                revision.getContentJson(),
                revision.getChangeSummary(),
                revision.getCreatedAt()
        );
    }

    @Transactional
    public DocumentDetailDto restoreRevision(
            UUID projectId,
            UUID documentId,
            int revisionNumber,
            Integer expectedRevisionNumber,
            UUID userId,
            String ipAddress,
            String userAgent
    ) {
        authz.requireReadAccess(projectId, userId);
        ProjectMemberRole role = authz.resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role != ProjectMemberRole.OWNER && role != ProjectMemberRole.CO_RESEARCHER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Only project Owners and Co-Researchers can restore prior versions.");
        }

        ResearchDocument document = findDocumentForUpdate(projectId, documentId);
        if (document.isArchived()) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "DOCUMENT_ARCHIVED", "Archived documents cannot be modified or restored.");
        }

        ResearchDocumentRevision historical = revisionRepository.findByDocumentIdAndRevisionNumber(documentId, revisionNumber)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "REVISION_NOT_FOUND", "Historical revision not found."));

        int latestRevision = revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(document.getId())
                .map(ResearchDocumentRevision::getRevisionNumber).orElse(1);
        requireRevision(expectedRevisionNumber, latestRevision);

        document.updateContent(historical.getTitle(), document.getDocumentType(), historical.getContentJson(), historical.getCrdtUpdate(), userId);
        document = documentRepository.save(document);

        int nextRevisionNumber = latestRevision + 1;
        ResearchDocumentRevision newRevision = new ResearchDocumentRevision(
                UUID.randomUUID(),
                documentId,
                nextRevisionNumber,
                userId,
                historical.getTitle(),
                historical.getContentJson(),
                historical.getCrdtUpdate(),
                "Restored from version " + revisionNumber
        );
        revisionRepository.save(newRevision);

        Map<String, Object> meta = new HashMap<>();
        meta.put("projectId", projectId.toString());
        meta.put("documentId", documentId.toString());
        meta.put("restoredVersion", revisionNumber);
        meta.put("newVersion", nextRevisionNumber);
        auditService.recordEvent(userId, AuthAuditAction.RESEARCH_DOCUMENT_VERSION_RESTORED, AuthAuditOutcome.SUCCESS,
                documentId.toString(), ipAddress, userAgent, meta);

        List<UUID> editors = revisionRepository.findDistinctEditorIdsByDocumentId(document.getId());
        Set<UUID> contributorsSet = new LinkedHashSet<>(editors);
        contributorsSet.add(document.getCreatedByUserId());

        return toDetailDto(document, new ArrayList<>(contributorsSet), nextRevisionNumber, nextRevisionNumber);
    }

    // ─── Comments ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DocumentCommentDto> listComments(UUID projectId, UUID documentId, UUID userId) {
        authz.requireReadAccess(projectId, userId);
        findDocumentOrThrow(projectId, documentId);

        List<ResearchDocumentComment> comments = commentRepository.findByDocumentIdOrderByCreatedAtAsc(documentId);
        Set<UUID> authorIds = comments.stream().map(ResearchDocumentComment::getAuthorUserId).collect(Collectors.toSet());
        Map<UUID, UserAccount> userMap = getUserMap(authorIds);

        return comments.stream().map(c -> {
            UserAccount author = userMap.get(c.getAuthorUserId());
            return new DocumentCommentDto(
                    c.getId(),
                    c.getDocumentId(),
                    c.getAuthorUserId(),
                    resolveName(author),
                    null,
                    c.getContent(),
                    c.getSelectedText(),
                    c.isResolved(),
                    c.getCreatedAt(),
                    c.getUpdatedAt()
            );
        }).toList();
    }

    @Transactional
    public DocumentCommentDto addComment(
            UUID projectId,
            UUID documentId,
            AddDocumentCommentRequest request,
            UUID userId,
            String ipAddress,
            String userAgent
    ) {
        authz.requireReadAccess(projectId, userId);
        ProjectMemberRole role = authz.resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role == ProjectMemberRole.VIEWER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Viewers have read-only access and cannot comment on documents.");
        }

        ResearchDocument document = findDocumentOrThrow(projectId, documentId);
        if (document.isArchived()) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "DOCUMENT_ARCHIVED", "Archived documents cannot receive new comments.");
        }

        ResearchDocumentComment comment = new ResearchDocumentComment(
                UUID.randomUUID(),
                documentId,
                userId,
                request.content(),
                request.selectedText()
        );
        comment = commentRepository.save(comment);

        Map<String, Object> meta = new HashMap<>();
        meta.put("projectId", projectId.toString());
        meta.put("documentId", documentId.toString());
        meta.put("commentId", comment.getId().toString());
        auditService.recordEvent(userId, AuthAuditAction.RESEARCH_DOCUMENT_COMMENT_CREATED, AuthAuditOutcome.SUCCESS,
                comment.getId().toString(), ipAddress, userAgent, meta);

        UserAccount author = userRepository.findById(userId).orElse(null);
        return new DocumentCommentDto(
                comment.getId(),
                comment.getDocumentId(),
                comment.getAuthorUserId(),
                resolveName(author),
                null,
                comment.getContent(),
                comment.getSelectedText(),
                comment.isResolved(),
                comment.getCreatedAt(),
                comment.getUpdatedAt()
        );
    }

    @Transactional
    public DocumentCommentDto resolveComment(UUID projectId, UUID documentId, UUID commentId, boolean resolved, UUID userId) {
        authz.requireReadAccess(projectId, userId);
        ProjectMemberRole role = authz.resolveProjectRole(projectId, userId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.FORBIDDEN,
                        ResearchErrorCode.PROJECT_ACCESS_DENIED, "Not a project member."));

        if (role == ProjectMemberRole.VIEWER) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Viewers have read-only access.");
        }

        findDocumentOrThrow(projectId, documentId);
        ResearchDocumentComment comment = commentRepository.findByIdAndDocumentId(commentId, documentId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "COMMENT_NOT_FOUND", "Comment not found on this document."));

        comment.setResolved(resolved);
        comment = commentRepository.save(comment);

        UserAccount author = userRepository.findById(comment.getAuthorUserId()).orElse(null);
        return new DocumentCommentDto(
                comment.getId(),
                comment.getDocumentId(),
                comment.getAuthorUserId(),
                resolveName(author),
                null,
                comment.getContent(),
                comment.getSelectedText(),
                comment.isResolved(),
                comment.getCreatedAt(),
                comment.getUpdatedAt()
        );
    }

    // ─── Safe Reference Lookups (Provenance only — No Dataset Files) ───────────

    @Transactional(readOnly = true)
    public List<SafeDatasetReferenceDto> listSafeDatasetReferences(UUID projectId, UUID userId) {
        authz.requireReadAccess(projectId, userId);
        return datasetRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .filter(ds -> authz.canReadDataset(ds.getId(), userId))
                .map(ds -> new SafeDatasetReferenceDto(
                        ds.getId(),
                        ds.getName(),
                        ds.getStatus(),
                        ds.getCreatedAt()
                )).toList();
    }

    @Transactional(readOnly = true)
    public List<SafeAIEvaluationReferenceDto> listSafeEvaluationReferences(UUID projectId, UUID userId) {
        authz.requireReadAccess(projectId, userId);
        // No verified execution adapter exists; historical fabricated completions are not valid citations.
        return List.of();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private void requireRevision(Integer expected, int actual) {
        if (expected == null || expected != actual) throw new ResearchApiException(HttpStatus.CONFLICT,
            "DOCUMENT_REVISION_CONFLICT", "This document has changed. Preserve your local draft and reload before saving again.");
    }

    private ResearchDocument findDocumentForUpdate(UUID projectId, UUID documentId) {
        return documentRepository.findForUpdate(documentId, projectId)
            .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "Document not found in this project."));
    }

    private ResearchDocument findDocumentOrThrow(UUID projectId, UUID documentId) {
        return documentRepository.findByIdAndProjectId(documentId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "DOCUMENT_NOT_FOUND", "Research document not found in this project."));
    }

    private DocumentDetailDto toDetailDto(ResearchDocument doc, List<UUID> contributorIds, int currentRevision, long revisionCount) {
        Set<UUID> allUserIds = new HashSet<>(contributorIds);
        allUserIds.add(doc.getCreatedByUserId());
        allUserIds.add(doc.getLastEditedByUserId());
        Map<UUID, UserAccount> userMap = getUserMap(allUserIds);

        UserAccount creator = userMap.get(doc.getCreatedByUserId());
        UserAccount lastEditor = userMap.get(doc.getLastEditedByUserId());
        List<ContributorDto> contributors = contributorIds.stream()
                .map(userMap::get)
                .filter(Objects::nonNull)
                .map(this::toContributorDto)
                .toList();

        String crdtStateBase64 = doc.getCrdtState() != null ? Base64.getEncoder().encodeToString(doc.getCrdtState()) : null;

        return new DocumentDetailDto(
                doc.getId(),
                doc.getProjectId(),
                doc.getTitle(),
                doc.getDocumentType(),
                doc.getContentJson(),
                crdtStateBase64,
                doc.getCreatedByUserId(),
                resolveName(creator),
                null,
                doc.getLastEditedByUserId(),
                resolveName(lastEditor),
                null,
                doc.getCreatedAt(),
                doc.getUpdatedAt(),
                doc.getArchivedAt(),
                doc.isArchived(),
                contributors,
                currentRevision,
                revisionCount
        );
    }

    private ContributorDto toContributorDto(UserAccount user) {
        return new ContributorDto(
                user.getId(),
                resolveName(user),
                user.getEmail(),
                null
        );
    }

    private Map<UUID, UserAccount> getUserMap(Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyMap();
        }
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(UserAccount::getId, Function.identity(), (a, b) -> a));
    }

    private String resolveName(UserAccount user) {
        if (user == null) return "Unknown Collaborator";
        String first = user.getFirstName() != null ? user.getFirstName().trim() : "";
        String last = user.getLastName() != null ? user.getLastName().trim() : "";
        String full = (first + " " + last).trim();
        return !full.isEmpty() ? full : user.getEmail();
    }

    private byte[] decodeBase64(String str) {
        if (str == null || str.isBlank()) return null;
        try {
            return Base64.getDecoder().decode(str);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
