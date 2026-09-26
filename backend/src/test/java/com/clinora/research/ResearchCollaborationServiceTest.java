package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.research.api.ResearchCollaborationModels.*;
import com.clinora.research.domain.InvitationStatus;
import com.clinora.research.domain.ProjectMemberRole;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectInvitation;
import com.clinora.research.domain.ResearchProjectMember;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.repository.DatasetAccessGrantRepository;
import com.clinora.research.repository.ResearchProjectInvitationRepository;
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

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ResearchCollaborationServiceTest {

    private ResearchProjectMemberRepository memberRepository;
    private ResearchProjectRepository projectRepository;
    private ResearchProjectInvitationRepository invitationRepository;
    private UserAccountRepository userRepository;
    private DatasetAccessGrantRepository grantRepository;
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
        invitationRepository = mock(ResearchProjectInvitationRepository.class);
        userRepository = mock(UserAccountRepository.class);
        grantRepository = mock(DatasetAccessGrantRepository.class);
        auditService = mock(ResearchAuditService.class);

        service = new ResearchCollaborationService(
                memberRepository,
                projectRepository,
                invitationRepository,
                userRepository,
                grantRepository,
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
    @DisplayName("C2: Project owner can successfully send a collaboration invitation with CO_RESEARCHER role")
    void ownerCanSendInvitation() {
        when(memberRepository.existsActiveByProjectIdAndUserId(projectId, collaboratorId)).thenReturn(false);
        when(invitationRepository.findByProjectIdAndInviteeUserIdAndStatus(projectId, collaboratorId, InvitationStatus.PENDING))
                .thenReturn(Optional.empty());
        when(invitationRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        SendInvitationRequest request = new SendInvitationRequest(
                collaboratorId, ProjectMemberRole.CO_RESEARCHER, "Welcome to the study");
        InvitationResponse response = service.sendInvitation(projectId, ownerId, request, "127.0.0.1", "TestAgent");

        assertNotNull(response);
        assertEquals(collaboratorId, response.inviteeUserId());
        assertEquals(ProjectMemberRole.CO_RESEARCHER, response.proposedRole());
        assertEquals(InvitationStatus.PENDING, response.status());

        verify(auditService).recordEvent(
                eq(ownerId),
                eq(AuthAuditAction.COLLABORATOR_INVITED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(projectId.toString()),
                any(),
                any(),
                any()
        );
    }

    @Test
    @DisplayName("C2: Duplicate pending invitation is rejected with CONFLICT")
    void cannotSendDuplicateInvitation() {
        when(memberRepository.existsActiveByProjectIdAndUserId(projectId, collaboratorId)).thenReturn(false);
        ResearchProjectInvitation existingInv = mock(ResearchProjectInvitation.class);
        when(invitationRepository.findByProjectIdAndInviteeUserIdAndStatus(projectId, collaboratorId, InvitationStatus.PENDING))
                .thenReturn(Optional.of(existingInv));

        SendInvitationRequest request = new SendInvitationRequest(
                collaboratorId, ProjectMemberRole.VIEWER, "Follow up");

        assertThrows(ResearchApiException.class, () ->
                service.sendInvitation(projectId, ownerId, request, "127.0.0.1", "TestAgent")
        );
    }

    @Test
    @DisplayName("C2: Non-owner cannot send collaboration invitations")
    void nonOwnerCannotSendInvitation() {
        UUID strangerId = UUID.randomUUID();
        when(memberRepository.findByProjectIdAndUserId(projectId, strangerId)).thenReturn(Optional.empty());

        SendInvitationRequest request = new SendInvitationRequest(
                collaboratorId, ProjectMemberRole.CO_RESEARCHER, null);

        assertThrows(ResearchApiException.class, () ->
                service.sendInvitation(projectId, strangerId, request, "127.0.0.1", "TestAgent")
        );
    }

    @Test
    @DisplayName("C3: Primary project owner cannot be removed from project")
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
