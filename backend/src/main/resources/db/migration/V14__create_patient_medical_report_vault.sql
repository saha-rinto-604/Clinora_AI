CREATE TABLE patient_medical_reports (
    id UUID PRIMARY KEY,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    report_name VARCHAR(160) NOT NULL,
    report_type VARCHAR(40) NOT NULL,
    report_date DATE NULL,
    provider_laboratory VARCHAR(200) NULL,
    object_key VARCHAR(700) NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256_checksum VARCHAR(64) NOT NULL,
    archived_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_patient_medical_reports_name CHECK (btrim(report_name) <> ''),
    CONSTRAINT ck_patient_medical_reports_type CHECK (
        report_type IN ('LAB_RESULTS', 'IMAGING', 'CARDIOLOGY', 'PATHOLOGY', 'DISCHARGE_SUMMARY', 'OTHER')
    ),
    CONSTRAINT ck_patient_medical_reports_mime CHECK (
        mime_type IN ('application/pdf', 'image/jpeg', 'image/png')
    ),
    CONSTRAINT ck_patient_medical_reports_size CHECK (size_bytes > 0 AND size_bytes <= 20971520),
    CONSTRAINT ck_patient_medical_reports_checksum CHECK (sha256_checksum ~ '^[0-9a-f]{64}$')
);

CREATE INDEX ix_patient_medical_reports_owner_collection
    ON patient_medical_reports (patient_user_id, archived_at, created_at DESC);

CREATE INDEX ix_patient_medical_reports_owner_report_date
    ON patient_medical_reports (patient_user_id, report_date DESC, created_at DESC);

CREATE INDEX ix_patient_medical_reports_active_type
    ON patient_medical_reports (patient_user_id, report_type, created_at DESC)
    WHERE archived_at IS NULL;
