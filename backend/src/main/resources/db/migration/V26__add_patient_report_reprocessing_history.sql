ALTER TABLE medical_report_extraction_jobs
    ADD COLUMN request_kind VARCHAR(24) NOT NULL DEFAULT 'INITIAL',
    ADD COLUMN baseline_result_id UUID NULL REFERENCES medical_report_extraction_results(id) ON DELETE SET NULL,
    ADD CONSTRAINT ck_medical_report_extraction_request_kind
        CHECK (request_kind IN ('INITIAL', 'RE_EXTRACTION'));

CREATE TABLE medical_report_extraction_differences (
    id UUID PRIMARY KEY,
    extraction_result_id UUID NOT NULL REFERENCES medical_report_extraction_results(id) ON DELETE CASCADE,
    baseline_result_id UUID NOT NULL REFERENCES medical_report_extraction_results(id) ON DELETE CASCADE,
    observation_id UUID NULL REFERENCES medical_report_observations(id) ON DELETE CASCADE,
    baseline_observation_id UUID NULL REFERENCES medical_report_observations(id) ON DELETE CASCADE,
    change_type VARCHAR(16) NOT NULL,
    resolution_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    resolved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_medical_report_extraction_difference_type
        CHECK (change_type IN ('CHANGED', 'NEW', 'MISSING')),
    CONSTRAINT ck_medical_report_extraction_difference_resolution
        CHECK (resolution_status IN ('PENDING', 'ACCEPTED')),
    CONSTRAINT ck_medical_report_extraction_difference_shape CHECK (
        (change_type = 'NEW' AND observation_id IS NOT NULL AND baseline_observation_id IS NULL)
        OR (change_type = 'MISSING' AND observation_id IS NULL AND baseline_observation_id IS NOT NULL)
        OR (change_type = 'CHANGED' AND observation_id IS NOT NULL AND baseline_observation_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_medical_report_extraction_difference_observation
    ON medical_report_extraction_differences (extraction_result_id, observation_id)
    WHERE observation_id IS NOT NULL;

CREATE UNIQUE INDEX uq_medical_report_extraction_difference_missing
    ON medical_report_extraction_differences (extraction_result_id, baseline_observation_id)
    WHERE change_type = 'MISSING';

CREATE INDEX idx_medical_report_extraction_differences_pending
    ON medical_report_extraction_differences (extraction_result_id, resolution_status, change_type);

DROP INDEX uq_medical_report_ai_analysis_successful_input;

CREATE INDEX idx_medical_report_ai_analysis_successful_input
    ON medical_report_ai_analysis_jobs (patient_user_id, report_id, input_fingerprint, requested_at DESC)
    WHERE status = 'SUCCEEDED';

COMMENT ON TABLE medical_report_extraction_differences IS
    'Patient-reviewable differences between a protected verified/corrected extraction and a later re-extraction.';
