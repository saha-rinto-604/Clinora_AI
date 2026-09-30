-- V38: Clinora Library & Publications Restructure
-- Adds status, library visibility, methodology, authors, keywords, research field,
-- and safe provenance links (dataset versions, evaluation runs) to research_publications.

ALTER TABLE research_publications
    ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN library_visibility VARCHAR(50) NOT NULL DEFAULT 'PROJECT_ONLY',
    ADD COLUMN methodology_summary TEXT,
    ADD COLUMN study_design VARCHAR(255),
    ADD COLUMN analysis_summary TEXT,
    ADD COLUMN keywords VARCHAR(500),
    ADD COLUMN authors VARCHAR(1000) NOT NULL DEFAULT '',
    ADD COLUMN research_field VARCHAR(100),
    ADD COLUMN linked_dataset_version_ids JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN linked_evaluation_run_ids JSONB NOT NULL DEFAULT '[]';

CREATE INDEX idx_publications_status_visibility ON research_publications(status, library_visibility);
CREATE INDEX idx_publications_research_field ON research_publications(research_field);
