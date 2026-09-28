-- V36: Research Collaboration Workspace (Notes, Comments, Files, Versions)
-- Supports Project-Scoped Notes, Threaded Comments, File Management and Versioning.

-- 1. Research Notes
CREATE TABLE IF NOT EXISTS research_notes (
    id              UUID PRIMARY KEY,
    project_id      UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    author_user_id  UUID NOT NULL REFERENCES users(id),
    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    pinned          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_edited_by  UUID REFERENCES users(id),
    CONSTRAINT ck_research_notes_status CHECK (status IN ('DRAFT', 'REVIEWED', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_research_notes_project ON research_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_research_notes_pinned ON research_notes(project_id, pinned);

-- 2. Research Note Comments
CREATE TABLE IF NOT EXISTS research_note_comments (
    id              UUID PRIMARY KEY,
    note_id         UUID NOT NULL REFERENCES research_notes(id) ON DELETE CASCADE,
    author_user_id  UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_note_comments_note ON research_note_comments(note_id);

-- 3. Research Project Files
CREATE TABLE IF NOT EXISTS research_project_files (
    id                      UUID PRIMARY KEY,
    project_id              UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    display_name            VARCHAR(255) NOT NULL,
    content_type            VARCHAR(128) NOT NULL,
    uploaded_by_user_id     UUID NOT NULL REFERENCES users(id),
    current_version_number  INT NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_files_project ON research_project_files(project_id);

-- 4. Research Project File Versions
CREATE TABLE IF NOT EXISTS research_project_file_versions (
    id                  UUID PRIMARY KEY,
    project_file_id     UUID NOT NULL REFERENCES research_project_files(id) ON DELETE CASCADE,
    version_number      INT NOT NULL,
    storage_object_key  VARCHAR(512) NOT NULL,
    checksum            VARCHAR(128) NOT NULL,
    size_bytes          BIGINT NOT NULL,
    uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_file_version UNIQUE (project_file_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_file_versions_file ON research_project_file_versions(project_file_id);
