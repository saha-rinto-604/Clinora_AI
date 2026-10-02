package com.clinora.research.service;

import com.clinora.research.exception.ResearchApiException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

/** Authoritative, current-state research access checks; never trust role alone. */
@Service
public class ResearchAccessGuard {
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public ResearchAccessGuard(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public void activeResearcher(UUID userId) {
        requireCount("SELECT count(*) FROM users WHERE id=? AND role='RESEARCHER' "
            + "AND account_status='ACTIVE' AND email_verified_at IS NOT NULL", userId);
    }

    public void token(Jwt jwt) {
        UUID user = UUID.fromString(jwt.getSubject());
        activeResearcher(user);
        if (jwt.getExpiresAt() == null || !jwt.getExpiresAt().isAfter(clock.instant()) || jwt.getIssuedAt() == null) denied();
        var cutoffs = jdbc.query("SELECT revoked_before FROM research_access_revocations WHERE user_id=?",
            (rs, n) -> rs.getTimestamp(1).toInstant(), user);
        if (cutoffs.stream().anyMatch(c -> !jwt.getIssuedAt().isAfter(c))) denied();
    }

    public void revokeTokens(UUID userId) {
        // Truncate to seconds to match JWT NumericDate (iat) precision (RFC 7519).
        Instant cutoff = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        jdbc.update("INSERT INTO research_access_revocations(user_id,revoked_before) VALUES (?,?) "
            + "ON CONFLICT(user_id) DO UPDATE SET revoked_before=EXCLUDED.revoked_before",
            userId, Timestamp.from(cutoff));
    }

    public void project(UUID projectId, UUID userId) {
        activeResearcher(userId);
        requireCount("SELECT count(*) FROM research_projects p WHERE p.id=? AND (p.owner_user_id=? "
            + "OR EXISTS(SELECT 1 FROM research_project_members m WHERE m.project_id=p.id AND m.user_id=? AND m.removed_at IS NULL))",
            projectId, userId, userId);
    }

    public void request(UUID requestId, UUID userId, boolean generation) {
        activeResearcher(userId);
        requireCount("SELECT count(*) FROM research_dataset_requests r JOIN research_projects p ON p.id=r.project_id "
            + "WHERE r.id=? AND (p.owner_user_id=? OR EXISTS(SELECT 1 FROM research_project_members m "
            + "WHERE m.project_id=p.id AND m.user_id=? AND m.removed_at IS NULL"
            + (generation ? " AND m.role IN ('OWNER','CO_RESEARCHER')" : "") + "))"
            + (generation ? " AND r.status='APPROVED' AND p.status IN ('APPROVED','ACTIVE') AND (r.expires_at IS NULL OR r.expires_at>CURRENT_TIMESTAMP)" : ""),
            requestId, userId, userId);
    }

    public void dataset(UUID datasetId, UUID userId) {
        activeResearcher(userId);
        requireCount("SELECT count(*) FROM research_datasets d JOIN research_projects p ON p.id=d.project_id "
            + "JOIN dataset_access_grants g ON g.dataset_id=d.id AND g.researcher_user_id=? "
            + "WHERE d.id=? AND d.status='ACTIVE' AND d.revoked_at IS NULL "
            + "AND (d.expires_at IS NULL OR d.expires_at>CURRENT_TIMESTAMP) "
            + "AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>CURRENT_TIMESTAMP) "
            + "AND p.status IN ('APPROVED','ACTIVE') AND (p.owner_user_id=? OR EXISTS "
            + "(SELECT 1 FROM research_project_members m WHERE m.project_id=p.id AND m.user_id=? AND m.removed_at IS NULL))",
            userId, datasetId, userId, userId);
        // Unknown historical lineage is deliberately unavailable until reviewed/backfilled.
        requireCount("SELECT count(*) FROM dataset_versions v WHERE v.dataset_id=?", datasetId);
        Integer unsafe = jdbc.queryForObject("SELECT count(*) FROM dataset_versions v WHERE v.dataset_id=? AND ("
            + "NOT EXISTS(SELECT 1 FROM research_dataset_privacy s WHERE s.version_id=v.id AND s.suspended_at IS NULL) "
            + "OR (SELECT count(DISTINCT c.patient_user_id) FROM research_dataset_contributions c WHERE c.version_id=v.id)<5 "
            + "OR EXISTS(SELECT 1 FROM research_dataset_contributions c LEFT JOIN patient_research_consents pc "
            + "ON pc.patient_user_id=c.patient_user_id WHERE c.version_id=v.id AND "
            + "(pc.id IS NULL OR pc.consent_status<>'CONSENTED' OR pc.revoked_at IS NOT NULL)))", Integer.class, datasetId);
        if (unsafe == null || unsafe != 0) throw new ResearchApiException(HttpStatus.FORBIDDEN,
            "DATASET_PRIVACY_REVIEW_REQUIRED", "Dataset access is suspended pending privacy review.");
    }

    public boolean canReadDataset(UUID datasetId, UUID userId) {
        try { dataset(datasetId, userId); return true; }
        catch (ResearchApiException denied) { return false; }
    }

    public void document(UUID projectId, UUID documentId, UUID userId, boolean edit) {
        project(projectId, userId);
        requireCount("SELECT count(*) FROM research_documents WHERE id=? AND project_id=?"
            + (edit ? " AND archived_at IS NULL" : ""), documentId, projectId);
        if (edit) requireCount("SELECT count(*) FROM research_projects p WHERE p.id=? AND (p.owner_user_id=? OR EXISTS "
            + "(SELECT 1 FROM research_project_members m WHERE m.project_id=p.id AND m.user_id=? "
            + "AND m.removed_at IS NULL AND m.role IN ('OWNER','CO_RESEARCHER','SUPERVISOR')))", projectId, userId, userId);
    }

    private void requireCount(String sql, Object... args) {
        Integer count = jdbc.queryForObject(sql, Integer.class, args);
        if (count == null || count < 1) denied();
    }

    private static void denied() {
        throw new ResearchApiException(HttpStatus.FORBIDDEN, "RESEARCH_ACCESS_DENIED", "Research access is not authorized.");
    }
}
