package com.clinora.admin.researcher;

import com.clinora.access.domain.AccessApplication;
import com.clinora.access.domain.ApplicationDocument;
import com.clinora.access.domain.ApplicationStatus;
import com.clinora.access.domain.ApplicationType;
import com.clinora.access.domain.ResearcherApplicationDetail;
import com.clinora.access.repository.AccessApplicationRepository;
import com.clinora.access.repository.ApplicationDocumentRepository;
import com.clinora.access.repository.ResearcherApplicationDetailRepository;
import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.admin.researcher.AdminResearcherAccountModels.*;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditEvent;
import com.clinora.audit.AuthAuditEventRepository;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.auth.session.RefreshSessionService;
import com.clinora.profile.service.ProfileImageService;
import com.clinora.research.domain.AIEvaluationRun;
import com.clinora.research.domain.DatasetRequest;
import com.clinora.research.domain.ResearchDataset;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectMember;
import com.clinora.research.domain.ResearchPublication;
import com.clinora.research.repository.*;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.*;

@Service
public class AdminResearcherAccountService {

    private final JdbcTemplate jdbc;
    private final UserAccountRepository userRepository;
    private final AccessApplicationRepository applicationRepository;
    private final ResearcherApplicationDetailRepository researcherDetailRepository;
    private final ApplicationDocumentRepository documentRepository;
    private final ApplicationDocumentStoragePort storagePort;
    private final ResearchProjectRepository projectRepository;
    private final ResearchProjectMemberRepository memberRepository;
    private final DatasetRequestRepository datasetRequestRepository;
    private final ResearchDatasetRepository datasetRepository;
    private final AIEvaluationRunRepository evaluationRunRepository;
    private final ResearchPublicationRepository publicationRepository;
    private final RefreshSessionService sessionService;
    private final AuthAuditService auditService;
    private final AuthAuditEventRepository auditEventRepository;
    private final ProfileImageService profileImageService;
    private final Clock clock;

