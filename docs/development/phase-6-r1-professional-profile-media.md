# Phase 6 R1 — Professional Profile and Profile Media

## Scope

R1 adds the identity/profile foundation required by the Phase 6 master plan. It intentionally stops before the R2 Patient booking/report-picker redesign, recurring availability rules, appointment tokens, realtime presence, and Doctor notification expansion.

## Doctor profile contract

`/doctor/profile` separates mutable professional presentation from approved onboarding evidence.

Directly editable fields are limited to:

1. profile photo
2. professional bio
3. professional profile URL
4. display title
5. current organization / current position
6. preferred timezone
7. default consultation duration

Verified signup facts remain read-only. The Doctor can see their approved specialization, years of experience, registration details, structured qualifications, and original signup-document metadata. CV/license/qualification/supporting documents can be viewed or downloaded only through Doctor-authenticated ownership-checked endpoints. Approved application rows and document rows are not mutated by the profile update API.

Profile setup percentage is operational/presentation readiness only. Clinora verification remains visually and semantically separate.

## Profile image contract

Patients and Doctors share one profile-image service and UI component.

- bytes are stored in a private MinIO/S3-compatible `clinora-profile-images` bucket
- PostgreSQL stores metadata, checksum, dimensions, version, and timestamps
- JPEG, PNG, and non-animated WebP are supported up to 5 MB and 4096×4096
- image content is detected from bytes; browser MIME/filename are not authoritative
- JPEG/PNG are decoded and re-encoded to remove unnecessary metadata; JPEG EXIF orientation is normalized
- WebP EXIF/XMP chunks are removed and animated WebP is rejected
- existing ClamAV scanning is reused and follows the configured fail-closed policy
- replacement is serialized on the user row and old/new object cleanup follows transaction completion
- all served image bytes are checksum-verified

### Image visibility

- Patient/Doctor can read their own photo
- an authenticated Patient may read a currently bookable Clinora Doctor photo
- an authenticated Doctor may read a Patient photo only through an active appointment owned by that Doctor
- no public Patient-photo directory exists
- raw MinIO object keys/URLs are never returned to the frontend

## Patient-facing Doctor profile

The Patient Doctor detail view receives a safe professional projection: photo, display title, specialty, verified experience, organization/position, bio, safe professional URL, preferred timezone/default duration, next availability, and Clinora verification state.

It deliberately excludes registration number, credential documents, application review metadata, private contact information, and storage metadata.

## Database migration

V23 is additive:

- adds presentation/preferences/version fields to `doctor_booking_profiles`
- creates `user_profile_images`
- does not alter `doctor_application_details`, `doctor_qualifications`, or `application_documents`

Existing approved application data remains the credential source of truth.

Availability projection refresh is also guarded: once a Doctor has made an R1 profile edit (`profile_version > 0`), publishing new availability must not overwrite the Doctor-managed current organization/position with the original onboarding projection. Verified signup organization/position remain separately visible as immutable credential history.

## R0 finding: suspicious equal-looking availability time

The existing database constraints require `doctor_availability_slots.ends_at > starts_at` and `appointments.scheduled_end > scheduled_start`, and the appointment service maps the persisted start/end instants directly. Therefore a genuine zero-duration row cannot be inserted through the current constrained schema. R1 makes the Doctor availability UI date-aware and shows the computed duration explicitly so a timezone/formatting/stale-data issue cannot masquerade as a valid zero-length appointment.

The exact runtime source of the previously observed `4:15 PM → 4:15 PM` screen still requires local DB/browser reproduction after the patch is applied; do not mark that browser bug certified solely from static source analysis.

## Local certification after applying

Run the complete repository gates on the real `phase-6-doctor-workspace` working tree:

```text
backend full Maven tests
frontend lint
frontend typecheck
frontend relevant tests
frontend full test suite
frontend production build
git diff --check
Docker backend/frontend rebuild
Flyway V23 on PostgreSQL 16
MinIO profile-image upload/replace/remove smoke test
Doctor credential view/download smoke test
Doctor/Patient cross-account authorization checks
browser QA at 1440 / 1280 / 1024 / 768 / 390
```

Do not commit/push/merge until these runtime/browser gates pass and the owner accepts the visual result.
