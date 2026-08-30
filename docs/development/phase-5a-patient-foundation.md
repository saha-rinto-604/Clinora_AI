# Clinora AI — Phase 5A Patient Foundation

**Status:** complete — merged to `main` on 2026-08-30
**Scope:** Patient-owned clinical profile and first Patient dashboard foundation

## Purpose

Phase 5A starts the Patient clinical domain without reopening Phase 4 authentication. It adds a one-to-one Patient profile tied to the authenticated `PATIENT` user, normalized lists for allergies, chronic conditions, and current medications, and a professional Patient workspace that displays only persisted Patient-controlled data.

## Backend

- `V13__create_patient_profile_foundation.sql`
- `GET /api/v1/patient/profile`
- `PATCH /api/v1/patient/profile`
- `GET /api/v1/patient/dashboard`
- Patient-only method authorization in addition to the authenticated API boundary
- Active-account and authoritative-role checks in the service layer
- Optimistic locking on the Patient profile
- Audit events for profile creation and update
- No arbitrary Patient identifier is accepted by own-profile APIs; ownership comes from the authenticated JWT subject

### Patient profile data

- date of birth
- gender
- blood group
- phone and address
- height and weight
- family medical history
- lifestyle information
- emergency contact
- allergies
- chronic conditions
- current medications

Name and account email remain sourced from the Phase 4 identity record rather than being duplicated into the clinical profile.

## Frontend

Routes:

- `/patient` — Patient dashboard foundation
- `/patient/profile` — editable health profile
- `/account` — existing Phase 4 account/security surface

The Patient workspace uses the existing Clinora dark biomedical design system, responsive Patient navigation, accessible form labels/focus behavior, loading/error/success states, and API calls through a dedicated Patient feature service.

The dashboard intentionally does **not** fabricate reports, appointments, OCR results, AI predictions, prescriptions, or research data. Later Phase 5 slices can attach those capabilities to this foundation.

## Security boundaries

- `PATIENT` only
- anonymous and non-Patient roles denied
- active account rechecked server-side
- no public clinical profile lookup by user ID
- no clinical profile fields are written to audit metadata

## Phase 5A closure

Phase 5A is closed as the Patient foundation milestone. Its responsibility is the Patient-owned profile, dashboard foundation, account/security integration, and associated Patient-only security boundaries. Medical-report storage, OCR/AI processing, longitudinal report history, appointments, notifications, and later Patient workflows belong to subsequent Phase 5 slices and should not be backfilled into Phase 5A.

## Follow-on dependency

Phase 5B adds the private Patient medical-report vault and should reuse the private object-storage/security patterns already established by Phase 4 application documents. OCR/AI processing remains outside Phase 5A.
