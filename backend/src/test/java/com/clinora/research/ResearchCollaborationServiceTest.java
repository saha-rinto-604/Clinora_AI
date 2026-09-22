package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.research.api.ResearchCollaborationModels.*;
import com.clinora.research.domain.ProjectMemberRole;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectMember;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.repository.ResearchProjectMemberRepository;
import com.clinora.research.repository.ResearchProjectRepository;
import com.clinora.research.service.ResearchAuditService;
import com.clinora.research.service.ResearchCollaborationService;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ResearchCollaborationServiceTest {

    private ResearchProjectMemberRepository memberRepository;
    private ResearchProjectRepository projectRepository;
    private UserAccountRepository userRepository;
    private ResearchAuditService auditService;
    private ResearchCollaborationService service;

    private UUID ownerId;
    private UUID collaboratorId;
    private UUID projectId;
    private ResearchProject project;
    private UserAccount collaboratorUser;

    @BeforeEach
    void setUp() throws Exception {
        memberRepository = mock(ResearchProjectMemberRepository.class);
        projectRepository = mock(ResearchProjectRepository.class);
        userRepository = mock(UserAccountRepository.class);
        auditService = mock(ResearchAuditService.class);

        service = new ResearchCollaborationService(
                memberRepository,
                projectRepository,
                userRepository,
                auditService
        );

        ownerId = UUID.randomUUID();
        collaboratorId = UUID.randomUUID();
        projectId = UUID.randomUUID();

        project = ResearchProject.createDraft(
                ownerId,
                "Collaborative Genomic Study",
                "Study objective",
                "Description",
                "GENOMICS",
                null,
                null,
                null,
                java.time.Instant.now()
        );

        collaboratorUser = new UserAccount(
                "Jane",
                "Doe",
                "jane.doe@clinora.local",
                "jane.doe@clinora.local",
                "hashed",
                UserRole.RESEARCHER,
                AccountStatus.ACTIVE,
                java.time.Instant.now()
        );
        Field idField = UserAccount.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(collaboratorUser, collaboratorId);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(collaboratorId)).thenReturn(Optional.of(collaboratorUser));
    }

    @Test
    @DisplayName("Phase R14: Project owner can successfully add a collaborator with CO_RESEARCHER role")
    void ownerCanAddCollaborator() {
        when(memberRepository.existsByProjectIdAndUserId(projectId, collaboratorId)).thenReturn(false);
        when(memberRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        AddMemberRequest request = new AddMemberRequest(collaboratorId, ProjectMemberRole.CO_RESEARCHER);
        ProjectMemberResponse response = service.addMember(projectId, ownerId, request, "127.0.0.1", "TestAgent");

        assertNotNull(response);
        assertEquals(collaboratorId, response.userId());
        assertEquals(ProjectMemberRole.CO_RESEARCHER, response.role());
        assertEquals("jane.doe@clinora.local", response.userEmail());

        verify(auditService).recordEvent(
                eq(ownerId),
                eq(AuthAuditAction.COLLABORATOR_ADDED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(projectId.toString()),
                any(),
                any(),
                any()
        );
    }

    @Test
    @DisplayName("Phase R14: Duplicate collaborator addition is rejected with CONFLICT")
    void cannotAddDuplicateCollaborator() {
        when(memberRepository.existsByProjectIdAndUserId(projectId, collaboratorId)).thenReturn(true);

        AddMemberRequest request = new AddMemberRequest(collaboratorId, ProjectMemberRole.VIEWER);

        assertThrows(ResearchApiException.class, () ->
                service.addMember(projectId, ownerId, request, "127.0.0.1", "TestAgent")
        );
    }

    @Test
    @DisplayName("Phase R14: Non-owner cannot add members or manage team permissions")
    void nonOwnerCannotAddCollaborator() {
        UUID strangerId = UUID.randomUUID();
        when(memberRepository.findByProjectIdAndUserId(projectId, strangerId)).thenReturn(Optional.empty());

        AddMemberRequest request = new AddMemberRequest(collaboratorId, ProjectMemberRole.CO_RESEARCHER);

        assertThrows(ResearchApiException.class, () ->
                service.addMember(projectId, strangerId, request, "127.0.0.1", "TestAgent")
        );
    }

    @Test
    @DisplayName("Phase R14: Primary project owner cannot be removed from project")
    void cannotRemovePrimaryOwner() {
        UUID ownerMemberId = UUID.randomUUID();
        ResearchProjectMember ownerMember = new ResearchProjectMember(
                ownerMemberId,
                projectId,
                ownerId,
                ProjectMemberRole.OWNER,
                ownerId
        );
        when(memberRepository.findById(ownerMemberId)).thenReturn(Optional.of(ownerMember));

        assertThrows(ResearchApiException.class, () ->
                service.removeMember(projectId, ownerId, ownerMemberId, "127.0.0.1", "TestAgent")
        );
    }
}
