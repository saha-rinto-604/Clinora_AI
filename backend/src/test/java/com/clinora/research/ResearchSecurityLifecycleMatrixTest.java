package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.api.AdminResearchProjectModels.AdminProjectDetailResponse;
import com.clinora.research.api.AdminResearchProjectReviewController;
import com.clinora.research.api.DatasetRequestModels.CreateDatasetRequestInput;
import com.clinora.research.api.DatasetRequestModels.DatasetRequestResponse;
import com.clinora.research.api.ResearchProjectController;
import com.clinora.research.api.ResearchProjectModels.CreateProjectRequest;
import com.clinora.research.api.ResearchProjectModels.ProjectResponse;
import com.clinora.research.api.ResearchProjectModels.UpdateProjectRequest;
import com.clinora.research.deid.DeidentificationResult;
import com.clinora.research.deid.DeidentificationService;
import com.clinora.research.deid.DefaultDeidentificationService;
import com.clinora.research.domain.*;
import com.clinora.research.domain.catalog.ResearchDataCatalog;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.*;
import com.clinora.research.service.*;
import com.clinora.research.storage.ResearchDatasetStoragePort;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Comprehensive Backend Security and Lifecycle Matrix Test.
 * Validates all security, RBAC, project lifecycle, and privacy boundaries:
 *
 * 1. RESEARCHER can create project
 * 2. PATIENT / DOCTOR cannot create project (RBAC role check)
 * 3. Researcher A cannot read Researcher B project
 * 4. Researcher cannot approve project, SYSTEM_ADMIN can approve project
 * 5. DRAFT can be edited, SUBMITTED cannot be arbitrarily edited
 * 6. DRAFT -> SUBMITTED works
 * 7. SUBMITTED -> APPROVED only via admin
 * 8. REJECTED does not behave as approved
 * 9. Unapproved project cannot request dataset
 * 10. Approved project can create dataset request
 * 11. Dataset cannot expose patient ID (project-scoped pseudonym, age-banded, coarsened period)
 * 12. OTHER reports never enter dataset
 * 13. Raw OCR does not automatically enter dataset
 * 14. Expired dataset cannot download
 * 15. Revoked dataset cannot download
 * 16. Audit event exists for download
 */
@ExtendWith(MockitoExtension.class)
class ResearchSecurityLifecycleMatrixTest {

    @Mock private ResearchProjectRepository projectRepository;
    @Mock private ResearchProjectReviewRepository reviewRepository;
    @Mock private UserAccountRepository userRepository;
    @Mock private DatasetRequestRepository datasetRequestRepository;
    @Mock private ResearchDatasetRepository datasetRepository;
    @Mock private DatasetVersionRepository versionRepository;
    @Mock private DatasetAccessGrantRepository accessGrantRepository;
    @Mock private DatasetGenerationJobRepository jobRepository;
    @Mock private ResearchDatasetStoragePort storagePort;
    @Mock private NamedParameterJdbcTemplate jdbcTemplate;
    @Mock private RabbitTemplate rabbitTemplate;
    @Mock private AuthAuditService auditService;

    private final Instant fixedNow = Instant.parse("2026-09-21T12:00:00Z");
    private final Clock clock = Clock.fixed(fixedNow, ZoneOffset.UTC);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private ResearchProjectService projectService;
    private AdminResearchProjectReviewService adminReviewService;
    private DatasetRequestService datasetRequestService;
    private DatasetGenerationService datasetGenerationService;
    private DefaultDeidentificationService deidentificationService;
    private DefaultResearchDataEligibilityService eligibilityService;

    private final UUID researcherA = UUID.randomUUID();
    private final UUID researcherB = UUID.randomUUID();
    private final UUID adminUserId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        projectService = new ResearchProjectService(projectRepository, auditService, clock);

        adminReviewService = new AdminResearchProjectReviewService(
                projectRepository, reviewRepository, userRepository, auditService, clock
        );

        datasetRequestService = new DatasetRequestService(
                datasetRequestRepository, projectRepository, auditService, clock
        );

        deidentificationService = new DefaultDeidentificationService(objectMapper, 3);

        eligibilityService = new DefaultResearchDataEligibilityService(null);

