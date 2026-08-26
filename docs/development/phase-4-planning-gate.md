# Clinora AI — Phase 4 Authentication & Access Governance Planning Gate

**Status:** PLANNING ONLY — NO IMPLEMENTATION AUTHORIZED BY THIS DOCUMENT
**Version:** 1.2
**Date:** 2026-08-14
**Governing update:** `Clinora_AI_Phase4_Role_Auth_SRS_Update.md`

---

## 1. Planning Authority

This plan follows the owner-directed Phase 4 Role/Auth SRS Update as the highest authority for:

- authentication;
- identity;
- RBAC;
- Patient registration;
- Doctor application/approval;
- Researcher application/approval;
- System Admin access review;
- Doctor onboarding interview scheduling;
- hospital independence for the Clinora core.

Older SRS/User Manual/Codex rules remain useful only where they do not conflict with the update or later owner architecture decisions.

### Owner override recorded during Phase 4C remediation

Doctor access review keeps the mandatory Phase 4D onboarding interview.

Researcher access review has no interview process. Researcher applications proceed through professional review, more information when needed, decision, activation, and Researcher account creation without Researcher interview states, meeting links, reminders, or interview UI.

### Owner override locked for Phase 4D implementation — 2026-08-14

The initial `SYSTEM_ADMIN` is provisioned from `SYSTEM_ADMIN_EMAIL`, `SYSTEM_ADMIN_PASSWORD`, `SYSTEM_ADMIN_FIRST_NAME`, and `SYSTEM_ADMIN_LAST_NAME` at Spring Boot startup. Existing admin => no-op. No existing admin => validate/normalize, enforce the existing password policy, BCrypt once, create `ACTIVE` + email-verified `SYSTEM_ADMIN`, then authenticate through the common `/login`. A normalized-email collision with a non-admin account fails safely. No admin verification email, activation email, activation token, or bootstrap link is used. Environment password changes never reset an existing admin.

This override **supersedes Section 29 and Decision F** wherever they still describe command/profile + activation-email bootstrap. The approved applicant scoped-session baseline is **8 hours**, superseding the older 24-hour value in Decision C. Researcher remains **NO INTERVIEW**, superseding any remaining optional-interview wording such as Decision K.

### Binding architecture

```text
React 19 / TypeScript / Vite
          |
          | HTTPS REST
          v
Spring Boot / Java 21 / Spring Security
          |
          +--> PostgreSQL (authoritative)
          +--> Redis (rate limiting / ephemeral security)
          +--> transactional email provider through an application adapter
          `--> S3-compatible private object storage in Phase 4C for application documents
```

No NestJS, Node backend, Prisma, Passport, Firebase Auth, Auth0, Clerk, or direct frontend access to databases/providers.

---

## 2. Phase 4 Product Boundary

Phase 4 establishes secure identity and access governance.

### In scope

```text
Patient
  -> direct registration
  -> email verification
  -> login/session/password security

Doctor
  -> application
  -> email verification
  -> CV/credential submission
  -> Clinora review
  -> mandatory onboarding interview
  -> approval/rejection
  -> one-time activation
  -> chooses password
  -> DOCTOR account

Researcher
  -> application
  -> email verification
  -> institutional/research information
  -> Clinora review
  -> approval/rejection
  -> one-time activation
  -> chooses password
  -> RESEARCHER account

System Admin
  -> securely provisioned
  -> Doctor/Researcher review
  -> interview scheduling
  -> approval/rejection
