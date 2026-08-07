CREATE TABLE auth_audit_events (
    id UUID PRIMARY KEY,
    actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    outcome VARCHAR(24) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(512) NULL,
    resource_id VARCHAR(120) NULL,
    metadata VARCHAR(2000) NULL
);

CREATE INDEX ix_auth_audit_events_actor_time ON auth_audit_events (actor_user_id, occurred_at DESC);
CREATE INDEX ix_auth_audit_events_action_time ON auth_audit_events (action, occurred_at DESC);
CREATE INDEX ix_auth_audit_events_occurred_at ON auth_audit_events (occurred_at DESC);
