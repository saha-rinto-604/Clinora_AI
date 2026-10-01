# Clinora AI — Clinora Library / Publications Restructure Plan

## Product Decision

Remove `Publications` from the individual Research Project tab navigation.

Add a global Researcher sidebar feature named:

    Clinora Library

The Library becomes a research knowledge/discovery space for scientific outputs produced from
Clinora Research projects.

It must expose publication metadata and methodology only.

It must never expose or grant access to underlying Research Dataset files.

## Target Navigation

Project tabs:

    Overview & Datasets
    Team & Collaboration
    AI Model Evaluation
    Audit Trail

Research sidebar:

    Dashboard
    My Projects
    New Project
    My Datasets
    Clinora Library
    Health Profile
    Credentials & Verification
    Notifications
    Account & Security

Do not redesign the entire sidebar.

## Why This Is Better

Publications should not be buried inside a single project.

Clinora Library should answer:

- What research has already been published using Clinora?
- What methodology was used?
- Who were the authors?
- Where was the paper published?
- What DOI/external published-paper link exists?
- Which Clinora project produced it?
- Which approved Clinora Dataset Version was used?
- Which AI Evaluation run supported the result?
- How should the paper be cited?

This helps future Researchers discover prior Clinora work without seeing private datasets.

## Critical Dataset Boundary

Library access != Dataset access.

The Library MAY show safe provenance such as:

    Dataset: Clinora Biomarker Cohort
    Version: 3
    Project: Cardiovascular Biomarkers in Type 2

The Library MUST NOT provide:

- Download Dataset
- Open Dataset
- raw CSV/JSON
- MinIO/object-store URL
- signed Dataset URL
- DatasetAccessGrant creation
- Patient-level rows
- pseudonymous subject rows
- raw OCR values
- private Research Notes
- restricted project files

Do not add a `Request Dataset` action from the Library in this phase.

Existing Dataset Request and DatasetAccessGrant rules remain unchanged.

## Library Visibility

Only eligible published outputs appear globally.

Recommended rule:

    publication.status == PUBLISHED
    AND publication.libraryVisibility == CLINORA_RESEARCHERS

Recommended visibility:

    PROJECT_ONLY
    CLINORA_RESEARCHERS

Do not add anonymous public Library access in this phase.

If current source already has visibility concepts, reuse them.

## Where Publications Are Managed

Because the project Publications tab is removed, management moves into Clinora Library.

The Library should have two views:

    Published Research
    My Research Outputs

### Published Research

Browse discoverable published Clinora outputs across projects.

### My Research Outputs

The current Researcher can:

- register a research output
- edit permitted drafts
- link an approved Research Project
- link Dataset Versions as provenance
- link AI Evaluation runs
- update publication status
- publish eligible metadata to Clinora Library

## Sidebar Change

Add:

    Clinora Library

Use a restrained Lucide icon such as `Library` or `BookOpen`.

Recommended placement:

    My Datasets
    Clinora Library

or under a small `KNOWLEDGE` section if this fits the current hierarchy without redesigning it.

## Remove Project Publications Tab

Remove the Publications tab from:

- project detail tab navigation
- active-tab logic
- nested project route/rendering where applicable

Do NOT delete Publication backend/domain logic.

This feature is being relocated, not removed.

Preserve:

- ResearchPublication persistence
- authors
- publication status
- audit events
- citation data
- Dataset Version provenance links
- AI Evaluation provenance links

## Routes

Recommended:

    /research/library
    /research/library/publications/:publicationId
    /research/library/my-outputs
    /research/library/my-outputs/new
    /research/library/my-outputs/:publicationId/edit

Adapt to current React Router conventions.

## Library Main Page

Header:

    Clinora Library

Description:

    Discover published research produced from Clinora Research projects.

Tabs:

    Published Research
    My Research Outputs

Controls:

    Search papers...
    Research field
    Publication type
    Year

Use server-side pagination.

## Published Research Result

Show real data only:

    Paper title
    Authors
    Journal / Conference · Year
    Research field
    Keywords
    Methodology summary

    Clinora provenance:
    Project
    Dataset Version
    AI Evaluation

    [View details] [Open published paper ↗]

No Dataset action is allowed.

## Publication Detail

### Publication metadata

- title
- abstract
- authors
- output type
- publication status
- journal/conference
- publication date
- DOI
- external published URL
- keywords
- research field

### Methodology

Show researcher-entered approved fields such as:

    methodologySummary
    studyDesign
    analysisSummary

Do not fabricate methodology using AI.

### Clinora provenance

Show safe metadata:

- Research Project title
- linked Dataset Version display name/version
- linked AI Evaluation run names/IDs

Do not expose Dataset contents or private note contents.

### Citation

Support:

    APA
    IEEE
    BibTeX

Generate only from stored factual publication metadata.

## Published Paper Link

Use only:

- DOI
- official journal/conference link
- approved preprint/open-access link

Do not automatically redistribute publisher PDFs.

Open external links safely:

    target="_blank"
    rel="noopener noreferrer"

## My Research Outputs

Show:

    Title
    Linked Project
    Type
    Status
    Updated
    Action

Suggested actions:

    DRAFT       Continue editing
    SUBMITTED   Open output
    ACCEPTED    Update publication
    PUBLISHED   View in Library

## Register Research Output

Form:

    Title *
    Output Type *
    Status *
    Abstract
    Methodology Summary *
    Study Design
    Analysis Summary
    Keywords
    Authors *
    Linked Research Project *
    Linked Dataset Version(s)
    Linked AI Evaluation Run(s)
    Journal / Conference
    DOI
    Published URL
    Publication Date
    Library Visibility