```

### Explicitly out of scope

- Hospital module or hospital registration;
- Hospital dependency for Doctor onboarding;
- Blood Bank workflows;
- doctor job marketplace/recruitment vacancies;
- Patient medical dashboard;
- full Doctor clinical dashboard;
- full Research dashboard;
- full Admin dashboard;
- medical-report upload;
- OCR;
- AI inference;
- appointments;
- consultations;
- prescriptions;
- real Patient-to-Doctor report sharing;
- research dataset access.

---

## 3. Canonical Roles

Keep exactly these enum values:

```text
PATIENT
DOCTOR
HOSPITAL_ADMIN
RESEARCHER
BLOOD_BANK_STAFF
SYSTEM_ADMIN
```

Current Phase 4 workflows actively use:

```text
PATIENT
DOCTOR
RESEARCHER
SYSTEM_ADMIN
```

`HOSPITAL_ADMIN` and `BLOOD_BANK_STAFF` remain reserved and receive no public onboarding flow.

Applicants are **not roles**.

Do not create:

```text
DOCTOR_APPLICANT
RESEARCHER_APPLICANT
PENDING_DOCTOR
PENDING_RESEARCHER
```

---

## 4. Recommended Phase 4 Subphases

### Phase 4A — Authentication foundation

Goal: establish security/persistence primitives before public forms.

Deliverables:

- six-role enum;
- account status enum;
- User entity/repository;
- Flyway identity migrations;
- BCrypt password service;
- JWT access-token service;
- opaque rotating refresh-session design;
- Spring Security filter chain;
- authenticated principal;
- session persistence;
- one-time token primitives;
- authentication audit foundation;
- email delivery port/adapter abstraction;
- CORS/origin/cookie configuration;
- Redis rate-limit infrastructure;
- System Admin bootstrap design;
- backend tests.

No Patient registration UI yet.

### Phase 4B — Patient authentication

Deliverables:

- `/register`;
- Patient-only registration API;
- real email verification;
- verification resend;
- `/login`;
- access token + refresh session;
- automatic refresh;
- logout;
- `/me`;
- forgot/reset password;
- change password;
- active sessions;
- revoke one session / revoke other sessions;
- `/account`;
- protected route foundation;
- frontend auth store/Axios integration;
- local real-email manual test;
- visual/accessibility review.

### Phase 4C — Doctor & Researcher applications

Deliverables:

- `/apply/doctor`;
- `/apply/researcher`;
- application email verification;
- scoped applicant portal access;
- application status;
- Doctor professional fields;
- Researcher institutional/research fields;
- secure application-document upload/storage pathway;
- application state machine;
- request-more-information loop;
- applicant email notifications;
- backend/frontend/integration tests.

No DOCTOR or RESEARCHER user account is created merely because an application exists.

### Phase 4D — Access review & Doctor interview

Deliverables:

- minimal `/admin/access-reviews`;
- System Admin-only review APIs;
- application queues/details;
- document review metadata;
- Doctor interview scheduling;
- date/time/timezone/duration;
- manual Google Meet / Zoom / Other link;
- reschedule/cancel/complete/no-show;
- reviewer notes;
- Doctor mandatory interview enforcement;
- approve/reject;
- one-time account activation email;
- applicant chooses password;
- user created/activated with final role;
- reminder email mechanism;
- security/audit tests.

### Phase 4E — Security hardening & publication

Deliverables:

- privilege-escalation tests;
- token/session replay tests;
- rate-limit tests;
- enumeration-resistance tests;
- admin authorization tests;
- application-document access tests;
- meeting-link privacy tests;
- email workflow tests;
- CORS/cookie/CSRF verification;
- accessibility/responsive review;
- frontend/backend regression;
- production build;
- GitHub CI;
- owner final review;
- merge;
- `phase-4-complete` tag only after owner approval.

---

## 5. Identity Model

### 5.1 `users`

A `users` row represents an actual activated Clinora account, except a Patient may exist temporarily while waiting for email verification.

Recommended fields:

```text
id                  UUID PK
first_name          VARCHAR
last_name           VARCHAR
email               VARCHAR
password_hash       VARCHAR
role                VARCHAR/enum representation
account_status      VARCHAR/enum representation
email_verified_at   TIMESTAMPTZ nullable
last_login_at       TIMESTAMPTZ nullable
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
deactivated_at      TIMESTAMPTZ nullable
```

Recommended account states:

```text
PENDING_EMAIL_VERIFICATION
ACTIVE
SUSPENDED
DEACTIVATED
```

Doctor/Researcher applicants should normally remain in application tables until activation; they do not need placeholder privileged user accounts.

### 5.2 Email normalization

- trim;
- lowercase using locale-independent behavior;
- preserve original display form only if necessary;
- enforce a database-level uniqueness rule on normalized/lowercase email.

Backend is authoritative.

---

## 6. Patient Registration Model

Endpoint:

```text
POST /api/v1/auth/register
```

Request:

```json
{
  "firstName": "Amina",
  "lastName": "Rahman",
  "email": "amina@example.com",
  "password": "StrongPassword#123"
}
```

The request contains **no role field**.

Backend behavior:

```text
validate
 -> normalize email
 -> reject duplicate
 -> hash password
 -> create user with role PATIENT
 -> PENDING_EMAIL_VERIFICATION
 -> generate one-time verification token
 -> persist token hash
 -> send verification email
