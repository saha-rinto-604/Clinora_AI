CREATE TABLE application_documents (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES access_applications(id) ON DELETE CASCADE,
    document_type VARCHAR(48) NOT NULL CHECK (document_type IN (
        'CV','MEDICAL_LICENSE','QUALIFICATION','OTHER','INSTITUTIONAL_EVIDENCE','ETHICS_OR_PROJECT_APPROVAL'
    )),
    object_key VARCHAR(700) NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    sha256_checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_application_documents_application ON application_documents(application_id);
