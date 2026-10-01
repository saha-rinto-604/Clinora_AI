CREATE TABLE research_project_reviews (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    reviewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(32) NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_research_project_reviews_action
        CHECK (action IN (
            'REVIEW_STARTED',
            'INFORMATION_REQUESTED',
            'APPROVED',
            'REJECTED'
        ))
);

CREATE INDEX idx_research_project_reviews_project_id
    ON research_project_reviews (project_id, created_at DESC);

CREATE INDEX idx_research_project_reviews_reviewer
    ON research_project_reviews (reviewer_user_id);