```

A modified client payload must never be able to create `DOCTOR`, `RESEARCHER`, or admin roles.

---

## 7. Doctor Application Model

Public entry point:

```text
/apply/doctor
```

No password is collected as the Doctor's final Clinora password during application.

Recommended Doctor data:

```text
first name
last name
email
phone
country/jurisdiction
medical registration/license number
specialization
years of experience
current practice/professional information
CV
license/registration evidence
qualification evidence
optional additional documents
```

Recommended application states:

```text
EMAIL_PENDING
DRAFT
SUBMITTED
UNDER_REVIEW
MORE_INFO_REQUIRED
INTERVIEW_REQUIRED
INTERVIEW_SCHEDULED
INTERVIEW_COMPLETED
APPROVED
REJECTED
ACTIVATION_PENDING
ACTIVATED
WITHDRAWN
```

Transition rule:

```text
Doctor cannot be APPROVED unless the mandatory interview is COMPLETED.
```

Legal credential criteria remain configurable and are not invented by the software.

---

## 8. Researcher Application Model

Public entry point:

```text
/apply/researcher
```

Recommended fields:

```text
full name
email
phone/contact
institution/organization
professional title
research field
research purpose
supporting documents when required
ethics/approval reference when relevant
```

Researcher interview:

```text
NONE
```

Researcher account approval does not grant research datasets.

Future dataset/project approval remains a separate Research module concern.

---

## 9. Applicant Portal Security

Doctor/Researcher applicants are not authenticated Clinora users before approval.

Therefore Phase 4C should not give them normal JWT user sessions.

Recommended mechanism:

```text
application email verification / resume link
        |
        v
one-time APPLICATION_PORTAL token
        |
        v
backend validates token
        |
        v
short-lived scoped applicant HttpOnly session cookie
        |
        v
applicant may access only their own application
```

Recommended scoped capabilities:

- complete draft;
- upload supporting documents;
- submit application;
- see status;
- see information requests;
- see Doctor interview details and request interview reschedule only for Doctor applications after Phase 4D enables them;
- withdraw where allowed.

The applicant session has no RBAC role and cannot access `/auth/me` or protected user APIs.

Do not reuse:

- password-reset token;
- account-activation token;
- email-verification token

as a long-lived applicant portal credential.

---

## 10. Authentication Token Architecture

### 10.1 Access token

Use JWT only for short-lived authenticated API access.

Recommended claims:

```text
sub  = user UUID
role = canonical Clinora role
jti  = unique token ID
iat
exp
```

Avoid unnecessary PII such as full name/email in the JWT.

Recommended implementation:

- Spring Security OAuth2 Resource Server/Jose support;
- Spring-managed `JwtEncoder` / `JwtDecoder`;
- no custom authentication framework.

### 10.2 Refresh session

Use an opaque high-entropy refresh token, not a long-lived browser JWT.

Recommended token wire format:

```text
<session-id>.<random-secret>
```

- session ID is non-secret;
- secret is cryptographically random;
- PostgreSQL stores only a SHA-256/secure hash of the secret;
- cookie contains raw token;
- refresh rotates the secret;
- server can identify the session even when an old token is replayed.

This permits practical replay/reuse detection without storing raw refresh tokens.

### 10.3 Cookie

Recommended name:

```text
clinora_refresh
```

Production:

```text
HttpOnly = true
Secure   = true
SameSite = Lax when frontend/api use same-site custom domains
```

Development localhost:

```text
HttpOnly = true
Secure   = false
SameSite = Lax
```

CORS must use exact allowed origins and credentials; never `*` with cookies.

For production, prefer:

```text
https://clinora.ai
https://api.clinora.ai
```

so frontend and API remain same-site even when frontend is deployed through Vercel.

### 10.4 CSRF position

Normal protected API calls use Bearer access tokens and are not cookie-authenticated.

Refresh/logout cookie endpoints shall additionally enforce:

- SameSite policy;
- strict configured frontend origins;
- Origin validation.

If deployment later requires `SameSite=None` cross-site cookies, add a dedicated CSRF token mechanism before production.

---

## 11. Session Model

Recommended `auth_sessions` fields:

```text
id                    UUID PK
user_id               UUID FK
current_token_hash    VARCHAR
previous_token_hash   VARCHAR nullable
previous_valid_until  TIMESTAMPTZ nullable
created_at            TIMESTAMPTZ
last_used_at          TIMESTAMPTZ
expires_at            TIMESTAMPTZ
revoked_at            TIMESTAMPTZ nullable
revoke_reason         VARCHAR nullable
user_agent            VARCHAR nullable
ip_address            INET/VARCHAR nullable
```

Behavior:

- login creates session;
- refresh rotates secret;
- logout revokes current session;
- password reset revokes all sessions;
- user can inspect sessions;
- user can revoke another session;
- user can revoke all other sessions;
- suspended/deactivated account cannot refresh.

---

## 12. One-Time Tokens

Recommended separate tables:

```text
email_verification_tokens
password_reset_tokens
application_email_tokens
account_activation_tokens
```

Common rules:

```text
UUID id
subject reference
token_hash
expires_at
consumed_at
created_at
```

Only hashes are stored.

Raw tokens must never appear in application logs.

Recommended initial TTLs requiring owner approval:

```text
Patient email verification     24 hours
Application email verification 24 hours
Password reset                 30 minutes
Account activation             48 hours
Applicant portal magic link    30 minutes to establish scoped session
Applicant scoped session       24 hours
```

---

## 13. Password Security

Use Spring Security BCrypt.

Recommended:

```text
BCrypt strength: 12
```

Password policy:

```text
minimum 8 chars
uppercase
lowercase
digit
special character
```

Backend is authoritative.

Session behavior recommendation:

```text
Forgot/reset password:
  revoke every active session

