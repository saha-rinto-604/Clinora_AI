# Clinora AI Phase 6 UX R3 — Clinical Product Experience

## Purpose

Phase 6 UX R3 is a frontend-only product-design refinement of the existing Patient and Doctor workflows on `phase-6-doctor-workspace`.

It does not add clinical capabilities or modify backend behavior. The objective is to move the authenticated product away from generic SaaS dashboard composition and toward a calm, information-dense clinical workspace suitable for a serious product demonstration and deployment hardening.

## Source of truth

- Branch baseline: `phase-6-doctor-workspace`
- Baseline commit: `c3e640aa8e52855d3555634c8288652c0a19fc07`
- Existing API contracts, RBAC, appointment ownership, report-sharing consent, verification provenance, and storage behavior remain authoritative.
- Existing Clinora dark navy/black identity, cyan/teal interaction accents, logo, and typography remain the visual foundation.

## Product-design principles

1. Patient and Doctor tasks outrank vanity metrics.
2. Use agendas, lists, schedules, evidence rows, and progressive disclosure when they fit the information better than cards.
3. Preserve one dominant action per task surface.
4. Keep authenticated clinical pages calmer than public marketing pages.
5. Use real persisted data only. No fake alerts, risk scores, percentages, workload metrics, AI states, or appointments.
6. Keep Patient consent visible and understandable without turning every screen into a compliance notice.
7. Increase useful information density while retaining whitespace around decisions and primary actions.
8. Motion communicates state or interaction only; decorative motion must not compete with clinical information.
9. Maintain keyboard focus visibility, semantic headings, accessible dialogs, reduced-motion behavior, and responsive layouts.

## R3 redesign scope

### Doctor shell

- Refined 264px clinical workspace navigation.
- Quieter inactive navigation and a narrow active indicator rather than large accent fills.
- Separate Care workspace, Practice, and Account navigation groups.
- Wider content canvases for scheduling and evidence workflows.
- Compact verified-account area and mobile navigation.

### Doctor Home

- Removes the generic four-metric-card grid.
- Makes Next Patient / current Patient the primary work item.
- Places Today's clinical agenda immediately beneath it.
- Moves existing upcoming/report/availability counts into a compact Practice Pulse side rail.
- Demotes optional professional-profile setup to a thin contextual notice.
- Uses a compact operational empty state when the queue is clear.

### Doctor Schedule

- Keeps the real Today / Upcoming / History data scopes.
- Replaces card-style appointment presentation with grouped agenda rows.
- Emphasizes time, Patient, visit reason, shared evidence, and booking status.
- Keeps backend pagination and appointment navigation unchanged.

### Doctor Availability

- Makes a seven-day week surface the primary interface.
- Renders existing AVAILABLE, BOOKED, and BLOCKED slots directly from current API data.
- Keeps booked slots protected from removal.
- Moves the existing Start / End / duration inputs into an Add Availability dialog.
- Keeps timezone behavior explicit and does not invent recurrence or drag/drop persistence that the backend does not support.

### Doctor Professional Profile

- Removes the oversized hero treatment and credential-card wall.
- Separates Public profile, Practice preferences, and Credentials & verification into local UI tabs.
- Keeps editable presentation data separate from immutable verified credentials.
- Adds a realistic live Patient-facing preview.
- Uses dense credential rows plus progressive disclosure for qualifications and signup documents.
- Keeps existing credential preview/download APIs intact.

### Patient Doctor booking

- Replaces the three-large-card wizard composition with a transactional booking workspace.
- Uses a compact Doctor identity surface.
- Makes appointment-time selection the primary workspace.
- Combines optional visit note and report sharing into one secondary preparation surface.
- Keeps the booking summary persistent on desktop.
- Preserves idempotency and conflict-recovery behavior.

### Medical report selector

- Replaces large repetitive report cards with a dense document-browser table/list.
- Makes report selection the primary row action.
- Moves Preview and Edit title into contextual row actions.
- Keeps search, type filtering, pagination, selection limit, source preview, and metadata editing behavior.
- Keeps the selector height constrained with independent scrolling and a persistent footer.

### Patient Home

- Establishes Medical Reports as the single report-upload location in the home command surface.
- AI analysis now links to Analyze an existing report instead of presenting a competing Upload action.
- Blood Network remains a distinct secondary clinical coordination tool.
- Introduces a unified Your Health Data section with explicit source semantics:
  - Health Profile = self-maintained context.
  - Health Record = longitudinal medical evidence/history organized by Clinora.
- Existing care, activity, baseline, and privacy data remain real and unchanged.

## Explicit non-goals

R3 does not:

- add Doctor-facing Clinora AI reasoning (Phase 6D),
- add consultation diagnosis/notes (Phase 6E),
- add prescriptions, lab orders, referrals, or follow-up (Phase 6F),
- add calendar recurrence rules,
- add fake live alerts or notifications,
- add fake OCR milestones or percentages,
- change appointment cancellation/rescheduling semantics,
- change report-share authorization or Patient consent,
- change DB migrations or backend endpoints,
- change the public Clinora brand identity,
- merge the feature branch into `main`.

## Acceptance criteria

Before publication, validate the patch in the full repository with:

1. `npm run typecheck`
2. `npm run lint`
3. `npm test -- --run` (or the repository's current Vitest command)
4. `npm run build`
5. Existing Doctor workspace tests
6. Existing Patient booking and report-picker tests
7. Browser inspection at approximately 1440px, 1280px, 1024px, 768px, and 390px
8. Keyboard-only navigation through tabs, dialogs, report selection, and primary actions
9. No horizontal page overflow
10. Reduced-motion behavior
11. No regression in Patient booking conflict recovery or report-sharing consent
12. No regression in Doctor availability create/remove behavior
13. No regression in credential preview/download behavior

## Visual acceptance bar

- Doctor Home should read as a Doctor's workday within seconds.
- Availability should read as scheduling software before any form field is opened.
- Professional Profile should separate public presentation from verified evidence at a glance.
- Patient booking should keep the chosen time and confirmation decision visually dominant.
- Report selection should feel like a medical document library rather than a stack of cards.
- Patient Home should expose one unambiguous upload path.
- The authenticated workspace should feel quieter, denser, and more operational than public marketing pages.
