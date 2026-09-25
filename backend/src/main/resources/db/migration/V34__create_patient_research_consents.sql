-- V34: Patient Research Consent & Privacy Governance (Phase 1)
-- Tracks patient informed consent preferences for research data extraction.
-- Fail-closed default: UNKNOWN, WITHHELD, or REVOKED excludes observations from all research cohorts.

CREATE TABLE patient_research_consents (
    id UUID PRIMARY KEY,
    patient_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    consent_status VARCHAR(32) NOT NULL DEFAULT 'CONSENTED',
    policy_version VARCHAR(32) NOT NULL DEFAULT 'v1.0-2026',
    consented_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_research_consent_patient ON patient_research_consents(patient_user_id);
CREATE INDEX idx_research_consent_status ON patient_research_consents(consent_status);

-- Seed initial consenting state for existing demo patient accounts to maintain local development continuity
INSERT INTO patient_research_consents (id, patient_user_id, consent_status, policy_version, consented_at, created_at, updated_at)
SELECT gen_random_uuid(), id, 'CONSENTED', 'v1.0-2026', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users
WHERE role = 'PATIENT'
ON CONFLICT (patient_user_id) DO NOTHING;
