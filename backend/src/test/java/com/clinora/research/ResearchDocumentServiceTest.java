package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.research.api.ResearchDocumentModels.*;
import com.clinora.research.domain.*;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.repository.*;
import com.clinora.research.service.ResearchAuditService;
import com.clinora.research.service.ResearchAuthorizationService;
import com.clinora.research.service.ResearchDocumentService;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ResearchDocumentServiceTest {

    private ResearchDocumentRepository documentRepository;
    private ResearchDocumentRevisionRepository revisionRepository;
    private ResearchDocumentCommentRepository commentRepository;
    private ResearchAuthorizationService authz;
    private UserAccountRepository userRepository;
    private ResearchAuditService auditService;
    private ResearchDatasetRepository datasetRepository;
    private AIEvaluationRunRepository evaluationRunRepository;
    private ResearchDocumentService service;

    private UUID projectId;
    private UUID ownerUserId;
    private UUID coResearcherUserId;
    private UUID supervisorUserId;
    private UUID viewerUserId;
    private UUID unrelatedUserId;

    private UserAccount ownerUser;
    private UserAccount coResearcherUser;
    private UserAccount supervisorUser;
    private UserAccount viewerUser;

    private UserAccount createUser(UUID id, String email, String firstName, String lastName) {
        UserAccount u = new UserAccount(
            firstName,
            lastName,
            email,
            email.toLowerCase(),
            "hashed_pass",
            UserRole.RESEARCHER,
            AccountStatus.ACTIVE,
            java.time.Instant.now()
        );
        try {
            java.lang.reflect.Field idField = UserAccount.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(u, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return u;
    }

    @BeforeEach
    void setUp() {
        documentRepository = mock(ResearchDocumentRepository.class);
        revisionRepository = mock(ResearchDocumentRevisionRepository.class);
        commentRepository = mock(ResearchDocumentCommentRepository.class);
        authz = mock(ResearchAuthorizationService.class);
        userRepository = mock(UserAccountRepository.class);
        auditService = mock(ResearchAuditService.class);
        datasetRepository = mock(ResearchDatasetRepository.class);
        evaluationRunRepository = mock(AIEvaluationRunRepository.class);

        service = new ResearchDocumentService(
                documentRepository,
                revisionRepository,
                commentRepository,
                authz,
                userRepository,
                auditService,
                datasetRepository,
                evaluationRunRepository
        );

        projectId = UUID.randomUUID();
        ownerUserId = UUID.randomUUID();
        coResearcherUserId = UUID.randomUUID();
        supervisorUserId = UUID.randomUUID();
        viewerUserId = UUID.randomUUID();
        unrelatedUserId = UUID.randomUUID();

        ownerUser = createUser(ownerUserId, "owner@example.com", "Elena", "Rostova");
        coResearcherUser = createUser(coResearcherUserId, "coresearcher@example.com", "Robert", "Chen");
        supervisorUser = createUser(supervisorUserId, "supervisor@example.com", "Marcus", "Vance");
        viewerUser = createUser(viewerUserId, "viewer@example.com", "Sophia", "Kim");

        when(userRepository.findAllById(any())).thenAnswer(inv -> {
            Collection<UUID> ids = inv.getArgument(0);
            List<UserAccount> list = new ArrayList<>();
            for (UUID id : ids) {
                if (id.equals(ownerUserId)) list.add(ownerUser);
                if (id.equals(coResearcherUserId)) list.add(coResearcherUser);
                if (id.equals(supervisorUserId)) list.add(supervisorUser);
                if (id.equals(viewerUserId)) list.add(viewerUser);
            }
            return list;
        });
        when(userRepository.findById(ownerUserId)).thenReturn(Optional.of(ownerUser));
        when(userRepository.findById(coResearcherUserId)).thenReturn(Optional.of(coResearcherUser));
        when(userRepository.findById(supervisorUserId)).thenReturn(Optional.of(supervisorUser));
        when(userRepository.findById(viewerUserId)).thenReturn(Optional.of(viewerUser));
    }

    @Test
    @DisplayName("1. OWNER can create documents")
    void ownerCanCreateDocuments() {
        when(authz.resolveProjectRole(projectId, ownerUserId)).thenReturn(Optional.of(ProjectMemberRole.OWNER));
        when(documentRepository.save(any(ResearchDocument.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateDocumentRequest request = new CreateDocumentRequest(
                "Phase 1 Protocol",
                ResearchDocumentType.METHODOLOGY,
                "{\"type\":\"doc\"}",
                null
        );

        DocumentDetailDto created = service.createDocument(projectId, request, ownerUserId, "127.0.0.1", "TestAgent");

        assertNotNull(created);
        assertEquals("Phase 1 Protocol", created.title());
        assertEquals(ResearchDocumentType.METHODOLOGY, created.documentType());
        assertEquals(ownerUserId, created.createdByUserId());
        assertEquals(1, created.currentRevisionNumber());

        verify(documentRepository).save(any(ResearchDocument.class));
        verify(revisionRepository).save(any(ResearchDocumentRevision.class));
        verify(auditService).recordEvent(eq(ownerUserId), eq(AuthAuditAction.RESEARCH_DOCUMENT_CREATED), eq(AuthAuditOutcome.SUCCESS),
                any(), any(), any(), any());
    }

    @Test
    @DisplayName("2. CO_RESEARCHER can edit allowed documents")
    void coResearcherCanEditAllowedDocuments() {
        UUID docId = UUID.randomUUID();
        ResearchDocument document = new ResearchDocument(
                docId, projectId, "Initial Draft", ResearchDocumentType.PAPER_DRAFT,
                "{\"type\":\"doc\",\"content\":[]}", null, ownerUserId
        );

        when(authz.resolveProjectRole(projectId, coResearcherUserId)).thenReturn(Optional.of(ProjectMemberRole.CO_RESEARCHER));
        when(documentRepository.findByIdAndProjectId(docId, projectId)).thenReturn(Optional.of(document));
        when(documentRepository.findForUpdate(docId, projectId)).thenReturn(Optional.of(document));
        when(documentRepository.save(any(ResearchDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(docId))
                .thenReturn(Optional.of(new ResearchDocumentRevision(UUID.randomUUID(), docId, 1, ownerUserId, "Initial Draft", "{}", null, "Initial")));

        UpdateDocumentRequest updateReq = new UpdateDocumentRequest(
                "Updated Methodology Draft",
                ResearchDocumentType.PAPER_DRAFT,
                "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"text\":\"Section 2\"}]}",
                null,
                "Added Section 2 analysis",
                1
        );

        DocumentDetailDto updated = service.updateDocument(projectId, docId, updateReq, coResearcherUserId, "127.0.0.1", "TestAgent");

        assertNotNull(updated);
        assertEquals("Updated Methodology Draft", updated.title());
        assertEquals(coResearcherUserId, updated.lastEditedByUserId());
        assertEquals(2, updated.currentRevisionNumber());
        verify(revisionRepository).save(argThat(r -> r.getRevisionNumber() == 2 && r.getEditedByUserId().equals(coResearcherUserId)));
    }

    @Test
    @DisplayName("3. SUPERVISOR behavior matches permission policy (can edit and review, cannot create or archive)")
    void supervisorPermissionPolicy() {
        when(authz.resolveProjectRole(projectId, supervisorUserId)).thenReturn(Optional.of(ProjectMemberRole.SUPERVISOR));

        // Attempt creation -> Forbidden
        CreateDocumentRequest createReq = new CreateDocumentRequest("Supervisor Note", ResearchDocumentType.GENERAL, "{}", null);
        assertThrows(ResearchApiException.class, () ->
                service.createDocument(projectId, createReq, supervisorUserId, "127.0.0.1", "TestAgent"));

        // Allowed to edit existing document
        UUID docId = UUID.randomUUID();
        ResearchDocument document = new ResearchDocument(docId, projectId, "Review Note", ResearchDocumentType.GENERAL, "{}", null, ownerUserId);
        when(documentRepository.findByIdAndProjectId(docId, projectId)).thenReturn(Optional.of(document));
        when(documentRepository.findForUpdate(docId, projectId)).thenReturn(Optional.of(document));
        when(documentRepository.save(any(ResearchDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(docId))
                .thenReturn(Optional.of(new ResearchDocumentRevision(UUID.randomUUID(), docId, 1, ownerUserId, "Review Note", "{}", null, "Initial")));

        UpdateDocumentRequest updateReq = new UpdateDocumentRequest("Review Note Edited", null, "{\"type\":\"doc\"}", null, "Supervisor edit", 1);
        DocumentDetailDto updated = service.updateDocument(projectId, docId, updateReq, supervisorUserId, "127.0.0.1", "TestAgent");
        assertNotNull(updated);
        assertEquals(supervisorUserId, updated.lastEditedByUserId());

        // Attempt archive -> Forbidden (only OWNER can archive)
        assertThrows(ResearchApiException.class, () ->
                service.archiveDocument(projectId, docId, 1, supervisorUserId, "127.0.0.1", "TestAgent"));
    }

    @Test
    @DisplayName("4. VIEWER cannot mutate (read-only)")
    void viewerCannotMutate() {
        UUID docId = UUID.randomUUID();
        ResearchDocument document = new ResearchDocument(docId, projectId, "Protected Doc", ResearchDocumentType.GENERAL, "{}", null, ownerUserId);
        when(documentRepository.findByIdAndProjectId(docId, projectId)).thenReturn(Optional.of(document));
        when(documentRepository.findForUpdate(docId, projectId)).thenReturn(Optional.of(document));
        when(authz.resolveProjectRole(projectId, viewerUserId)).thenReturn(Optional.of(ProjectMemberRole.VIEWER));

        // Cannot create
        assertThrows(ResearchApiException.class, () ->
                service.createDocument(projectId, new CreateDocumentRequest("T", ResearchDocumentType.GENERAL, "{}", null), viewerUserId, "127.0.0.1", "TestAgent"));

        // Cannot edit
        assertThrows(ResearchApiException.class, () ->
                service.updateDocument(projectId, docId, new UpdateDocumentRequest("T2", null, "{}", null, "c", 1), viewerUserId, "127.0.0.1", "TestAgent"));

        // Cannot rename
        assertThrows(ResearchApiException.class, () ->
                service.renameDocument(projectId, docId, new RenameDocumentRequest("New Title", 1), viewerUserId, "127.0.0.1", "TestAgent"));

        // Cannot archive
        assertThrows(ResearchApiException.class, () ->
                service.archiveDocument(projectId, docId, 1, viewerUserId, "127.0.0.1", "TestAgent"));

        // Cannot comment
        assertThrows(ResearchApiException.class, () ->
                service.addComment(projectId, docId, new AddDocumentCommentRequest("comment", null), viewerUserId, "127.0.0.1", "TestAgent"));
    }

    @Test
    @DisplayName("5. Unrelated Researcher cannot read or edit (403 Forbidden)")
    void unrelatedResearcherCannotReadOrEdit() {
        doThrow(new ResearchApiException(org.springframework.http.HttpStatus.FORBIDDEN, "PROJECT_ACCESS_DENIED", "Denied"))
                .when(authz).requireReadAccess(projectId, unrelatedUserId);

        assertThrows(ResearchApiException.class, () ->
                service.listDocuments(projectId, unrelatedUserId));

        UUID docId = UUID.randomUUID();
        assertThrows(ResearchApiException.class, () ->
                service.getDocument(projectId, docId, unrelatedUserId));
    }

    @Test
    @DisplayName("6. Removed collaborator loses access")
    void removedCollaboratorLosesAccess() {
        UUID removedCollaboratorId = UUID.randomUUID();
        doThrow(new ResearchApiException(org.springframework.http.HttpStatus.FORBIDDEN, "PROJECT_ACCESS_DENIED", "Access denied: You are not an active member of this project."))
                .when(authz).requireReadAccess(projectId, removedCollaboratorId);

        assertThrows(ResearchApiException.class, () ->
                service.listDocuments(projectId, removedCollaboratorId));
    }

    @Test
    @DisplayName("7. Creator and last-editor attribution is correct")
    void creatorAndLastEditorAttribution() {
        UUID docId = UUID.randomUUID();
        ResearchDocument document = new ResearchDocument(
                docId, projectId, "Attribution Test", ResearchDocumentType.PAPER_DRAFT,
                "{}", null, ownerUserId
        );
        document.updateContent("Attribution Test", null, "{\"updated\":true}", null, coResearcherUserId);

        when(documentRepository.findByIdAndProjectId(docId, projectId)).thenReturn(Optional.of(document));
        when(documentRepository.findForUpdate(docId, projectId)).thenReturn(Optional.of(document));
        when(revisionRepository.findDistinctEditorIdsByDocumentId(docId)).thenReturn(List.of(coResearcherUserId));
        when(revisionRepository.countByDocumentId(docId)).thenReturn(2L);
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(docId))
                .thenReturn(Optional.of(new ResearchDocumentRevision(UUID.randomUUID(), docId, 2, coResearcherUserId, "Attribution Test", "{}", null, "rev 2")));

        DocumentDetailDto detail = service.getDocument(projectId, docId, ownerUserId);

        assertEquals(ownerUserId, detail.createdByUserId());
        assertEquals("Elena Rostova", detail.createdByName());
        assertEquals(coResearcherUserId, detail.lastEditedByUserId());
        assertEquals("Robert Chen", detail.lastEditedByName());
    }

    @Test
    @DisplayName("8. Contributor list comes from real edits (not inferred from project members)")
    void contributorListComesFromRealEdits() {
        UUID docId = UUID.randomUUID();
        ResearchDocument document = new ResearchDocument(
                docId, projectId, "Multi-editor doc", ResearchDocumentType.GENERAL,
                "{}", null, ownerUserId
        );

        when(documentRepository.findByIdAndProjectId(docId, projectId)).thenReturn(Optional.of(document));
        when(documentRepository.findForUpdate(docId, projectId)).thenReturn(Optional.of(document));
        // Elena created it, Robert and Marcus edited revisions; Sophia (viewer) never edited
        when(revisionRepository.findDistinctEditorIdsByDocumentId(docId))
                .thenReturn(List.of(coResearcherUserId, supervisorUserId));
        when(revisionRepository.countByDocumentId(docId)).thenReturn(3L);
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(docId))
                .thenReturn(Optional.of(new ResearchDocumentRevision(UUID.randomUUID(), docId, 3, supervisorUserId, "Multi-editor doc", "{}", null, "rev 3")));

        DocumentDetailDto detail = service.getDocument(projectId, docId, ownerUserId);

        List<UUID> contributorUserIds = detail.contributors().stream().map(ContributorDto::userId).toList();
        assertTrue(contributorUserIds.contains(ownerUserId), "Must contain creator");
        assertTrue(contributorUserIds.contains(coResearcherUserId), "Must contain editor Robert");
        assertTrue(contributorUserIds.contains(supervisorUserId), "Must contain editor Marcus");
        assertFalse(contributorUserIds.contains(viewerUserId), "Must NOT contain non-editing member Sophia");
    }

    @Test
    @DisplayName("9. Version history preserves prior content and can be restored without losing history")
    void versionHistoryPreservedAndRestorable() {
        UUID docId = UUID.randomUUID();
        ResearchDocument document = new ResearchDocument(
                docId, projectId, "Version Test", ResearchDocumentType.PAPER_DRAFT,
                "Content V2", null, ownerUserId
        );

        ResearchDocumentRevision rev1 = new ResearchDocumentRevision(
                UUID.randomUUID(), docId, 1, ownerUserId, "Version Test", "Original Content V1", null, "Initial"
        );
        ResearchDocumentRevision rev2 = new ResearchDocumentRevision(
                UUID.randomUUID(), docId, 2, coResearcherUserId, "Version Test", "Content V2", null, "Edit V2"
        );

        when(documentRepository.findByIdAndProjectId(docId, projectId)).thenReturn(Optional.of(document));
        when(documentRepository.findForUpdate(docId, projectId)).thenReturn(Optional.of(document));
        when(documentRepository.save(any(ResearchDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(revisionRepository.findByDocumentIdAndRevisionNumber(docId, 1)).thenReturn(Optional.of(rev1));
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(docId)).thenReturn(Optional.of(rev2));
        when(authz.resolveProjectRole(projectId, ownerUserId)).thenReturn(Optional.of(ProjectMemberRole.OWNER));

        // Restore version 1
        DocumentDetailDto restored = service.restoreRevision(projectId, docId, 1, 2, ownerUserId, "127.0.0.1", "TestAgent");

        assertEquals(3, restored.currentRevisionNumber(), "Restoring creates new revision 3 without deleting prior revisions");
        assertEquals("Original Content V1", document.getContentJson());
        verify(revisionRepository).save(argThat(r -> r.getRevisionNumber() == 3 && r.getContentJson().equals("Original Content V1")));
        verify(auditService).recordEvent(eq(ownerUserId), eq(AuthAuditAction.RESEARCH_DOCUMENT_VERSION_RESTORED), eq(AuthAuditOutcome.SUCCESS),
                any(), any(), any(), any());
    }

    @Test
    @DisplayName("10. Archived document becomes read-only")
    void archivedDocumentBecomesReadOnly() {
        UUID docId = UUID.randomUUID();
        ResearchDocument document = new ResearchDocument(
                docId, projectId, "Archived Doc", ResearchDocumentType.GENERAL,
                "{}", null, ownerUserId
        );
        document.archive(ownerUserId);

        when(documentRepository.findByIdAndProjectId(docId, projectId)).thenReturn(Optional.of(document));
        when(documentRepository.findForUpdate(docId, projectId)).thenReturn(Optional.of(document));
        when(authz.resolveProjectRole(projectId, ownerUserId)).thenReturn(Optional.of(ProjectMemberRole.OWNER));

        // Update rejected
        assertThrows(ResearchApiException.class, () ->
                service.updateDocument(projectId, docId, new UpdateDocumentRequest("Title", null, "{}", null, "change", 1), ownerUserId, "127.0.0.1", "TestAgent"));

        // Rename rejected
        assertThrows(ResearchApiException.class, () ->
                service.renameDocument(projectId, docId, new RenameDocumentRequest("New Title", 1), ownerUserId, "127.0.0.1", "TestAgent"));

        // Comment rejected
        assertThrows(ResearchApiException.class, () ->
                service.addComment(projectId, docId, new AddDocumentCommentRequest("New comment", null), ownerUserId, "127.0.0.1", "TestAgent"));

        // Restore rejected
        assertThrows(ResearchApiException.class, () ->
                service.restoreRevision(projectId, docId, 1, 1, ownerUserId, "127.0.0.1", "TestAgent"));
    }

    @Test
    @DisplayName("11. Document audit does not contain raw content or keystrokes")
    void documentAuditDoesNotContainRawContentOrKeystrokes() {
        when(authz.resolveProjectRole(projectId, ownerUserId)).thenReturn(Optional.of(ProjectMemberRole.OWNER));
        when(documentRepository.save(any(ResearchDocument.class))).thenAnswer(inv -> inv.getArgument(0));

        String secretText = "SENSITIVE_CLINICAL_HYPOTHESIS_12345";
        CreateDocumentRequest request = new CreateDocumentRequest(
                "Audit Privacy Test",
                ResearchDocumentType.ANALYSIS_NOTES,
                secretText,
                null
        );

        service.createDocument(projectId, request, ownerUserId, "127.0.0.1", "TestAgent");

        // Verify audit call does not contain secretText in metadata map
        verify(auditService).recordEvent(
                eq(ownerUserId),
                eq(AuthAuditAction.RESEARCH_DOCUMENT_CREATED),
                eq(AuthAuditOutcome.SUCCESS),
                any(),
                any(),
                any(),
                argThat(meta -> {
                    for (Object v : meta.values()) {
                        if (v != null && v.toString().contains(secretText)) {
                            return false;
                        }
                    }
                    return true;
                })
        );
    }
    @Test
    void staleSaveDoesNotChangeDocumentOrCreateRevision() {
        UUID docId = UUID.randomUUID();
        ResearchDocument doc = new ResearchDocument(docId,projectId,"Latest",ResearchDocumentType.GENERAL,"latest body",null,ownerUserId);
        when(authz.resolveProjectRole(projectId,ownerUserId)).thenReturn(Optional.of(ProjectMemberRole.OWNER));
        when(documentRepository.findForUpdate(docId,projectId)).thenReturn(Optional.of(doc));
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(docId)).thenReturn(Optional.of(
            new ResearchDocumentRevision(UUID.randomUUID(),docId,2,ownerUserId,"Latest","latest body",null,"Latest")));
        var stale = new UpdateDocumentRequest("Old",null,"stale body",null,"stale",1);
        var failure = assertThrows(ResearchApiException.class, () -> service.updateDocument(projectId,docId,stale,ownerUserId,"test","test"));
        assertEquals(org.springframework.http.HttpStatus.CONFLICT,failure.getStatus());
        assertEquals("latest body",doc.getContentJson());
        verify(documentRepository,never()).save(any());
        verify(revisionRepository,never()).save(any());
    }

}
