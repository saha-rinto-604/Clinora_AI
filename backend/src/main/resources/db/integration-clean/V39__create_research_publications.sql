-- V33: Research Publications & Scientific Output Tracking (PHASE R15)
-- Tracks literature, preprints, journal articles, and citation metadata resulting from approved studies.

CREATE TABLE research_publications (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    abstract_text TEXT,
    publication_type VARCHAR(50) NOT NULL,
    doi VARCHAR(100),
    journal VARCHAR(255),
    conference VARCHAR(255),
    publication_date DATE,
    external_url VARCHAR(1000),
    citation_metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_publications_project ON research_publications(project_id);
CREATE INDEX idx_publications_doi ON research_publications(doi);
CREATE INDEX idx_publications_type ON research_publications(publication_type);
