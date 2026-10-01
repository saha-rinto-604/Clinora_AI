# Clinora AI — Research Notepad Collaborative Editor Plan

## Product Decision

Add a new project-scoped tab named `Notepad` immediately before `AI Model Evaluation`.

Target project tabs:

    Overview & Datasets
    Team & Collaboration
    Notepad
    AI Model Evaluation
    Audit Trail

The Notepad is a collaborative scientific writing workspace, similar in spirit to Google Docs,
for one Clinora Research Project.

It is not generic chat, not a Dataset viewer, and not a Patient-record editor.

## Main Goal

Authorized project collaborators should be able to:

- create multiple research documents
- write paper drafts, methodology, analysis notes, and general research notes
- edit shared text
- see who created a document
- see who last edited it
- see all contributors
- preserve version history
- autosave
- collaborate safely without silently overwriting each other's work

## Multiple Documents

Do not make one giant note.

Each project may contain multiple documents.

Suggested document types:

    PAPER_DRAFT
    METHODOLOGY
    ANALYSIS_NOTES
    GENERAL

Use current repository conventions and do not hardcode fake documents.

## UI Layout

Desktop:

    ---------------------------------------------------------------
    | Documents |               Document Editor                   |
    |           |                                                 |
    | Paper     | Title                                           |
    | Method... | Created by Elena • Last edited by Robert        |
    | Notes     | Contributors: Elena, Robert, Marcus             |
    |           |                                                 |
    | + New     | Toolbar                                         |
    |           | ------------------------------------------------|
    |           | Rich text content                               |
    ---------------------------------------------------------------

Use the current Clinora dark navy/cyan/teal design.

Do not build a bright white Google Docs clone.

## Document Header

Show real attribution:

    Created by <user>
    Last edited by <user> · <timestamp>
    Contributors: <actual contributors>

If real-time collaboration is implemented, show:

    Editing now: Elena, Robert

Never show fake presence or dummy avatars.

Use uploaded profile image where available; otherwise initials.

## Rich Text Editor

V1 toolbar:

    Paragraph
    Heading 1
    Heading 2
    Heading 3
    Bold
    Italic
    Underline
    Bullet list
    Numbered list
    Blockquote
    Link
    Table
    Undo
    Redo

Optional later:

    superscript/subscript
    equations
    footnotes
    citation insertion

Do not build a complete Word clone.

## Editor Dependency Rule

Before adding packages, inspect:

- current frontend dependencies
- current editor libraries
- current WebSocket infrastructure
- current collaboration/presence infrastructure

Reuse an existing editor if one exists.

If no mature editor exists, a ProseMirror-based editor such as Tiptap is acceptable only after
verifying React 19/build compatibility.

Do not introduce two editor libraries.

## Google-Docs-Like Collaboration

Do NOT use naive last-write-wins autosave for simultaneous editing.

Two collaborators must not silently overwrite each other.

Use conflict-safe collaboration.

Preferred model:

    rich-text editor
        ↓
    CRDT/OT document state
        ↓
    authenticated WebSocket channel
        ↓
    persisted document updates/snapshots

Yjs is acceptable if it fits the current architecture.

Do not introduce an external SaaS collaboration service.

Prefer existing Spring WebSocket infrastructure.

If safe real-time CRDT/OT cannot be implemented using the current architecture, stop and report
the dependency instead of pretending ordinary autosave is Google-Docs-like collaboration.

## Autosave

Show:

    Saving...
    Saved
    Reconnecting...
    Save failed

Do not silently lose unsynchronized changes.

## Authorship

Minimum stored attribution:

    createdByUserId
    createdAt
    lastEditedByUserId
    updatedAt

Contributor list must be derived from real revision/update history.

Do not infer contributors from project membership alone.

## Version History

Add `Version History`.

Show:

    timestamp
    editor/contributor
    revision/version

Allow viewing historical versions.

