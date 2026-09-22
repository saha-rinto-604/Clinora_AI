package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.ResearchProjectModels.*;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectStatus;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.ResearchProjectRepository;
import com.clinora.research.service.ResearchProjectService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResearchProjectServiceTest {

    @Mock
    private ResearchProjectRepository repository;

    @Mock
    private AuthAuditService auditService;

    private final Instant fixedInstant = Instant.parse("2026-09-21T12:00:00Z");
    private final Clock clock = Clock.fixed(fixedInstant, ZoneOffset.UTC);

    private ResearchProjectService service;

    private final UUID researcherId = UUID.randomUUID();
    private final String clientIp = "127.0.0.1";
    private final String userAgent = "Mozilla/5.0";

    @BeforeEach
    void setUp() {
        service = new ResearchProjectService(repository, auditService, clock);
    }

    @Test
    @DisplayName("Create draft project persists entity and logs audit event")
    void createDraftSuccess() {
        CreateProjectRequest request = new CreateProjectRequest(
                "Study Alpha",
                "Study objective",
                "Study description",
                "Cardiology",
                "Methodology details",
                "General Hospital",
                "IRB-123"
        );

        when(repository.existsByOwnerUserIdAndTitleIgnoreCase(researcherId, "Study Alpha")).thenReturn(false);
        when(repository.save(any(ResearchProject.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProjectResponse response = service.createDraft(researcherId, request, clientIp, userAgent);

        assertThat(response.title()).isEqualTo("Study Alpha");
        assertThat(response.status()).isEqualTo(ResearchProjectStatus.DRAFT);
        assertThat(response.editable()).isTrue();
        assertThat(response.submittable()).isTrue();

        verify(repository).save(any(ResearchProject.class));
        verify(auditService).record(
                eq(researcherId),
                eq(AuthAuditAction.RESEARCH_PROJECT_CREATED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                anyString(),
                contains("Study Alpha")
        );
    }

    @Test
    @DisplayName("Create draft with duplicate title throws 409 conflict")
    void createDraftDuplicateTitle() {
        CreateProjectRequest request = new CreateProjectRequest(
                "Existing Study",
                "Objective",
                null,
                "Cardiology",
                null,
                null,
                null
        );

        when(repository.existsByOwnerUserIdAndTitleIgnoreCase(researcherId, "Existing Study")).thenReturn(true);

        assertThatThrownBy(() -> service.createDraft(researcherId, request, clientIp, userAgent))
                .isInstanceOf(ResearchApiException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT)
                .hasFieldOrPropertyWithValue("errorCode", ResearchErrorCode.DUPLICATE_PROJECT_TITLE);

        verify(repository, never()).save(any());
        verify(auditService, never()).record(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("List projects returns paginated response")
    void listProjects() {
        ResearchProject project = ResearchProject.createDraft(
                researcherId,
                "Study Beta",
                "Objective",
                "Desc",
                "Neurology",
                "Method",
                null,
                null,
                fixedInstant
        );

        when(repository.findByOwnerUserId(eq(researcherId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(project), PageRequest.of(0, 20), 1));

        ProjectPageResponse response = service.listProjects(researcherId, null, 1, 20, "createdAt,desc");

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).title()).isEqualTo("Study Beta");
        assertThat(response.totalItems()).isEqualTo(1);
        assertThat(response.page()).isEqualTo(1);
    }

    @Test
    @DisplayName("Get project returns owned project")
    void getProjectOwned() {
        UUID projectId = UUID.randomUUID();
        ResearchProject project = new ResearchProject(
                projectId,
                researcherId,
                "My Project",
                "Objective",
                "Desc",
                "Oncology",
                null,
                null,
                null,
                fixedInstant
        );

        when(repository.findByIdAndOwnerUserId(projectId, researcherId)).thenReturn(Optional.of(project));

        ProjectResponse response = service.getProject(researcherId, projectId);
        assertThat(response.id()).isEqualTo(projectId);
        assertThat(response.title()).isEqualTo("My Project");
    }

    @Test
    @DisplayName("Get project not owned by researcher throws 404")
    void getProjectNotOwnedThrows404() {
        UUID projectId = UUID.randomUUID();
        when(repository.findByIdAndOwnerUserId(projectId, researcherId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getProject(researcherId, projectId))
                .isInstanceOf(ResearchApiException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.NOT_FOUND)
                .hasFieldOrPropertyWithValue("errorCode", ResearchErrorCode.PROJECT_NOT_FOUND);
    }

    @Test
    @DisplayName("Submit project transitions to SUBMITTED and logs audit")
    void submitProject() {
        UUID projectId = UUID.randomUUID();
        ResearchProject project = new ResearchProject(
                projectId,
                researcherId,
                "Ready Study",
                "Clear Objective",
                "Desc",
                "Genetics",
                null,
                null,
                null,
                fixedInstant
        );

        when(repository.findByIdAndOwnerUserId(projectId, researcherId)).thenReturn(Optional.of(project));
        when(repository.save(any(ResearchProject.class))).thenAnswer(i -> i.getArgument(0));

        ProjectResponse response = service.submitProject(researcherId, projectId, clientIp, userAgent);

        assertThat(response.status()).isEqualTo(ResearchProjectStatus.SUBMITTED);
        assertThat(response.submittedAt()).isEqualTo(fixedInstant);

        verify(auditService).record(
                eq(researcherId),
                eq(AuthAuditAction.RESEARCH_PROJECT_SUBMITTED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                eq(projectId.toString()),
                contains("SUBMITTED")
        );
    }

    @Test
    @DisplayName("Cannot update project after submission")
    void cannotUpdateSubmittedProject() {
        UUID projectId = UUID.randomUUID();
        ResearchProject project = new ResearchProject(
                projectId,
                researcherId,
                "Ready Study",
                "Objective",
                null,
                "Genetics",
                null,
                null,
                null,
                fixedInstant
        );
        project.submit(fixedInstant);

        when(repository.findByIdAndOwnerUserId(projectId, researcherId)).thenReturn(Optional.of(project));

        UpdateProjectRequest updateRequest = new UpdateProjectRequest(
                "Ready Study",
                "Attempted edit",
                null,
                "Genetics",
                null,
                null,
                null
        );

        assertThatThrownBy(() -> service.updateProject(researcherId, projectId, updateRequest, clientIp, userAgent))
                .isInstanceOf(ResearchApiException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT)
                .hasFieldOrPropertyWithValue("errorCode", ResearchErrorCode.PROJECT_NOT_EDITABLE);
    }

    @Test
    @DisplayName("Withdraw submitted project")
    void withdrawProject() {
        UUID projectId = UUID.randomUUID();
        ResearchProject project = new ResearchProject(
                projectId,
                researcherId,
                "Study to withdraw",
                "Objective",
                null,
                "Genetics",
                null,
                null,
                null,
                fixedInstant
        );
        project.submit(fixedInstant);

        when(repository.findByIdAndOwnerUserId(projectId, researcherId)).thenReturn(Optional.of(project));
        when(repository.save(any(ResearchProject.class))).thenAnswer(i -> i.getArgument(0));

        ProjectResponse response = service.withdrawProject(researcherId, projectId, clientIp, userAgent);

        assertThat(response.status()).isEqualTo(ResearchProjectStatus.WITHDRAWN);
        verify(auditService).record(
                eq(researcherId),
                eq(AuthAuditAction.RESEARCH_PROJECT_WITHDRAWN),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                eq(projectId.toString()),
                contains("WITHDRAWN")
        );
    }

    @Test
    @DisplayName("Archive allowed project")
    void archiveProject() {
        UUID projectId = UUID.randomUUID();
        ResearchProject project = new ResearchProject(
                projectId,
                researcherId,
                "Draft to archive",
                "Objective",
                null,
                "Genetics",
                null,
                null,
                null,
                fixedInstant
        );

        when(repository.findByIdAndOwnerUserId(projectId, researcherId)).thenReturn(Optional.of(project));
        when(repository.save(any(ResearchProject.class))).thenAnswer(i -> i.getArgument(0));

        ProjectResponse response = service.archiveProject(researcherId, projectId, clientIp, userAgent);

        assertThat(response.status()).isEqualTo(ResearchProjectStatus.ARCHIVED);
        assertThat(response.archivedAt()).isEqualTo(fixedInstant);
        verify(auditService).record(
                eq(researcherId),
                eq(AuthAuditAction.RESEARCH_PROJECT_ARCHIVED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                eq(projectId.toString()),
                contains("ARCHIVED")
        );
    }
}
