-- V47: AI Evaluation Results
-- Stores per-sample predictions compared against reference ground truth

CREATE TABLE ai_evaluation_results (
    id UUID PRIMARY KEY,
    evaluation_run_id UUID NOT NULL REFERENCES ai_evaluation_runs(id) ON DELETE CASCADE,
    sample_key VARCHAR(100) NOT NULL,
    variable_code VARCHAR(100) NOT NULL,
    ground_truth VARCHAR(50) NOT NULL,
    prediction VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ai_eval_result_sample UNIQUE (evaluation_run_id, sample_key)
);

CREATE INDEX idx_ai_eval_results_run ON ai_evaluation_results(evaluation_run_id);
