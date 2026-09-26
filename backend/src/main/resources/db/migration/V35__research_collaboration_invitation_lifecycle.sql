-- V35: Research Collaboration Invitation Lifecycle (C2)
-- Adds invitation state machine, soft-delete for membership, and researcher directory search.

-- 1. Add soft-delete / removal tracking columns to existing membership table
ALTER TABLE research_project_members
    ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_project_members_active
    ON research_project_members(project_id)
    WHERE removed_at IS NULL;

-- 2. Create collaboration invitations table
CREATE TYPE invitation_status AS ENUM (
    ''PENDING'',
    ''ACCEPTED'',
    ''DECLINED'',
    ''REVOKED'',
    ''EXPIRED''
);

CREATE TABLE research_project_invitations (
    id              UUID PRIMARY KEY,
    project_id      UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    invitee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by      UUID NOT NULL REFERENCES users(id),
    proposed_role   VARCHAR(32) NOT NULL,
    status          invitation_status NOT NULL DEFAULT ''PENDING'',
    message         TEXT,
    invited_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMPTZ NOT NULL,
    responded_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_project_invitation_pending
    ON research_project_invitations(project_id, invitee_user_id)
    WHERE status = ''PENDING'';

CREATE INDEX idx_invitations_project  ON research_project_invitations(project_id);
CREATE INDEX idx_invitations_invitee  ON research_project_invitations(invitee_user_id);
CREATE INDEX idx_invitations_status   ON research_project_invitations(status);
CREATE INDEX idx_invitations_expires  ON research_project_invitations(expires_at) WHERE status = ''PENDING'';
