CREATE TABLE research_dataset_requests (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    purpose TEXT NOT NULL,
    requested_population JSONB NOT NULL DEFAULT '{}'::jsonb,
    requested_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    requested_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    requested_format VARCHAR(32) NOT NULL,
    status VARCHAR(48) NOT NULL,
    submitted_at TIMESTAMPTZ NULL,
    reviewed_at TIMESTAMPTZ NULL,
    approved_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NULL,
    reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_research_dataset_requests_status
        CHECK (status IN (
            'DRAFT',
            'SUBMITTED',
            'UNDER_REVIEW',
            'MORE_INFO_REQUIRED',
            'APPROVED',
            'REJECTED',
            'CANCELLED'
        )),
    CONSTRAINT ck_research_dataset_requests_format
        CHECK (requested_format IN ('CSV', 'JSON', 'PARQUET'))
);

CREATE INDEX idx_research_dataset_requests_project_id
    ON research_dataset_requests (project_id);

CREATE INDEX idx_research_dataset_requests_status
    ON research_dataset_requests (status);

CREATE INDEX idx_research_dataset_requests_created_at
    ON research_dataset_requests (created_at DESC);
