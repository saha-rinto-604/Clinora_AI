# Clinora AI — Phase 4 Authentication, Access Applications & Role Model SRS Update

**Document status:** OWNER-DIRECTED SRS UPDATE
**Version:** 1.0
**Date:** 2026-08-07
**Applies to:** Phase 4 authentication/access-control implementation and all future role/onboarding decisions that depend on it
**Intended repository path:** `docs/development/phase-4-role-auth-srs-update.md`

---

## 1. Purpose and Authority

This document records owner-approved product-direction changes made after the original Clinora AI SRS, User Manual, UI/UX Plan, and Codex Development Manual were written.

It exists specifically to prevent future development agents, Codex sessions, or maintainers from blindly reintroducing outdated assumptions from the legacy documents.

### 1.1 Authority order for the topics covered here

For **Phase 4, identity, authentication, role onboarding, Doctor/Researcher approval, and hospital dependency**, use the following precedence:

1. **This Phase 4 Role/Auth SRS Update**
2. Owner-approved architecture/baseline documents in `docs/development/`
3. Original Full SRS
4. Original User Manual
5. UI/UX Plan
6. Codex Development Manual
7. MedGemma local setup guide only as an auxiliary historical reference

If an older document conflicts with this update on a topic explicitly covered here, **this update wins**.

### 1.2 Mandatory future-agent rule

Before changing authentication, registration, Doctor onboarding, Researcher onboarding, RBAC, protected routes, role provisioning, or related schema/API contracts:

- Read this file first.
- Do not restore a legacy rule merely because it appears in the old SRS.
- Do not make Hospitals mandatory for Doctor accounts, patient care, appointments, report sharing, OCR review, or AI review.
- Do not allow privileged roles to become active merely through email verification.
- Do not create new role/onboarding assumptions without explicit owner approval.

---

## 2. Product Direction Update — Clinora Is the Primary Care Platform

Clinora shall be designed as an independent healthcare/clinic-style platform that can operate without participation from external hospitals.

The core system is:

```text
Patient
   ↕
Clinora
   ↕
Approved Doctor
```

Supporting platform capabilities include:

```text
Patient
  → medical reports
  → OCR
  → doctor discovery
  → appointment
  → selected report sharing
  → consultation
  → prescription / follow-up

Approved Doctor
  → professional profile
  → availability
  → appointments
  → authorized patient reports
  → OCR review
  → AI Clinical Intelligence review
  → consultation
  → prescription / follow-up

Approved Researcher
  → governed research tools
  → approved projects
  → approved anonymized datasets
```

### 2.1 Hospital independence

The following legacy assumptions are **superseded** for the current Clinora core:

- A Doctor does **not** have to belong to a registered Hospital to have a Clinora Doctor account.
- A Hospital does **not** approve which Doctor a Patient can book.
- A Hospital does **not** determine which Doctor can see a Patient's medical report.
- Hospital participation is **not** a prerequisite for Patient ↔ Doctor clinical workflows.
- Mandatory `hospital_id` / `department_id` on the Doctor identity/profile are not permitted as Phase 4 requirements.

Hospital functionality may be reconsidered in a future owner-approved module, but it must remain optional to the core Clinora care system unless a later SRS update explicitly changes this rule.

### 2.2 Explicit legacy rules superseded

| Legacy assumption | Updated rule |
|---|---|
| “Every doctor must belong to a registered hospital.” | **Superseded.** Clinora Doctors are independent Clinora providers after Clinora approval. |
| Doctor profile requires one `hospital_id` and one `department_id`. | **Superseded for current core.** Hospital linkage is not part of Phase 4 identity. |
| All roles may register ordinary accounts directly. | **Superseded.** Patient registers directly; Doctor/Researcher apply and require approval; admin/organization roles are not public signup. |
| Email verification is sufficient to activate every role. | **Superseded.** Email verification proves email ownership only. |
| Phase 4 uses only Patient/Doctor/Researcher/Administrator roles. | **Superseded.** The canonical enum remains the six approved roles listed below. |
| NestJS/Prisma/Passport-style authentication implementation. | **Superseded by owner architecture.** Use Spring Boot/Spring Security/JPA/Flyway. |

---

## 3. Canonical Role Model

The canonical Clinora RBAC enum remains:

