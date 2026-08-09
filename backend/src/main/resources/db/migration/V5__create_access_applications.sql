CREATE TABLE access_applications (
    id UUID PRIMARY KEY,
    application_type VARCHAR(24) NOT NULL CHECK (application_type IN ('DOCTOR','RESEARCHER')),
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    email VARCHAR(320) NOT NULL,
    normalized_email VARCHAR(320) NOT NULL,
    phone VARCHAR(40),
    country_code VARCHAR(120),
    status VARCHAR(48) NOT NULL CHECK (status IN (
        'EMAIL_PENDING','DRAFT','SUBMITTED','UNDER_REVIEW','MORE_INFO_REQUIRED',
        'INTERVIEW_REQUIRED','INTERVIEW_SCHEDULED','INTERVIEW_COMPLETED',
        'APPROVED','REJECTED','ACTIVATION_PENDING','ACTIVATED','WITHDRAWN'
    )),
    processing_consent_at TIMESTAMPTZ NOT NULL,
    email_verified_at TIMESTAMPTZ,
    attested_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_access_applications_email ON access_applications(normalized_email);
CREATE UNIQUE INDEX uq_active_professional_application_email
    ON access_applications(normalized_email)
    WHERE status NOT IN ('REJECTED','WITHDRAWN','ACTIVATED');
