CREATE TABLE patient_body_measurement_snapshots (
    id UUID PRIMARY KEY,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    patient_profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    height_cm NUMERIC(5, 2) NULL,
    weight_kg NUMERIC(6, 2) NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    source_type VARCHAR(40) NOT NULL,
    source_id UUID NULL,
    recorded_by_user_id UUID NULL REFERENCES users(id) ON DELETE RESTRICT,
    deduplication_key VARCHAR(220) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_body_measurement_value CHECK (height_cm IS NOT NULL OR weight_kg IS NOT NULL),
    CONSTRAINT ck_body_measurement_height CHECK (height_cm IS NULL OR (height_cm >= 30 AND height_cm <= 300)),
    CONSTRAINT ck_body_measurement_weight CHECK (weight_kg IS NULL OR (weight_kg >= 1 AND weight_kg <= 700)),
    CONSTRAINT ck_body_measurement_source CHECK (source_type IN ('PATIENT_PROFILE')),
    CONSTRAINT uq_body_measurement_dedupe UNIQUE (patient_user_id, deduplication_key)
);

CREATE INDEX ix_body_measurement_owner_recorded
    ON patient_body_measurement_snapshots (patient_user_id, recorded_at DESC, id DESC);

CREATE INDEX ix_body_measurement_profile_recorded
    ON patient_body_measurement_snapshots (patient_profile_id, recorded_at DESC, id DESC);

COMMENT ON TABLE patient_body_measurement_snapshots IS
    'Append-only Patient body-measurement history. Existing profile values are intentionally not backfilled.';
