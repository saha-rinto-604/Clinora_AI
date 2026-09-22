CREATE TABLE research_datasets (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE RESTRICT,
    dataset_request_id UUID NOT NULL REFERENCES research_dataset_requests(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_research_dataset_status CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED'))
);

CREATE INDEX idx_research_datasets_project ON research_datasets(project_id, created_at DESC);
CREATE INDEX idx_research_datasets_request ON research_datasets(dataset_request_id);

CREATE TABLE dataset_versions (
    id UUID PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES research_datasets(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    schema_version VARCHAR(32) NOT NULL,
    record_count BIGINT NOT NULL,
    storage_object_key VARCHAR(500) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    format VARCHAR(24) NOT NULL,
    deidentification_profile_version VARCHAR(32) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    immutable BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_dataset_version UNIQUE (dataset_id, version_number),
    CONSTRAINT ck_dataset_version_number CHECK (version_number >= 1),
    CONSTRAINT ck_dataset_version_record_count CHECK (record_count >= 0)
);

CREATE INDEX idx_dataset_versions_dataset ON dataset_versions(dataset_id, version_number DESC);

CREATE TABLE dataset_access_grants (
    id UUID PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES research_datasets(id) ON DELETE CASCADE,
    researcher_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    granted_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT uq_dataset_access_grant UNIQUE (dataset_id, researcher_user_id)
);

CREATE INDEX idx_dataset_access_grants_researcher ON dataset_access_grants(researcher_user_id);

CREATE TABLE dataset_generation_jobs (
    id UUID PRIMARY KEY,
    dataset_request_id UUID NOT NULL REFERENCES research_dataset_requests(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    failure_reason VARCHAR(1000),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_dataset_generation_job_status CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'))
);

CREATE INDEX idx_dataset_generation_jobs_request ON dataset_generation_jobs(dataset_request_id, created_at DESC);
