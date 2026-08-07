CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ix_email_verification_tokens_user_id ON email_verification_tokens (user_id);
CREATE INDEX ix_email_verification_tokens_expires_at ON email_verification_tokens (expires_at);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ix_password_reset_tokens_user_id ON password_reset_tokens (user_id);
CREATE INDEX ix_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);