    public AdminResearcherAccountService(
            JdbcTemplate jdbc,
            UserAccountRepository userRepository,
            AccessApplicationRepository applicationRepository,
            ResearcherApplicationDetailRepository researcherDetailRepository,
            ApplicationDocumentRepository documentRepository,
            ApplicationDocumentStoragePort storagePort,
            ResearchProjectRepository projectRepository,
            ResearchProjectMemberRepository memberRepository,
            DatasetRequestRepository datasetRequestRepository,
            ResearchDatasetRepository datasetRepository,
            AIEvaluationRunRepository evaluationRunRepository,
            ResearchPublicationRepository publicationRepository,
            RefreshSessionService sessionService,
            AuthAuditService auditService,
            AuthAuditEventRepository auditEventRepository,
            ProfileImageService profileImageService,
            Clock clock
    ) {
        this.jdbc = jdbc;
        this.userRepository = userRepository;
        this.applicationRepository = applicationRepository;
        this.researcherDetailRepository = researcherDetailRepository;
        this.documentRepository = documentRepository;
        this.storagePort = storagePort;
        this.projectRepository = projectRepository;
        this.memberRepository = memberRepository;
        this.datasetRequestRepository = datasetRequestRepository;
        this.datasetRepository = datasetRepository;
        this.evaluationRunRepository = evaluationRunRepository;
        this.publicationRepository = publicationRepository;
        this.sessionService = sessionService;
        this.auditService = auditService;
        this.auditEventRepository = auditEventRepository;
        this.profileImageService = profileImageService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ResearcherPageResponse<ResearcherSummaryView> listResearchers(
            String q,
            AccountStatus accountStatus,
            ApplicationStatus applicationStatus,
            String researchField,
            String institution,
            int page,
            int size
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        int offset = safePage * safeSize;

        StringBuilder whereClause = new StringBuilder(" WHERE u.role = 'RESEARCHER' ");
        List<Object> params = new ArrayList<>();

        if (q != null && !q.isBlank()) {
            String pattern = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
            whereClause.append("""
                 AND (
                     LOWER(u.first_name) LIKE ?
                     OR LOWER(u.last_name) LIKE ?
                     OR LOWER(CONCAT(u.first_name, ' ', u.last_name)) LIKE ?
                     OR LOWER(u.email) LIKE ?
                     OR LOWER(COALESCE(rad.institution, '')) LIKE ?
                     OR LOWER(COALESCE(rad.research_field, '')) LIKE ?
                     OR LOWER(COALESCE(rad.professional_title, '')) LIKE ?
                 )
            """);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
        }

        if (accountStatus != null) {
            whereClause.append(" AND u.account_status = ? ");
            params.add(accountStatus.name());
        }

        if (applicationStatus != null) {
            whereClause.append(" AND a.status = ? ");
            params.add(applicationStatus.name());
        }

        if (researchField != null && !researchField.isBlank()) {
            whereClause.append(" AND LOWER(COALESCE(rad.research_field, '')) LIKE ? ");
            params.add("%" + researchField.trim().toLowerCase(Locale.ROOT) + "%");
        }

        if (institution != null && !institution.isBlank()) {
            whereClause.append(" AND LOWER(COALESCE(rad.institution, '')) LIKE ? ");
            params.add("%" + institution.trim().toLowerCase(Locale.ROOT) + "%");
        }

        String countSql = """
            SELECT COUNT(*)
            FROM users u
            LEFT JOIN access_applications a ON a.id = (
                SELECT a2.id FROM access_applications a2
                WHERE a2.normalized_email = u.normalized_email AND a2.application_type = 'RESEARCHER'
                ORDER BY a2.created_at DESC
                LIMIT 1
            )
            LEFT JOIN researcher_application_details rad ON rad.application_id = a.id
        """ + whereClause;

        Long totalCount = jdbc.queryForObject(countSql, Long.class, params.toArray());
        long totalItems = totalCount != null ? totalCount : 0L;
        int totalPages = (int) Math.ceil((double) totalItems / safeSize);

        String selectSql = """
            SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.role, u.account_status,
                   u.email_verified_at, u.created_at AS user_created_at, u.last_login_at, u.deactivated_at,
                   a.id AS application_id, a.status AS application_status,
                   rad.institution, rad.department, rad.professional_title, rad.research_field,
                   CASE WHEN upi.user_id IS NOT NULL THEN true ELSE false END AS has_profile_image,
                   rcv.verification_status AS cred_verification_status
            FROM users u
            LEFT JOIN access_applications a ON a.id = (
                SELECT a2.id FROM access_applications a2
                WHERE a2.normalized_email = u.normalized_email AND a2.application_type = 'RESEARCHER'
                ORDER BY a2.created_at DESC
                LIMIT 1
            )
            LEFT JOIN researcher_application_details rad ON rad.application_id = a.id
            LEFT JOIN user_profile_images upi ON upi.user_id = u.id
            LEFT JOIN researcher_credential_verifications rcv ON rcv.user_id = u.id
        """ + whereClause + " ORDER BY u.created_at DESC LIMIT ? OFFSET ? ";

        List<Object> selectParams = new ArrayList<>(params);
        selectParams.add(safeSize);
        selectParams.add(offset);

        List<ResearcherSummaryView> items = jdbc.query(selectSql, (rs, rowNum) -> {
            UUID userId = UUID.fromString(rs.getString("user_id"));
            String appStatusStr = rs.getString("application_status");
            ApplicationStatus appStatus = appStatusStr != null ? ApplicationStatus.valueOf(appStatusStr) : null;
            String appIdStr = rs.getString("application_id");
            UUID appId = appIdStr != null ? UUID.fromString(appIdStr) : null;
            Timestamp emailVerifiedTs = rs.getTimestamp("email_verified_at");
            Timestamp lastLoginTs = rs.getTimestamp("last_login_at");
            Timestamp deactivatedTs = rs.getTimestamp("deactivated_at");
            String credStatusStr = rs.getString("cred_verification_status");
            com.clinora.research.domain.CredentialVerificationStatus credStatus = credStatusStr != null
                    ? com.clinora.research.domain.CredentialVerificationStatus.valueOf(credStatusStr)
                    : null;

            return new ResearcherSummaryView(
                    userId,
                    rs.getString("first_name"),
                    rs.getString("last_name"),
                    rs.getString("email"),
                    UserRole.valueOf(rs.getString("role")),
                    AccountStatus.valueOf(rs.getString("account_status")),
                    emailVerifiedTs != null,
                    rs.getTimestamp("user_created_at").toInstant(),
                    lastLoginTs != null ? lastLoginTs.toInstant() : null,
                    deactivatedTs != null ? deactivatedTs.toInstant() : null,
                    appId,
                    appStatus,
                    rs.getString("institution"),
                    rs.getString("department"),
                    rs.getString("professional_title"),
                    rs.getString("research_field"),
                    rs.getBoolean("has_profile_image"),
                    credStatus
            );
        }, selectParams.toArray());

        return new ResearcherPageResponse<>(items, safePage, safeSize, totalItems, totalPages);
    }

    @Transactional
    public ResearcherDetailView getResearcherDetail(UUID userId, UUID adminUserId, String ipAddress, String userAgent) {
        UserAccount user = requireResearcher(userId);

        ResearcherAccountView accountView = new ResearcherAccountView(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getRole(),
                user.getAccountStatus(),
                user.getEmailVerifiedAt() != null,
                user.getCreatedAt(),
                user.getUpdatedAt(),
                user.getLastLoginAt(),
                user.getDeactivatedAt(),
                profileImageService.hasProfileImage(user.getId())
        );

        ResearcherApplicationView applicationView = findResearcherApplication(user.getNormalizedEmail());

        int activeSessionsCount = countActiveSessions(userId);
        ResearcherSecuritySummaryView securitySummary = new ResearcherSecuritySummaryView(
                activeSessionsCount,
                user.getLastLoginAt(),
                user.getAccountStatus(),
                user.getEmailVerifiedAt() != null
        );

        auditService.record(
                adminUserId,
                AuthAuditAction.ADMIN_RESEARCHER_ACCOUNT_VIEWED,
                AuthAuditOutcome.SUCCESS,
                ipAddress,
                userAgent,
                userId.toString(),
                "Inspected researcher account details"
        );

        return new ResearcherDetailView(accountView, applicationView, securitySummary);
    }

    @Transactional(readOnly = true)
    public List<ResearcherDocumentView> getResearcherDocuments(UUID userId) {
        UserAccount user = requireResearcher(userId);
        Optional<AccessApplication> appOpt = findLatestApplication(user.getNormalizedEmail());
        if (appOpt.isEmpty()) {
            return List.of();
        }

        AccessApplication app = appOpt.get();
        List<ApplicationDocument> docs = documentRepository.findAllByApplicationIdOrderByCreatedAt(app.getId());

        return docs.stream()
                .map(d -> new ResearcherDocumentView(
                        d.getId(),
                        d.getApplicationId(),
                        d.getDocumentType(),
                        d.getOriginalFilename(),
                        d.getMimeType(),
                        d.getSizeBytes(),
                        d.getCreatedAt()
                ))
                .toList();
    }

    @Transactional
    public DocumentDownload downloadDocument(
            UUID researcherUserId,
            UUID documentId,
            boolean inline,
            UUID adminUserId,
            String ipAddress,
            String userAgent
    ) {
        UserAccount user = requireResearcher(researcherUserId);
        AccessApplication app = findLatestApplication(user.getNormalizedEmail())
                .orElseThrow(() -> new AdminResearcherApiException(HttpStatus.NOT_FOUND, "APPLICATION_NOT_FOUND", "Researcher application record not found"));

        ApplicationDocument doc = documentRepository.findByIdAndApplicationId(documentId, app.getId())
                .orElseThrow(() -> new AdminResearcherApiException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "Verification document not found"));

        AuthAuditAction action = inline
                ? AuthAuditAction.ADMIN_RESEARCHER_DOCUMENT_VIEWED
                : AuthAuditAction.ADMIN_RESEARCHER_DOCUMENT_DOWNLOADED;

        auditService.record(
                adminUserId,
                action,
                AuthAuditOutcome.SUCCESS,
                ipAddress,
                userAgent,
                doc.getId().toString(),
                "Admin " + (inline ? "viewed" : "downloaded") + " document: " + doc.getOriginalFilename()
        );

        ApplicationDocumentStoragePort.StoredObject stored = storagePort.get(doc.getObjectKey());
        if (stored == null || stored.bytes() == null) {
            throw new AdminResearcherApiException(HttpStatus.NOT_FOUND, "DOCUMENT_BYTES_NOT_FOUND", "Document content could not be retrieved from secure storage");
        }

        return new DocumentDownload(stored.bytes(), doc.getMimeType(), doc.getOriginalFilename());
    }

