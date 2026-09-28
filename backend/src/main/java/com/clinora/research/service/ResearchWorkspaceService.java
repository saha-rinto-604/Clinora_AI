package com.clinora.research.service;

import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditEvent;
import com.clinora.audit.AuthAuditEventRepository;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.patients.security.PatientReportMalwareScanner;
import com.clinora.research.api.ResearchWorkspaceModels.*;
import com.clinora.research.domain.*;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.*;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ResearchWorkspaceService {

    private static final Logger log = LoggerFactory.getLogger(ResearchWorkspaceService.class);
    private static final long MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
    private static final Set<String> DISALLOWED_EXTENSIONS = Set.of(
            "exe", "bat", "sh", "cmd", "msi", "com", "bin", "dll", "vbs", "ps1", "scr", "jar"
    );

    private final ResearchAuthorizationService authz;
    private final ResearchNoteRepository noteRepository;
    private final ResearchNoteCommentRepository commentRepository;
    private final ResearchProjectFileRepository fileRepository;
    private final ResearchProjectFileVersionRepository versionRepository;
    private final UserAccountRepository userRepository;
    private final AuthAuditEventRepository auditEventRepository;
    private final ResearchAuditService auditService;
    private final ApplicationDocumentStoragePort storagePort;
    private final PatientReportMalwareScanner malwareScanner;

    public ResearchWorkspaceService(
            ResearchAuthorizationService authz,
            ResearchNoteRepository noteRepository,
            ResearchNoteCommentRepository commentRepository,
            ResearchProjectFileRepository fileRepository,
            ResearchProjectFileVersionRepository versionRepository,
            UserAccountRepository userRepository,
            AuthAuditEventRepository auditEventRepository,
            ResearchAuditService auditService,
            ApplicationDocumentStoragePort storagePort,
            @Autowired(required = false) PatientReportMalwareScanner malwareScanner
    ) {
        this.authz = authz;
        this.noteRepository = noteRepository;
        this.commentRepository = commentRepository;
        this.fileRepository = fileRepository;
        this.versionRepository = versionRepository;
        this.userRepository = userRepository;
        this.auditEventRepository = auditEventRepository;
        this.auditService = auditService;
        this.storagePort = storagePort;
        this.malwareScanner = malwareScanner;
    }

    // ─── Research Notes ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<NoteResponse> listNotes(UUID projectId, UUID requesterUserId) {
        authz.requireReadAccess(projectId, requesterUserId);
        List<ResearchNote> notes = noteRepository
                .findByProjectIdAndStatusNotOrderByPinnedDescCreatedAtDesc(projectId, ResearchNoteStatus.ARCHIVED);

        Set<UUID> userIds = notes.stream().map(ResearchNote::getAuthorUserId).collect(Collectors.toSet());
        Map<UUID, UserAccount> userMap = getUserMap(userIds);

        return notes.stream().map(n -> {
            UserAccount author = userMap.get(n.getAuthorUserId());
            int commentCount = commentRepository.findActiveByNoteIdOrderByCreatedAtAsc(n.getId()).size();
            return toNoteResponse(n, author, commentCount);
        }).toList();
    }

    @Transactional(readOnly = true)
    public NoteResponse getNote(UUID projectId, UUID noteId, UUID requesterUserId) {
        authz.requireReadAccess(projectId, requesterUserId);
        ResearchNote note = noteRepository.findByIdAndProjectId(noteId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "NOTE_NOT_FOUND", "Research note not found."));

        UserAccount author = userRepository.findById(note.getAuthorUserId()).orElse(null);
        int commentCount = commentRepository.findActiveByNoteIdOrderByCreatedAtAsc(note.getId()).size();
        return toNoteResponse(note, author, commentCount);
    }

    @Transactional
    public NoteResponse createNote(
            UUID projectId, UUID requesterUserId, CreateNoteRequest req,
            String ipAddress, String userAgent
    ) {
        authz.requireNoteCreationPermission(projectId, requesterUserId);

        ResearchNote note = new ResearchNote(
                UUID.randomUUID(), projectId, requesterUserId,
                req.title(), req.content(), ResearchNoteStatus.DRAFT, req.pinned()
        );
        note = noteRepository.save(note);

        auditService.recordEvent(requesterUserId, AuthAuditAction.RESEARCH_NOTE_CREATED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("noteId", note.getId().toString(), "title", note.getTitle(), "pinned", String.valueOf(note.isPinned())));

        UserAccount author = userRepository.findById(requesterUserId).orElse(null);
        return toNoteResponse(note, author, 0);
    }

    @Transactional
    public NoteResponse updateNote(
            UUID projectId, UUID noteId, UUID requesterUserId, UpdateNoteRequest req,
            String ipAddress, String userAgent
    ) {
        ResearchNote note = noteRepository.findByIdAndProjectId(noteId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "NOTE_NOT_FOUND", "Research note not found."));

        authz.requireNoteEditPermission(projectId, note.getAuthorUserId(), requesterUserId);

        note.update(req.title(), req.content(), req.status(), requesterUserId);
        if (req.pinned() != null) {
            note.setPinned(req.pinned(), requesterUserId);
        }
        note = noteRepository.save(note);

        auditService.recordEvent(requesterUserId, AuthAuditAction.RESEARCH_NOTE_UPDATED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("noteId", note.getId().toString(), "status", note.getStatus().name()));

        UserAccount author = userRepository.findById(note.getAuthorUserId()).orElse(null);
        int commentCount = commentRepository.findActiveByNoteIdOrderByCreatedAtAsc(note.getId()).size();
        return toNoteResponse(note, author, commentCount);
    }

    @Transactional
    public void archiveNote(
            UUID projectId, UUID noteId, UUID requesterUserId,
            String ipAddress, String userAgent
    ) {
        ResearchNote note = noteRepository.findByIdAndProjectId(noteId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "NOTE_NOT_FOUND", "Research note not found."));

        authz.requireNoteEditPermission(projectId, note.getAuthorUserId(), requesterUserId);

        note.archive(requesterUserId);
        noteRepository.save(note);

        auditService.recordEvent(requesterUserId, AuthAuditAction.RESEARCH_NOTE_ARCHIVED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("noteId", note.getId().toString()));
    }

    @Transactional
    public NoteResponse togglePin(
            UUID projectId, UUID noteId, UUID requesterUserId,
            String ipAddress, String userAgent
    ) {
        ResearchNote note = noteRepository.findByIdAndProjectId(noteId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "NOTE_NOT_FOUND", "Research note not found."));

        authz.requireNoteCreationPermission(projectId, requesterUserId);

        boolean newPin = !note.isPinned();
        note.setPinned(newPin, requesterUserId);
        note = noteRepository.save(note);

        auditService.recordEvent(requesterUserId, AuthAuditAction.RESEARCH_NOTE_PINNED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("noteId", note.getId().toString(), "pinned", String.valueOf(newPin)));

        UserAccount author = userRepository.findById(note.getAuthorUserId()).orElse(null);
        int commentCount = commentRepository.findActiveByNoteIdOrderByCreatedAtAsc(note.getId()).size();
        return toNoteResponse(note, author, commentCount);
    }

    // ─── Note Comments ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CommentResponse> listComments(UUID projectId, UUID noteId, UUID requesterUserId) {
        authz.requireReadAccess(projectId, requesterUserId);
        noteRepository.findByIdAndProjectId(noteId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "NOTE_NOT_FOUND", "Research note not found."));

        List<ResearchNoteComment> comments = commentRepository.findActiveByNoteIdOrderByCreatedAtAsc(noteId);
        Set<UUID> userIds = comments.stream().map(ResearchNoteComment::getAuthorUserId).collect(Collectors.toSet());
        Map<UUID, UserAccount> userMap = getUserMap(userIds);

        return comments.stream().map(c -> toCommentResponse(c, userMap.get(c.getAuthorUserId()))).toList();
    }

    @Transactional
    public CommentResponse addComment(
            UUID projectId, UUID noteId, UUID requesterUserId, AddCommentRequest req,
            String ipAddress, String userAgent
    ) {
        authz.requireCommentPermission(projectId, requesterUserId);
        ResearchNote note = noteRepository.findByIdAndProjectId(noteId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "NOTE_NOT_FOUND", "Research note not found."));

        ResearchNoteComment comment = new ResearchNoteComment(
                UUID.randomUUID(), note.getId(), requesterUserId, req.content()
        );
        comment = commentRepository.save(comment);

        auditService.recordEvent(requesterUserId, AuthAuditAction.RESEARCH_NOTE_COMMENTED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("noteId", noteId.toString(), "commentId", comment.getId().toString()));

        UserAccount author = userRepository.findById(requesterUserId).orElse(null);
        return toCommentResponse(comment, author);
    }

    @Transactional
    public void deleteComment(
            UUID projectId, UUID noteId, UUID commentId, UUID requesterUserId,
            String ipAddress, String userAgent
    ) {
        authz.requireReadAccess(projectId, requesterUserId);
        ResearchNoteComment comment = commentRepository.findByIdAndNoteId(commentId, noteId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "COMMENT_NOT_FOUND", "Comment not found."));

        Optional<ProjectMemberRole> role = authz.resolveProjectRole(projectId, requesterUserId);
        boolean isOwner = role.map(r -> r == ProjectMemberRole.OWNER).orElse(false);
        boolean isAuthor = comment.getAuthorUserId().equals(requesterUserId);

        if (!isAuthor && !isOwner) {
            throw new ResearchApiException(HttpStatus.FORBIDDEN,
                    "INSUFFICIENT_ROLE", "Only the comment author or project owner can delete this comment.");
        }

        comment.remove();
        commentRepository.save(comment);
    }

    // ─── Project Files & Versions ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<FileResponse> listFiles(UUID projectId, UUID requesterUserId) {
        authz.requireReadAccess(projectId, requesterUserId);
        List<ResearchProjectFile> files = fileRepository.findByProjectIdAndArchivedAtIsNullOrderByCreatedAtDesc(projectId);

        Set<UUID> userIds = files.stream().map(ResearchProjectFile::getUploadedByUserId).collect(Collectors.toSet());
        Map<UUID, UserAccount> userMap = getUserMap(userIds);

        return files.stream().map(f -> {
            UserAccount uploader = userMap.get(f.getUploadedByUserId());
            long sizeBytes = versionRepository
                    .findByProjectFileIdAndVersionNumber(f.getId(), f.getCurrentVersionNumber())
                    .map(ResearchProjectFileVersion::getSizeBytes).orElse(0L);
            return toFileResponse(f, uploader, sizeBytes);
        }).toList();
    }

    @Transactional
    public FileResponse uploadFile(
            UUID projectId, UUID requesterUserId, MultipartFile file, String displayName,
            String ipAddress, String userAgent
    ) {
        authz.requireFileUploadPermission(projectId, requesterUserId);
        validateUploadFile(file);

        byte[] bytes = readFileBytes(file);
        scanMalwareIfAvailable(file);

        String filename = sanitizeFilename(file.getOriginalFilename());
        String finalDisplayName = (displayName != null && !displayName.isBlank()) ? displayName.trim() : filename;
        String contentType = detectContentType(file, filename);
        String checksum = sha256(bytes);

        UUID fileId = UUID.randomUUID();
        ResearchProjectFile projectFile = new ResearchProjectFile(
                fileId, projectId, finalDisplayName, contentType, requesterUserId
        );
        projectFile = fileRepository.save(projectFile);

        String storageKey = "research/projects/" + projectId + "/files/" + fileId + "/v1/" + filename;
        storagePort.put(storageKey, bytes, contentType);

        ResearchProjectFileVersion version = new ResearchProjectFileVersion(
                UUID.randomUUID(), fileId, 1, storageKey, checksum, bytes.length, requesterUserId
        );
        versionRepository.save(version);

        auditService.recordEvent(requesterUserId, AuthAuditAction.PROJECT_FILE_UPLOADED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("fileId", fileId.toString(), "filename", finalDisplayName, "sizeBytes", String.valueOf(bytes.length)));

        UserAccount uploader = userRepository.findById(requesterUserId).orElse(null);
        return toFileResponse(projectFile, uploader, bytes.length);
    }

    @Transactional
    public FileVersionResponse uploadFileVersion(
            UUID projectId, UUID fileId, UUID requesterUserId, MultipartFile file,
            String ipAddress, String userAgent
    ) {
        authz.requireFileUploadPermission(projectId, requesterUserId);
        ResearchProjectFile projectFile = fileRepository.findByIdAndProjectId(fileId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "FILE_NOT_FOUND", "Project file not found."));

        if (projectFile.isArchived()) {
            throw new ResearchApiException(HttpStatus.CONFLICT,
                    "FILE_ARCHIVED", "Cannot upload a new version to an archived file.");
        }

        validateUploadFile(file);
        byte[] bytes = readFileBytes(file);
        scanMalwareIfAvailable(file);

        String filename = sanitizeFilename(file.getOriginalFilename());
        String contentType = detectContentType(file, filename);
        String checksum = sha256(bytes);

        projectFile.incrementVersion();
        int newVersionNumber = projectFile.getCurrentVersionNumber();
        fileRepository.save(projectFile);

        String storageKey = "research/projects/" + projectId + "/files/" + fileId + "/v" + newVersionNumber + "/" + filename;
        storagePort.put(storageKey, bytes, contentType);

        ResearchProjectFileVersion version = new ResearchProjectFileVersion(
                UUID.randomUUID(), fileId, newVersionNumber, storageKey, checksum, bytes.length, requesterUserId
        );
        version = versionRepository.save(version);

        auditService.recordEvent(requesterUserId, AuthAuditAction.PROJECT_FILE_VERSION_UPLOADED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("fileId", fileId.toString(), "versionNumber", String.valueOf(newVersionNumber), "sizeBytes", String.valueOf(bytes.length)));

        UserAccount uploader = userRepository.findById(requesterUserId).orElse(null);
        return toFileVersionResponse(version, uploader);
    }

    @Transactional(readOnly = true)
    public List<FileVersionResponse> listFileVersions(UUID projectId, UUID fileId, UUID requesterUserId) {
        authz.requireReadAccess(projectId, requesterUserId);
        fileRepository.findByIdAndProjectId(fileId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "FILE_NOT_FOUND", "Project file not found."));

        List<ResearchProjectFileVersion> versions = versionRepository.findByProjectFileIdOrderByVersionNumberDesc(fileId);
        Set<UUID> userIds = versions.stream().map(ResearchProjectFileVersion::getUploadedByUserId).collect(Collectors.toSet());
        Map<UUID, UserAccount> userMap = getUserMap(userIds);

        return versions.stream().map(v -> toFileVersionResponse(v, userMap.get(v.getUploadedByUserId()))).toList();
    }

    @Transactional(readOnly = true)
    public DownloadableFile downloadFile(
            UUID projectId, UUID fileId, Integer versionNumber, UUID requesterUserId,
            String ipAddress, String userAgent
    ) {
        authz.requireReadAccess(projectId, requesterUserId);
        ResearchProjectFile projectFile = fileRepository.findByIdAndProjectId(fileId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "FILE_NOT_FOUND", "Project file not found."));

        int targetVersion = (versionNumber != null && versionNumber > 0)
                ? versionNumber : projectFile.getCurrentVersionNumber();

        ResearchProjectFileVersion version = versionRepository
                .findByProjectFileIdAndVersionNumber(fileId, targetVersion)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "VERSION_NOT_FOUND", "File version " + targetVersion + " not found."));

        ApplicationDocumentStoragePort.StoredObject stored = storagePort.get(version.getStorageObjectKey());

        auditService.recordEvent(requesterUserId, AuthAuditAction.PROJECT_FILE_DOWNLOADED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("fileId", fileId.toString(), "version", String.valueOf(targetVersion)));

        return new DownloadableFile(projectFile.getDisplayName(), stored.contentType(), stored.bytes());
    }

    @Transactional
    public void archiveFile(
            UUID projectId, UUID fileId, UUID requesterUserId,
            String ipAddress, String userAgent
    ) {
        ResearchProjectFile file = fileRepository.findByIdAndProjectId(fileId, projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND,
                        "FILE_NOT_FOUND", "Project file not found."));

        authz.requireFileArchivePermission(projectId, file.getUploadedByUserId(), requesterUserId);

        file.archive();
        fileRepository.save(file);

        auditService.recordEvent(requesterUserId, AuthAuditAction.PROJECT_FILE_ARCHIVED,
                AuthAuditOutcome.SUCCESS, projectId.toString(), ipAddress, userAgent,
                Map.of("fileId", fileId.toString()));
    }

    // ─── Activity Feed ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ProjectActivityItem> getProjectActivity(UUID projectId, UUID requesterUserId) {
        authz.requireReadAccess(projectId, requesterUserId);

        List<AuthAuditEvent> events = auditEventRepository
                .findByResourceIdOrderByOccurredAtDesc(projectId.toString());

        Set<UUID> actorIds = events.stream()
                .map(AuthAuditEvent::getActorUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, UserAccount> userMap = getUserMap(actorIds);

        return events.stream().map(e -> {
            UserAccount actor = e.getActorUserId() != null ? userMap.get(e.getActorUserId()) : null;
            String actorName = actor != null ? (actor.getFirstName() + " " + actor.getLastName()).trim() : "System";
            String initials = actor != null ? buildInitials(actor.getFirstName(), actor.getLastName()) : "SYS";
            String description = formatActivityDescription(e.getAction(), e.getMetadata());

            return new ProjectActivityItem(
                    e.getId(),
                    e.getActorUserId(),
                    actorName,
                    initials,
                    e.getAction().name(),
                    description,
                    e.getOccurredAt()
            );
        }).toList();
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    private void validateUploadFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "EMPTY_FILE", "File is empty or missing.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "FILE_TOO_LARGE", "File size exceeds 50 MB limit.");
        }
        String originalName = file.getOriginalFilename();
        if (originalName != null && originalName.contains(".")) {
            String ext = originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase();
            if (DISALLOWED_EXTENSIONS.contains(ext)) {
                throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                        "DISALLOWED_FILE_TYPE", "Executable and script files (. " + ext + ") are not permitted.");
            }
        }
    }

    private void scanMalwareIfAvailable(MultipartFile file) {
        if (malwareScanner != null) {
            PatientReportMalwareScanner.ScanResult result = malwareScanner.scan(file);
            if (result == PatientReportMalwareScanner.ScanResult.INFECTED) {
                throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                        "MALWARE_DETECTED", "File was rejected by security scanner.");
            }
        }
    }

    private byte[] readFileBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST,
                    "FILE_READ_FAILED", "Failed to read uploaded file content.");
        }
    }

    private String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "document.bin";
        }
        return filename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String detectContentType(MultipartFile file, String filename) {
        String ct = file.getContentType();
        if (ct != null && !ct.isBlank() && !ct.equals("application/octet-stream")) {
            return ct;
        }
        if (filename.endsWith(".pdf")) return "application/pdf";
        if (filename.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (filename.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (filename.endsWith(".csv")) return "text/csv";
        if (filename.endsWith(".json")) return "application/json";
        if (filename.endsWith(".txt") || filename.endsWith(".md")) return "text/plain";
        if (filename.endsWith(".png")) return "image/png";
        if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    private String sha256(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(data);
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            return "unknown";
        }
    }

    private Map<UUID, UserAccount> getUserMap(Set<UUID> userIds) {
        Map<UUID, UserAccount> map = new HashMap<>();
        if (!userIds.isEmpty()) {
            userRepository.findAllById(userIds).forEach(u -> map.put(u.getId(), u));
        }
        return map;
    }

    private String buildInitials(String first, String last) {
        String f = (first != null && !first.isBlank()) ? first.substring(0, 1).toUpperCase() : "";
        String l = (last != null && !last.isBlank()) ? last.substring(0, 1).toUpperCase() : "";
        return f + l;
    }

    private String formatActivityDescription(AuthAuditAction action, String metadata) {
        return switch (action) {
            case COLLABORATOR_INVITED -> "Invited a researcher to collaborate";
            case COLLABORATOR_INVITATION_ACCEPTED -> "Accepted collaboration invitation and joined project";
            case COLLABORATOR_INVITATION_DECLINED -> "Declined collaboration invitation";
            case COLLABORATOR_INVITATION_REVOKED -> "Revoked a collaboration invitation";
            case COLLABORATOR_INVITATION_EXPIRED -> "Collaboration invitation expired";
            case COLLABORATOR_ADDED -> "Joined the project team";
            case COLLABORATOR_ROLE_CHANGED -> "Updated collaborator project role";
            case COLLABORATOR_REMOVED -> "Removed a collaborator from the project";
            case RESEARCH_NOTE_CREATED -> "Created a research note";
            case RESEARCH_NOTE_UPDATED -> "Updated a research note";
            case RESEARCH_NOTE_ARCHIVED -> "Archived a research note";
            case RESEARCH_NOTE_PINNED -> "Updated pinned status of a research note";
            case RESEARCH_NOTE_COMMENTED -> "Commented on a research note";
            case PROJECT_FILE_UPLOADED -> "Uploaded a project document";
            case PROJECT_FILE_VERSION_UPLOADED -> "Uploaded a new document version";
            case PROJECT_FILE_DOWNLOADED -> "Downloaded a project document";
            case PROJECT_FILE_ARCHIVED -> "Archived a project document";
            case RESEARCH_PROJECT_CREATED -> "Created research project";
            case RESEARCH_PROJECT_SUBMITTED -> "Submitted project for governance review";
            case RESEARCH_PROJECT_APPROVED -> "Project approved by governance review";
            case DATASET_REQUEST_CREATED -> "Created dataset request";
            case DATASET_REQUEST_SUBMITTED -> "Submitted dataset request";
            default -> action.name().replace('_', ' ').toLowerCase();
        };
    }

    private NoteResponse toNoteResponse(ResearchNote n, UserAccount author, int commentCount) {
        String name = author != null ? (author.getFirstName() + " " + author.getLastName()).trim() : "Researcher";
        String initials = author != null ? buildInitials(author.getFirstName(), author.getLastName()) : "RE";
        return new NoteResponse(
                n.getId(), n.getProjectId(), n.getAuthorUserId(),
                name, initials, n.getTitle(), n.getContent(),
                n.getStatus(), n.isPinned(), n.getCreatedAt(),
                n.getUpdatedAt(), n.getLastEditedBy(), commentCount
        );
    }

    private CommentResponse toCommentResponse(ResearchNoteComment c, UserAccount author) {
        String name = author != null ? (author.getFirstName() + " " + author.getLastName()).trim() : "Researcher";
        String initials = author != null ? buildInitials(author.getFirstName(), author.getLastName()) : "RE";
        return new CommentResponse(
                c.getId(), c.getNoteId(), c.getAuthorUserId(),
                name, initials, c.getContent(), c.getCreatedAt(), c.getUpdatedAt()
        );
    }

    private FileResponse toFileResponse(ResearchProjectFile f, UserAccount uploader, long sizeBytes) {
        String name = uploader != null ? (uploader.getFirstName() + " " + uploader.getLastName()).trim() : "Researcher";
        return new FileResponse(
                f.getId(), f.getProjectId(), f.getDisplayName(), f.getContentType(),
                f.getUploadedByUserId(), name, f.getCurrentVersionNumber(),
                sizeBytes, f.getCreatedAt(), f.getUpdatedAt(), f.getArchivedAt()
        );
    }

    private FileVersionResponse toFileVersionResponse(ResearchProjectFileVersion v, UserAccount uploader) {
        String name = uploader != null ? (uploader.getFirstName() + " " + uploader.getLastName()).trim() : "Researcher";
        return new FileVersionResponse(
                v.getId(), v.getProjectFileId(), v.getVersionNumber(),
                v.getChecksum(), v.getSizeBytes(), v.getUploadedByUserId(),
                name, v.getUploadedAt()
        );
    }

    public record DownloadableFile(String filename, String contentType, byte[] bytes) {}
}