Authenticated change password:
  revoke all other sessions
  rotate the current refresh session
```

---

## 14. Phase 4 API Plan

### 14.1 Patient/auth APIs

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/verify-email
POST   /api/v1/auth/resend-verification
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
PATCH  /api/v1/auth/change-password
GET    /api/v1/auth/me
GET    /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/{sessionId}
POST   /api/v1/auth/sessions/revoke-others
```

### 14.2 Application APIs

Initial application creation:

```text
POST /api/v1/access-applications/doctor
POST /api/v1/access-applications/researcher
```

Email/access:

```text
POST /api/v1/access-applications/verify-email
POST /api/v1/access-applications/access-link
```

Scoped applicant portal:

```text
GET    /api/v1/access-applications/me
PATCH  /api/v1/access-applications/me
POST   /api/v1/access-applications/me/documents
DELETE /api/v1/access-applications/me/documents/{documentId}
POST   /api/v1/access-applications/me/submit
POST   /api/v1/access-applications/me/withdraw
GET    /api/v1/access-applications/me/interview
POST   /api/v1/access-applications/me/interview/reschedule-request
```

The exact DTO differs for Doctor and Researcher.

### 14.3 System Admin access review

```text
GET  /api/v1/admin/access-applications
GET  /api/v1/admin/access-applications/{id}

POST /api/v1/admin/access-applications/{id}/request-info
POST /api/v1/admin/access-applications/{id}/approve
POST /api/v1/admin/access-applications/{id}/reject

POST  /api/v1/admin/access-applications/{id}/interviews
PATCH /api/v1/admin/access-applications/{id}/interviews/{interviewId}
```

All admin endpoints require:

```text
ROLE_SYSTEM_ADMIN
```

and produce audit events.

### 14.4 Account activation

```text
POST /api/v1/auth/activate-account
```

Request:

```json
{
  "token": "...",
  "password": "StrongPassword#123"
}
```

Backend:

```text
validate activation token
 -> verify approved source application/bootstrap
 -> ensure email/user uniqueness
 -> BCrypt password
 -> create/activate User
 -> assign approved role
 -> consume token
 -> mark application ACTIVATED
 -> audit
```

---

## 15. API Response and Error Model