    @Transactional(readOnly = true)
    public ResearcherActivityView getResearcherActivity(UUID researcherUserId) {
        requireResearcher(researcherUserId);

        // 1. Owned projects
        List<ResearchProject> owned = projectRepository.findByOwnerUserIdOrderByCreatedAtDesc(researcherUserId);
        List<ProjectSummaryItem> ownedItems = owned.stream()
                .map(p -> new ProjectSummaryItem(
                        p.getId(),
                        p.getTitle(),
                        p.getResearchField(),
                        p.getStatus(),
                        p.getCreatedAt(),
                        p.getSubmittedAt(),
                        p.getApprovedAt()
                ))
                .toList();

        // 2. Collaborations (active memberships on projects owned by others)
        List<ResearchProjectMember> memberships = memberRepository.findByUserId(researcherUserId).stream()
                .filter(m -> m.getRemovedAt() == null)
                .toList();

        Set<UUID> ownedIds = new HashSet<>();
        owned.forEach(p -> ownedIds.add(p.getId()));

        List<CollaborationSummaryItem> collaborationItems = new ArrayList<>();
        Set<UUID> allAccessibleProjectIds = new HashSet<>(ownedIds);

        for (ResearchProjectMember m : memberships) {
            allAccessibleProjectIds.add(m.getProjectId());
            if (!ownedIds.contains(m.getProjectId())) {
                String projectTitle = projectRepository.findById(m.getProjectId())
                        .map(ResearchProject::getTitle)
                        .orElse("Untitled Project");
                collaborationItems.add(new CollaborationSummaryItem(
                        m.getProjectId(),
                        projectTitle,
                        m.getRole().name(),
                        m.getCreatedAt()
                ));
            }
        }

        // 3. Dataset requests for all accessible projects
        List<DatasetRequestSummaryItem> requestItems = new ArrayList<>();
        List<DatasetSummaryItem> datasetItems = new ArrayList<>();
        List<EvaluationRunSummaryItem> evaluationItems = new ArrayList<>();
        List<PublicationSummaryItem> publicationItems = new ArrayList<>();

        for (UUID projId : allAccessibleProjectIds) {
            String projTitle = projectRepository.findById(projId)
                    .map(ResearchProject::getTitle)
                    .orElse("Project");

            // Dataset Requests
            List<DatasetRequest> reqs = datasetRequestRepository.findByProjectIdOrderByCreatedAtDesc(projId);
            for (DatasetRequest r : reqs) {
                requestItems.add(new DatasetRequestSummaryItem(
                        r.getId(),
                        r.getProjectId(),
                        projTitle,
                        r.getName(),
                        r.getStatus(),
                        r.getRequestedFormat(),
                        r.getCreatedAt()
                ));
            }

            // Research Datasets
            List<ResearchDataset> datasets = datasetRepository.findByProjectIdOrderByCreatedAtDesc(projId);
            for (ResearchDataset d : datasets) {
                datasetItems.add(new DatasetSummaryItem(
                        d.getId(),
                        d.getProjectId(),
                        projTitle,
                        d.getName(),
                        d.getStatus(),
                        d.getCreatedAt(),
                        d.getExpiresAt()
                ));
            }

            // AI Evaluation Runs
            List<AIEvaluationRun> runs = evaluationRunRepository.findByProjectIdOrderByCreatedAtDesc(projId);
            for (AIEvaluationRun run : runs) {
                evaluationItems.add(new EvaluationRunSummaryItem(
                        run.getId(),
                        run.getProjectId(),
                        projTitle,
                        run.getModelId(),
                        run.getModelVersion(),
                        run.getTaskType(),
                        run.getStatus(),
                        run.getStartedAt(),
                        run.getCompletedAt()
                ));
            }

            // Publications
            List<ResearchPublication> pubs = publicationRepository.findByProjectIdOrderByCreatedAtDesc(projId);
            for (ResearchPublication pub : pubs) {
                publicationItems.add(new PublicationSummaryItem(
                        pub.getId(),
                        pub.getProjectId(),
                        projTitle,
                        pub.getTitle(),
                        pub.getPublicationType(),
                        pub.getDoi(),
                        pub.getJournal(),
                        pub.getPublicationDate()
                ));
            }
        }

        return new ResearcherActivityView(
                ownedItems,
                collaborationItems,
                requestItems,
                datasetItems,
                evaluationItems,
                publicationItems
        );
    }

