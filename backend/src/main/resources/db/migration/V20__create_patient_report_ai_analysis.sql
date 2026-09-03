CREATE TABLE medical_report_ai_analysis_jobs (
    id UUID PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES patient_medical_reports(id) ON DELETE CASCADE,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    extraction_result_id UUID NOT NULL REFERENCES medical_report_extraction_results(id) ON DELETE CASCADE,
    input_fingerprint VARCHAR(64) NOT NULL,
    input_snapshot JSONB NOT NULL,
    status VARCHAR(24) NOT NULL,
    model_name VARCHAR(200) NOT NULL,
    model_revision VARCHAR(120) NOT NULL,
    prompt_version VARCHAR(80) NOT NULL,
    schema_version VARCHAR(40) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    failure_code VARCHAR(80),
    requested_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_medical_report_ai_analysis_job_status
        CHECK (status IN ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
    CONSTRAINT ck_medical_report_ai_analysis_attempt_count CHECK (attempt_count >= 0),
    CONSTRAINT ck_medical_report_ai_analysis_fingerprint CHECK (input_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX uq_medical_report_ai_analysis_active_job
    ON medical_report_ai_analysis_jobs (report_id)
    WHERE status IN ('QUEUED', 'PROCESSING');

CREATE UNIQUE INDEX uq_medical_report_ai_analysis_successful_input
    ON medical_report_ai_analysis_jobs (patient_user_id, report_id, input_fingerprint)
    WHERE status = 'SUCCEEDED';

CREATE INDEX idx_medical_report_ai_analysis_jobs_patient_requested
    ON medical_report_ai_analysis_jobs (patient_user_id, requested_at DESC);

CREATE TABLE medical_report_ai_analysis_results (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL UNIQUE REFERENCES medical_report_ai_analysis_jobs(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES patient_medical_reports(id) ON DELETE CASCADE,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    extraction_result_id UUID NOT NULL REFERENCES medical_report_extraction_results(id) ON DELETE CASCADE,
    analysis_status VARCHAR(40) NOT NULL,
    result_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_medical_report_ai_analysis_status CHECK (
        analysis_status IN ('POSSIBLE_CLINICAL_PATTERN', 'NO_CLEAR_ABNORMAL_PATTERN', 'INSUFFICIENT_EVIDENCE')
    )
);

CREATE INDEX idx_medical_report_ai_analysis_results_report
    ON medical_report_ai_analysis_results (report_id, created_at DESC);

COMMENT ON TABLE medical_report_ai_analysis_jobs IS
    'Private Patient clinical AI jobs. input_snapshot contains only confirmed structured observations and must not contain direct identifiers, raw OCR text, file URLs, or report binaries.';

COMMENT ON TABLE medical_report_ai_analysis_results IS
    'Private Patient clinical AI output. Research APIs must never query this table directly; any future research use requires a separately approved de-identified projection.';
