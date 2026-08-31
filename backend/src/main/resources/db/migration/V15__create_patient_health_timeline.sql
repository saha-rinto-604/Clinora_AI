CREATE TABLE patient_timeline_events (
    id UUID PRIMARY KEY,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    event_type VARCHAR(64) NOT NULL,
    category VARCHAR(40) NOT NULL,
    source_type VARCHAR(40) NULL,
    source_id UUID NULL,
    title VARCHAR(180) NOT NULL,
    detail VARCHAR(320) NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    deduplication_key VARCHAR(220) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_patient_timeline_event_type CHECK (btrim(event_type) <> ''),
    CONSTRAINT ck_patient_timeline_category CHECK (
        category IN ('PROFILE','CONDITIONS_MEDICATIONS','REPORTS','APPOINTMENTS')
    ),
    CONSTRAINT ck_patient_timeline_title CHECK (btrim(title) <> ''),
    CONSTRAINT uq_patient_timeline_dedupe UNIQUE (patient_user_id, deduplication_key)
);

CREATE INDEX ix_patient_timeline_owner_occurred
    ON patient_timeline_events (patient_user_id, occurred_at DESC, id DESC);

CREATE INDEX ix_patient_timeline_owner_category_occurred
    ON patient_timeline_events (patient_user_id, category, occurred_at DESC, id DESC);

COMMENT ON TABLE patient_timeline_events IS
    'Patient-facing longitudinal clinical event ledger. This is protected clinical storage, not an application log.';