        datasetGenerationService = new DatasetGenerationService(
                datasetRequestRepository,
                projectRepository,
                datasetRepository,
                versionRepository,
                accessGrantRepository,
                jobRepository,
                deidentificationService,
                storagePort,
                jdbcTemplate,
                new ResearchDataCatalog(),
                rabbitTemplate,
                auditService,
                objectMapper,
                clock,
                "clinora.research.dataset-generation"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. RESEARCHER can create project
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("1. RESEARCHER can create project in DRAFT status")
    void testResearcherCanCreateProject() {
        CreateProjectRequest req = new CreateProjectRequest(
                "Biomarker Study", "Evaluate biomarkers", "Protocol details",
                "Cardiology", "Observational cohort", "University Hospital", "IRB-2026-01"
        );

        when(projectRepository.existsByOwnerUserIdAndTitleIgnoreCase(researcherA, "Biomarker Study")).thenReturn(false);
        when(projectRepository.save(any(ResearchProject.class))).thenAnswer(inv -> inv.getArgument(0));

        ProjectResponse response = projectService.createDraft(researcherA, req, "127.0.0.1", "JUnit");

        assertThat(response).isNotNull();
        assertThat(response.title()).isEqualTo("Biomarker Study");
        assertThat(response.status()).isEqualTo(ResearchProjectStatus.DRAFT);
        assertThat(response.editable()).isTrue();

        verify(auditService).record(
                eq(researcherA),
                eq(AuthAuditAction.RESEARCH_PROJECT_CREATED),
                eq(AuthAuditOutcome.SUCCESS),
                eq("127.0.0.1"), eq("JUnit"), anyString(), contains("Biomarker Study")
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. PATIENT / DOCTOR cannot create project (RBAC check)
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("2. PATIENT and DOCTOR cannot access ResearchProjectController (guarded by ROLE_RESEARCHER)")
    void testDoctorAndPatientCannotCreateProject() {
        PreAuthorize preAuth = ResearchProjectController.class.getAnnotation(PreAuthorize.class);
        assertThat(preAuth).isNotNull();
        assertThat(preAuth.value()).isEqualTo("hasRole('RESEARCHER')");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Researcher A cannot read Researcher B project
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("3. Researcher A cannot read Researcher B project (fails closed with 404 NOT_FOUND)")
    void testResearcherACannotReadResearcherBProject() {
        UUID projectBId = UUID.randomUUID();
        when(projectRepository.findByIdAndOwnerUserId(projectBId, researcherA)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectService.getProject(researcherA, projectBId))
                .isInstanceOf(ResearchApiException.class)
                .satisfies(ex -> {
                    ResearchApiException rae = (ResearchApiException) ex;
                    assertThat(rae.getErrorCode()).isEqualTo(ResearchErrorCode.PROJECT_NOT_FOUND);
                });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Researcher cannot approve project, SYSTEM_ADMIN can approve project
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("4. Only SYSTEM_ADMIN can approve project via AdminReviewController; Researcher cannot")
    void testResearcherCannotApproveProjectAndAdminCan() {
        // Verify controller PreAuthorize is restricted to ADMIN
        PreAuthorize controllerAuth = AdminResearchProjectReviewController.class.getAnnotation(PreAuthorize.class);
        assertThat(controllerAuth).isNotNull();
        assertThat(controllerAuth.value()).isEqualTo("hasRole('SYSTEM_ADMIN')");

        // Admin approval succeeds
        UUID projId = UUID.randomUUID();
        ResearchProject project = ResearchProject.createDraft(
                researcherA, "Title", "Obj", "Desc", "Field", "Methodology", "Inst", "IRB", fixedNow
        );
        project.submit(fixedNow); // Must be SUBMITTED
        when(projectRepository.findById(projId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ResearchProject.class))).thenAnswer(inv -> inv.getArgument(0));
        when(reviewRepository.findByProjectIdOrderByCreatedAtDesc(projId)).thenReturn(List.of());

        AdminProjectDetailResponse response = adminReviewService.approve(
                adminUserId, projId, "Protocol verified", "127.0.0.1", "AdminAgent"
        );

        assertThat(response.project().status()).isEqualTo(ResearchProjectStatus.APPROVED);
        verify(auditService).record(
                eq(adminUserId),
                eq(AuthAuditAction.RESEARCH_PROJECT_APPROVED),
                eq(AuthAuditOutcome.SUCCESS),
                anyString(), anyString(), eq(projId.toString()), contains("note=Protocol verified")
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. DRAFT can be edited, SUBMITTED cannot be arbitrarily edited
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("5. DRAFT can be edited; SUBMITTED project cannot be edited (throws PROJECT_NOT_EDITABLE)")
    void testDraftCanBeEditedAndSubmittedCannotBeEdited() {
        UUID projId = UUID.randomUUID();
        ResearchProject project = ResearchProject.createDraft(
                researcherA, "Draft Title", "Obj", "Desc", "Field", "Methodology", "Inst", "IRB", fixedNow
        );
        when(projectRepository.findByIdAndOwnerUserId(projId, researcherA)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ResearchProject.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1. Edit succeeds in DRAFT
        UpdateProjectRequest updateReq = new UpdateProjectRequest(
                "Updated Title", "Updated Obj", "Updated Desc", "Field", "Methodology", "Inst", "IRB"
        );
        ProjectResponse updated = projectService.updateProject(researcherA, projId, updateReq, "127.0.0.1", "JUnit");
        assertThat(updated.title()).isEqualTo("Updated Title");

        // 2. Submit project
        project.submit(fixedNow);

        // 3. Edit fails in SUBMITTED
        assertThatThrownBy(() -> projectService.updateProject(researcherA, projId, updateReq, "127.0.0.1", "JUnit"))
                .isInstanceOf(ResearchApiException.class)
                .satisfies(ex -> {
                    ResearchApiException rae = (ResearchApiException) ex;
                    assertThat(rae.getErrorCode()).isEqualTo(ResearchErrorCode.PROJECT_NOT_EDITABLE);
                });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. DRAFT -> SUBMITTED works
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("6. DRAFT -> SUBMITTED transitions successfully and records audit event")
    void testDraftToSubmittedLifecycle() {
        UUID projId = UUID.randomUUID();
        ResearchProject project = ResearchProject.createDraft(
                researcherA, "Study", "Obj", "Desc", "Field", "Methodology", "Inst", "IRB", fixedNow
        );
        when(projectRepository.findByIdAndOwnerUserId(projId, researcherA)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ResearchProject.class))).thenAnswer(inv -> inv.getArgument(0));

        ProjectResponse response = projectService.submitProject(researcherA, projId, "127.0.0.1", "JUnit");

        assertThat(response.status()).isEqualTo(ResearchProjectStatus.SUBMITTED);
        assertThat(project.getSubmittedAt()).isNotNull();
        verify(auditService).record(
                eq(researcherA),
                eq(AuthAuditAction.RESEARCH_PROJECT_SUBMITTED),
                eq(AuthAuditOutcome.SUCCESS),
                eq("127.0.0.1"), eq("JUnit"), anyString(), contains("status=SUBMITTED")
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. SUBMITTED -> APPROVED only via admin
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("7. SUBMITTED -> APPROVED only occurs via administrative review")
    void testSubmittedToApprovedOnlyViaAdmin() {
        UUID projId = UUID.randomUUID();
        ResearchProject project = ResearchProject.createDraft(
                researcherA, "Study", "Obj", "Desc", "Field", "Methodology", "Inst", "IRB", fixedNow
        );
        project.submit(fixedNow);
        when(projectRepository.findById(projId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ResearchProject.class))).thenAnswer(inv -> inv.getArgument(0));
        when(reviewRepository.findByProjectIdOrderByCreatedAtDesc(projId)).thenReturn(List.of());

        AdminProjectDetailResponse approved = adminReviewService.approve(
                adminUserId, projId, "Ethics and methodology approved", "127.0.0.1", "AdminAgent"
        );

        assertThat(approved.project().status()).isEqualTo(ResearchProjectStatus.APPROVED);
        assertThat(project.getReviewDecisionReason()).isEqualTo("Ethics and methodology approved");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. REJECTED does not behave as approved
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("8. REJECTED project has isApprovedOrActive == false and cannot request datasets")
    void testRejectedProjectDoesNotBehaveAsApproved() {
        UUID projId = UUID.randomUUID();
        ResearchProject project = ResearchProject.createDraft(
                researcherA, "Study", "Obj", "Desc", "Field", "Methodology", "Inst", "IRB", fixedNow
        );
        project.submit(fixedNow);
        when(projectRepository.findById(projId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ResearchProject.class))).thenAnswer(inv -> inv.getArgument(0));
        when(reviewRepository.findByProjectIdOrderByCreatedAtDesc(projId)).thenReturn(List.of());

        // Admin rejects project
        AdminProjectDetailResponse rejected = adminReviewService.reject(
                adminUserId, projId, "Insufficient clinical justification", "127.0.0.1", "AdminAgent"
        );
        assertThat(rejected.project().status()).isEqualTo(ResearchProjectStatus.REJECTED);
        assertThat(project.getStatus().isApprovedOrActive()).isFalse();

        // Attempting dataset request on REJECTED project fails
        when(projectRepository.findByIdAndOwnerUserId(projId, researcherA)).thenReturn(Optional.of(project));
        CreateDatasetRequestInput input = new CreateDatasetRequestInput(
                "Cohort 1", "Purpose", "{}", "[]", "{}", DatasetFormat.CSV
        );

        assertThatThrownBy(() -> datasetRequestService.createDraft(researcherA, projId, input, "127.0.0.1", "JUnit"))
                .isInstanceOf(ResearchApiException.class)
                .satisfies(ex -> {
                    ResearchApiException rae = (ResearchApiException) ex;
                    assertThat(rae.getErrorCode()).isEqualTo(ResearchErrorCode.INVALID_PROJECT_STATE);
                });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Unapproved project cannot request dataset
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("9. Unapproved (DRAFT or SUBMITTED) project cannot create dataset requests")
    void testUnapprovedProjectCannotRequestDataset() {
        UUID projId = UUID.randomUUID();
        ResearchProject draftProject = ResearchProject.createDraft(
                researcherA, "Study", "Obj", "Desc", "Field", "Methodology", "Inst", "IRB", fixedNow
        );
        when(projectRepository.findByIdAndOwnerUserId(projId, researcherA)).thenReturn(Optional.of(draftProject));

        CreateDatasetRequestInput input = new CreateDatasetRequestInput(
                "Diabetic Cohort", "Analysis", "{}", "[]", "{}", DatasetFormat.CSV
        );

        assertThatThrownBy(() -> datasetRequestService.createDraft(researcherA, projId, input, "127.0.0.1", "JUnit"))
                .isInstanceOf(ResearchApiException.class)
                .satisfies(ex -> {
                    ResearchApiException rae = (ResearchApiException) ex;
                    assertThat(rae.getErrorCode()).isEqualTo(ResearchErrorCode.INVALID_PROJECT_STATE);
                });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Approved project can create dataset request
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("10. APPROVED project can create dataset requests")
    void testApprovedProjectCanCreateDatasetRequest() {
        UUID projId = UUID.randomUUID();
        ResearchProject project = ResearchProject.createDraft(
                researcherA, "Study", "Obj", "Desc", "Field", "Methodology", "Inst", "IRB", fixedNow
        );
        project.submit(fixedNow);
        project.approve(adminUserId, "Approved by IRB committee", fixedNow);

        when(projectRepository.findByIdAndOwnerUserId(projId, researcherA)).thenReturn(Optional.of(project));
        when(datasetRequestRepository.existsByProjectIdAndNameIgnoreCase(projId, "Diabetic Cohort")).thenReturn(false);
        when(datasetRequestRepository.save(any(DatasetRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateDatasetRequestInput input = new CreateDatasetRequestInput(
                "Diabetic Cohort", "Biomarker study", "{}", "[\"HBA1C\"]", "{}", DatasetFormat.CSV
        );

        DatasetRequestResponse response = datasetRequestService.createDraft(researcherA, projId, input, "127.0.0.1", "JUnit");
        assertThat(response).isNotNull();
        assertThat(response.name()).isEqualTo("Diabetic Cohort");
        assertThat(response.status()).isEqualTo(DatasetRequestStatus.DRAFT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Dataset cannot expose patient ID
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("11. Dataset de-identification removes patient ID, names, exact DOB and uses project pseudonym")
    void testDatasetCannotExposePatientId() {
        UUID patient1 = UUID.randomUUID();
        UUID patient2 = UUID.randomUUID();
        UUID patient3 = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();

        List<DeidentificationService.RawObservationRow> rows = List.of(
                new DeidentificationService.RawObservationRow(
                        patient1, LocalDate.of(1980, 5, 20), "MALE", LocalDate.of(2026, 3, 10),
                        "HBA1C", new BigDecimal("6.8"), "%", new BigDecimal("4.0"), new BigDecimal("5.6"), "HIGH"
                ),
                new DeidentificationService.RawObservationRow(
                        patient2, LocalDate.of(1975, 11, 2), "FEMALE", LocalDate.of(2026, 3, 12),
                        "HBA1C", new BigDecimal("7.1"), "%", new BigDecimal("4.0"), new BigDecimal("5.6"), "HIGH"
                ),
                new DeidentificationService.RawObservationRow(
                        patient3, LocalDate.of(1990, 1, 15), "FEMALE", LocalDate.of(2026, 3, 15),
                        "HBA1C", new BigDecimal("5.4"), "%", new BigDecimal("4.0"), new BigDecimal("5.6"), "NORMAL"
                )
        );

        DeidentificationResult result = deidentificationService.transform(UUID.randomUUID(), projectId, "CSV", rows);

        assertThat(result.records()).hasSize(3);
        String csvOutput = new String(result.serializedPayload(), StandardCharsets.UTF_8);

        // Verify patient UUIDs are completely absent from output
        assertThat(csvOutput).doesNotContain(patient1.toString());
        assertThat(csvOutput).doesNotContain(patient2.toString());
        assertThat(csvOutput).doesNotContain(patient3.toString());

        // Verify exact birthdates are absent
        assertThat(csvOutput).doesNotContain("1980-05-20");
        assertThat(csvOutput).doesNotContain("1975-11-02");
        assertThat(csvOutput).doesNotContain("1990-01-15");

        // Verify project-scoped pseudonym is used
        assertThat(result.records().get(0).subjectId()).startsWith("SUBJ-");
        assertThat(result.records().get(0).ageBand()).matches("\\d{2}-\\d{2}");
        assertThat(result.records().get(0).observationPeriod()).matches("\\d{4}-Q[1-4]");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 12. OTHER reports never enter dataset
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("12. Clinical observations with subjectType == 'OTHER' are strictly rejected from research datasets")
    void testOtherReportsNeverEnterDataset() {
        EligibilityCandidate otherCandidate = new EligibilityCandidate(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "OTHER", "Mother's Report", null,
                "DOCTOR_VERIFIED", false, new BigDecimal("0.98"),
                "HbA1c", "hba1c", "HbA1c", "NUMERIC",
                new BigDecimal("6.5"), null, "%",
                new BigDecimal("4.0"), new BigDecimal("5.6"),
                ResearchConsentStatus.CONSENTED
        );

        EligibilityDecision decision = eligibilityService.evaluate(otherCandidate);

        assertThat(decision.isEligible()).isFalse();
        assertThat(decision.reasons()).contains(EligibilityIneligibilityReason.EXCLUDED_OTHER_SUBJECT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 13. Raw OCR does not automatically enter dataset
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("13. Observations from unreviewed raw OCR are excluded from research datasets")
    void testRawOcrDoesNotAutomaticallyEnterDataset() {
        EligibilityCandidate unreviewedCandidate = new EligibilityCandidate(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "SELF", null, null,
                "UNREVIEWED", false, new BigDecimal("0.70"),
                "Glucose", "fasting_glucose", "Fasting Glucose", "NUMERIC",
                new BigDecimal("105"), null, "mg/dL",
                new BigDecimal("70"), new BigDecimal("99"),
                ResearchConsentStatus.CONSENTED
        );

        EligibilityDecision decision = eligibilityService.evaluate(unreviewedCandidate);

        assertThat(decision.isEligible()).isFalse();
        assertThat(decision.reasons()).contains(EligibilityIneligibilityReason.EXCLUDED_UNREVIEWED_RAW_OCR);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 14. Expired dataset cannot download
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("14. Expired dataset cannot be downloaded (throws 410 GONE)")
    void testExpiredDatasetCannotDownload() {
        UUID datasetId = UUID.randomUUID();
        UUID projId = UUID.randomUUID();

        // Expired 1 hour ago
        Instant expiredAt = fixedNow.minusSeconds(3600);
        ResearchDataset dataset = new ResearchDataset(
                datasetId, projId, UUID.randomUUID(), "Cardiology Cohort", fixedNow.minusSeconds(86400), expiredAt
        );

        when(datasetRepository.findById(datasetId)).thenReturn(Optional.of(dataset));
        ResearchProject project = new ResearchProject(
                projId, researcherA, "Title", "Obj", "Desc", "Field", "Methodology", "Inst", "IRB", fixedNow
        );
        when(projectRepository.findById(projId)).thenReturn(Optional.of(project));

        assertThatThrownBy(() -> datasetGenerationService.downloadVersion(datasetId, 1, researcherA, "127.0.0.1", "JUnit"))
                .isInstanceOf(ResearchApiException.class)
                .satisfies(ex -> {
                    ResearchApiException rae = (ResearchApiException) ex;
                    assertThat(rae.getStatus().value()).isEqualTo(410);
                    assertThat(rae.getMessage()).contains("expired");
                });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 15. Revoked dataset cannot download
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("15. Revoked dataset cannot be downloaded (throws 403 FORBIDDEN)")
    void testRevokedDatasetCannotDownload() {
        UUID datasetId = UUID.randomUUID();
        UUID projId = UUID.randomUUID();

        ResearchDataset dataset = new ResearchDataset(
                datasetId, projId, UUID.randomUUID(), "Biomarker Study", fixedNow.minusSeconds(86400), null
        );
        dataset.revoke(fixedNow.minusSeconds(60));

        when(datasetRepository.findById(datasetId)).thenReturn(Optional.of(dataset));
        ResearchProject project = new ResearchProject(
                projId, researcherA, "Title", "Obj", "Desc", "Field", "Methodology", "Inst", "IRB", fixedNow
        );
        when(projectRepository.findById(projId)).thenReturn(Optional.of(project));

        assertThatThrownBy(() -> datasetGenerationService.downloadVersion(datasetId, 1, researcherA, "127.0.0.1", "JUnit"))
                .isInstanceOf(ResearchApiException.class)
                .satisfies(ex -> {
                    ResearchApiException rae = (ResearchApiException) ex;
                    assertThat(rae.getStatus().value()).isEqualTo(403);
                    assertThat(rae.getMessage()).contains("revoked");
                });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 16. Audit event exists for download
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("16. Downloading dataset version records AuthAuditEvent with checksum and version")
    void testAuditEventExistsForDownload() {
        UUID datasetId = UUID.randomUUID();
        UUID projId = UUID.randomUUID();

        ResearchDataset dataset = new ResearchDataset(
                datasetId, projId, UUID.randomUUID(), "Valid Cohort", fixedNow, null
        );
        when(datasetRepository.findById(datasetId)).thenReturn(Optional.of(dataset));

        ResearchProject project = new ResearchProject(
                projId, researcherA, "Title", "Obj", "Desc", "Field", "Methodology", "Inst", "IRB", fixedNow
        );
        when(projectRepository.findById(projId)).thenReturn(Optional.of(project));

        DatasetVersion version = new DatasetVersion(
                UUID.randomUUID(), datasetId, 1, "1.0", 50, "datasets/obj.csv", "sha256-checksum-xyz", "CSV", "clinora-deid-v1", fixedNow
        );
        when(versionRepository.findByDatasetIdAndVersionNumber(datasetId, 1)).thenReturn(Optional.of(version));
        when(storagePort.get("datasets/obj.csv")).thenReturn(new ResearchDatasetStoragePort.StoredDataset("a,b\n1,2".getBytes(), "text/csv"));

        DatasetGenerationService.DatasetDownload download = datasetGenerationService.downloadVersion(
                datasetId, 1, researcherA, "192.168.1.10", "ClinoraClient"
        );

        assertThat(download).isNotNull();
        assertThat(download.checksum()).isEqualTo("sha256-checksum-xyz");

        verify(auditService).record(
                eq(researcherA),
                eq(AuthAuditAction.RESEARCH_DATASET_DOWNLOADED),
                eq(AuthAuditOutcome.SUCCESS),
                eq("192.168.1.10"), eq("ClinoraClient"), eq(datasetId.toString()), contains("version=1")
        );
    }
}
