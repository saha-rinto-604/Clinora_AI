# Clinora AI — Admin Researcher Account Management Plan

## 1. Goal

Create a dedicated `SYSTEM_ADMIN` workspace for managing Researcher accounts after approval.
The workspace should let an authorized admin inspect account identity, professional/application
information, profile image, Researcher verification documents, research activity metadata, account
security state, and audit history.

This is a governance/account-management feature, NOT an unrestricted database browser.

## 2. Critical privacy boundary

The current Researcher account may have a Health Profile, but that does NOT give System Admin
automatic permission to inspect that person's clinical/health information.

The Admin Researcher workspace MUST NOT expose:

- blood group, height, weight, BMI
- allergies, chronic conditions, medications
- family medical history or lifestyle notes
- emergency-contact health context
- medical reports or OCR results
- AI clinical insights
- prescriptions or appointments
- Patient records or OTHER-person reports

Do not reuse `/api/v1/patient/profile` in this Admin workspace.

`SYSTEM_ADMIN` remains subject to Clinora's clinical-privacy boundary.

## 3. What the Admin may view

### Account/governance

- full name
- verified email
- global role
- account status
- email verification state
- created/activated/suspended timestamps
- current profile image or initials

Never return password hashes, raw passwords, access/refresh/reset/activation/verification tokens,
authorization headers, object-store credentials, or cryptographic secrets.

### Researcher professional/application data

- institution/organization
- professional title/role
- research field
- proposed research purpose
- relevant institutional/project information
- ethics/approval references where present
- application status and timestamps
- reviewer identity/history where appropriate
- request-more-information / approval / rejection history

### Verification/supporting documents

Examples:

- student ID card
- institutional ID
- affiliation evidence
- research credentials
- ethics/supporting documents

These documents are sensitive identity/professional evidence.

Requirements:

- private object storage only
- no public bucket/object URLs
- backend authorization on every access
- audit document view/download
- MIME/type/size validation
- use existing malware-scan status where available
- never preload document bytes in list/search responses
- never expose storage credentials/object keys unnecessarily

## 4. Admin routes and UI

Recommended routes:

    /admin/researchers
    /admin/researchers/:researcherUserId

Do not overload `/admin/access-reviews`.

`Access Reviews` = application approval workflow.

`Researcher Accounts` = ongoing account/governance management after provisioning.

### Researcher Accounts list

Use a dense table with real backend data:

- profile image / initials
- name
- verified email
- institution
- professional title
- research field
- account status
- application status
- activated date
- View action

Filters:

- name/email/institution search
- account status
- application status
- research field
- institution

Use server-side pagination. Do not hardcode fake Researcher accounts.

### Researcher detail page

Tabs:

    Overview
    Verification & Documents
    Research Activity
    Account & Security
    Audit History

Do NOT add a Health Profile tab.

#### Overview

Show identity, professional/application information, application provenance, and timestamps.

#### Verification & Documents

Show document metadata and an explicit `View` action.

Secure view flow:

1. verify `ROLE_SYSTEM_ADMIN`
2. verify document belongs to target Researcher/application
3. record document-access audit event
4. stream via backend or use existing short-lived controlled access
5. never persist signed URLs

#### Research Activity

Show metadata only:

- owned Research Projects and status
- project collaboration memberships
- Dataset Request metadata/status
- Research Dataset metadata/status
- AI Evaluation run metadata/status
- publication/scientific-output metadata

Do NOT expose dataset contents or identifiable Patient source data.

#### Account & Security

Show account status, verification/activation state, existing authoritative login/session summary,
and suspension state/reason.

V1 actions only if supported by the current auth architecture:

- Suspend account
- Reactivate account
- Revoke active sessions

Require confirmation and audit.

Do not let Admin set a Researcher's password.

#### Audit History

Show relevant events:

- application submitted/reviewed/approved/rejected
- account activation
- profile image change
- application document upload/replacement
- admin document view
- suspension/reactivation
- session revocation
- role/security changes

Never log or render secret/token/document contents.

## 5. Backend design

Follow current Spring Boot conventions.

Conceptual services:

    AdminResearcherAccountController
    AdminResearcherAccountService
    AdminResearcherAccountModels
    AdminResearcherDocumentService

Prefer aggregation of authoritative existing entities/tables rather than duplicating Researcher data.

Compose from current sources such as:

- User
- Researcher access application/details
- application documents
- professional profile/image
- Research projects
- Research memberships
- Dataset Requests
- Research Datasets
- AI Evaluation runs
- Publications
- audit events

Do NOT create a duplicate Researcher-profile table just for Admin.

## 6. API plan

Adapt names to current repository conventions.

    GET /api/v1/admin/researchers

Query:

    q
    accountStatus
    applicationStatus
    researchField
    institution
    page
    size
    sort

    GET /api/v1/admin/researchers/{researcherUserId}
    GET /api/v1/admin/researchers/{researcherUserId}/documents
    GET /api/v1/admin/researchers/{researcherUserId}/documents/{documentId}/content
    GET /api/v1/admin/researchers/{researcherUserId}/research-activity
    GET /api/v1/admin/researchers/{researcherUserId}/audit-events