Only authorized projects may be selected.

Dataset Versions must belong to the selected project.

Linking a Dataset Version is provenance only and must never grant Dataset access.

## Authors

Project collaborators are NOT automatically publication authors.

Keep explicit publication authorship.

## Search and Discovery

Search:

- title
- author
- keyword
- research field
- venue
- year

Filters:

- publication type
- year
- research field

## Backend API Direction

Reuse existing publication entities/services where possible.

Conceptual APIs:

    GET /api/v1/research/library/publications
    GET /api/v1/research/library/publications/{publicationId}

    GET  /api/v1/research/library/my-outputs
    POST /api/v1/research/library/my-outputs
    GET  /api/v1/research/library/my-outputs/{publicationId}
    PATCH /api/v1/research/library/my-outputs/{publicationId}

If project-scoped Publication APIs already exist, prefer a Library query/facade layer over duplicate persistence.

## Safe Library DTO

Allowed:

    id
    title
    abstract
    methodologySummary
    studyDesign
    analysisSummary
    authors
    publicationType
    researchField
    keywords
    venue
    publicationDate
    doi
    publishedUrl
    projectTitle
    datasetProvenanceSummary
    evaluationProvenanceSummary

Explicitly exclude:

    storageObjectKey
    dataset URL
    signed URL
    DatasetAccessGrant
    Patient identifiers
    row-level observations
    private notes
    private project files

## Safe Dataset Provenance

Allowed:

    datasetDisplayName
    versionNumber
    generatedAt

Optional:

    approved variable names/categories

Never expose:

- object key
- download endpoint
- exact suppressed cohort values
- Patient/pseudonymous subject IDs

## Authorization

Published Library read:

    active authenticated RESEARCHER

My Research Outputs management:

    owner / authorized project contributor according to existing project/publication permissions

Library read must never imply Dataset access.

## Audit

Reuse/add:

    PUBLICATION_CREATED
    PUBLICATION_UPDATED
    PUBLICATION_STATUS_CHANGED
    PUBLICATION_LIBRARY_VISIBILITY_CHANGED
    PUBLICATION_PUBLISHED_TO_LIBRARY
    PUBLICATION_DATASET_LINKED
    PUBLICATION_EVALUATION_LINKED

Do not log paper contents or Dataset contents.

## Empty States

Published Research:

    No published Clinora research matches your filters.

My Research Outputs:

    You have not registered any research outputs yet.
    [Register research output]

No fake publications.

## Antigravity Procedure

Before editing:

    git status
    git branch --show-current
    git rev-parse HEAD
    git log -1 --oneline

Inspect current:

- Research sidebar/layout
- project detail tabs/routes
- project Publications UI
- publication API/service/types
- ResearchPublication backend
- DatasetVersion relationships
- AI Evaluation relationships
- audit actions
- latest Flyway migrations

Search:

    "Publications"
    "Register Publication"
    "ResearchPublication"

Do not guess filenames.

## Implementation Phases

CL0 — Current-code audit

CL1 — Remove project Publications tab

CL2 — Add sidebar Clinora Library + route

CL3 — Add safe Library read model/API

CL4 — Build Published Research list/detail

CL5 — Build My Research Outputs registration/management

CL6 — Add methodology/citation/provenance presentation

CL7 — Security tests proving Library cannot access Dataset files

CL8 — Full validation

## Required Backend Tests

1. Researcher can browse eligible published outputs.
2. DRAFT output is not globally visible.
3. PROJECT_ONLY output is not globally visible.
4. Library DTO contains no Dataset object key/file URL.
5. Viewing publication does not create DatasetAccessGrant.
6. Viewing publication does not authorize Dataset download.
7. Output registration requires authorized project.
8. Linked Dataset Version must belong to project.
9. Linked AI Evaluation must belong to project.
10. No Patient-identifiable data appears in Library DTO.

## Frontend Tests

Cover:

- Clinora Library sidebar item
- Publications project tab absent
- loading/empty/error/403 states
- search/filter/pagination
- publication detail
- methodology
- external publication link
- citations
- My Research Outputs
- Register Research Output
- safe Dataset provenance
- absence of any Dataset download/open button

## Validation

Frontend:

    npm run typecheck
    npm run lint
    npm test -- --run
    npm run build

Backend:

    mvn test -Dtest=<focused library/publication tests>
    mvn test

Always:

    git diff --check

Report exact results.

## Git Safety

Do NOT commit, push, merge, rebase, reset, force-push, or discard unrelated work.

## Acceptance Criteria

1. `Publications` is removed from project tabs.
2. `Clinora Library` appears in Research sidebar.
3. `/research/library` works.
4. Published Research uses real PUBLISHED records.
5. Methodology is visible.
6. DOI/external published-paper link is visible when stored.
7. Safe Clinora Dataset provenance is visible.
8. No Dataset download/access action exists in the Library.
9. Library access never creates/bypasses DatasetAccessGrant.
10. My Research Outputs supports registration/management.
11. Draft/internal outputs remain private.
12. Authors remain explicit, not inferred from collaborators.
13. Existing publication persistence is reused where possible.
14. No fake publication data is introduced.
15. Validation is accurately reported.

## Final Product Meaning

Clinora Library is a scientific knowledge/discovery layer.

Researchers can discover:

    what was studied
    who published it
    how it was studied
    which Clinora project produced it
    which approved Dataset Version supported it
    which AI Evaluation supported it
    where the paper is published
    how to cite it

without gaining access to:

    Dataset files
    Dataset downloads
    Patient-level data
    private project content
