ALTER TABLE application_tokens
    DROP CONSTRAINT application_tokens_token_type_check;

ALTER TABLE application_tokens
    ADD CONSTRAINT ck_application_tokens_token_type
    CHECK (token_type IN ('EMAIL_VERIFICATION', 'PORTAL_ACCESS', 'ACCOUNT_ACTIVATION'));