```text
PATIENT
DOCTOR
HOSPITAL_ADMIN
RESEARCHER
BLOOD_BANK_STAFF
SYSTEM_ADMIN
```

### 3.1 Current active product roles

The current product direction actively designs workflows for:

- `PATIENT`
- `DOCTOR`
- `RESEARCHER`
- `SYSTEM_ADMIN`

### 3.2 Reserved roles

For now:

- `HOSPITAL_ADMIN`
- `BLOOD_BANK_STAFF`

remain reserved role values for future modules.

They shall **not** receive public registration/onboarding flows during Phase 4.

They shall **not** be deleted from the enum merely because their workflows are deferred.

### 3.3 Applicant is not a role

Do **not** create RBAC roles such as:

```text
DOCTOR_APPLICANT
RESEARCHER_APPLICANT
PENDING_DOCTOR
PENDING_RESEARCHER
```

Application state is business workflow state, not authorization role.

A person becomes `DOCTOR` or `RESEARCHER` only after the required approval and account activation.

---

## 4. Identity Concepts Must Remain Separate

Clinora must distinguish the following concepts:

### 4.1 Email verification

Answers only:

> Does this applicant/user control this email address?

Email verification does **not** prove:

- medical license validity;
- Doctor suitability;
- institutional research affiliation;
- legal entitlement to practice medicine;
- legal entitlement to access research datasets.

### 4.2 Professional/access application review

Answers:

> Has Clinora reviewed and approved this person for a privileged Clinora role?

Required for:

- Doctor
- Researcher

### 4.3 Account activation

Answers:

> May this approved person create credentials and sign in?

For Doctor/Researcher, account activation occurs **after approval**.

### 4.4 Authorization

Answers:

> What may this authenticated user access?

Authorization is enforced by backend RBAC plus resource-level access rules.

These four concepts must never be collapsed into a single `verified` flag.

---

## 5. Public Entry Points

The public application/authentication experience shall present:

```text
Patient
[Create Account]

Doctor
[Apply as a Doctor]

Researcher
[Apply for Research Access]

Existing approved user
[Login]
```

There shall not be a public role selector that allows arbitrary assignment of privileged roles.

---

## 6. Patient Registration Workflow

Patient registration is direct self-service registration.

### 6.1 Flow

```text
Create Patient Account
      ↓
Enter identity + email + password
      ↓
Create PATIENT account
      ↓
accountStatus = PENDING_EMAIL_VERIFICATION
      ↓
Send one-time email verification link
      ↓
Patient verifies email
      ↓
accountStatus = ACTIVE
      ↓
Patient may login
```

### 6.2 Minimum patient registration data

Phase 4 should collect only authentication-relevant data:

- first name;
- last name;
- email;
- password;
- password confirmation on frontend;
- optional phone if owner retains phone in the Phase 4 identity form;
- acceptance of applicable Terms/Privacy controls if required by product/legal review.

Do not collect the full Patient medical profile during Phase 4.

### 6.3 Password rule

Clinora must never email a password to a Patient.

The Patient creates their own password.

---

## 7. Doctor Application and Approval Workflow

A Doctor does **not** obtain the `DOCTOR` role through ordinary registration.

The public action is:

```text
Apply as a Doctor
```

### 7.1 Doctor onboarding flow

```text
Doctor application started
        ↓
Applicant provides email
        ↓
Email verification link
        ↓
Email ownership verified
        ↓
Professional application completed
        ↓
CV + professional credentials submitted
        ↓
Application submitted
        ↓
Clinora administrative review
        ↓
Interview required
        ↓
Interview scheduled
        ↓
Interview completed
        ↓
APPROVE / REJECT / REQUEST MORE INFORMATION
        ↓
If approved:
one-time account activation link
        ↓
Doctor chooses password
        ↓
Clinora creates/activates DOCTOR account
        ↓
Doctor may login
```

### 7.2 Doctor application information

The software shall support collection of appropriate professional information, including at minimum:

- full legal/professional name;
- verified email;
- phone/contact information;
- country/jurisdiction;
- medical registration/license number;
- specialization;
- years of experience;
- current professional/practice information where relevant;
- CV/resume;
- qualification/credential evidence;
- additional supporting documents requested by an authorized Clinora reviewer.