Keep a stable envelope:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Request could not be completed",
  "errorCode": "SOME_STABLE_CODE",
  "fieldErrors": {}
}
```

Recommended auth/application error codes include:

```text
INVALID_CREDENTIALS
EMAIL_VERIFICATION_REQUIRED
ACCOUNT_SUSPENDED
ACCOUNT_DEACTIVATED
TOKEN_INVALID
TOKEN_EXPIRED
TOKEN_ALREADY_USED
PASSWORD_POLICY_FAILED
SESSION_REVOKED
RATE_LIMITED
APPLICATION_NOT_EDITABLE
APPLICATION_NOT_READY_FOR_REVIEW
INTERVIEW_REQUIRED
INTERVIEW_NOT_COMPLETED
ACCESS_DENIED
```

Forgot-password and application-access-link responses must remain enumeration-resistant.

---

## 16. Database Migration Forecast

Recommended migration sequence:

```text
V1__create_users_and_role_constraints.sql
V2__create_auth_sessions.sql
V3__create_auth_one_time_tokens.sql
V4__create_auth_audit_events.sql
V5__create_access_applications.sql
V6__create_application_detail_tables.sql
V7__create_application_documents.sql
V8__create_applicant_sessions.sql
V9__create_doctor_interviews.sql
V10__create_account_activation_tokens.sql
```

Migration numbering must be adapted to whatever Flyway version already exists on current `main`.

No Hibernate auto-DDL creation; keep:

```text
ddl-auto: validate
```

---

## 17. Access Application Schema

Recommended common table:

```text
access_applications
-------------------
id
application_type          DOCTOR | RESEARCHER
first_name
last_name
email
phone
country_code
status
email_verified_at
submitted_at
reviewer_user_id
review_started_at
decision_at
public_decision_message
internal_review_notes
created_at
updated_at
version
```

Recommended Doctor one-to-one detail:

```text
doctor_application_details
--------------------------
application_id
medical_license_number
specialization
years_experience
current_practice
```

Recommended Researcher one-to-one detail:

```text
researcher_application_details
------------------------------
application_id
institution
professional_title
research_field
research_purpose
ethics_reference
```

This avoids a generic table full of role-specific nullable columns.

---

## 18. Application Document Model

```text
application_documents
---------------------
id
application_id
document_type
object_key
original_filename
mime_type
size_bytes
sha256_checksum
review_status
reviewer_user_id
reviewed_at
created_at
```

Recommended MVP Doctor document types:

```text
CV
MEDICAL_LICENSE
QUALIFICATION
OTHER
```

Recommended Researcher types:

```text
INSTITUTIONAL_EVIDENCE
ETHICS_OR_PROJECT_APPROVAL
CV
OTHER
```

Software-level validation is not a claim of legal credential validity.

Recommended MVP upload types:

```text
PDF
JPG/JPEG
PNG
```

Prefer PDF for CVs.

Application document storage must be private and backend-authorized.

---

## 19. S3-Compatible Storage Plan for Phase 4C

Recommended architecture:

```text
Frontend
  -> Spring Boot
       -> StoragePort
            -> S3-compatible adapter
```

Suggested local-development option:

```text
MinIO
```

Suggested production principle:

```text
provider configurable
AWS S3 / another approved S3-compatible provider later
```

Use a separate bucket/prefix for application documents, not the future medical-report bucket.

Suggested environment keys:

```text
S3_APPLICATION_BUCKET=clinora-access-documents
S3_ENDPOINT=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
```

Do not expose bucket credentials to React.

---

## 20. Email Architecture

Use an interface such as:

```text
EmailDeliveryPort
```

Methods conceptually:

```text
sendPatientVerification(...)
sendPasswordReset(...)
sendApplicationVerification(...)
sendApplicationMoreInfo(...)
sendInterviewScheduled(...)
sendInterviewRescheduled(...)
sendInterviewCancelled(...)
sendInterviewReminder(...)
sendApplicationApproved(...)
sendApplicationRejected(...)
sendAccountActivation(...)
```

Recommended implementation approach:

- fake/in-memory adapter in automated tests;
- real provider adapter in local manual/staging/production;
- provider configuration through environment;
- use existing Spring `WebClient` for provider REST API when possible;
- do not expose provider SDK/API key to frontend.

Recommended first real provider:

```text
Resend
```

but business code must depend only on the Clinora email interface.

A provider failure must not create a privileged account or silently mark a verification/activation completed.

---

## 21. Localhost Real-Email Plan

Local frontend:

```text
http://localhost:5173
```

Local backend:

```text
http://localhost:8080
```

Example:

```text
APP_FRONTEND_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

Spring Boot calls the real email provider over the Internet.

Verification/reset/application links may point to localhost for same-machine manual testing.

Later Vercel:

```text
APP_FRONTEND_URL=https://clinora.ai
VITE_API_BASE_URL=https://api.clinora.ai/api/v1
```

