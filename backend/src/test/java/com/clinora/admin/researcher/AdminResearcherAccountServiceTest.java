package com.clinora.admin.researcher;

import com.clinora.access.domain.*;
import com.clinora.access.repository.AccessApplicationRepository;
import com.clinora.access.repository.ApplicationDocumentRepository;
import com.clinora.access.repository.ResearcherApplicationDetailRepository;
import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.admin.researcher.AdminResearcherAccountModels.*;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditEventRepository;
import com.clinora.audit.AuthAuditService;
import com.clinora.auth.session.RefreshSessionService;
import com.clinora.profile.service.ProfileImageService;
import com.clinora.research.domain.*;
import com.clinora.research.repository.*;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.lang.reflect.Field;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminResearcherAccountServiceTest {

    private JdbcTemplate jdbc;
    private UserAccountRepository userRepository;
    private AccessApplicationRepository applicationRepository;
    private ResearcherApplicationDetailRepository researcherDetailRepository;
    private ApplicationDocumentRepository documentRepository;
    private ApplicationDocumentStoragePort storagePort;
    private ResearchProjectRepository projectRepository;
    private ResearchProjectMemberRepository memberRepository;
    private DatasetRequestRepository datasetRequestRepository;
    private ResearchDatasetRepository datasetRepository;
    private AIEvaluationRunRepository evaluationRunRepository;
    private ResearchPublicationRepository publicationRepository;
    private RefreshSessionService sessionService;
    private AuthAuditService auditService;
    private AuthAuditEventRepository auditEventRepository;
    private ProfileImageService profileImageService;
    private Clock clock;

    private AdminResearcherAccountService service;

    private UUID researcherId;
    private UUID adminId;
    private UserAccount researcherUser;

    @BeforeEach
    void setUp() throws Exception {
        jdbc = mock(JdbcTemplate.class);
        userRepository = mock(UserAccountRepository.class);
        applicationRepository = mock(AccessApplicationRepository.class);
        researcherDetailRepository = mock(ResearcherApplicationDetailRepository.class);
        documentRepository = mock(ApplicationDocumentRepository.class);
        storagePort = mock(ApplicationDocumentStoragePort.class);
        projectRepository = mock(ResearchProjectRepository.class);
        memberRepository = mock(ResearchProjectMemberRepository.class);
        datasetRequestRepository = mock(DatasetRequestRepository.class);
        datasetRepository = mock(ResearchDatasetRepository.class);
        evaluationRunRepository = mock(AIEvaluationRunRepository.class);
        publicationRepository = mock(ResearchPublicationRepository.class);
        sessionService = mock(RefreshSessionService.class);
        auditService = mock(AuthAuditService.class);
        auditEventRepository = mock(AuthAuditEventRepository.class);
        profileImageService = mock(ProfileImageService.class);
        clock = Clock.fixed(Instant.parse("2026-09-28T12:00:00Z"), ZoneOffset.UTC);

        service = new AdminResearcherAccountService(
                jdbc,
                userRepository,
                applicationRepository,
                researcherDetailRepository,
                documentRepository,
                storagePort,
                projectRepository,
                memberRepository,
                datasetRequestRepository,
                datasetRepository,
                evaluationRunRepository,
                publicationRepository,
                sessionService,
                auditService,
                auditEventRepository,
                profileImageService,
                clock
        );

        researcherId = UUID.randomUUID();
        adminId = UUID.randomUUID();
        researcherUser = createResearcherUser(researcherId, "Marcus", "Thorne", "marcus.thorne@clinora.local");
    }

    private UserAccount createResearcherUser(UUID id, String firstName, String lastName, String email) throws Exception {
        UserAccount u = new UserAccount(
                firstName, lastName, email, email.toLowerCase(), "hashed_password",
                UserRole.RESEARCHER, AccountStatus.ACTIVE, Instant.parse("2026-01-01T10:00:00Z")
        );
        Field idField = UserAccount.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(u, id);
        return u;
    }

    @Test
    @DisplayName("listResearchers executes query and returns page response")
    void testListResearchers() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(1L);

        ResearcherSummaryView item = new ResearcherSummaryView(
                researcherId, "Marcus", "Thorne", "marcus.thorne@clinora.local",
                UserRole.RESEARCHER, AccountStatus.ACTIVE, true,
                Instant.now(), null, null, UUID.randomUUID(), ApplicationStatus.ACTIVATED,
                "Oxford University", "Oncology", "Lead Investigator", "Cancer Genomics", false
        );

        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of(item));

        ResearcherPageResponse<ResearcherSummaryView> response = service.listResearchers(
                "marcus", AccountStatus.ACTIVE, null, null, null, 0, 20
        );

        assertNotNull(response);
        assertEquals(1, response.totalItems());
        assertEquals(1, response.items().size());
        assertEquals("Marcus", response.items().get(0).firstName());
        assertEquals("Oxford University", response.items().get(0).institution());
    }

    @Test
    @DisplayName("getResearcherDetail returns detail and audits account view")
    void testGetResearcherDetail() {
        when(userRepository.findById(researcherId)).thenReturn(Optional.of(researcherUser));
        when(profileImageService.hasProfileImage(researcherId)).thenReturn(true);
        when(jdbc.queryForObject(contains("auth_sessions"), eq(Integer.class), eq(researcherId), any()))
                .thenReturn(2);

        ResearcherDetailView detail = service.getResearcherDetail(researcherId, adminId, "127.0.0.1", "JUnit");

        assertNotNull(detail);
        assertEquals("Marcus", detail.account().firstName());
        assertEquals("Thorne", detail.account().lastName());
        assertEquals(UserRole.RESEARCHER, detail.account().role());
        assertEquals(AccountStatus.ACTIVE, detail.account().accountStatus());
        assertTrue(detail.account().hasProfileImage());
        assertEquals(2, detail.securitySummary().activeSessionsCount());

        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.ADMIN_RESEARCHER_ACCOUNT_VIEWED),
                any(),
                eq("127.0.0.1"),
                eq("JUnit"),
                eq(researcherId.toString()),
                anyString()
        );
    }

    @Test
    @DisplayName("getResearcherDetail throws 404 if user not found or not researcher")
    void testGetResearcherDetailNotFound() throws Exception {
        when(userRepository.findById(researcherId)).thenReturn(Optional.empty());

        AdminResearcherApiException ex = assertThrows(AdminResearcherApiException.class, () ->
                service.getResearcherDetail(researcherId, adminId, "127.0.0.1", "JUnit")
        );
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals("RESEARCHER_NOT_FOUND", ex.getErrorCode());

        // Test non-researcher role (e.g. PATIENT)
        UserAccount patientUser = new UserAccount(
                "Jane", "Doe", "jane@clinora.local", "jane@clinora.local", "hash",
                UserRole.PATIENT, AccountStatus.ACTIVE, Instant.now()
        );
        when(userRepository.findById(researcherId)).thenReturn(Optional.of(patientUser));

        AdminResearcherApiException exRole = assertThrows(AdminResearcherApiException.class, () ->
                service.getResearcherDetail(researcherId, adminId, "127.0.0.1", "JUnit")
        );
        assertEquals(HttpStatus.NOT_FOUND, exRole.getStatus());
        assertEquals("NOT_A_RESEARCHER", exRole.getErrorCode());
    }

    @Test
    @DisplayName("DTO verification: Researcher models never contain clinical or health fields")
    void testClinicalPrivacyBoundaryInModels() {
        // Assert that none of the admin researcher models contain health profile fields
        List<Class<?>> classes = List.of(
                ResearcherSummaryView.class,
                ResearcherAccountView.class,
                ResearcherApplicationView.class,
                ResearcherSecuritySummaryView.class,
                ResearcherDetailView.class,
                ResearcherDocumentView.class,
                ProjectSummaryItem.class,
                DatasetRequestSummaryItem.class,
                DatasetSummaryItem.class,
                EvaluationRunSummaryItem.class,
                PublicationSummaryItem.class,
                ResearcherActivityView.class,
                ResearcherAuditEventView.class
        );

        List<String> prohibitedSubstrings = List.of(
                "blood", "height", "weight", "bmi", "allergy", "allergies",
                "condition", "medication", "lifestyle", "emergencycontact",
                "ocr", "clinicalinsight", "prescription", "appointment"
        );

        for (Class<?> clazz : classes) {
            for (var field : clazz.getDeclaredFields()) {
                String fieldName = field.getName().toLowerCase();
                for (String prohibited : prohibitedSubstrings) {
                    assertFalse((prohibited.equals("bmi") ? fieldName.equals("bmi") || fieldName.startsWith("bmi") : fieldName.contains(prohibited)),
                            "Model " + clazz.getSimpleName() + " contains prohibited clinical field: " + field.getName());
                }
            }
        }
    }

    @Test
    @DisplayName("suspendResearcher updates user status, revokes sessions, and logs audit")
    void testSuspendResearcher() {
        when(userRepository.findById(researcherId)).thenReturn(Optional.of(researcherUser));

        service.suspendResearcher(researcherId, "Violation of research terms", adminId, "127.0.0.1", "JUnit");

        assertEquals(AccountStatus.SUSPENDED, researcherUser.getAccountStatus());
        verify(userRepository).save(researcherUser);
        verify(sessionService).revokeAll(eq(researcherId), contains("Violation of research terms"));
        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.ADMIN_RESEARCHER_SUSPENDED),
                any(),
                eq("127.0.0.1"),
                eq("JUnit"),
                eq(researcherId.toString()),
                eq("Violation of research terms")
        );
    }

    @Test
    @DisplayName("reactivateResearcher updates user status to ACTIVE and logs audit")
    void testReactivateResearcher() {
        researcherUser.suspend(Instant.now());
        when(userRepository.findById(researcherId)).thenReturn(Optional.of(researcherUser));

        service.reactivateResearcher(researcherId, "Appeal approved", adminId, "127.0.0.1", "JUnit");

        assertEquals(AccountStatus.ACTIVE, researcherUser.getAccountStatus());
        verify(userRepository).save(researcherUser);
        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.ADMIN_RESEARCHER_REACTIVATED),
                any(),
                eq("127.0.0.1"),
                eq("JUnit"),
                eq(researcherId.toString()),
                eq("Appeal approved")
        );
    }

    @Test
    @DisplayName("revokeResearcherSessions revokes all active sessions and logs audit")
    void testRevokeResearcherSessions() {
        when(userRepository.findById(researcherId)).thenReturn(Optional.of(researcherUser));

        service.revokeResearcherSessions(researcherId, "Security rotation", adminId, "127.0.0.1", "JUnit");

        verify(sessionService).revokeAll(eq(researcherId), contains("Security rotation"));
        verify(auditService).record(
                eq(adminId),
                eq(AuthAuditAction.ADMIN_RESEARCHER_SESSIONS_REVOKED),
                any(),
                eq("127.0.0.1"),
                eq("JUnit"),
                eq(researcherId.toString()),
                eq("Security rotation")
        );
    }

    @Test
    @DisplayName("getResearcherActivity aggregates projects, collaborations, and runs without clinical data")
    void testGetResearcherActivity() {
        when(userRepository.findById(researcherId)).thenReturn(Optional.of(researcherUser));

        UUID projId = UUID.randomUUID();
        ResearchProject project = ResearchProject.createDraft(
                researcherId, "Genomic Biomarkers", "Biomarker discovery",
                "Description", "Genomics", "Methodology", "Oxford", "IRB-123",
                Instant.parse("2026-03-01T10:00:00Z")
        );
        when(projectRepository.findByOwnerUserIdOrderByCreatedAtDesc(researcherId))
                .thenReturn(List.of(project));
        when(memberRepository.findByUserId(researcherId)).thenReturn(List.of());

        ResearcherActivityView activity = service.getResearcherActivity(researcherId);

        assertNotNull(activity);
        assertEquals(1, activity.ownedProjects().size());
        assertEquals("Genomic Biomarkers", activity.ownedProjects().get(0).title());
        assertEquals("Genomics", activity.ownedProjects().get(0).researchField());
    }
}
