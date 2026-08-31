CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(64) NOT NULL,
    category VARCHAR(32) NOT NULL,
    title VARCHAR(180) NOT NULL,
    body VARCHAR(400) NOT NULL,
    target_type VARCHAR(40),
    target_id UUID,
    source_event_id VARCHAR(180) NOT NULL,
    deliver_in_app BOOLEAN NOT NULL,
    deliver_email BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    CONSTRAINT ck_notifications_category CHECK (category IN ('APPOINTMENTS','SECURITY','REPORTS','SYSTEM')),
    CONSTRAINT uq_notification_source UNIQUE (user_id, source_event_id)
);

CREATE INDEX ix_notifications_user_created
    ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX ix_notifications_user_unread
    ON notifications (user_id, created_at DESC)
    WHERE read_at IS NULL AND deliver_in_app = TRUE;

CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    appointments_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    reports_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    security_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    appointments_email BOOLEAN NOT NULL DEFAULT TRUE,
    reports_email BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    aggregate_type VARCHAR(60) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_outbox_attempt_count CHECK (attempt_count >= 0)
);

CREATE INDEX ix_outbox_pending
    ON outbox_events (next_attempt_at, created_at)
    WHERE published_at IS NULL;