    @Transactional(readOnly = true)
    public ResearcherPageResponse<ResearcherAuditEventView> getResearcherAuditEvents(UUID researcherUserId, int page, int size) {
        requireResearcher(researcherUserId);

        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        int offset = safePage * safeSize;

        String countSql = """
            SELECT COUNT(*) FROM auth_audit_events
            WHERE resource_id = ? OR actor_user_id = ?
        """;
        Long count = jdbc.queryForObject(countSql, Long.class, researcherUserId.toString(), researcherUserId);
        long totalItems = count != null ? count : 0L;
        int totalPages = (int) Math.ceil((double) totalItems / safeSize);

        String selectSql = """
            SELECT id, action, outcome, occurred_at, actor_user_id, ip_address, user_agent, resource_id, metadata
            FROM auth_audit_events
            WHERE resource_id = ? OR actor_user_id = ?
            ORDER BY occurred_at DESC
            LIMIT ? OFFSET ?
        """;

        List<ResearcherAuditEventView> events = jdbc.query(selectSql, (rs, rowNum) -> new ResearcherAuditEventView(
                UUID.fromString(rs.getString("id")),
                rs.getString("action"),
                rs.getString("outcome"),
                rs.getTimestamp("occurred_at").toInstant(),
                rs.getString("actor_user_id") != null ? UUID.fromString(rs.getString("actor_user_id")) : null,
                rs.getString("ip_address"),
                rs.getString("user_agent"),
                rs.getString("resource_id"),
                rs.getString("metadata")
        ), researcherUserId.toString(), researcherUserId, safeSize, offset);

        return new ResearcherPageResponse<>(events, safePage, safeSize, totalItems, totalPages);
    }

