-- V39__create_research_notepad_documents.sql
-- Create research notepad collaborative documents, revisions, and document-level comments

CREATE TABLE IF NOT EXISTS research_documents (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(64) NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}',
    crdt_state BYTEA,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    last_edited_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_research_docs_project_archived_updated
    ON research_documents (project_id, archived_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS research_document_revisions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES research_documents(id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    edited_by_user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content_json TEXT NOT NULL,
    crdt_update BYTEA,
    change_summary VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_research_doc_revisions_doc_rev
    ON research_document_revisions (document_id, revision_number);

CREATE INDEX IF NOT EXISTS idx_research_doc_revisions_doc_created
    ON research_document_revisions (document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS research_document_comments (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES research_documents(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    selected_text VARCHAR(1000),
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_doc_comments_doc_created
    ON research_document_comments (document_id, created_at ASC);