### 7.3 Legal/credentialing boundary

Clinora software shall support a review workflow, but this SRS update does **not** define a universal legal credentialing standard.

The exact documents, external verification sources, professional-license validation rules, retention requirements, consent language, and legal eligibility criteria must be approved for the jurisdiction in which Clinora is deployed.

The application system must therefore be configurable enough to support jurisdiction-specific review policies.

### 7.4 Doctor application states

Recommended canonical workflow states:

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

Application state is separate from account state.

### 7.5 No hospital dependency

Doctor approval is performed by Clinora's authorized review process.

A Hospital account is not required.

A Doctor does not need to be recruited by a Hospital through Clinora.

Clinora is not currently a hospital job marketplace.

---

## 8. Doctor Interview Scheduler

Doctor approval shall include an interview scheduling capability.

### 8.1 Purpose

The scheduler supports Clinora's professional onboarding/review process.

It is **not** a Hospital recruitment interview system.

### 8.2 Interview data

The interview record shall support:

- application ID;
- scheduled date/time;
- start instant stored in UTC;
- explicit IANA timezone for display/context;
- duration;
- interview status;
- meeting provider;
- private meeting URL;
- interviewer/reviewer identity where available;
- applicant-facing instructions;
- internal reviewer notes;
- creation/update timestamps;
- completion timestamp;
- cancellation/reschedule metadata.

### 8.3 Meeting providers

Initial Phase 4 support shall allow a reviewer to provide a meeting link manually for:

```text
GOOGLE_MEET
ZOOM
OTHER
```

Automatic Google Meet/Zoom API integration is **not required for the first implementation**.

Do not introduce Google/Zoom OAuth integrations merely to implement the Phase 4 scheduler.

### 8.4 Interview status

Recommended states:

```text
SCHEDULED
RESCHEDULE_REQUESTED
RESCHEDULED
CANCELLED
COMPLETED
NO_SHOW
```

### 8.5 Applicant visibility

The Doctor applicant shall be able to receive/view:

- interview date;
- interview time;
- timezone;
- duration;
- meeting provider;
- meeting URL;
- instructions;
- reschedule/cancellation information.

The meeting URL must not appear on a public Doctor profile or public application page.

### 8.6 Notifications

Clinora should support transactional email notifications for:

- interview scheduled;
- interview rescheduled;
- interview cancelled;
- interview reminder;
- more information requested;
- application approved;
- application rejected;
- account activation.

Exact reminder timing shall remain configuration-driven.

---

## 9. Researcher Application and Approval Workflow

A Researcher does **not** obtain `RESEARCHER` privileges merely by verifying an email.

The public action is:

```text
Apply for Research Access
```

### 9.1 Flow

```text
Research application started
       ↓
Email verification
       ↓
Institutional/research information
       ↓
Research purpose
       ↓
Supporting evidence/documents
       ↓
SUBMITTED
       ↓
Clinora Admin review
       ↓
Optional interview / more information if required
       ↓
APPROVED / REJECTED
       ↓
If approved:
one-time account activation link
       ↓
Researcher chooses password
       ↓
RESEARCHER account activated
```

### 9.2 Researcher application information

The application system should support:

- full name;
- verified email;
- institution/organization;
- professional title/role;
- research field;
- proposed research purpose;
- relevant institutional or project information;
- supporting documentation when required;
- ethics/approval references where relevant to a later research request.

### 9.3 Researcher account approval is not dataset approval

After a person becomes an approved `RESEARCHER`, that person still does not gain unrestricted access to Clinora data.

Separate future research controls remain required:

```text
Approved Researcher
      ↓
Research Project
      ↓
Project Approval
      ↓
Dataset Request
      ↓
Dataset Approval
      ↓
Anonymization / privacy controls
      ↓
Authorized research access
```

Researchers must never receive ordinary identifiable Patient records merely because they hold the `RESEARCHER` role.

### 9.4 Interview policy

Doctor interviews are part of the approved Doctor onboarding flow.

Researcher interviews are **optional**, triggered by review policy rather than mandatory for every application.

---

## 10. System Administrator Role in Phase 4

`SYSTEM_ADMIN` is responsible for the access-governance functions required by Phase 4.

A minimal Phase 4 access-review interface may include:

