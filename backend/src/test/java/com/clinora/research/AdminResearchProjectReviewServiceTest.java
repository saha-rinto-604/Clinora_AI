package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.AdminResearchProjectModels.AdminProjectDetailResponse;
import com.clinora.research.api.AdminResearchProjectModels.AdminProjectPageResponse;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectReview;
import com.clinora.research.domain.ResearchProjectReviewAction;
import com.clinora.research.domain.ResearchProjectStatus;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.ResearchProjectRepository;
import com.clinora.research.repository.ResearchProjectReviewRepository;
import com.clinora.research.service.AdminResearchProjectReviewService;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminResearchProjectReviewServiceTest {

    @Mock
    private ResearchProjectRepository projectRepository;

    @Mock
    private ResearchProjectReviewRepository reviewRepository;

    @Mock
    private UserAccountRepository userRepository;

    @Mock
    private AuthAuditService auditService;

    private final Instant fixedInstant = Instant.parse("2026-09-21T14:00:00Z");
    private final Clock clock = Clock.fixed(fixedInstant, ZoneOffset.UTC);

    private AdminResearchProjectReviewService service;

    private final UUID adminId = UUID.randomUUID();
    private final UUID researcherId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final String clientIp = "10.0.0.1";
    private final String userAgent = "Admin-Browser";

    @BeforeEach
    void setUp() {
        service = new AdminResearchProjectReviewService(
                projectRepository,
                reviewRepository,
                userRepository,
                auditService,
                clock
        );
    }

    private ResearchProject createSubmittedProject() {
        ResearchProject project = new ResearchProject(
                projectId,
                researcherId,
                "Study Zeta",
                "Objective Zeta",
                "Desc",
                "Cardiology",
                "Observational",
                "Metro Hospital",
                "IRB-ZETA-01",
                fixedInstant.minusSeconds(3600)
        );
        project.submit(fixedInstant.minusSeconds(1800));
        return project;
    }

    @Test
    @DisplayName("List review queue returns submitted projects enriched with owner info")
    void listReviewQueue() {
        ResearchProject project = createSubmittedProject();

        when(projectRepository.findByStatus(eq(ResearchProjectStatus.SUBMITTED), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(project), PageRequest.of(0, 20), 1));

        UserAccount mockUser = mock(UserAccount.class);
        when(mockUser.getId()).thenReturn(researcherId);
        when(mockUser.getFirstName()).thenReturn("Jane");
        when(mockUser.getLastName()).thenReturn("Doe");
        when(mockUser.getEmail()).thenReturn("jane.doe@research.org");

        when(userRepository.findAllById(Set.of(researcherId))).thenReturn(List.of(mockUser));

        AdminProjectPageResponse queue = service.listReviewQueue(ResearchProjectStatus.SUBMITTED, 1, 20, "submittedAt,asc");

        assertThat(queue.items()).hasSize(1);
        assertThat(queue.items().get(0).title()).isEqualTo("Study Zeta");
        assertThat(queue.items().get(0).ownerName()).isEqualTo("Jane Doe");
        assertThat(queue.items().get(0).ownerEmail()).isEqualTo("jane.doe@research.org");
    }

    @Test
    @DisplayName("Start review sets UNDER_REVIEW and saves immutable review record")
    void startReview() {
        ResearchProject project = createSubmittedProject();
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(researcherId)).thenReturn(Optional.empty());

        AdminProjectDetailResponse response = service.startReview(adminId, projectId, clientIp, userAgent);

        assertThat(response.project().status()).isEqualTo(ResearchProjectStatus.UNDER_REVIEW);
        assertThat(response.project().reviewedBy()).isEqualTo(adminId);

        verify(projectRepository).save(project);
        verify(reviewRepository).save(argThat(r ->
                r.getProjectId().equals(projectId)
                        && r.getReviewerUserId().equals(adminId)
                        && r.getAction() == ResearchProjectReviewAction.REVIEW_STARTED
        ));
        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.RESEARCH_PROJECT_REVIEW_STARTED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                eq(projectId.toString()),
                anyString()
        );
    }

    @Test
    @DisplayName("Request information transitions to MORE_INFO_REQUIRED and logs comment")
    void requestInformation() {
        ResearchProject project = createSubmittedProject();
        project.startReview(adminId, fixedInstant);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(researcherId)).thenReturn(Optional.empty());

        AdminProjectDetailResponse response = service.requestInformation(
                adminId,
                projectId,
                "Please clarify patient inclusion criteria.",
                clientIp,
                userAgent
        );

        assertThat(response.project().status()).isEqualTo(ResearchProjectStatus.MORE_INFO_REQUIRED);
        assertThat(response.project().reviewDecisionReason()).isEqualTo("Please clarify patient inclusion criteria.");

        verify(reviewRepository).save(argThat(r ->
                r.getAction() == ResearchProjectReviewAction.INFORMATION_REQUESTED
                        && "Please clarify patient inclusion criteria.".equals(r.getComment())
        ));
        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.RESEARCH_PROJECT_MORE_INFO_REQUESTED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                eq(projectId.toString()),
                contains("criteria")
        );
    }

    @Test
    @DisplayName("Approve transitions to APPROVED with decision note and timestamp")
    void approveProject() {
        ResearchProject project = createSubmittedProject();
        project.startReview(adminId, fixedInstant);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(researcherId)).thenReturn(Optional.empty());

        AdminProjectDetailResponse response = service.approve(
                adminId,
                projectId,
                "Governance, institutional ethics, and protocol verified.",
                clientIp,
                userAgent
        );

        assertThat(response.project().status()).isEqualTo(ResearchProjectStatus.APPROVED);
        assertThat(response.project().approvedAt()).isEqualTo(fixedInstant);

        verify(reviewRepository).save(argThat(r ->
                r.getAction() == ResearchProjectReviewAction.APPROVED
                        && r.getComment().contains("verified")
        ));
        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.RESEARCH_PROJECT_APPROVED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                eq(projectId.toString()),
                contains("verified")
        );
    }

    @Test
    @DisplayName("Reject transitions to REJECTED with reason")
    void rejectProject() {
        ResearchProject project = createSubmittedProject();
        project.startReview(adminId, fixedInstant);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(researcherId)).thenReturn(Optional.empty());

        AdminProjectDetailResponse response = service.reject(
                adminId,
                projectId,
                "Protocol does not meet ethics requirements.",
                clientIp,
                userAgent
        );

        assertThat(response.project().status()).isEqualTo(ResearchProjectStatus.REJECTED);
        assertThat(response.project().reviewDecisionReason()).isEqualTo("Protocol does not meet ethics requirements.");

        verify(reviewRepository).save(argThat(r ->
                r.getAction() == ResearchProjectReviewAction.REJECTED
                        && r.getComment().contains("ethics")
        ));
        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.RESEARCH_PROJECT_REJECTED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                eq(projectId.toString()),
                contains("ethics")
        );
    }

    @Test
    @DisplayName("Cannot review unsubmitted DRAFT project")
    void cannotReviewDraftProject() {
        ResearchProject draft = ResearchProject.createDraft(
                researcherId,
                "Draft Study",
                "Objective",
                null,
                "Field",
                null,
                null,
                null,
                fixedInstant
        );

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> service.startReview(adminId, projectId, clientIp, userAgent))
                .isInstanceOf(ResearchApiException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT)
                .hasFieldOrPropertyWithValue("errorCode", ResearchErrorCode.INVALID_PROJECT_STATE);

        verify(reviewRepository, never()).save(any());
        verify(auditService, never()).record(any(), any(), any(), any(), any(), any(), any());
    }
}