No authentication business-code rewrite is required.

---

## 22. Frontend Route Plan

### Auth

```text
/login
/register
/verify-email
/forgot-password
/reset-password
/activate-account
/account
```

### Applications

```text
/apply/doctor
/apply/researcher
/application/email-verification
/application/status
/application/interview
```

### Minimal System Admin

```text
/admin/access-reviews
/admin/access-reviews/:applicationId
```

No full dashboard navigation is required.

---

## 23. Frontend State Plan

### Auth Zustand store

Recommended state:

```text
status:
  unknown | anonymous | authenticated

accessToken:
  memory only

user:
  id
  firstName
  lastName
  role
  accountStatus
  emailVerified

sessions:
  loaded on account/security page only
```

Startup:

```text
App loads
 -> refresh endpoint with credentials
 -> if successful, receive new access token
 -> load /me
 -> authenticated
 -> otherwise anonymous
```

Axios:

- base URL from `VITE_API_BASE_URL`;
- `withCredentials` only where needed/configured;
- attach access token from memory;
- one single-flight refresh when a request returns 401;
- retry original request once;
- never create refresh loops.

### Applicant state

Keep applicant portal state separate from user auth.

Applicant session is cookie/scoped server session, not a User JWT.

---

## 24. Auth UI Direction

Auth pages should extend the published Clinora public identity rather than resemble a generic admin form.

Recommended layout:

```text
Desktop:
  focused biomedical context panel | glass form panel

Mobile:
  compact biomedical header
  form
```

Use:

- existing DNA/molecular/cellular brand language;
- low-motion background;
- existing buttons/inputs/cards;
- visible validation;
- accessible form labels;
- password visibility toggle;
- loading/disabled submit;
- clear success/error states;
- reduced-motion support.

Do not overwhelm forms with hero-level animation.

---

## 25. Doctor Application UI

Recommended form stages:

```text
1. Identity & contact
2. Professional information
3. Credentials/documents
4. Review & submit
```

After submission:

```text
Application Status
------------------
Submitted
Under review
More information required
Interview required/scheduled
Decision
```

Doctor interview view:

```text
date
time
timezone
duration
provider
private Join Interview button
instructions
reschedule request
status
```

Meeting URL must never be rendered in public HTML/metadata.

---

## 26. Researcher Application UI

Recommended stages:

```text
1. Identity/contact
2. Institution & professional role
3. Research field & purpose
4. Supporting evidence
5. Review & submit
```

Status page mirrors the common application system.

Researcher interview UI is not part of the Clinora access lifecycle. Reviewers may request more information, approve, or reject according to the authorized Researcher flow.

---

## 27. System Admin Review UI

Minimal workbench only:

```text
Access Reviews

Tabs/filters:
  Doctor
  Researcher

Statuses:
  Submitted
  Under Review
  More Info
  Interview
  Activation Pending
  Completed/Rejected
```

Application detail:

```text
identity
application data
documents
review history
interview
internal notes
audit-safe actions
```

Actions are explicit and destructive decisions require confirmation.

Do not add unrelated platform analytics/AI/blood/hospital administration.

---

## 28. Doctor Interview Scheduler

Admin creates:

```text
date
time
IANA timezone
duration
provider: GOOGLE_MEET | ZOOM | OTHER
meeting URL
applicant-facing instructions
```

Persist:

```text
scheduled_at_utc
timezone
duration_minutes
meeting_provider
meeting_url
status
interviewer_user_id
instructions
internal_notes
completed_at
```

Recommended default duration:

```text
30 minutes
```

Recommended reminder policy requiring owner approval:

```text
24 hours before
1 hour before
```

Use a persistent database-backed reminder state; do not use sleeping threads.

Automatic Google/Zoom API creation is deferred.

---

## 29. System Admin Bootstrap Proposal

Recommended Phase 4 mechanism:

```text
one-time backend bootstrap command/profile
        |
        v
operator supplies System Admin email only
        |
        v
backend verifies no System Admin exists
        |
        v
creates one-time SYSTEM_ADMIN activation token
        |
        v
sends activation email
        |
        v
owner chooses password
        |
        v
SYSTEM_ADMIN created/activated
```

Rules:

- no public bootstrap endpoint;
- no plaintext admin password in Git;
- bootstrap refuses once a System Admin exists;
- bootstrap event is audited.

---

## 30. Rate-Limit Proposal

