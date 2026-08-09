CREATE TABLE application_events (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES access_applications(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    public_message VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_application_events_application_created
    ON application_events(application_id, created_at DESC);
