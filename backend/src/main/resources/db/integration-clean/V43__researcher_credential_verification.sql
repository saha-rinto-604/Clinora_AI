-- Migration V37: Researcher Credential Verification
CREATE TABLE IF NOT EXISTS researcher_credential_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    verification_status VARCHAR(40) NOT NULL DEFAULT 'PENDING_SUBMISSION',
    student_id_document_key VARCHAR(500),
    student_id_filename VARCHAR(255),
    student_id_mime_type VARCHAR(100),
    student_id_size_bytes BIGINT,
    certificate_document_key VARCHAR(500),
    certificate_filename VARCHAR(255),
    certificate_mime_type VARCHAR(100),
    certificate_size_bytes BIGINT,
    institution_name VARCHAR(255),
    degree_program VARCHAR(255),
    credential_id_number VARCHAR(100),
    submission_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by_user_id UUID REFERENCES users(id),
    rejection_reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_researcher_cred_status ON researcher_credential_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_researcher_cred_deadline ON researcher_credential_verifications(submission_deadline);
CREATE INDEX IF NOT EXISTS idx_researcher_cred_user ON researcher_credential_verifications(user_id);