- Doctor application queue;
- Researcher application queue;
- application detail review;
- document review status;
- request-more-information action;
- Doctor interview scheduling/rescheduling;
- reviewer notes;
- approve;
- reject;
- activation issuance;
- account suspend/reactivate where required;
- authentication/security audit visibility required for Phase 4.

This is a **minimal access-governance workbench**, not authorization to implement the complete future System Administration module.

### 10.1 System Admin provisioning

`SYSTEM_ADMIN` must never be obtainable through anonymous/public registration.

The initial System Admin shall be created through a secure internal/bootstrap process.

The exact production bootstrap mechanism must be finalized before deployment and must not place plaintext administrative credentials in Git.

---

## 11. Login Model

Clinora shall use one common login page:

```text
/login
```

There shall not be separate:

```text
/patient-login
/doctor-login
/researcher-login
```

### 11.1 Login fields

- email;
- password.

The user does not select their role during login.

The backend resolves the user's assigned role from the authoritative database identity.

### 11.2 Login eligibility

Login is permitted only when:

- the account exists;
- the account is active;
- required email verification is complete;
- the supplied credentials are valid;
- the account is not suspended/deactivated;
- role-specific approval/activation prerequisites have already been satisfied.

Doctor/Researcher applicants who have not been approved and activated do not possess normal privileged login access.

### 11.3 Post-login route during Phase 4

Until role dashboards exist, successful authentication shall land at a small authenticated account/security route such as:

```text
/account
```

Do not create fake Patient/Doctor/Researcher dashboards solely to complete Phase 4.

---

## 12. Email Delivery and Real Email Verification on Localhost

The backend shall own all email sending.

```text
React
  ↓
Spring Boot
  ↓
Transactional Email Provider
  ↓
Real Gmail / Outlook / other inbox
```

The frontend must never receive or expose the email-provider secret/API key.

### 12.1 Local development

Spring Boot running on localhost may call a real transactional email provider over the Internet.

Example configuration concept:

```text
APP_FRONTEND_URL=http://localhost:5173
MAIL_PROVIDER=resend-or-approved-provider
MAIL_FROM=...
MAIL_API_KEY=...
```

A real email can contain a local verification link:

```text
http://localhost:5173/verify-email?token=<one-time-token>
```

This works when the recipient opens the link on the development machine.

For testing on another device/person, use an approved public staging URL or secure tunnel; `localhost` always refers to the recipient device itself.

### 12.2 Production/Vercel compatibility

The React frontend may later be hosted on Vercel.

The backend remains a separately deployed Spring Boot service.

Only environment configuration changes:

```text
Development:
APP_FRONTEND_URL=http://localhost:5173

Production:
APP_FRONTEND_URL=https://<approved-clinora-domain>
```

Authentication/email business logic must not depend on Vercel-specific server functions.

### 12.3 Provider abstraction

Email delivery shall be behind an application interface/adapter so the provider can be replaced without rewriting authentication.

The current recommended real-email development path may use Resend, but application logic must not hard-code Resend-specific behavior.

### 12.4 Never email passwords

Clinora must never send plaintext/generated passwords by email.

Use:

- email-verification links;
- password-reset links;
- approved-account activation links;
- interview links/notifications.

The user always chooses their own password.

---

## 13. One-Time Token Security

Email verification, password reset, and account activation links must use cryptographically secure random tokens.

Rules:

- raw token appears only in the outbound link/request;
- PostgreSQL stores only a cryptographic hash of the token;
- token has an expiry;
- token is single-use;
- consumed token becomes unusable;
- token purpose is explicit;
- tokens cannot be reused across workflows;
- token values must never be written to normal application logs;
- authorization headers and credentials must never be logged.

Relevant purposes include:

```text
EMAIL_VERIFICATION
PASSWORD_RESET
ACCOUNT_ACTIVATION
APPLICATION_EMAIL_VERIFICATION
```

If applicant portal links require reusable access, use a separately designed scoped mechanism rather than reusing password-reset or activation tokens.

---

## 14. Password Security

Backend validation is authoritative.

Baseline password requirements:

- minimum 8 characters;
- at least one uppercase letter;
- at least one lowercase letter;
- at least one number;
- at least one special character.

Passwords must:

