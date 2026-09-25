package com.clinora.research.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "patient_research_consents")
public class PatientResearchConsent {

    public static final String DEFAULT_POLICY_VERSION = "v1.0-2026";

    @Id
    private UUID id;

    @Column(name = "patient_user_id", nullable = false, unique = true)
    private UUID patientUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "consent_status", nullable = false, length = 32)
    private ResearchConsentStatus consentStatus;

    @Column(name = "policy_version", nullable = false, length = 32)
    private String policyVersion;

    @Column(name = "consented_at")
    private Instant consentedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PatientResearchConsent() {}

    public PatientResearchConsent(
            UUID id,
            UUID patientUserId,
            ResearchConsentStatus consentStatus,
            String policyVersion,
            Instant consentedAt,
            Instant revokedAt,
            Instant createdAt,
            Instant updatedAt
    ) {
        this.id = Objects.requireNonNull(id, "id must not be null");
        this.patientUserId = Objects.requireNonNull(patientUserId, "patientUserId must not be null");
        this.consentStatus = consentStatus != null ? consentStatus : ResearchConsentStatus.UNKNOWN;
        this.policyVersion = policyVersion != null ? policyVersion : DEFAULT_POLICY_VERSION;
        this.consentedAt = consentedAt;
        this.revokedAt = revokedAt;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static PatientResearchConsent createConsented(UUID patientUserId, String policyVersion, Instant now) {
        return new PatientResearchConsent(
                UUID.randomUUID(),
                patientUserId,
                ResearchConsentStatus.CONSENTED,
                policyVersion,
                now,
                null,
                now,
                now
        );
    }

    public void grantConsent(String policyVersion, Instant now) {
        this.consentStatus = ResearchConsentStatus.CONSENTED;
        this.policyVersion = policyVersion != null ? policyVersion : DEFAULT_POLICY_VERSION;
        this.consentedAt = now;
        this.revokedAt = null;
        this.updatedAt = now;
    }

    public void revokeConsent(Instant now) {
        this.consentStatus = ResearchConsentStatus.REVOKED;
        this.revokedAt = now;
        this.updatedAt = now;
    }

    public boolean isCurrentlyConsented() {
        return consentStatus == ResearchConsentStatus.CONSENTED && revokedAt == null;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPatientUserId() {
        return patientUserId;
    }

    public ResearchConsentStatus getConsentStatus() {
        return consentStatus;
    }

    public String getPolicyVersion() {
        return policyVersion;
    }

    public Instant getConsentedAt() {
        return consentedAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