Implement with Redis counters/expiry using existing Redis support; avoid adding a broad new rate-limit framework unless needed.

Recommended starting limits:

```text
Login:
  5/minute/IP
  10/15-minutes/email-hash

Patient register:
  5/hour/IP
  3/hour/email-hash

Forgot password:
  10/hour/IP
  3/hour/email-hash

Resend verification:
  10/hour/IP
  3/hour/email-hash
  60-second cooldown

Refresh:
  60/hour/session

Doctor/Researcher application start:
  10/day/IP
  3/day/email-hash

Applicant access-link:
  10/hour/IP
  5/hour/email-hash
```

Rate-limit keys should not contain raw email addresses; use a stable keyed hash.

Responses should use generic `429 RATE_LIMITED`.

---

## 31. Audit Event Model

Recommended events:

```text
PATIENT_REGISTERED
EMAIL_VERIFICATION_SENT
EMAIL_VERIFIED
LOGIN_SUCCEEDED
LOGIN_FAILED
TOKEN_REFRESHED
LOGOUT
PASSWORD_RESET_REQUESTED
PASSWORD_RESET_COMPLETED
PASSWORD_CHANGED
SESSION_REVOKED

APPLICATION_STARTED
APPLICATION_EMAIL_VERIFIED
APPLICATION_SUBMITTED
APPLICATION_VIEWED_BY_REVIEWER
APPLICATION_MORE_INFO_REQUESTED
APPLICATION_DOCUMENT_REVIEWED
INTERVIEW_SCHEDULED
INTERVIEW_RESCHEDULED
INTERVIEW_CANCELLED
INTERVIEW_COMPLETED
APPLICATION_APPROVED
APPLICATION_REJECTED
ACCOUNT_ACTIVATED
ACCOUNT_SUSPENDED
ACCOUNT_REACTIVATED
```

Audit stores:

```text
actor user ID when known
application/user/resource ID
event type
timestamp
IP
user agent
outcome
non-sensitive metadata
```

Never store passwords, raw tokens, Authorization headers, or private meeting URLs in general audit metadata.

---

## 32. Spring Boot Package Forecast

Adapt naming to current repository conventions.

Recommended:

```text
com.clinora.users
  domain
  repository
  service
  api/dto

com.clinora.auth
  api
  dto
  service
  session
  token
  repository

com.clinora.security
  jwt
  principal
  config
  ratelimit

com.clinora.access
  api
  application
  domain
  repository
  documents
  interview

com.clinora.admin
  accessreview

com.clinora.notifications
  email

com.clinora.audit

com.clinora.storage
```

Controllers stay thin; services own business rules; repositories own persistence.

---

## 33. Dependency Forecast

Already present in the uploaded foundation:

- Spring Security;
- Spring Data JPA;
- PostgreSQL;
- Flyway;
- Validation;
- Redis;
- WebClient/WebFlux;
- Springdoc;
- test infrastructure.

Likely new Phase 4 dependencies:

### Phase 4A

```text
spring-boot-starter-oauth2-resource-server
```

Purpose: supported JWT encoding/decoding/security primitives.

No third-party JWT framework should be added unless Spring facilities prove insufficient.

### Phase 4C

One S3-compatible Java client dependency, preferably:

```text
AWS SDK v2 S3
```

configured with endpoint override so it can work with local MinIO and later S3-compatible production storage.

Avoid introducing an email SDK if the provider REST API can be called using existing `WebClient`.

---

## 34. Testing Plan

### Backend unit tests

- password policy/hash;
- email normalization;
- token generation/hash/expiry;
- JWT claims;
- session rotation;
- application state transitions;
- Doctor mandatory interview rule;
- Researcher no-interview rule;
- activation eligibility;
- admin-only decision rules.

### Backend integration/security tests

- Patient registration;
- payload cannot self-assign privileged role;
- email verification;
- login before verification denied;
- login success;
- invalid credentials generic;
- access token validation/expiry;
- refresh rotation;
- old refresh replay;
- logout;
- password reset;
- change password;
- sessions/revocation;
- rate limits;
- Doctor application;
- Researcher application;
- applicant portal isolation;
- document authorization;
- admin review authorization;
- Doctor cannot be approved before completed interview;
- activation token one-time;
- final role assignment;
- pending/rejected applicant cannot login as privileged user.

### Frontend tests