Optional security actions:

    POST /api/v1/admin/researchers/{researcherUserId}/suspend
    POST /api/v1/admin/researchers/{researcherUserId}/reactivate
    POST /api/v1/admin/researchers/{researcherUserId}/revoke-sessions

Every endpoint must require `ROLE_SYSTEM_ADMIN`.

## 7. Safe DTO rule

Never return JPA entities directly.

Create explicit safe DTOs. Exclude:

- password hash
- tokens/secrets
- Health Profile fields
- medical report data
- dataset contents

## 8. Flyway strategy

Before schema changes:

1. inspect all current migrations
2. determine next unused version
3. verify whether required data already exists

Prefer NO migration if this feature can aggregate existing account/application/document data.

Do not duplicate application documents or professional information.

## 9. Audit actions

Reuse/add events such as:

    ADMIN_RESEARCHER_ACCOUNT_VIEWED
    ADMIN_RESEARCHER_DOCUMENT_VIEWED
    ADMIN_RESEARCHER_DOCUMENT_DOWNLOADED
    ADMIN_RESEARCHER_SUSPENDED
    ADMIN_RESEARCHER_REACTIVATED
    ADMIN_RESEARCHER_SESSIONS_REVOKED

At minimum audit sensitive document access and account-security actions.

## 10. Implementation phases

### AR0 — Read-only audit

Before editing run:

    git status
    git branch --show-current
    git rev-parse HEAD
    git log -1 --oneline

Inspect:

- User/account status
- UserRole
- Researcher application details
- application documents and storage access
- access-review service
- profile image implementation
- current Researcher Health Profile reuse
- session revocation
- audit infrastructure
- Research projects/memberships
- Dataset Requests/Datasets
- AI Evaluations
- Publications
- Admin routes/layout/API layer
- latest Flyway migration

### AR1 — Backend safe read model

- paginated Researcher list
- detail aggregator
- safe DTOs
- strict `SYSTEM_ADMIN` auth
- tests proving Health Profile/medical fields are absent

### AR2 — Admin Researcher list UI

- sidebar/nav entry
- real API data
- search/filter/pagination
- profile image/initials
- loading/empty/error/403 states

### AR3 — Detail workspace

- Overview
- application provenance
- professional/research information

### AR4 — Secure verification-document viewer

- metadata list
- private backend-authorized view
- audit
- no public URL

### AR5 — Research activity metadata

- projects
- collaborations
- dataset requests
- research datasets metadata
- AI evaluations
- publications

No clinical-data bypass.

### AR6 — Account & Security actions

- suspend
- reactivate
- revoke sessions

Only through the canonical auth/session architecture.

### AR7 — Audit History

- paginated governance/security events

### AR8 — Validation

Run focused + full backend/frontend validation.

## 11. Required tests

At minimum prove:

1. SYSTEM_ADMIN can list/view Researcher accounts.
2. PATIENT/DOCTOR/RESEARCHER cannot access Admin Researcher APIs.
3. list/detail use real DB data only.
4. password/hash/tokens are never returned.
5. Health Profile/medical fields are never returned.
6. allowed professional/application information is returned.
7. document-list API returns metadata only.
8. unauthenticated/non-admin document access is rejected.
9. admin document view is audited.
10. Student ID/supporting documents are never public.
11. Admin Researcher page cannot bypass Research Dataset authorization to download contents.
12. account suspension blocks subsequent privileged Researcher access.
13. suspension preserves Research Projects/publications/history.
14. reactivation/session revocation are audited.
15. pagination/search/filtering works.
16. invalid/non-Researcher user IDs do not leak data.

## 12. Frontend validation

Cover:

- route guard
- loading
- empty
- error
- 403
- pagination/search/filter
- real profile image / initials fallback
- detail tabs
- secure document viewer errors
- suspend/reactivate/revoke-session confirmations
- absence of Health Profile/medical fields
- no fake production data

## 13. Validation commands

Backend:

    mvn test -Dtest=<focused admin researcher tests>
    mvn test

Frontend:

    npm run typecheck
    npm run lint
    npm test -- --run
    npm run build

Always:

    git diff --check

Report exact results; do not overstate.

## 14. Git safety

Do NOT:

- commit unless explicitly requested
- push
- merge
- rebase
- reset
- force-push
- discard unrelated work

Preserve current Research changes.

If generating a code patch later, generate it against the exact current source and run:

    git apply --check <patch>

Only call a patch verified if that check actually passes.

## 15. Definition of Done

Complete only when:

- Admin can search/paginate real Researcher accounts
- professional/application/governance information is visible
- actual profile image is used where available
- supporting documents (including student ID where supplied) are securely viewable
- document access is audited
- Research activity metadata is available without dataset/clinical-data bypass
- Health Profile/medical data is not exposed
- password hashes/tokens/secrets are not exposed
- account-security actions follow current auth design
- backend RBAC is authoritative
- loading/empty/error/403 states exist
- relevant tests pass
- full validation is accurately reported
- `git diff --check` is clean

The final product is a Researcher identity/governance workspace, not a clinical-record browser.
It should answer:

    "Who is this Researcher, what evidence supported their access, what Research activity is
    attached to the account, and is the account currently authorized to operate?"
