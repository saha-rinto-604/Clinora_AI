package com.clinora.research.domain;

/**
 * Project-scoped membership roles for research collaboration.
 *
 * <p>NOTE: These are strictly project-level permissions and are completely distinct
 * from global Clinora RBAC roles. Globally, users remain ROLE_RESEARCHER or ROLE_ADMIN.
 */
public enum ProjectMemberRole {
    OWNER,
    CO_RESEARCHER,
    SUPERVISOR,
    VIEWER
}
