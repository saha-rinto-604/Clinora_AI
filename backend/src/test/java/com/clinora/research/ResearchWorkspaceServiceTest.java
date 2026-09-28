package com.clinora.research;

import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditEventRepository;
import com.clinora.patients.security.PatientReportMalwareScanner;
import com.clinora.research.api.ResearchWorkspaceModels.*;
import com.clinora.research.domain.*;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.repository.*;
import com.clinora.research.service.ResearchAuditService;
import com.clinora.research.service.ResearchAuthorizationService;
import com.clinora.research.service.ResearchWorkspaceService;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ResearchWorkspaceServiceTest {

    private ResearchAuthorizationService authz;
    private ResearchNoteRepository noteRepository;
    private ResearchNoteCommentRepository commentRepository;
    private ResearchProjectFileRepository fileRepository;
    private ResearchProjectFileVersionRepository versionRepository;
    private UserAccountRepository userRepository;
    private AuthAuditEventRepository auditEventRepository;
    private ResearchAuditService auditService;
    private ApplicationDocumentStoragePort storagePort;
    private PatientReportMalwareScanner malwareScanner;

    private ResearchWorkspaceService service;

    private UUID projectId;
    private UUID ownerId;
    private UUID coResearcherId;
    private UUID viewerId;
    private UserAccount ownerUser;
    private UserAccount coResearcherUser;
    private UserAccount viewerUser;

    @BeforeEach
    void setUp() throws Exception {
        authz = mock(ResearchAuthorizationService.class);
        noteRepository = mock(ResearchNoteRepository.class);
        commentRepository = mock(ResearchNoteCommentRepository.class);
        fileRepository = mock(ResearchProjectFileRepository.class);
        versionRepository = mock(ResearchProjectFileVersionRepository.class);
        userRepository = mock(UserAccountRepository.class);
        auditEventRepository = mock(AuthAuditEventRepository.class);
        auditService = mock(ResearchAuditService.class);
        storagePort = mock(ApplicationDocumentStoragePort.class);
        malwareScanner = mock(PatientReportMalwareScanner.class);

        service = new ResearchWorkspaceService(
                authz, noteRepository, commentRepository, fileRepository,
                versionRepository, userRepository, auditEventRepository,
                auditService, storagePort, malwareScanner
        );

        projectId = UUID.randomUUID();
        ownerId = UUID.randomUUID();
        coResearcherId = UUID.randomUUID();
        viewerId = UUID.randomUUID();

        ownerUser = createUser(ownerId, "Elena", "Vance");
        coResearcherUser = createUser(coResearcherId, "Marcus", "Chen");
        viewerUser = createUser(viewerId, "Sarah", "Connor");

        when(userRepository.findById(ownerId)).thenReturn(Optional.of(ownerUser));
        when(userRepository.findById(coResearcherId)).thenReturn(Optional.of(coResearcherUser));
        when(userRepository.findById(viewerId)).thenReturn(Optional.of(viewerUser));
    }

    private UserAccount createUser(UUID id, String firstName, String lastName) throws Exception {
        UserAccount u = new UserAccount(
                firstName, lastName, firstName.toLowerCase() + "@clinora.local",
                firstName.toLowerCase() + "@clinora.local", "hashed",
                UserRole.RESEARCHER, AccountStatus.ACTIVE, Instant.now()
        );
        Field idField = UserAccount.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(u, id);
        return u;
    }

    // ─── Notes Tests ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("Owner can create a research note")
    void testCreateNoteByOwner() {
        CreateNoteRequest req = new CreateNoteRequest("Methodology Note", "Observations on cohort", false);
        when(noteRepository.save(any(ResearchNote.class))).thenAnswer(invocation -> invocation.getArgument(0));

        NoteResponse response = service.createNote(projectId, ownerId, req, "127.0.0.1", "test-agent");

        assertNotNull(response);
        assertEquals("Methodology Note", response.title());
        assertEquals("Observations on cohort", response.content());
        assertFalse(response.pinned());
        verify(authz).requireNoteCreationPermission(projectId, ownerId);
        verify(auditService).recordEvent(eq(ownerId), eq(AuthAuditAction.RESEARCH_NOTE_CREATED), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Viewer cannot create a research note")
    void testCreateNoteByViewerDenied() {
        CreateNoteRequest req = new CreateNoteRequest("Unauthorized Note", "Viewer writing note", false);
        doThrow(new ResearchApiException(org.springframework.http.HttpStatus.FORBIDDEN, "INSUFFICIENT_ROLE", "Only project Owners and Co-Researchers can create research notes."))
                .when(authz).requireNoteCreationPermission(projectId, viewerId);

        assertThrows(ResearchApiException.class, () ->
                service.createNote(projectId, viewerId, req, "127.0.0.1", "test-agent"));
    }

    @Test
    @DisplayName("Authorized user can add comment to research note")
    void testAddCommentSuccess() {
        UUID noteId = UUID.randomUUID();
        ResearchNote note = new ResearchNote(noteId, projectId, ownerId, "Title", "Content", ResearchNoteStatus.DRAFT, false);
        when(noteRepository.findByIdAndProjectId(noteId, projectId)).thenReturn(Optional.of(note));
        when(commentRepository.save(any(ResearchNoteComment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AddCommentRequest req = new AddCommentRequest("Looks good, proceed with analysis.");
        CommentResponse comment = service.addComment(projectId, noteId, coResearcherId, req, "127.0.0.1", "test-agent");

        assertNotNull(comment);
        assertEquals("Looks good, proceed with analysis.", comment.content());
        verify(authz).requireCommentPermission(projectId, coResearcherId);
        verify(auditService).recordEvent(eq(coResearcherId), eq(AuthAuditAction.RESEARCH_NOTE_COMMENTED), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Viewer cannot comment on a research note")
    void testAddCommentByViewerDenied() {
        UUID noteId = UUID.randomUUID();
        doThrow(new ResearchApiException(org.springframework.http.HttpStatus.FORBIDDEN, "INSUFFICIENT_ROLE", "Viewers have read-only access and cannot comment on research notes."))
                .when(authz).requireCommentPermission(projectId, viewerId);

        AddCommentRequest req = new AddCommentRequest("Viewer comment");
        assertThrows(ResearchApiException.class, () ->
                service.addComment(projectId, noteId, viewerId, req, "127.0.0.1", "test-agent"));
    }

    // ─── File & Versioning Tests ──────────────────────────────────────────────

    @Test
    @DisplayName("Owner can upload a project document")
    void testUploadProjectFileSuccess() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "protocol.pdf", "application/pdf", "PDF file data".getBytes()
        );

        when(fileRepository.save(any(ResearchProjectFile.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(versionRepository.save(any(ResearchProjectFileVersion.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FileResponse response = service.uploadFile(projectId, ownerId, file, "Study Protocol v1", "127.0.0.1", "test-agent");

        assertNotNull(response);
        assertEquals("Study Protocol v1", response.displayName());
        assertEquals("application/pdf", response.contentType());
        assertEquals(1, response.currentVersionNumber());
        verify(authz).requireFileUploadPermission(projectId, ownerId);
        verify(storagePort).put(anyString(), any(byte[].class), eq("application/pdf"));
        verify(auditService).recordEvent(eq(ownerId), eq(AuthAuditAction.PROJECT_FILE_UPLOADED), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Uploading a new file version increments version number without overwriting")
    void testUploadNewFileVersion() {
        UUID fileId = UUID.randomUUID();
        ResearchProjectFile projectFile = new ResearchProjectFile(
                fileId, projectId, "Protocol", "application/pdf", ownerId
        );
        assertEquals(1, projectFile.getCurrentVersionNumber());

        when(fileRepository.findByIdAndProjectId(fileId, projectId)).thenReturn(Optional.of(projectFile));
        when(fileRepository.save(any(ResearchProjectFile.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(versionRepository.save(any(ResearchProjectFileVersion.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MockMultipartFile newVersion = new MockMultipartFile(
                "file", "protocol_v2.pdf", "application/pdf", "Updated PDF data".getBytes()
        );

        FileVersionResponse versionResponse = service.uploadFileVersion(
                projectId, fileId, coResearcherId, newVersion, "127.0.0.1", "test-agent"
        );

        assertNotNull(versionResponse);
        assertEquals(2, versionResponse.versionNumber());
        assertEquals(2, projectFile.getCurrentVersionNumber());
        verify(auditService).recordEvent(eq(coResearcherId), eq(AuthAuditAction.PROJECT_FILE_VERSION_UPLOADED), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Disallowed file types such as executables are rejected")
    void testDisallowedFileTypeRejected() {
        MockMultipartFile exeFile = new MockMultipartFile(
                "file", "malicious.exe", "application/x-msdownload", "binary data".getBytes()
        );

        ResearchApiException ex = assertThrows(ResearchApiException.class, () ->
                service.uploadFile(projectId, ownerId, exeFile, "Malware", "127.0.0.1", "test-agent"));

        assertEquals("DISALLOWED_FILE_TYPE", ex.getErrorCode());
    }

    @Test
    @DisplayName("Viewer cannot upload project files")
    void testUploadFileByViewerDenied() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "paper.pdf", "application/pdf", "PDF content".getBytes()
        );
        doThrow(new ResearchApiException(org.springframework.http.HttpStatus.FORBIDDEN, "INSUFFICIENT_ROLE", "Only project Owners and Co-Researchers can upload project documents."))
                .when(authz).requireFileUploadPermission(projectId, viewerId);

        assertThrows(ResearchApiException.class, () ->
                service.uploadFile(projectId, viewerId, file, "Paper", "127.0.0.1", "test-agent"));
    }

    @Test
    @DisplayName("Downloading a file retrieves stored bytes and audits the action")
    void testDownloadFileSuccess() {
        UUID fileId = UUID.randomUUID();
        ResearchProjectFile projectFile = new ResearchProjectFile(
                fileId, projectId, "Data_Dictionary.csv", "text/csv", ownerId
        );
        ResearchProjectFileVersion version = new ResearchProjectFileVersion(
                UUID.randomUUID(), fileId, 1, "research/projects/key", "checksum123", 100L, ownerId
        );

        when(fileRepository.findByIdAndProjectId(fileId, projectId)).thenReturn(Optional.of(projectFile));
        when(versionRepository.findByProjectFileIdAndVersionNumber(fileId, 1)).thenReturn(Optional.of(version));
        when(storagePort.get("research/projects/key"))
                .thenReturn(new ApplicationDocumentStoragePort.StoredObject("col1,col2\nval1,val2".getBytes(), "text/csv"));

        ResearchWorkspaceService.DownloadableFile downloaded =
                service.downloadFile(projectId, fileId, 1, viewerId, "127.0.0.1", "test-agent");

        assertNotNull(downloaded);
        assertEquals("Data_Dictionary.csv", downloaded.filename());
        assertEquals("text/csv", downloaded.contentType());
        assertTrue(downloaded.bytes().length > 0);
        verify(authz).requireReadAccess(projectId, viewerId);
        verify(auditService).recordEvent(eq(viewerId), eq(AuthAuditAction.PROJECT_FILE_DOWNLOADED), any(), any(), any(), any(), any());
    }
}
