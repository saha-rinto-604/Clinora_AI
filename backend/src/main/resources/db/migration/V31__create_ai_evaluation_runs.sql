-- V31: AI Evaluation Runs for Research Model Evaluation (PHASE R13)
-- Immutable experimental records tracking model evaluations against approved research dataset versions.
-- Governance constraint: Research evaluations can NEVER automatically overwrite production models.

CREATE TABLE ai_evaluation_runs (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE RESTRICT,
    dataset_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE RESTRICT,
    model_id VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    prompt_version VARCHAR(50) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    ground_truth_definition VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    configuration JSONB NOT NULL DEFAULT '{}',
    metrics JSONB,
    failure_reason TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_eval_runs_project ON ai_evaluation_runs(project_id);
CREATE INDEX idx_ai_eval_runs_dataset_version ON ai_evaluation_runs(dataset_version_id);
CREATE INDEX idx_ai_eval_runs_created_by ON ai_evaluation_runs(created_by);
CREATE INDEX idx_ai_eval_runs_status ON ai_evaluation_runs(status);