    @Transactional
    public void suspendResearcher(UUID researcherUserId, String reason, UUID adminUserId, String ipAddress, String userAgent) {
        UserAccount user = requireResearcher(researcherUserId);
        Instant now = clock.instant();

        user.suspend(now);
        userRepository.save(user);

        String revokeReason = "ACCOUNT_SUSPENDED: " + (reason != null && !reason.isBlank() ? reason.trim() : "Admin suspended researcher account");
        sessionService.revokeAll(researcherUserId, revokeReason);

        auditService.record(
                adminUserId,
                AuthAuditAction.ADMIN_RESEARCHER_SUSPENDED,
                AuthAuditOutcome.SUCCESS,
                ipAddress,
                userAgent,
                researcherUserId.toString(),
                reason != null ? reason.trim() : "Account suspended by admin"
        );
    }

    @Transactional
    public void reactivateResearcher(UUID researcherUserId, String reason, UUID adminUserId, String ipAddress, String userAgent) {
        UserAccount user = requireResearcher(researcherUserId);
        Instant now = clock.instant();

        user.reactivate(now);
        userRepository.save(user);

        auditService.record(
                adminUserId,
                AuthAuditAction.ADMIN_RESEARCHER_REACTIVATED,
                AuthAuditOutcome.SUCCESS,
                ipAddress,
                userAgent,
                researcherUserId.toString(),
                reason != null ? reason.trim() : "Account reactivated by admin"
        );
    }

