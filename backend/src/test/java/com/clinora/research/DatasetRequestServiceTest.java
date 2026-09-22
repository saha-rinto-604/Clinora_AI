package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.DatasetRequestModels.CreateDatasetRequestInput;
import com.clinora.research.api.DatasetRequestModels.DatasetRequestResponse;
import com.clinora.research.api.DatasetRequestModels.UpdateDatasetRequestInput;
import com.clinora.research.domain.DatasetFormat;
import com.clinora.research.domain.DatasetRequest;
import com.clinora.research.domain.DatasetRequestStatus;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.DatasetRequestRepository;
import com.clinora.research.repository.ResearchProjectRepository;
import com.clinora.research.service.DatasetRequestService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DatasetRequestServiceTest {

    @Mock
    private DatasetRequestRepository requestRepository;

    @Mock
    private ResearchProjectRepository projectRepository;

    @Mock
    private AuthAuditService auditService;

    private final Instant fixedInstant = Instant.parse("2026-09-21T15:00:00Z");
    private final Clock clock = Clock.fixed(fixedInstant, ZoneOffset.UTC);

    private DatasetRequestService service;

    private final UUID researcherId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID requestId = UUID.randomUUID();
    private final String clientIp = "127.0.0.1";
    private final String userAgent = "Researcher-Browser";

    @BeforeEach
    void setUp() {
        service = new DatasetRequestService(requestRepository, projectRepository, auditService, clock);
    }

    private ResearchProject createApprovedProject() {
        ResearchProject project = new ResearchProject(
                projectId,
                researcherId,
                "Approved Cardio Study",
                "Objective",
                "Desc",
                "Cardiology",
                null,
                null,
                null,
                fixedInstant.minusSeconds(7200)
        );
        project.submit(fixedInstant.minusSeconds(3600));
        project.approve(UUID.randomUUID(), "Ethics approved", fixedInstant.minusSeconds(1800));
        return project;
    }

    @Test
    @DisplayName("Create dataset request draft succeeds on APPROVED project with structured filters")
    void createDraftSuccess() {
        ResearchProject approvedProject = createApprovedProject();
        when(projectRepository.findByIdAndOwnerUserId(projectId, researcherId)).thenReturn(Optional.of(approvedProject));
        when(requestRepository.existsByProjectIdAndNameIgnoreCase(projectId, "Baseline Cohort 2026")).thenReturn(false);
        when(requestRepository.save(any(DatasetRequest.class))).thenAnswer(i -> i.getArgument(0));

        CreateDatasetRequestInput input = new CreateDatasetRequestInput(
                "Baseline Cohort 2026",
                "Analyze blood pressure variations in hypertension cohort",
                "{\"minAge\": 40, \"maxAge\": 75, \"condition\": \"HYPERTENSION\"}",
                "[\"SYSTOLIC_BP\", \"DIASTOLIC_BP\", \"AGE_AT_OBSERVATION\"]",
                "{\"dateFrom\": \"2024-01-01\", \"dateTo\": \"2025-12-31\"}",
                DatasetFormat.CSV
        );

        DatasetRequestResponse response = service.createDraft(researcherId, projectId, input, clientIp, userAgent);

        assertThat(response.name()).isEqualTo("Baseline Cohort 2026");
        assertThat(response.status()).isEqualTo(DatasetRequestStatus.DRAFT);
        assertThat(response.requestedFormat()).isEqualTo(DatasetFormat.CSV);
        assertThat(response.editable()).isTrue();
        assertThat(response.submittable()).isTrue();

        verify(auditService).record(
                eq(researcherId),
                eq(AuthAuditAction.DATASET_REQUEST_CREATED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                anyString(),
                contains("Baseline Cohort 2026")
        );
    }

    @Test
    @DisplayName("Create dataset request fails when parent project is still in DRAFT or SUBMITTED")
    void createDraftFailsWhenProjectNotApproved() {
        ResearchProject unapprovedProject = ResearchProject.createDraft(
                researcherId,
                "Draft Study",
                "Objective",
                null,
                "Cardiology",
                null,
                null,
                null,
                fixedInstant
        );

        when(projectRepository.findByIdAndOwnerUserId(projectId, researcherId)).thenReturn(Optional.of(unapprovedProject));

        CreateDatasetRequestInput input = new CreateDatasetRequestInput(
                "Premature Request",
                "Purpose",
                "{}",
                "[]",
                "{}",
                DatasetFormat.CSV
        );

        assertThatThrownBy(() -> service.createDraft(researcherId, projectId, input, clientIp, userAgent))
                .isInstanceOf(ResearchApiException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT)
                .hasFieldOrPropertyWithValue("errorCode", ResearchErrorCode.INVALID_PROJECT_STATE);

        verify(requestRepository, never()).save(any());
    }

    @Test
    @DisplayName("Reject dataset request containing raw executable SQL queries")
    void rejectRawSqlInStructuredFilters() {
        ResearchProject approvedProject = createApprovedProject();
        when(projectRepository.findByIdAndOwnerUserId(projectId, researcherId)).thenReturn(Optional.of(approvedProject));

        CreateDatasetRequestInput maliciousInput = new CreateDatasetRequestInput(
                "SQL Injection Attempt",
                "Extracting all records",
                "SELECT * FROM patients WHERE id IS NOT NULL",
                "[]",
                "{}",
                DatasetFormat.CSV
        );

        assertThatThrownBy(() -> service.createDraft(researcherId, projectId, maliciousInput, clientIp, userAgent))
                .isInstanceOf(ResearchApiException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.BAD_REQUEST)
                .hasFieldOrPropertyWithValue("errorCode", ResearchErrorCode.INVALID_SUBMISSION);

        verify(requestRepository, never()).save(any());
    }

    @Test
    @DisplayName("Submit dataset request transitions to SUBMITTED")
    void submitDatasetRequest() {
        ResearchProject approvedProject = createApprovedProject();
        DatasetRequest request = DatasetRequest.createDraft(
                projectId,
                "Cohort A",
                "Purpose A",
                "{}",
                "[]",
                "{}",
                DatasetFormat.JSON,
                fixedInstant
        );

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(request));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(approvedProject));
        when(requestRepository.save(any(DatasetRequest.class))).thenAnswer(i -> i.getArgument(0));

        DatasetRequestResponse response = service.submit(researcherId, requestId, clientIp, userAgent);

        assertThat(response.status()).isEqualTo(DatasetRequestStatus.SUBMITTED);
        assertThat(response.submittedAt()).isEqualTo(fixedInstant);

        verify(auditService).record(
                eq(researcherId),
                eq(AuthAuditAction.DATASET_REQUEST_SUBMITTED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                anyString(),
                contains("SUBMITTED")
        );
    }

    @Test
    @DisplayName("Cancel dataset request transitions to CANCELLED")
    void cancelDatasetRequest() {
        ResearchProject approvedProject = createApprovedProject();
        DatasetRequest request = DatasetRequest.createDraft(
                projectId,
                "Cohort to cancel",
                "Purpose",
                "{}",
                "[]",
                "{}",
                DatasetFormat.CSV,
                fixedInstant
        );
        request.submit(fixedInstant);

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(request));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(approvedProject));
        when(requestRepository.save(any(DatasetRequest.class))).thenAnswer(i -> i.getArgument(0));

        DatasetRequestResponse response = service.cancel(researcherId, requestId, clientIp, userAgent);

        assertThat(response.status()).isEqualTo(DatasetRequestStatus.CANCELLED);

        verify(auditService).record(
                eq(researcherId),
                eq(AuthAuditAction.DATASET_REQUEST_CANCELLED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(clientIp),
                eq(userAgent),
                anyString(),
                contains("CANCELLED")
        );
    }
}
