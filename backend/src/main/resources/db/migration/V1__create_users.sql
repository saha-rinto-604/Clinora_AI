CREATE TABLE users (
    id UUID PRIMARY KEY,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    email VARCHAR(320) NOT NULL,
    normalized_email VARCHAR(320) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(32) NOT NULL,
    account_status VARCHAR(48) NOT NULL,
    email_verified_at TIMESTAMPTZ NULL,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deactivated_at TIMESTAMPTZ NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_users_role CHECK (role IN (
        'PATIENT',
        'DOCTOR',
        'HOSPITAL_ADMIN',
        'RESEARCHER',
        'BLOOD_BANK_STAFF',
        'SYSTEM_ADMIN'
    )),
    CONSTRAINT ck_users_account_status CHECK (account_status IN (
        'PENDING_EMAIL_VERIFICATION',
        'ACTIVE',
        'SUSPENDED',
        'DEACTIVATED'
    ))
);

CREATE UNIQUE INDEX ux_users_normalized_email ON users (normalized_email);
CREATE INDEX ix_users_role ON users (role);
CREATE INDEX ix_users_account_status ON users (account_status);
