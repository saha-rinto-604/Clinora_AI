# Clinora AI — Remove Standalone "De-identified" UI Badges

## Goal

Remove the standalone visual `De-identified` badge/text with shield/security icon
from Researcher and System Admin UI surfaces.

This is a presentation cleanup only.

Do NOT remove or weaken actual de-identification/privacy behavior.

## Scope

Remove standalone decorative/status elements such as:

    [shield icon] De-identified
    [shield icon] DE-IDENTIFIED
    De-identified
    Deidentified
    De Identified

where they appear in:

- Researcher dashboard
- Researcher projects
- Researcher dataset/dataset-request/cohort pages
- Researcher AI evaluation/collaboration/publication pages
- Admin dashboard
- Admin Research Projects
- Admin Dataset Requests
- Admin Researcher Accounts
- Admin access-review/governance pages
- shared Research/Admin components

If one shared component renders the badge everywhere, fix it centrally.

## Important Boundary

Do NOT remove semantically necessary wording, backend concepts, or security behavior.

Keep meaningful text such as:

    "Researchers may access only approved de-identified datasets."

Keep:

- backend de-identification logic
- DatasetVersion/privacy metadata
- enums/database fields
- audit events
- security/SRS documentation
- SELF/OTHER separation
- consent/eligibility checks
- minimum cohort protection
- DatasetAccessGrant

The request is to remove the repetitive visual badge/icon, not erase the privacy concept.

## Antigravity Search Procedure

Before editing run:

    git status
    git branch --show-current
    git rev-parse HEAD
    git log -1 --oneline

Search current frontend source for:

    "De-identified"
    "DE-IDENTIFIED"
    "de-identified"
    "Deidentified"
    "De Identified"
    "deidentified"

Also inspect likely UI/icon references:

    Shield
    ShieldCheck
    ShieldCheckIcon
    PrivacyBadge
    DatasetPrivacyBadge
    DeidentifiedBadge
    StatusBadge

Do not guess old filenames.

## Exact UI Change

Where code renders conceptually:

    <Badge>
      <ShieldCheck />
      De-identified
    </Badge>

remove that entire standalone badge/pill.

Do NOT leave:

- shield icon alone
- empty wrapper
- blank flex/grid space
- tooltip for the deleted element
- replacement privacy badge

The surrounding layout must close naturally.

## Status Preservation

If the current UI shows:

    [De-identified] [ACTIVE]

the result should be:

    [ACTIVE]

Keep real operational statuses such as:

- ACTIVE
- READY
- APPROVED
- DRAFT
- EXPIRED
- REVOKED
- SUBMITTED

Do not remove useful resource state.

## Researcher UI

Remove standalone `De-identified` badge/icon from all Researcher-facing surfaces.

Preserve:

- project status
- dataset status
- dataset request status
- dataset version information
- privacy threshold behavior
- authorization logic

Do not change API/DTO contracts merely to hide the badge.

## Admin UI

Remove the same standalone badge/icon from Admin surfaces.

Preserve:

- project governance status
- dataset-request status
- research dataset status
- account/application status
- audit information

## Shared Component Cleanup

If a dedicated component exists only for this badge:

- remove all usages
- delete the now-dead component

If a shared component also renders other statuses:

- remove only the `De-identified` branch
- preserve other legitimate state rendering

## Import/Layout Cleanup

After removal:

- remove unused Shield/ShieldCheck imports only where no longer used
- remove dead constants/helper arrays
- remove empty wrappers/gaps
- preserve responsive layout

Do not perform unrelated refactoring.

## Tests

Update only UI tests that expect the removed standalone badge.

Do NOT remove functional privacy/security tests.

Keep tests for:

- de-identification
- Patient-identity leakage prevention
- SELF/OTHER separation
- DatasetAccessGrant
- minimum cohort protection

## Acceptance Criteria

1. No standalone `De-identified` badge remains in Researcher UI.
2. No standalone `De-identified` badge remains in Admin UI.
3. No orphan shield/logo remains where it was removed.
4. No empty layout gap remains.
5. Operational statuses remain visible.
6. No replacement badge/text is added.
7. Backend privacy/de-identification logic is unchanged.
8. Meaningful explanatory privacy wording remains where required.
9. No fake data is introduced.
10. Responsive layout remains clean.

## Validation

Run:

    npm run typecheck
    npm run lint
    npm test -- --run
    npm run build
    git diff --check

Report exact results and separate unrelated pre-existing failures.

## Git Safety

Do NOT commit, push, merge, rebase, reset, force-push, or discard unrelated changes.

## Final Report

Return:

A. branch + HEAD
B. exact files changed
C. every UI location where the badge was removed
D. shared component changes
E. unused import cleanup
F. confirmation privacy/de-identification behavior was not changed
G. validation results
H. git diff --check result
I. no commit / no push / no merge / no rebase / no reset
