CREATE TABLE application_tokens (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES access_applications(id) ON DELETE CASCADE,
    token_type VARCHAR(32) NOT NULL CHECK (token_type IN ('EMAIL_VERIFICATION','PORTAL_ACCESS')),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_application_tokens_application ON application_tokens(application_id);

CREATE TABLE applicant_sessions (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES access_applications(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    user_agent VARCHAR(500),
    ip_address VARCHAR(64)
);
CREATE INDEX idx_applicant_sessions_application ON applicant_sessions(application_id);