If restore is later implemented, restore by creating a new revision; never destroy subsequent history.

## Data Model

Inspect current Research Notes/Project Files before creating new entities.

Conceptually:

    ResearchDocument
        id
        projectId
        title
        documentType
        createdByUserId
        lastEditedByUserId
        createdAt
        updatedAt
        archivedAt
        contentJson/currentState as required by selected editor

    ResearchDocumentRevision
        id
        documentId
        revisionNumber
        editedByUserId
        snapshot/update
        createdAt

For CRDT implementations, an update/snapshot persistence model may replace ordinary revision snapshots.

Do not create duplicate tables if current ResearchNote persistence can safely evolve into this feature.

## Permissions

Project-scoped authorization remains mandatory.

Recommended:

    OWNER          create/edit/rename/archive/comment/history
    CO_RESEARCHER  create/edit/comment/history
    SUPERVISOR     edit/review/comment/history
    VIEWER         read-only

`Anyone can edit` means any authorized project collaborator with edit permission.

It does NOT mean every Clinora user or every Researcher account.

Backend authorization is authoritative.

## Removed Collaborator

When a collaborator is removed:

- existing historical attribution remains
- current document-edit access is revoked
- real-time socket/channel access is revoked or rejected
- historical versions are not deleted

## Comments

After core editing works, support project-document comments.

V1 can use document-level comments.

Inline selected-text comments may be added after the editor model is stable.

Do not build generic chat inside Notepad.

## Privacy Boundary

Display one restrained notice:

    Research workspace only — do not enter identifiable patient information.

Do not automatically insert:

- Patient names
- email/phone
- Patient UUID
- raw Medical Reports
- OTHER-person reports
- identifiable appointments

Notepad must not become a workaround around Research privacy controls.

## Dataset Links

A Notepad document may reference safe Research Dataset metadata:

    Biomarker Dataset v3

This is provenance only.

Notepad access != DatasetAccessGrant.

Never provide Dataset download through the Notepad.

## AI Evaluation Links

Allow safe links/chips to authorized evaluation runs:

    Evaluation Run #23
    Clinora AI v1.2

Use real run data only.

## Clinora Library Integration

Workflow:

    Notepad paper draft
        ↓
    collaborators write/review
        ↓
    paper published externally
        ↓
    Register Research Output
        ↓
    Clinora Library

Do not automatically publish Notepad content to Clinora Library.

## Export

After editor stability, support:

    Export PDF
    Export DOCX

Do not prioritize export ahead of safe collaboration/versioning.

## API Direction

Adapt to current conventions:

    GET  /api/v1/research/projects/{projectId}/documents
    POST /api/v1/research/projects/{projectId}/documents
    GET  /api/v1/research/projects/{projectId}/documents/{documentId}
    PATCH /api/v1/research/projects/{projectId}/documents/{documentId}
    POST /api/v1/research/projects/{projectId}/documents/{documentId}/archive

    GET /api/v1/research/projects/{projectId}/documents/{documentId}/versions
    GET /api/v1/research/projects/{projectId}/documents/{documentId}/versions/{version}

Use an authenticated project/document WebSocket channel for real-time editing if implemented.

Never expose an unauthenticated collaboration socket.

## Audit

Audit lifecycle actions:

    RESEARCH_DOCUMENT_CREATED
    RESEARCH_DOCUMENT_RENAMED
    RESEARCH_DOCUMENT_ARCHIVED
    RESEARCH_DOCUMENT_EXPORTED
    RESEARCH_DOCUMENT_COMMENT_CREATED
    RESEARCH_DOCUMENT_VERSION_RESTORED

Do not log every keystroke in the general Research Audit Trail.

Do not log full document content in audit metadata.

## Loading / Empty / Error States

Empty:

    No research documents yet.
    Create a document to start writing with your team.

Loading:
    document list/editor skeleton

Error:
    Unable to load this document. [Retry]

403:
    You do not have permission to access this research document.

