-- V32: Research Project Members for Project-Level Collaboration (PHASE R14)
-- Roles are project-scoped (OWNER, CO_RESEARCHER, SUPERVISOR, VIEWER) and distinct from global RBAC roles.

CREATE TABLE research_project_members (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    added_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_project_member_user UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_project ON research_project_members(project_id);
CREATE INDEX idx_project_members_user ON research_project_members(user_id);
CREATE INDEX idx_project_members_role ON research_project_members(role);
