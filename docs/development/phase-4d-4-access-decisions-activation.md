# Clinora AI Phase 4D-4 Access Decisions & Professional Account Activation

**Status:** Phase 4D-4 — Access Decisions & Professional Account Activation — COMPLETE
**Branch:** `phase-4d-4-access-decisions-activation`
**Date:** 2026-08-26

## Scope Completed

Phase 4D-4 completes the access-review decision and professional account activation portion of Phase 4D.

Implemented:

- System Admin approval and rejection endpoints for professional access applications.
- Doctor approval gated behind `INTERVIEW_COMPLETED`.
- Researcher approval from active professional review without Researcher interview states or interview UI.
- Applicant-safe rejection reason delivery.
- One-time `ACCOUNT_ACTIVATION` token purpose with hashed storage and expiration.
- Approval email containing a single-use activation link.
- Public professional activation endpoint.
- Backend-authoritative password policy enforcement.
- Doctor/Researcher `UserAccount` creation only after successful activation.
- Password hashing before persistence.
- Application transition to `ACTIVATED` after successful activation.
- Activation token consumption after successful activation.
- Applicant-session revocation after professional account activation.
- Admin workbench Approve/Reject controls.
- `/application/activate` frontend route for password setup and activation.
- Focused backend and frontend tests for decision and activation behavior.

## Security Boundaries Preserved

- Patient self-registration remains the only public user-registration path.
- Doctor and Researcher remain application, approval, and activation roles.
- Applicants remain workflow records, not RBAC roles.
- Email verification does not grant privileged roles.
- Role assignment happens only when the activation token is valid and the password is accepted.
- `SYSTEM_ADMIN` is not publicly self-assigned.
- Doctor onboarding has no hospital dependency.
- Raw one-time tokens are not stored in PostgreSQL.
- Rejection emails use only the applicant-facing decision reason, not internal reviewer notes.
- Admin decision endpoints remain under the `/api/v1/admin/**` System Admin RBAC boundary.

## Verification

Final local verification for this implementation slice:

- Backend: `mvn.cmd -q test` passed with 62 tests, 0 failures, 0 errors.
- Frontend format: `npm.cmd run format:check` passed.
- Frontend lint: `npm.cmd run lint` passed with 0 errors and the existing 6 Fast Refresh warnings.
- Frontend typecheck: `npm.cmd run typecheck` passed.
- Frontend tests: `npm.cmd run test:run` passed with 75 tests.
- Frontend build: `npm.cmd run build` passed with the existing Vite chunk-size warning.
- Git whitespace: `git diff --check` passed.

## Deferred Owner Decisions

This completion note does not decide or change JWT lifetime, refresh lifetime, rate-limit thresholds, production email provider, admin bootstrap policy, credentialing/legal review policy, retention policy, or interview reminder timing.

Phase 4E and Phase 5 are not started by this work.