    @Transactional
    public void revokeResearcherSessions(UUID researcherUserId, String reason, UUID adminUserId, String ipAddress, String userAgent) {
        requireResearcher(researcherUserId);

        String revokeReason = "ADMIN_REVOKED: " + (reason != null && !reason.isBlank() ? reason.trim() : "Admin revoked all sessions");
        sessionService.revokeAll(researcherUserId, revokeReason);

        auditService.record(
                adminUserId,
                AuthAuditAction.ADMIN_RESEARCHER_SESSIONS_REVOKED,
                AuthAuditOutcome.SUCCESS,
                ipAddress,
                userAgent,
                researcherUserId.toString(),
                reason != null ? reason.trim() : "Sessions revoked by admin"
        );
    }

    private UserAccount requireResearcher(UUID userId) {
        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new AdminResearcherApiException(HttpStatus.NOT_FOUND, "RESEARCHER_NOT_FOUND", "Researcher account not found"));

        if (user.getRole() != UserRole.RESEARCHER) {
            throw new AdminResearcherApiException(HttpStatus.NOT_FOUND, "NOT_A_RESEARCHER", "Specified user account is not a Researcher");
        }
        return user;
    }

    private Optional<AccessApplication> findLatestApplication(String normalizedEmail) {
        List<AccessApplication> apps = jdbc.query(
                """
                SELECT id FROM access_applications
                WHERE normalized_email = ? AND application_type = 'RESEARCHER'
                ORDER BY created_at DESC LIMIT 1
                """,
                (rs, rowNum) -> applicationRepository.findById(UUID.fromString(rs.getString("id"))).orElse(null),
                normalizedEmail
        );
        return apps.stream().filter(Objects::nonNull).findFirst();
    }

    private ResearcherApplicationView findResearcherApplication(String normalizedEmail) {
        Optional<AccessApplication> appOpt = findLatestApplication(normalizedEmail);
        if (appOpt.isEmpty()) {
            return null;
        }

        AccessApplication app = appOpt.get();
        Optional<ResearcherApplicationDetail> detailOpt = researcherDetailRepository.findById(app.getId());

        String institution = null;
        String department = null;
        String professionalTitle = null;
        String institutionalProfileUrl = null;
        String researchField = null;
        String researchPurpose = null;
        String researchSummary = null;
        String orcid = null;
        String researchProfileUrl = null;
        String publicationProfileUrl = null;
        String ethicsReference = null;
        String projectApprovalReference = null;

        if (detailOpt.isPresent()) {
            ResearcherApplicationDetail d = detailOpt.get();
            institution = d.getInstitution();
            department = d.getDepartment();
            professionalTitle = d.getProfessionalTitle();
            institutionalProfileUrl = d.getInstitutionalProfileUrl();
            researchField = d.getResearchField();
            researchPurpose = d.getResearchPurpose();
            researchSummary = d.getResearchSummary();
            orcid = d.getOrcid();
            researchProfileUrl = d.getResearchProfileUrl();
            publicationProfileUrl = d.getPublicationProfileUrl();
            ethicsReference = d.getEthicsReference();
            projectApprovalReference = d.getProjectApprovalReference();
        }

        return new ResearcherApplicationView(
                app.getId(),
                app.getStatus(),
                app.getSubmittedAt(),
                app.getEmailVerifiedAt(),
                app.getAttestedAt(),
                app.getCreatedAt(),
                app.getUpdatedAt(),
                app.getPhone(),
                app.getCountryCode(),
                institution,
                department,
                professionalTitle,
                institutionalProfileUrl,
                researchField,
                researchPurpose,
                researchSummary,
                orcid,
                researchProfileUrl,
                publicationProfileUrl,
                ethicsReference,
                projectApprovalReference
        );
    }

    private int countActiveSessions(UUID userId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM auth_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?",
                Integer.class,
                userId,
                Timestamp.from(clock.instant())
        );
        return count != null ? count : 0;
    }

    public record DocumentDownload(byte[] bytes, String contentType, String filename) {}
}
