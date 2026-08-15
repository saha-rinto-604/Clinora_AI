CREATE TABLE application_review_notes (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES access_applications(id) ON DELETE CASCADE,
    reviewer_user_id UUID NOT NULL REFERENCES users(id),
    text VARCHAR(2000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_application_review_notes_application_created
    ON application_review_notes(application_id, created_at DESC);

CREATE INDEX idx_application_review_notes_reviewer
    ON application_review_notes(reviewer_user_id);
