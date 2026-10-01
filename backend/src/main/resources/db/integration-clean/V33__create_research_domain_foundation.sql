CREATE TABLE research_projects (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    objective TEXT NOT NULL,
    description TEXT NULL,
    research_field VARCHAR(120) NOT NULL,
    methodology_summary TEXT NULL,
    institution_name VARCHAR(255) NULL,
    ethics_reference VARCHAR(120) NULL,
    status VARCHAR(48) NOT NULL,
    submitted_at TIMESTAMPTZ NULL,
    reviewed_at TIMESTAMPTZ NULL,
    approved_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    archived_at TIMESTAMPTZ NULL,
    reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    review_decision_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_research_projects_status
        CHECK (status IN (
            'DRAFT',
            'SUBMITTED',
            'UNDER_REVIEW',
            'MORE_INFO_REQUIRED',
            'APPROVED',
            'REJECTED',
            'ACTIVE',
            'COMPLETED',
            'ARCHIVED',
            'WITHDRAWN'
        ))
);

CREATE INDEX idx_research_projects_owner_user_id
    ON research_projects (owner_user_id);

CREATE INDEX idx_research_projects_status
    ON research_projects (status);

CREATE INDEX idx_research_projects_created_at
    ON research_projects (created_at DESC);
