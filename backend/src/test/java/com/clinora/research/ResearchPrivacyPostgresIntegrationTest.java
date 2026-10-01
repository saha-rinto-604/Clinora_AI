package com.clinora.research;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.clinora.audit.*;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.service.*;
import java.time.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

/** Actual combined SQL lineage and privacy boundaries on a fresh, disposable PostgreSQL database. */
@Testcontainers
class ResearchPrivacyPostgresIntegrationTest {
    @Container static final PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16-alpine")
        .withDatabaseName("clinora_integration_privacy");
    JdbcTemplate jdbc;
    TransactionTemplate tx;
    ResearchAccessGuard guard;
    ResearchPrivacyService privacy;
    AuthAuditService audit;
    UUID owner, outsider, admin, project, request, dataset, version;
    List<UUID> patients;

    @BeforeAll static void migrate() {
        Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
            .locations("classpath:db/migration", "classpath:db/integration-clean").load().migrate();
    }

    @BeforeEach void setup() {
        var source = new DriverManagerDataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword());
        jdbc = new JdbcTemplate(source);
        tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        audit = mock(AuthAuditService.class);
        guard = new ResearchAccessGuard(jdbc, Clock.systemUTC());
        privacy = new ResearchPrivacyService(jdbc, audit);
        owner = user("RESEARCHER"); outsider = user("RESEARCHER"); admin = user("SYSTEM_ADMIN");
        project = UUID.randomUUID(); request = UUID.randomUUID(); dataset = UUID.randomUUID(); version = UUID.randomUUID();
        jdbc.update("INSERT INTO research_projects(id,owner_user_id,title,objective,research_field,status,created_at,updated_at) VALUES (?,?,'Synthetic','Synthetic','Synthetic','APPROVED',now(),now())",project,owner);
        jdbc.update("INSERT INTO research_dataset_requests(id,project_id,name,purpose,requested_format,status,created_at,updated_at) VALUES (?,?,'Synthetic','Synthetic','JSON','APPROVED',now(),now())",request,project);
        jdbc.update("INSERT INTO research_datasets(id,project_id,dataset_request_id,name,created_at) VALUES (?,?,?,'Synthetic',now())",dataset,project,request);
        jdbc.update("INSERT INTO dataset_versions(id,dataset_id,version_number,schema_version,record_count,storage_object_key,checksum,format,deidentification_profile_version,generated_at) VALUES (?,?,1,'1',5,'synthetic-only','test','JSON','1',now())",version,dataset);
        jdbc.update("INSERT INTO dataset_access_grants(id,dataset_id,researcher_user_id,granted_by,granted_at) VALUES (?,?,?,?,now())",UUID.randomUUID(),dataset,owner,admin);
        patients = java.util.stream.IntStream.range(0,5).mapToObj(i -> {
            UUID patient = user("PATIENT");
            jdbc.update("INSERT INTO patient_research_consents(id,patient_user_id,consent_status,consented_at) VALUES (?,?,'CONSENTED',now())",UUID.randomUUID(),patient);
            return patient;
        }).toList();
        tx.executeWithoutResult(s -> { privacy.lockConsentChanges(); privacy.recordContributions(version,patients); });
    }

    UUID user(String role) {
        UUID id = UUID.randomUUID(); String email = id + "@example.invalid";
        jdbc.update("INSERT INTO users(id,first_name,last_name,email,normalized_email,password_hash,role,account_status,email_verified_at,created_at,updated_at) VALUES (?,'Synthetic','Test',?,?,'not-a-login',?,'ACTIVE',now(),now(),now())",id,email,email,role);
        return id;
    }

    @Test void completeLineageValidatesAndDoesNotInferConsent() {
        Flyway.configure().dataSource(database.getJdbcUrl(),database.getUsername(),database.getPassword())
            .locations("classpath:db/migration","classpath:db/integration-clean").load().validate();
        UUID patient = user("PATIENT");
        jdbc.update("INSERT INTO patient_research_consents(id,patient_user_id) VALUES (?,?)",UUID.randomUUID(),patient);
        assertEquals("UNKNOWN",jdbc.queryForObject("SELECT consent_status FROM patient_research_consents WHERE patient_user_id=?",String.class,patient));
        assertDoesNotThrow(() -> guard.dataset(dataset,owner));
    }

    @Test void repeatedRecordsCannotSatisfyMinimumCohort() {
        assertThrows(ResearchApiException.class, () -> tx.executeWithoutResult(s -> privacy.recordContributions(UUID.randomUUID(), Collections.nCopies(50,patients.getFirst()))));
    }

    @Test void withdrawalSuspendsAndReconsentDoesNotAutomaticallyRestore() {
        UUID patient = patients.getFirst();
        tx.executeWithoutResult(s -> {
            privacy.lockConsentChanges();
            jdbc.update("UPDATE patient_research_consents SET consent_status='REVOKED',revoked_at=now() WHERE patient_user_id=?",patient);
            privacy.suspendContributions(patient,"test","test");
        });
        assertThrows(ResearchApiException.class, () -> guard.dataset(dataset,owner));
        assertThrows(ResearchApiException.class, () -> tx.executeWithoutResult(s -> privacy.restoreVersion(version,admin,"Review","test","test")));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM dataset_versions WHERE id=?",Integer.class,version));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM dataset_access_grants WHERE dataset_id=? AND revoked_at IS NULL",Integer.class,dataset));
        jdbc.update("UPDATE patient_research_consents SET consent_status='CONSENTED',revoked_at=NULL WHERE patient_user_id=?",patient);
        assertThrows(ResearchApiException.class, () -> guard.dataset(dataset,owner));
        assertThrows(ResearchApiException.class, () -> tx.executeWithoutResult(s -> privacy.restoreVersion(version,owner,"Self approval","test","test")));
        tx.executeWithoutResult(s -> privacy.restoreVersion(version,admin,"Reviewed current consent and contribution provenance","test","test"));
        assertDoesNotThrow(() -> guard.dataset(dataset,owner));
        verify(audit).record(eq(patient),eq(AuthAuditAction.RESEARCH_DATASET_PRIVACY_SUSPENDED),eq(AuthAuditOutcome.SUCCESS),anyString(),anyString(),eq(version.toString()),anyString());
        verify(audit).record(eq(admin),eq(AuthAuditAction.RESEARCH_DATASET_PRIVACY_RESTORED),eq(AuthAuditOutcome.SUCCESS),anyString(),anyString(),eq(version.toString()),anyString());
    }

    @Test void ownersCannotBypassMissingRevokedOrExpiredGrants() {
        jdbc.update("UPDATE dataset_access_grants SET revoked_at=now() WHERE dataset_id=?",dataset);
        assertThrows(ResearchApiException.class, () -> guard.dataset(dataset,owner));
        jdbc.update("UPDATE dataset_access_grants SET revoked_at=NULL,expires_at=now()-interval '1 second' WHERE dataset_id=?",dataset);
        assertThrows(ResearchApiException.class, () -> guard.dataset(dataset,owner));
        jdbc.update("UPDATE dataset_access_grants SET expires_at=NULL,researcher_user_id=? WHERE dataset_id=?",outsider,dataset);
        assertThrows(ResearchApiException.class, () -> guard.dataset(dataset,owner));
        assertThrows(ResearchApiException.class, () -> guard.dataset(dataset,outsider));
    }

    @Test void datasetAndProjectLifecycleAndAccountStatusRemainAuthoritative() {
        jdbc.update("UPDATE research_datasets SET expires_at=now()-interval '1 second' WHERE id=?",dataset);
        assertThrows(ResearchApiException.class, () -> guard.dataset(dataset,owner));
        jdbc.update("UPDATE research_datasets SET expires_at=NULL WHERE id=?",dataset);
        jdbc.update("UPDATE research_projects SET status='ARCHIVED' WHERE id=?",project);
        assertThrows(ResearchApiException.class, () -> guard.dataset(dataset,owner));
        jdbc.update("UPDATE research_projects SET status='APPROVED' WHERE id=?",project);
        jdbc.update("UPDATE users SET account_status='SUSPENDED' WHERE id=?",owner);
        assertThrows(ResearchApiException.class, () -> guard.dataset(dataset,owner));
    }

    @Test void requestAndMetadataDoNotLeakAcrossProjects() {
        assertDoesNotThrow(() -> guard.request(request,owner,true));
        assertThrows(ResearchApiException.class, () -> guard.request(request,outsider,false));
        jdbc.update("UPDATE research_dataset_requests SET status='REJECTED' WHERE id=?",request);
        assertThrows(ResearchApiException.class, () -> guard.request(request,owner,true));
    }

    @Test void oldTokensRemainRevokedAfterReactivation() {
        var jwt = Jwt.withTokenValue("synthetic").header("alg","HS256").subject(owner.toString())
            .claim("role","RESEARCHER").issuedAt(Instant.now().minusSeconds(10)).expiresAt(Instant.now().plusSeconds(600)).build();
        assertDoesNotThrow(() -> guard.token(jwt));
        guard.revokeTokens(owner);
        assertThrows(ResearchApiException.class, () -> guard.token(jwt));
    }

    @Test void unknownHistoricalContributionLineageIsUnavailable() {
        jdbc.update("INSERT INTO dataset_versions(id,dataset_id,version_number,schema_version,record_count,storage_object_key,checksum,format,deidentification_profile_version,generated_at) VALUES (?,?,2,'1',50,'synthetic-historical','test','JSON','1',now())",UUID.randomUUID(),dataset);
        assertThrows(ResearchApiException.class, () -> guard.dataset(dataset,owner));
    }
    @Test void socketDestinationsRequireExactDocumentScopeAndFreshAccess() {
        UUID document = UUID.randomUUID();
        jdbc.update("INSERT INTO research_documents(id,project_id,title,document_type,created_by_user_id,last_edited_by_user_id) VALUES (?,?,'Synthetic','GENERAL',?,?)",document,project,owner,owner);
        var socket = new ResearchSocketAccess(guard,jdbc,Clock.systemUTC());
        var jwt = Jwt.withTokenValue("synthetic").header("alg","HS256").subject(owner.toString())
            .claim("role","RESEARCHER").issuedAt(Instant.now().minusSeconds(10)).expiresAt(Instant.now().plusSeconds(600)).build();
        String topic = "/topic/research.projects."+project+".documents."+document;
        assertDoesNotThrow(() -> socket.destination(jwt,topic,false));
        assertDoesNotThrow(() -> socket.destination(jwt,"/app/research/projects/"+project+"/documents/"+document+"/presence",true));
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> socket.destination(jwt,"/topic/research.projects.*.documents.#",false));
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> socket.destination(jwt,"/topic/research/projects/*",false));
        assertThrows(ResearchApiException.class, () -> socket.destination(jwt,topic.replace(document.toString(),UUID.randomUUID().toString()),false));
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> socket.destination(jwt,topic.replace("/topic/","/app/")+"/edit",true));
        guard.revokeTokens(owner);
        assertThrows(ResearchApiException.class, () -> socket.destination(jwt,topic,false));
    }

    @Test void expiredSocketTokenAndRemovedMembershipLoseAccess() {
        jdbc.update("INSERT INTO research_project_members(id,project_id,user_id,role,added_by) VALUES (?,?,?,'VIEWER',?)",UUID.randomUUID(),project,outsider,owner);
        jdbc.update("INSERT INTO dataset_access_grants(id,dataset_id,researcher_user_id,granted_by,granted_at) VALUES (?,?,?,?,now())",UUID.randomUUID(),dataset,outsider,admin);
        assertDoesNotThrow(() -> guard.dataset(dataset,outsider));
        jdbc.update("UPDATE research_project_members SET removed_at=now() WHERE project_id=? AND user_id=?",project,outsider);
        assertThrows(ResearchApiException.class, () -> guard.dataset(dataset,outsider));
        var expired = Jwt.withTokenValue("synthetic").header("alg","HS256").subject(owner.toString())
            .claim("role","RESEARCHER").issuedAt(Instant.now().minusSeconds(600)).expiresAt(Instant.now().minusSeconds(1)).build();
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> new ResearchSocketAccess(guard,jdbc,Clock.systemUTC()).destination(expired,"/user/queue/notifications",false));
    }

}
