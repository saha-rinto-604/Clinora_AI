CREATE TABLE medical_report_extraction_jobs (
    id UUID PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES patient_medical_reports(id) ON DELETE CASCADE,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_checksum VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    engine VARCHAR(80),
    engine_version VARCHAR(80),
    pipeline_profile VARCHAR(80) NOT NULL DEFAULT 'clinora-lab-v1',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    failure_code VARCHAR(80),
    requested_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_medical_report_extraction_job_status CHECK (status IN ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
    CONSTRAINT ck_medical_report_extraction_attempt_count CHECK (attempt_count >= 0)
);

CREATE UNIQUE INDEX uq_medical_report_extraction_active_job
    ON medical_report_extraction_jobs (report_id)
    WHERE status IN ('QUEUED', 'PROCESSING');

CREATE INDEX idx_medical_report_extraction_jobs_patient_requested
    ON medical_report_extraction_jobs (patient_user_id, requested_at DESC);

CREATE TABLE medical_report_extraction_results (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL UNIQUE REFERENCES medical_report_extraction_jobs(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES patient_medical_reports(id) ON DELETE CASCADE,
    document_type VARCHAR(60) NOT NULL,
    page_count INTEGER NOT NULL,
    overall_confidence NUMERIC(6,5),
    parser_version VARCHAR(80) NOT NULL,
    normalizer_version VARCHAR(80) NOT NULL,
    review_status VARCHAR(32) NOT NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_medical_report_extraction_page_count CHECK (page_count >= 1),
    CONSTRAINT ck_medical_report_extraction_confidence CHECK (
        overall_confidence IS NULL OR (overall_confidence >= 0 AND overall_confidence <= 1)
    ),
    CONSTRAINT ck_medical_report_extraction_review_status CHECK (
        review_status IN ('NOT_REVIEWED', 'REVIEW_REQUIRED', 'READY_FOR_CONFIRMATION', 'VERIFIED')
    )
);

CREATE INDEX idx_medical_report_extraction_results_report
    ON medical_report_extraction_results (report_id, created_at DESC);

CREATE TABLE medical_report_observations (
    id UUID PRIMARY KEY,
    extraction_result_id UUID NOT NULL REFERENCES medical_report_extraction_results(id) ON DELETE CASCADE,
    source_label VARCHAR(160) NOT NULL,
    normalized_label VARCHAR(160) NOT NULL,
    effective_label VARCHAR(160) NOT NULL,
    ocr_value_type VARCHAR(24) NOT NULL,
    effective_value_type VARCHAR(24) NOT NULL,
    ocr_numeric_value NUMERIC,
    ocr_text_value VARCHAR(400),
    ocr_comparator VARCHAR(8),
    ocr_unit VARCHAR(80),
    effective_numeric_value NUMERIC,
    effective_text_value VARCHAR(400),
    effective_comparator VARCHAR(8),
    effective_unit VARCHAR(80),
    reference_range_raw VARCHAR(160),
    reference_low NUMERIC,
    reference_high NUMERIC,
    source_flag VARCHAR(40),
    derived_range_flag VARCHAR(32),
    page_number INTEGER NOT NULL,
    bounding_box_json JSONB,
    ocr_confidence NUMERIC(6,5),
    review_required BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status VARCHAR(32) NOT NULL DEFAULT 'UNREVIEWED',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_medical_report_observation_ocr_value_type CHECK (ocr_value_type IN ('NUMERIC', 'TEXT', 'QUALITATIVE')),
    CONSTRAINT ck_medical_report_observation_effective_value_type CHECK (effective_value_type IN ('NUMERIC', 'TEXT', 'QUALITATIVE')),
    CONSTRAINT ck_medical_report_observation_page CHECK (page_number >= 1),
    CONSTRAINT ck_medical_report_observation_confidence CHECK (
        ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 1)
    ),
    CONSTRAINT ck_medical_report_observation_verification CHECK (
        verification_status IN ('UNREVIEWED', 'PATIENT_CONFIRMED', 'PATIENT_CORRECTED', 'DOCTOR_VERIFIED')
    )
);

CREATE INDEX idx_medical_report_observations_result
    ON medical_report_observations (extraction_result_id, page_number, normalized_label);

CREATE TABLE medical_report_observation_corrections (
    id UUID PRIMARY KEY,
    observation_id UUID NOT NULL REFERENCES medical_report_observations(id) ON DELETE CASCADE,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    previous_snapshot JSONB NOT NULL,
    corrected_snapshot JSONB NOT NULL,
    correction_version INTEGER NOT NULL,
    corrected_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_medical_report_observation_correction_version CHECK (correction_version >= 1),
    UNIQUE (observation_id, correction_version)
);

COMMENT ON TABLE medical_report_extraction_results IS
    'Private clinical extraction data. Raw OCR text is intentionally not persisted; Research dataset APIs must never query this table directly.';
COMMENT ON TABLE medical_report_observations IS
    'Private patient clinical observations. Research access must use a separately approved de-identified projection; never query this table directly from Research controllers.';
