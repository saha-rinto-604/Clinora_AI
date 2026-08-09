# Clinora AI — Phase 4C Professional Access Applications

## Scope

Phase 4C implements Doctor and Researcher professional access applications. Applicants are not Clinora RBAC users and do not receive normal user JWTs. Email verification establishes only control of the application email. A separate explicit continue/resume action establishes a scoped applicant HttpOnly cookie for exactly one application.

## Applicant workflow

```text
Choose Doctor / Researcher path
  -> before-you-begin requirements
  -> identity/contact
  -> verify application email
  -> scoped applicant session
  -> save/resume professional application
  -> supporting evidence
  -> review + declaration
  -> submit
  -> status + updates
  -> Phase 4D review
```

No `DOCTOR` or `RESEARCHER` user is created by application creation, email verification, document upload, or submission.

## Doctor requirements

Doctor submission requires professional title, specialization, experience, current practice/position, registration jurisdiction/authority/number, at least one structured qualification, CV, medical-registration evidence, and at least one qualification document.

The software collects evidence; it does not claim that Clinora has legally validated a credential. Doctor approval remains subject to the mandatory Phase 4D interview.

## Researcher requirements

Researcher submission requires institution/organization, professional title, research field, and research purpose. Institutional evidence, ethics/project approval evidence, CV, ORCID, and profile links remain optional/configurable signals unless a later approved policy makes them mandatory. Researcher approval does not grant research dataset access.

Owner override for Phase 4C remediation: Researcher applications have no interview process. Researcher lifecycle is draft, submitted, under review, more information required when needed, approved or rejected, activation, then Researcher account. Shared enum values may retain Doctor interview states for forward compatibility, but `ApplicationType.RESEARCHER` must not transition into interview states or show interview UI/copy.

## Security

- raw application verification and portal-link tokens are never persisted;
- applicant session secrets are hashed server-side;
- applicant cookies are HttpOnly, scoped separately from `clinora_refresh`, and carry no RBAC role;
- applicant endpoints derive ownership from the server-side session rather than an application ID supplied by the browser;
- cookie-authenticated mutations reject browser Origins outside the configured CORS allow-list;
- application documents are served only through backend-authorized endpoints;
- object keys and S3/MinIO credentials are not exposed to React;
- PDF/JPEG/PNG uploads are limited by configured size and checked using file signatures plus declared MIME type;
- application-access-link responses are enumeration resistant.

## Storage

Application documents use `ApplicationDocumentStoragePort` with an S3-compatible adapter. Local development uses MinIO and a separate `clinora-access-documents` bucket. This bucket is independent of future medical-report storage.

## Lifecycle

The complete application enum anticipates later review states, but Phase 4C applicant behavior controls only creation/email verification, draft editing, submission, and safe withdrawal. System Admin review, request-more-information actions, interviews, decisions, account activation, and final role assignment remain Phase 4D.

## Phase 4D compatibility

The status/event model is prepared for:

- more-information requests;
- Doctor mandatory interviews;
- interview scheduled/rescheduled/cancelled/reminder events;
- approve/reject decisions;
- one-time account activation.

No Phase 4D administrative action is implemented in Phase 4C.