- never be stored in plaintext;
- be hashed with Spring Security BCrypt;
- use an appropriate BCrypt strength consistent with the approved security baseline;
- never be logged;
- never be returned in API responses.

Password reset and password change must invalidate or revoke authentication sessions according to the final session policy.

---

## 15. Authentication and Session Architecture

Implementation stack:

```text
React 19
   ↓ HTTPS/REST
Spring Boot / Spring Security
   ↓
PostgreSQL
```

### 15.1 Access/refresh model

Use:

- short-lived JWT access token;
- rotating refresh-session token;
- server-side session record;
- refresh-token hash persisted, not raw token;
- refresh rotation;
- revocation on logout;
- replay/reuse detection where practical;
- account state checked during refresh;
- secure cookie strategy for browser refresh token unless a later approved security decision changes it.

### 15.2 Browser token storage

Do not require long-lived authentication secrets in `localStorage` merely because a legacy document says the frontend stores tokens.

Preferred browser model:

- access token held in memory/auth state;
- refresh token delivered in an `HttpOnly`, `Secure` cookie in production with an explicitly approved SameSite/CSRF strategy.

### 15.3 Token lifetime conflict remains explicit

Legacy documents conflict:

- Full SRS: approximately 1-hour access / 30-day refresh.
- Security manual: 15-minute access / 7-day refresh.

**Do not silently choose based on whichever old document is read first.**

Before final Phase 4 implementation, owner/security decision must lock the production lifetimes.

Recommended security baseline remains:

```text
Access token: 15 minutes
Refresh session: 7 days
```

unless owner explicitly approves another value.

---

## 16. Core Phase 4 APIs

Exact request/response schemas are to be finalized during implementation planning, but the updated functional surface is:

### 16.1 Patient authentication

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/verify-email
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
PATCH  /api/v1/auth/change-password
GET    /api/v1/auth/me
GET    /api/v1/auth/sessions
```

`POST /auth/register` is a Patient self-registration endpoint unless a later owner-approved contract explicitly renames it.

A caller must not be able to obtain `DOCTOR`, `RESEARCHER`, `SYSTEM_ADMIN`, `HOSPITAL_ADMIN`, or `BLOOD_BANK_STAFF` by manipulating the Patient registration payload.

### 16.2 Professional/access applications

Conceptual API namespace:

```text
POST /api/v1/access-applications/doctor
POST /api/v1/access-applications/researcher
POST /api/v1/access-applications/verify-email
```

Additional endpoints for application document upload/status/interview interaction shall be designed during Phase 4 implementation without turning applicants into privileged RBAC users.

### 16.3 Admin access review

Conceptual namespace:

```text
GET    /api/v1/admin/access-applications
GET    /api/v1/admin/access-applications/{id}
PATCH  /api/v1/admin/access-applications/{id}/review
POST   /api/v1/admin/access-applications/{id}/approve
POST   /api/v1/admin/access-applications/{id}/reject
POST   /api/v1/admin/access-applications/{id}/request-info

POST   /api/v1/admin/access-applications/{id}/interviews
PATCH  /api/v1/admin/access-applications/{id}/interviews/{interviewId}
```

The precise command shape may be improved during implementation, but all privileged actions must be backend-authorized and audited.

---

## 17. Updated RBAC and Resource Boundaries

| Capability | Patient | Doctor | Researcher | System Admin | Hospital Admin | Blood Bank Staff |
|---|---:|---:|---:|---:|---:|---:|
| Public self-registration | Yes | No | No | No | No | No |
| Public application | N/A | Yes | Yes | No | Deferred | Deferred |
| Normal login after activation | Yes | Yes | Yes | Yes | Deferred | Deferred |
| View own account/profile | Yes | Yes | Yes | Yes | Deferred | Deferred |
| Upload own medical report | Future Patient module | No | No | Restricted | No | No |
| Review authorized Patient report | No | Future Doctor module | No | No automatic clinical access | No | No |
| Use Doctor clinical AI review | No | Future Doctor module | No | No automatic clinical access | No | No |
| Research tools | No | No | Future Research module | Govern | No | No |
| Identifiable Patient records for research | No | No | **Never by role alone** | No automatic clinical access | No | No |
| Review Doctor applications | No | No | No | Yes | No | No |
| Review Researcher applications | No | No | No | Yes | No | No |
| Schedule Doctor onboarding interview | No | No | No | Yes | No | No |
| Global role/account governance | No | No | No | Yes | No | No |

### 17.1 System Admin privacy boundary

`SYSTEM_ADMIN` is powerful for platform governance but does not automatically gain unrestricted medical-record access merely because the role is administrative.

Clinical data access must remain subject to separate privacy/resource authorization rules.

---

## 18. Patient → Doctor Report Access Rule

This update establishes the future clinical authorization direction so Hospital logic is not accidentally reintroduced.

### 18.1 Core rule

OCR does not choose a Doctor.

Hospital affiliation does not choose a Doctor.

The Patient/clinical relationship determines Doctor access.

Conceptual flow:

```text
Patient uploads medical report
        ↓
