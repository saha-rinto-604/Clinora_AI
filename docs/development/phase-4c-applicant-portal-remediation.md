# Phase 4C Applicant Portal Remediation

## Owner decision

Phase 4C keeps passwordless professional-applicant authentication. Doctor and Researcher applicants remain outside the normal Clinora `UserAccount` / RBAC authentication domain until a later approved activation step.

This remediation does not add:

- an `APPLICANT` RBAC role;
- applicant passwords or a second credential store;
- passkeys or MFA;
- Phase 4D reviewer actions, interview operations, decisions, or account activation.

## Applicant access model

The professional application is accessed with the verified application email and a short-lived, single-use portal sign-in link. Successful link exchange creates an application-scoped, server-backed HttpOnly applicant session.

Defaults:

- email verification link: 24 hours;
- portal sign-in link: 30 minutes;
- applicant session: 8 hours absolute;
- no sliding session extension.

Production must set the applicant cookie `Secure` flag. The applicant cookie stays separate from normal Clinora authentication cookies.

## Discovery and information architecture

The main public navbar remains unchanged.

`/professional-access` is the canonical public hub for:

- Apply as Doctor;
- Apply as Researcher;
- Already applied? Continue your application.

The public footer exposes the professional-access hub and direct application links. Login and Patient registration keep a visually secondary professional-access section as a recovery path for visitors who arrive at the wrong authentication surface. The Doctor and Researcher application-start pages also link returning applicants to `/application/status`.

Applicants are not presented as normal Clinora users.

## Session controls

The applicant workspace exposes:

- Sign out — revokes the current server-side applicant session;
- Sign out all devices — revokes all active applicant sessions scoped to the current application.

Multiple independent sessions remain supported so a legitimate applicant can use more than one device. No per-request or per-mutation session-secret rotation is introduced in this remediation.

## Applicant-facing updates

Internal application history remains stored, but applicant-visible activity is intentionally narrower.

Applicant-facing:

- application started;
- email verified;
- supporting document received;
- application submitted;
- withdrawal;
- future approved applicant-safe lifecycle events when Phase 4D explicitly introduces them.

Internal/not applicant-facing:

- per-save `PROFILE_UPDATED`;
- access-link requests;
- session establishment;
- email-verification delivery;
- document-removal edit noise;
- security/audit events;
- reviewer-only notes.

The frontend additionally groups document-upload events by day and shows the latest five meaningful updates before an explicit “View earlier activity” expansion.

## Status tracker

The tracker derives milestone state from the actual application status instead of a fixed array position.

Doctor lifecycle presentation:

1. Application submitted
2. Professional review
3. Mandatory interview
4. Decision
5. Account activation

Researcher lifecycle presentation:

1. Application submitted
2. Professional review
3. Decision
4. Account activation

Researcher applications never surface Doctor interview copy. `MORE_INFO_REQUIRED`, `REJECTED`, `WITHDRAWN`, `ACTIVATION_PENDING`, and `ACTIVATED` receive explicit action/terminal treatment.

## Security invariants preserved

- application ownership is resolved server-side from the applicant session;
- browser-supplied application IDs do not establish ownership;
- raw portal/session secrets are not persisted;
- documents remain backend-authorized and application-scoped;
- object-storage credentials remain backend-only;
- access-link responses remain enumeration-resistant;
- logout remains true server-side revocation;
- applicant authentication remains separate from Clinora RBAC authorization;
- application submission never grants Doctor or Researcher platform privileges.

## Phase boundary

This file documents Phase 4C remediation only. Phase 4D remains unauthorized by this remediation.
