CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_token_hash VARCHAR(64) NOT NULL,
    rotation BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    revoke_reason VARCHAR(120) NULL,
    user_agent VARCHAR(512) NULL,
    ip_address VARCHAR(64) NULL,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX ix_auth_sessions_user_active ON auth_sessions (user_id, revoked_at);
CREATE INDEX ix_auth_sessions_expires_at ON auth_sessions (expires_at);