- all auth forms;
- validation;
- loading/disabled state;
- API errors;
- login;
- auth restoration;
- logout;
- protected route;
- verification/reset/activation states;
- Doctor multi-step application;
- Researcher application;
- application status;
- interview privacy/view;
- admin review permissions UI;
- keyboard/focus;
- reduced motion.

### Manual acceptance

- real Gmail/Outlook verification from localhost;
- reset email from localhost;
- Doctor application email;
- Doctor interview email with real Meet/Zoom link;
- approval + activation email;
- Vercel-compatible environment configuration review.

---

## 35. Git / Publication Strategy

Because Phase 4 is materially larger than previous phases, use separate reviewable branches/PRs:

```text
phase-4a-auth-foundation
phase-4b-patient-auth
phase-4c-access-applications
phase-4d-access-review
phase-4e-security-hardening
```

Each PR:

- starts from current clean `main`;
- contains only that subphase;
- passes CI;
- receives owner review before merge.

Do not create `phase-4-complete` until Phase 4E is merged and the complete Phase 4 acceptance suite passes.

Subphase tags are optional; the required final tag is:

```text
phase-4-complete
```

---

## 36. Implementation Order

Strict dependency order:

```text
4A
User/schema/security/JWT/session/token/email/rate-limit foundation
        |
        v
4B
Patient register/verify/login/password/session/frontend auth
        |
        v
4C
Doctor/Researcher applicant model + portal + documents
        |
        v
4D
System Admin review + interview + approval + activation
        |
        v
4E
Hardening + regression + CI + owner publication gate
```

Do not start 4C before 4B security primitives are stable.

Do not start 4D before applicant state/document workflows are stable.

---

## 37. Owner Decisions to Lock Before Implementation

Recommended values are provided so the owner can approve the bundle rather than design each value from scratch.

### Decision A — Token lifetime

Recommended:

```text
Access token: 15 minutes
Refresh session: 7 days
```

### Decision B — Role cardinality

Recommended for Phase 4 simplicity:

```text
one active Clinora role per account
```

Do not implement multi-role switching in Phase 4.

This can be revisited by an explicit later SRS update.

### Decision C — Token TTLs

Recommended:

```text
Patient verification: 24h
Application email verification: 24h
Password reset: 30m
Account activation: 48h
Applicant access magic link: 30m
Applicant scoped session: 24h
```

### Decision D — Real email provider

Recommended:

```text
provider abstraction
+
Resend adapter for real local/staging/production testing
```

Automated tests use a fake adapter.

### Decision E — Application document local storage

Recommended:

```text
MinIO locally
S3-compatible adapter
provider configurable in production
```

### Decision F — System Admin bootstrap

Recommended:

```text
one-time backend bootstrap command/profile
-> activation email
-> owner chooses password
-> automatically unavailable once an admin exists
```

### Decision G — Doctor interview defaults

Recommended:

```text
30-minute duration
24h reminder
1h reminder
manual Meet/Zoom/Other URL
```

### Decision H — Password/session behavior

Recommended:

```text
Password reset:
  revoke all sessions

Authenticated password change:
  revoke other sessions
  rotate current session
```

### Decision I — Rate limits

Use the proposed Redis limits in Section 30 initially, configuration-driven.

### Decision J — Doctor software-level documents

Recommended MVP submission requirements:

```text
CV: required
medical license/registration evidence: required
qualification evidence: at least one
other evidence: optional/admin-requested
```

These are workflow requirements only and do not define jurisdictional legal validity.

### Decision K — Researcher baseline

Recommended:

```text
institution + role + research field + purpose required
supporting docs configurable
interview optional
no dataset access in Phase 4
```

---

## 38. Phase 4 Planning Approval Gate

Implementation must not begin until:

1. Phase 3 is confirmed merged/tagged/clean on the real local repository.
2. The new Phase 4 SRS update is placed in the repository.
3. The owner approves or modifies Decisions A–K above.
4. The Phase 4A branch is created from current `main`.
5. Implementation authorization explicitly states **Phase 4A only**.

After approval, the first implementation target is:

```text
PHASE 4A — AUTHENTICATION FOUNDATION
```

No Doctor/Researcher UI, Patient signup UI, or Admin review UI should be implemented in Phase 4A.

---

**PHASE 4 PLANNING DRAFT COMPLETE — WAITING FOR OWNER DECISION LOCK**