OCR processes report
        ↓
Patient retains ownership/control
        ↓
Patient books/selects Doctor X
        ↓
Patient explicitly shares selected report(s)
        ↓
Doctor X receives authorized access
        ↓
Doctor X reviews original + OCR + AI assistance
```

A different Doctor does not gain access merely because they are a Clinora Doctor.

### 18.2 Future data relationship

A future appointment/report-sharing model may use an association such as:

```text
Appointment
- patientId
- doctorId

AppointmentReport / ReportShare
- appointmentId or doctorId
- reportId
- sharedAt
- revokedAt
- reviewedAt
```

Exact schema belongs to the relevant future clinical phase.

---

## 19. Phase 4 Data Model Direction

Phase 4 may require the following authentication/access-governance persistence:

```text
users
auth_sessions
email_verification_tokens
password_reset_tokens
auth_audit_events

access_applications
application_documents
application_email_tokens
doctor_interviews
account_activation_tokens
```

### 19.1 `users`

Contains activated application identities.

Expected fields include:

- UUID id;
- first name;
- last name;
- email;
- password hash;
- role;
- email verified;
- active/account status;
- last login;
- created/updated timestamps;
- soft-delete/deactivation metadata where required.

### 19.2 `access_applications`

Supports at least:

```text
DOCTOR
RESEARCHER
```

Expected concepts:

- application UUID;
- application type;
- applicant identity/contact fields;
- verified email state;
- status;
- submitted time;
- reviewer;
- review timestamps;
- rejection/more-information reason;
- approval timestamp;
- activation status.

Do not use an RBAC role to represent application status.

### 19.3 `application_documents`

Stores metadata/reference for securely stored application evidence.

Do not store large CV/credential binary files directly in ordinary database text/blob columns unless a later explicit storage decision authorizes it.

Production document storage must be private and access-controlled.

### 19.4 `doctor_interviews`

Stores Doctor onboarding interview scheduling/review metadata defined above.

### 19.5 Raw secrets

The following must never be persisted in raw form:

- refresh tokens;
- password-reset tokens;
- account-activation tokens;
- email-verification tokens.

Persist only hashes/secure server-side representations.

---

## 20. Application Document Storage Boundary

Doctor CVs, credentials, license evidence, and Researcher supporting documents may contain sensitive personal/professional information.

Requirements:

- private storage only;
- no public bucket/object URLs;
- backend-authorized access;
- access audit where appropriate;
- MIME/type/size validation;
- no direct frontend secret credentials;
- signed/short-lived access mechanism when viewing documents;
- retention/deletion policy to be finalized before production.

The approved architecture uses S3-compatible private object storage as the long-term direction.

The exact provider remains configurable and must not be hard-coded.

---

## 21. Email/Application UX Routes

Phase 4 should plan/reuse the approved Clinora visual system for:

```text
/login
/register
/verify-email
/forgot-password
/reset-password
/activate-account
/account

