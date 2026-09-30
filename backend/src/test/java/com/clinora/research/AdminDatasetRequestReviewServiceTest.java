package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.DatasetRequestModels.AdminDatasetRequestDetailResponse;
import com.clinora.research.api.DatasetRequestModels.AdminDatasetRequestQueueItem;
import com.clinora.research.domain.DatasetFormat;
import com.clinora.research.domain.DatasetRequest;
import com.clinora.research.domain.DatasetRequestStatus;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.repository.DatasetRequestRepository;
import com.clinora.research.repository.ResearchProjectRepository;
import com.clinora.research.service.AdminDatasetRequestReviewService;
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

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminDatasetRequestReviewServiceTest {

    @Mock
    private DatasetRequestRepository requestRepository;

    @Mock
    private ResearchProjectRepository projectRepository;

    @Mock
    private UserAccountRepository userRepository;

    @Mock
    private AuthAuditService auditService;

    private final Instant fixedInstant = Instant.parse("2026-09-21T16:00:00Z");
    private final Clock clock = Clock.fixed(fixedInstant, ZoneOffset.UTC);

    private AdminDatasetRequestReviewService service;

    private final UUID adminId = UUID.randomUUID();
    private final UUID researcherId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID requestId = UUID.randomUUID();
    private final String clientIp = "10.0.0.5";
    private final String userAgent = "Admin-Console";

    @BeforeEach
    void setUp() {
        service = new AdminDatasetRequestReviewService(
                requestRepository,
                projectRepository,
                userRepository,
                auditService,
                clock
        );
    }

    private DatasetRequest createSubmittedRequest() {
        DatasetRequest request = DatasetRequest.createDraft(
                projectId,
                "Hypertension Cohort Request",
                "Study drug efficacy on BP",
                "{\"minAge\": 30}",
                "[\"BP_SYS\", \"BP_DIA\"]",
                "{}",
                DatasetFormat.CSV,
                fixedInstant.minusSeconds(3600)
        );
        request.submit(fixedInstant.minusSeconds(1800));
        return request;
    }

    @Test
    @DisplayName("List review queue returns submitted dataset requests with enriched project and researcher data")
    void listQueue() {
        DatasetRequest request = createSubmittedRequest();

        when(requestRepository.findByStatus(eq(DatasetRequestStatus.SUBMITTED), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(request), PageRequest.of(0, 20), 1));

        ResearchProject mockProject = mock(ResearchProject.class);
        when(mockProject.getId()).thenReturn(projectId);
        when(mockProject.getTitle()).thenReturn("Cardio Health Study");
        when(mockProject.getOwnerUserId()).thenReturn(researcherId);

        when(projectRepository.findAllById(Set.of(projectId))).thenReturn(List.of(mockProject));

        UserAccount mockUser = mock(UserAccount.class);
        when(mockUser.getId()).thenReturn(researcherId);
        when(mockUser.getFirstName()).thenReturn("Alex");
        when(mockUser.getLastName()).thenReturn("Smith");
        when(mockUser.getEmail()).thenReturn("alex.smith@med.org");

        when(userRepository.findAllById(Set.of(researcherId))).thenReturn(List.of(mockUser));

        List<AdminDatasetRequestQueueItem> queue = service.listQueue(DatasetRequestStatus.SUBMITTED, 1, 20);

        assertThat(queue).hasSize(1);
        assertThat(queue.get(0).name()).isEqualTo("Hypertension Cohort Request");
        assertThat(queue.get(0).projectTitle()).isEqualTo("Cardio Health Study");
        assertThat(queue.get(0).researcherName()).isEqualTo("Alex Smith");
        assertThat(queue.get(0).researcherEmail()).isEqualTo("alex.smith@med.org");
    }

    @Test
    @DisplayName("Admin starts review transitions to UNDER_REVIEW")
    void startReview() {
        DatasetRequest request = createSubmittedRequest();
        when(requestRepository.findById(requestId)).thenReturn(Optional.of(request));
        when(requestRepository.save(any(DatasetRequest.class))).thenAnswer(i -> i.getArgument(0));

        AdminDatasetRequestDetailResponse response = service.startReview(adminId, requestId, clientIp, userAgent);

        assertThat(response.request().status()).isEqualTo(DatasetRequestStatus.UNDER_REVIEW);
        assertThat(response.request().reviewedBy()).isEqualTo(adminId);

        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.DATASET_REQUEST_REVIEW_STARTED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                anyString(),
                contains("UNDER_REVIEW")
        );
    }

    @Test
    @DisplayName("Admin requests info transitions to MORE_INFO_REQUIRED with review notes")
    void requestInfo() {
        DatasetRequest request = createSubmittedRequest();
        request.startReview(adminId, fixedInstant);

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(request));
        when(requestRepository.save(any(DatasetRequest.class))).thenAnswer(i -> i.getArgument(0));

        AdminDatasetRequestDetailResponse response = service.requestInformation(
                adminId,
                requestId,
                "Please specify maximum age limit for cohort",
                clientIp,
                userAgent
        );

        assertThat(response.request().status()).isEqualTo(DatasetRequestStatus.MORE_INFO_REQUIRED);
        assertThat(response.request().reviewNotes()).isEqualTo("Please specify maximum age limit for cohort");

        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.DATASET_REQUEST_MORE_INFO_REQUESTED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                anyString(),
                contains("maximum age")
        );
    }

    @Test
    @DisplayName("Admin approves dataset request setting approvedAt and optional expiresAt")
    void approveDatasetRequest() {
        DatasetRequest request = createSubmittedRequest();
        request.startReview(adminId, fixedInstant);

        Instant expiresAt = fixedInstant.plusSeconds(86400 * 30); // 30 days
        when(requestRepository.findById(requestId)).thenReturn(Optional.of(request));
        when(requestRepository.save(any(DatasetRequest.class))).thenAnswer(i -> i.getArgument(0));

        AdminDatasetRequestDetailResponse response = service.approve(
                adminId,
                requestId,
                "Cohort definition approved for observational extraction.",
                expiresAt,
                clientIp,
                userAgent
        );

        assertThat(response.request().status()).isEqualTo(DatasetRequestStatus.APPROVED);
        assertThat(response.request().approvedAt()).isEqualTo(fixedInstant);
        assertThat(response.request().expiresAt()).isEqualTo(expiresAt);

        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.DATASET_REQUEST_APPROVED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                anyString(),
                contains("observational extraction")
        );
    }

    @Test
    @DisplayName("Admin rejects dataset request setting reason")
    void rejectDatasetRequest() {
        DatasetRequest request = createSubmittedRequest();
        request.startReview(adminId, fixedInstant);

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(request));
        when(requestRepository.save(any(DatasetRequest.class))).thenAnswer(i -> i.getArgument(0));

        AdminDatasetRequestDetailResponse response = service.reject(
                adminId,
                requestId,
                "Requested variables exceed study protocol scope.",
                clientIp,
                userAgent
        );

        assertThat(response.request().status()).isEqualTo(DatasetRequestStatus.REJECTED);
        assertThat(response.request().reviewNotes()).isEqualTo("Requested variables exceed study protocol scope.");

        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.DATASET_REQUEST_REJECTED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                anyString(),
                contains("protocol scope")
        );
    }
}