Read-only:
    This document is read-only.

## Antigravity Current-Code Audit

Before editing:

    git status
    git branch --show-current
    git rev-parse HEAD
    git log -1 --oneline

Inspect:

- Research Project tab navigation
- Team & Collaboration
- current Research Notes
- current Project Files
- ProjectMemberRole
- project authorization service
- WebSocket/STOMP support
- frontend editor dependencies
- audit infrastructure
- latest Flyway migrations

Search:

    "AI Model Evaluation"
    "Team & Collaboration"
    "ResearchNote"
    "WebSocket"
    "STOMP"
    "Tiptap"
    "ProseMirror"
    "Yjs"

Do not guess filenames.

## Existing Research Notes

If Research Notes already exist, do not blindly create a second overlapping note system.

Choose after inspecting source:

    A. evolve ResearchNote into richer ResearchDocument/Notepad

or:

    B. retain lightweight Collaboration notes and add long-form Notepad documents separately

Preserve existing user data.

## Implementation Phases

NP0 — Current-code audit

NP1 — Add Notepad tab + document CRUD

NP2 — Rich-text editor + autosave

NP3 — creator/last-editor/contributor attribution + version history

NP4 — conflict-safe real-time collaboration + presence

NP5 — comments/review

NP6 — safe Dataset and AI Evaluation references

NP7 — PDF/DOCX export

NP8 — full validation

Do not implement everything in one uncontrolled change.

## Backend Test Matrix

Prove:

1. OWNER can create documents.
2. CO_RESEARCHER can edit allowed documents.
3. SUPERVISOR behavior matches permission policy.
4. VIEWER cannot mutate.
5. unrelated Researcher cannot read/edit.
6. removed collaborator loses access.
7. creator/last-editor attribution is correct.
8. contributor list comes from real edits.
9. version history preserves prior content.
10. archived document becomes read-only.
11. simultaneous edits do not silently overwrite.
12. real-time channel enforces project authorization.
13. Dataset reference does not create DatasetAccessGrant.
14. document audit does not contain content/keystrokes.

## Frontend Test Matrix

Cover:

- Notepad appears before AI Model Evaluation
- loading/empty/error/403
- document creation
- rename/archive
- rich-text editing
- autosave states
- creator/last editor
- contributor list
- version history
- Viewer read-only mode
- live presence only when real
- reconnect behavior
- comments
- safe Dataset/AI Evaluation links
- responsive layout

## Validation

Backend:

    mvn test -Dtest=<focused notepad/document tests>
    mvn test

Frontend:

    npm run typecheck
    npm run lint
    npm test -- --run
    npm run build

Always:

    git diff --check

If real-time collaboration is implemented, run multi-client/concurrency tests.

Do not claim Google-Docs-like collaboration unless concurrent editing was actually tested.

## Git Safety

Do NOT commit, push, merge, rebase, reset, force-push, or discard unrelated work.

## Acceptance Criteria

1. `Notepad` appears directly before `AI Model Evaluation`.
2. Each project supports multiple documents.
3. Authorized collaborators can edit according to role.
4. Rich text editing works.
5. Autosave reports real state.
6. Creator is shown.
7. Last editor is shown.
8. Real contributors are shown.
9. Version history is preserved.
10. Concurrent editing cannot silently overwrite work.
11. Presence is real if displayed.
12. Removed collaborators lose access.
13. Notepad cannot bypass Dataset authorization.
14. No Patient-identifiable data is automatically inserted.
15. No fake users/documents/presence are introduced.
16. Existing Research Notes are reused/migrated safely where applicable.
17. Relevant tests are accurately reported.
18. `git diff --check` is clean.

## Final Product Meaning

Research Notepad is Clinora's collaborative scientific writing workspace.

It lets a Research Project team write, review, preserve authorship/history, and prepare
research output together without becoming generic chat, uncontrolled clinical-data storage,
or an unsafe last-write-wins editor.
