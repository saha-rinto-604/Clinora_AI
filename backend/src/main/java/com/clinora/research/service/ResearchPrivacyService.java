package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.exception.ResearchApiException;
import java.util.Collection;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Private contribution lineage is never exposed through research DTOs or exports. */
@Service
public class ResearchPrivacyService {
    private final JdbcTemplate jdbc;
    private final AuthAuditService audit;

    public ResearchPrivacyService(JdbcTemplate jdbc, AuthAuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    // Serialize generation, consent changes and governance decisions, including absent consent rows.
    // This deliberately favors correctness over parallel dataset generation.
    @Transactional(propagation = Propagation.MANDATORY)
    public void lockConsentChanges() {
        jdbc.execute("SELECT pg_advisory_xact_lock(7243192601)");
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordContributions(UUID versionId, Collection<UUID> patientIds) {
        var distinct = patientIds.stream().distinct().toList();
        if (distinct.size() < 5 || distinct.contains(null)) privacyDenied();
        for (UUID patient : distinct) {
            Integer eligible = jdbc.queryForObject("SELECT count(*) FROM patient_research_consents "
                + "WHERE patient_user_id=? AND consent_status='CONSENTED' AND revoked_at IS NULL", Integer.class, patient);
            if (eligible == null || eligible != 1) privacyDenied();
            jdbc.update("INSERT INTO research_dataset_contributions(version_id,patient_user_id) VALUES (?,?)", versionId, patient);
        }
        jdbc.update("INSERT INTO research_dataset_privacy(version_id) VALUES (?)", versionId);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void suspendContributions(UUID patientId, String ip, String userAgent) {
        var versions = jdbc.query("SELECT version_id FROM research_dataset_contributions WHERE patient_user_id=?",
            (rs, row) -> rs.getObject(1, UUID.class), patientId);
        for (UUID version : versions) {
            jdbc.update("INSERT INTO research_dataset_privacy(version_id,suspended_at,reason) "
                + "VALUES (?,CURRENT_TIMESTAMP,'Consent withdrawn; governance review required') "
                + "ON CONFLICT(version_id) DO UPDATE SET suspended_at=COALESCE(research_dataset_privacy.suspended_at,EXCLUDED.suspended_at), "
                + "reason=EXCLUDED.reason,reviewed_at=NULL,reviewed_by=NULL", version);
            audit.record(patientId, AuthAuditAction.RESEARCH_DATASET_PRIVACY_SUSPENDED, AuthAuditOutcome.SUCCESS,
                ip, userAgent, version.toString(), "Consent withdrawal; stored data and grants preserved");
        }
    }

    @Transactional
    public void restoreVersion(UUID versionId, UUID administrator, String reason, String ip, String userAgent) {
        Integer authorized = jdbc.queryForObject("SELECT count(*) FROM users WHERE id=? AND role='SYSTEM_ADMIN' "
            + "AND account_status='ACTIVE' AND email_verified_at IS NOT NULL", Integer.class, administrator);
        if (authorized == null || authorized != 1) throw new ResearchApiException(HttpStatus.FORBIDDEN,
            "GOVERNANCE_ACCESS_DENIED", "An active system administrator must approve restoration.");
        if (reason == null || reason.isBlank() || reason.length() > 1000) throw new ResearchApiException(HttpStatus.BAD_REQUEST,
            "REVIEW_REASON_REQUIRED", "Document the governance decision before restoring access.");
        lockConsentChanges();
        Integer count = jdbc.queryForObject("SELECT count(DISTINCT patient_user_id) FROM research_dataset_contributions WHERE version_id=?", Integer.class, versionId);
        Integer withdrawn = jdbc.queryForObject("SELECT count(*) FROM research_dataset_contributions c LEFT JOIN patient_research_consents p "
            + "ON p.patient_user_id=c.patient_user_id WHERE c.version_id=? AND (p.id IS NULL OR p.consent_status<>'CONSENTED' OR p.revoked_at IS NOT NULL)", Integer.class, versionId);
        if (count == null || count < 5 || withdrawn == null || withdrawn != 0) privacyDenied();
        int updated = jdbc.update("UPDATE research_dataset_privacy SET suspended_at=NULL,reason=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP "
            + "WHERE version_id=? AND suspended_at IS NOT NULL", reason.trim(), administrator, versionId);
        if (updated != 1) throw new ResearchApiException(HttpStatus.CONFLICT, "REVIEW_STATE_CHANGED", "No suspended version is available for restoration.");
        audit.record(administrator, AuthAuditAction.RESEARCH_DATASET_PRIVACY_RESTORED, AuthAuditOutcome.SUCCESS,
            ip, userAgent, versionId.toString(), "Authorized governance decision; existing grants remain subject to access checks");
    }

    private static void privacyDenied() {
        throw new ResearchApiException(HttpStatus.FORBIDDEN, "DATASET_PRIVACY_REVIEW_REQUIRED",
            "At least five distinct consenting contributors with verified provenance are required. Generate a compliant replacement if necessary.");
    }
}