/apply/doctor
/apply/researcher
/application/email-verification
/application/status
/application/interview
```

A minimal authorized admin review experience may use a protected route such as:

```text
/admin/access-reviews
```

This does not authorize the full future Admin dashboard.

---

## 22. Frontend Architecture Rules

Use the approved frontend stack:

- React 19;
- TypeScript;
- Vite;
- React Router;
- React Hook Form;
- Zod;
- Zustand;
- Axios;
- Tailwind CSS v4;
- source-owned/shadcn-compatible UI components;
- Framer Motion;
- Lucide React.

Rules:

- pages do not call Axios directly;
- service layer owns API communication;
- backend validation is authoritative;
- forms include labels, validation, loading, disabled-submit, success/error feedback;
- preserve WCAG-focused keyboard/focus behavior;
- preserve reduced-motion support;
- keep authentication UI visually connected to the established Clinora biomedical design;
- do not introduce another UI framework.

---

## 23. Backend Architecture Rules

Use the approved backend stack:

- Java 21 LTS;
- Spring Boot;
- Maven;
- Spring Security;
- Spring Web;
- Spring Data JPA/Hibernate;
- PostgreSQL;
- Flyway;
- Jakarta Validation;
- Springdoc;
- MapStruct where appropriate;
- SLF4J/Logback.

Do not use:

- NestJS;
- Node backend;
- Prisma;
- Passport;
- NestJS Guards.

Legacy security behavior must be implemented with equivalent Spring mechanisms.

---

## 24. Rate Limiting and Enumeration Protection

Sensitive public endpoints shall be rate-limited.

At minimum consider:

- Patient registration;
- login;
- forgot password;
- verification resend if implemented;
- Doctor application submission;
- Researcher application submission;
- application email verification;
- token refresh.

Redis is approved for rate limiting and ephemeral coordination.

Password-recovery responses must not disclose whether an arbitrary email is registered.

Application endpoints must avoid unnecessary disclosure of application status to unauthenticated third parties.

Exact thresholds remain a Phase 4 security decision and must not be copied blindly from conflicting legacy documents.

---

## 25. Audit Requirements

Phase 4 must audit security/governance events including:

- Patient registration;
- email verification;
- successful login;
- failed login;
- refresh;
- logout;
- password reset;
- password change;
- session revocation;
- Doctor application submission;
- Researcher application submission;
- reviewer access;
- request for more information;
- Doctor interview scheduling/rescheduling/completion;
- approval;
- rejection;
- account activation;
- suspension/reactivation.

Never log:

- passwords;
- raw access tokens;
- raw refresh tokens;
- raw reset/verification/activation tokens;
- authorization headers;
- private meeting URLs in broad/system logs unless specifically protected.

---

## 26. Phase 4 Implementation Breakdown

To avoid scope explosion, Phase 4 should be implemented in controlled subphases.

### Phase 4A — Auth foundation

- identity schema;
- roles;
- Spring Security foundation;
- JWT/session architecture;
- audit foundation;
- email abstraction;
- token infrastructure.

### Phase 4B — Patient authentication

- Patient registration;
- real email verification;
- login;
- refresh;
- logout;
- `/me`;
- forgot/reset password;
- change password;
- session management;
- `/account`.

### Phase 4C — Doctor/Researcher applications

- Doctor application;
- Researcher application;
- application email verification;
- professional/research fields;
- secure supporting-document metadata/upload pathway;
- application state machine;
- application notifications.

### Phase 4D — Access review and Doctor interview

- minimal System Admin access-review workbench;
- Doctor document review;
- Researcher review;
- request-more-information;
- Doctor interview scheduler;
- Meet/Zoom/Other manual links;
- approval/rejection;
- activation link;
- set-password activation;
- role assignment only after approval.

### Phase 4E — Security, testing and publication gate

- backend tests;
- frontend tests;
- integration tests;
- RBAC tests;
- token/session tests;
- rate-limit tests;
- applicant privilege-escalation tests;
- email flow tests;
- interview privacy tests;
- accessibility/responsive review;
- CI;
- owner review before merge/tag.

No later clinical module is automatically authorized by Phase 4.

---

## 27. Explicit Phase 4 Non-Goals

Phase 4 does **not** authorize implementation of:

- Patient medical dashboard;
- full Doctor clinical dashboard;
- full Research dashboard;
- full System Admin dashboard;
- Hospital module;
- Hospital registration;
- Hospital dependency for Doctors;
- Hospital recruitment;
- hospital job vacancies;
- Doctor employment contracts;
- hospital department assignment;
- Blood Bank module;
- medical report upload/clinical storage workflow;
- OCR processing implementation;
- AI inference implementation;
- appointment booking implementation;
- consultation implementation;
- prescription implementation;
- dataset generation;
- research project execution;
- real clinical record sharing implementation.

Phase 4 may establish data/authorization hooks required for these later modules but must not implement the modules themselves.

---

## 28. Security Acceptance Criteria

Phase 4 is not complete until tests demonstrate at minimum:

- a Patient cannot register as Doctor/Researcher/System Admin by changing the payload;
- Doctor/Researcher email verification does not grant their final role;
- rejected/pending applicants cannot access Doctor/Researcher protected APIs;
- only an authorized System Admin can approve/reject applications;
- approval alone cannot leak/set a plaintext password;
- activation tokens are one-time and expire;
- Doctor chooses their own password after approval;
- password hashes are never exposed;
- raw tokens are not stored in PostgreSQL;
- logout/session revocation works;
- protected APIs reject invalid/expired tokens;
- RBAC is enforced on the backend;
- applicant documents are not publicly accessible;
- Doctor interview meeting URLs are not public;
- researchers cannot access identifiable Patient records by role alone;
- System Admin does not automatically bypass clinical privacy boundaries;
- email flows work with localhost configuration;
- production frontend origin can be changed by configuration without code rewrites.

---

## 29. Decisions Still Requiring Explicit Owner Lock

The following must remain visible rather than being silently inherited from older documents:

1. Final JWT access-token lifetime.
   - Recommended: 15 minutes.
   - Legacy conflict: 15 minutes vs 1 hour.

2. Final refresh-session lifetime.
   - Recommended: 7 days.
   - Legacy conflict: 7 days vs 30 days.

3. Exact auth/application rate-limit thresholds.

4. Exact Doctor credential documents and jurisdiction-specific legal review criteria.

5. Exact Researcher institutional/access review criteria.

6. Exact application-document retention/deletion period.

7. Exact production email provider/domain.

8. Exact initial `SYSTEM_ADMIN` bootstrap mechanism.

9. Exact Doctor interview reminder timing.

These are not permission for a developer to choose arbitrarily.

---

## 30. Future Development Reading Rule

Any future prompt or coding agent working on Clinora shall treat the following statements as binding unless the owner writes a newer override:

> Clinora is an independent healthcare/clinic-style platform and does not require external Hospital participation for its core Patient ↔ Doctor workflow.

> Patient is a direct self-registration role.

> Doctor is an application-and-approval role, not an instant email-verified signup role.

> Researcher is an application-and-approval role, not an instant email-verified signup role.

> Email verification proves email ownership only.

> Doctor approval includes Clinora review and an interview scheduling/review workflow before account activation.

> Approved Doctor/Researcher users create their own password through a one-time activation link; Clinora never emails passwords.

> Applicants are workflow records, not RBAC roles.

> `SYSTEM_ADMIN` is internal/provisioned and never publicly self-assigned.

> `HOSPITAL_ADMIN` and `BLOOD_BANK_STAFF` remain reserved until separately designed; they do not block Phase 4 or core Clinora care.

> A Doctor's future access to a Patient report is based on explicit clinical authorization/report sharing, not Hospital membership.

> Old SRS statements that mandate Hospital membership for Doctors are superseded for the current product direction.

---

## 31. Change Control

This file must not be silently edited to reintroduce legacy assumptions.

For future owner changes:

1. increment the document version;
2. add a dated change note;
3. identify the superseded rule;
4. update affected API/schema/RBAC sections;
5. obtain owner approval before implementation.

### Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-07 | Establishes Clinora-independent care model; Patient direct registration; Doctor/Researcher application + approval; Doctor interview scheduler; System Admin access review; hospital-independent role/access rules; localhost real-email/activation direction. |
| 1.1 | 2026-08-10 | Owner override recorded during Phase 4C remediation: Doctor retains mandatory onboarding interview for Phase 4D; Researcher applications have no interview process. Researcher review proceeds through professional review, more information if needed, decision, activation, and account creation without Researcher interview states, meeting links, reminders, or interview UI. |

---

# OWNER BASELINE

**This document is the current governing Phase 4 and role/onboarding SRS update.**

Future implementation must not blindly follow contradictory Hospital-dependent, direct privileged-registration, four-role, or NestJS/Prisma assumptions from the legacy documents.

**PHASE 4 SRS UPDATE READY FOR OWNER REVIEW / REPOSITORY ADOPTION**
