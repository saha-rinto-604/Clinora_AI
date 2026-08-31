# Clinora AI — Phase 5C–5G Patient Product Completion

**Baseline requirement:** apply this integration only after the Phase 5B Patient Medical Report Vault patch is present (V14 `patient_medical_reports`).

**Publication status:** implementation prepared; repository-local verification and owner visual acceptance are mandatory before merge/publication.

## Product intent

This change completes the Patient product as a task-oriented healthcare workspace rather than a developer/admin dashboard. It preserves the existing Clinora Patient shell, dark biomedical tokens, `AppSurface`/button/status primitives, and Patient-owned resource model.

The final Patient information architecture is intentionally small:

- Home — current care summary, reports, health record, activity, privacy/sharing
- Medical Reports — private report vault delivered in Phase 5B
- Health Record — current Patient-entered health information plus longitudinal timeline
- Appointments — approved Doctor discovery, real availability, booking and appointment-scoped report sharing
- Health Profile — Patient-maintained source information
- Notifications — header utility and dedicated inbox; not another dashboard destination
- Account & Security — existing Phase 4 account/session surface

No OCR result, AI diagnosis/summary, prescription, consultation note, research data, blood inventory, or Doctor clinical review is fabricated by Phase 5.

## Phase 5C — Health Record & Timeline

### Backend

`V15__create_patient_health_timeline.sql` adds protected append-only `patient_timeline_events` storage. Timeline events are idempotent through `(patient_user_id, deduplication_key)` and are not written to broad application logs.

`PatientProfileService` is upgraded from wholesale child-list replacement to stable reconciliation: unchanged allergies, conditions, and medications keep their UUID and original creation time; only real additions/removals mutate. `PatientProfileMutationService` then compares the protected before/after views and records only meaningful longitudinal changes in the same transaction. Historical events are never invented from unreliable pre-5C child-row timestamps.

`PatientReportMutationService` wraps the established Phase 5B report service so report upload/detail changes/archive/restore become real timeline producers without duplicating storage, MIME, checksum, ownership, or audit rules.

Patient endpoints:

- `GET /api/v1/patient/history`
- `GET /api/v1/patient/health-trends?from=&to=`
- `GET /api/v1/patient/timeline?category=&before=&beforeId=&limit=`

### Frontend

- `/patient/history` — read-only current record: clinical essentials, current measurements, real trends, reports, care history, and health background
- `/patient/timeline` — chronological meaningful events with human filters and cursor-based older activity

The two routes are presented as one **Health Record** product area, not duplicate sidebar destinations.

### Health Profile and Health Record boundary

`/patient/profile` remains the four-section editing workspace for Personal Details, Basic Health, Medical Background, and Emergency Contact. Account-owned identity is read-only. A successful save updates the current profile, reconciles stable clinical collections, and appends meaningful Patient timeline activity in one transaction.

`V18__create_patient_body_measurement_history.sql` adds append-only `patient_body_measurement_snapshots`. A snapshot is written only when normalized height or weight changes, and stores the resulting current pair with Patient/Profile ownership, provenance, observed time, and a deduplication key. Existing profile values are deliberately not backfilled because their historical measurement time is not trustworthy. BMI is derived from each valid snapshot and is never Patient-editable.

Health Trends currently exposes only persisted Weight and derived BMI observations. Zero observations show an intentional no-history state; one observation shows the recorded value without a graph; two or more observations may be plotted chronologically with an accessible data table. Directional change is presented neutrally and never labeled as clinical improvement or deterioration.

## Phase 5D — Doctor Discovery, Appointments & Explicit Report Sharing

`V16__create_patient_booking_and_report_sharing.sql` adds:

- `doctor_booking_profiles` — booking-safe projection derived from activated Doctor onboarding data; no private registration number is exposed
- `doctor_availability_slots`
- `appointments`
- `appointment_report_shares`

Patient workflow:

1. discover only active approved Clinora Doctors;
2. inspect professional information and real future availability;
3. choose a slot and optional reason for visit;
4. explicitly select zero or more active Patient-owned reports;
5. confirm booking;
6. manage appointment and report grants later.

Nothing is shared by default. Cancelling an appointment revokes its active report shares. Rescheduling is limited to the same Doctor; choosing another Doctor is a new booking.

Booking uses database row locks, a partial unique index for active booked slots, optimistic version columns, and a Patient idempotency key. UI button state is not used as concurrency protection.

A deliberately narrow `/doctor/availability` producer is included so Phase 5D can be genuinely usable without pulling the Phase 6 Doctor clinical workspace forward.

## Phase 5E — Notifications

`V17__create_patient_notifications_and_outbox.sql` adds persistent notifications, preferences, and a generic transactional outbox.

- REST persistence is the source of truth.
- RabbitMQ/STOMP/WebSocket is a realtime acceleration path.
- Patient subscriptions are limited to `/user/queue/notifications`.
- browser clients cannot send application messages over STOMP.
- delivery is idempotent by notification source event.
- timeline and notification pagination use composite `(timestamp, UUID)` cursors so same-time event batches cannot be skipped.
- appointment reminders are produced from real booked appointments.
- external email copy is intentionally generic so clinical details are not exposed in lock-screen/inbox previews.
- outbox delivery cross-checks the persisted notification recipient before routing email or realtime delivery.

The existing Clinora `EmailDeliveryPort` is reused; no second mail implementation is introduced.

## Phase 5F — Patient Portal Completion

`/patient` uses the final Patient portal composition instead of adding another analytics dashboard. It shows only real data accumulated by 5A–5E:

- upcoming care;
- report vault summary and upload;
- concise health-record summary;
- recent longitudinal activity;
- active privacy/report-sharing summary limited to current booked care;
- deliberate first-use onboarding when the workspace is empty.

There are no fake health scores, unsupported vitals, fake charts, AI cards, Doctor ratings, or duplicate quick-action panels.

## Phase 5G — Publication hardening

### Medical report scanning

A pluggable `PatientReportMalwareScanner` and ClamAV INSTREAM adapter are included. Production/local Compose should enable scanning with fail-closed behavior. File extension/MIME/magic-byte/checksum controls from Phase 5B remain authoritative and are not replaced.

Production must not silently publish with malware scanning disabled.

### Clinical response policy

Patient and Doctor clinical API responses receive no-store/nosniff/referrer/permission hardening headers. Existing JWT/RBAC/own-resource rules remain authoritative.

### Security boundaries to verify before publication

- Patient A cannot read Patient B profile/history/timeline/report/appointment/share.
- anonymous clinical/report access is denied.
- SYSTEM_ADMIN has no clinical privacy bypass merely by role.
- RESEARCHER has no identifiable Patient access merely by role.
- unrelated Doctor has no report access.
- a booked Doctor without an explicit report grant has no report access.
- cancelled/revoked sharing cannot authorize later Doctor consumption.
- archived reports cannot be newly shared.
- MIME/extension/content spoofing and oversized files are rejected.
- malware scanner unavailable in fail-closed production mode rejects upload.
- concurrent booking of one slot results in exactly one active booking.
- request retries with one idempotency key do not create duplicate appointments.
- WebSocket subscription cannot be redirected to another Patient.
- PHI, raw report content, object keys, tokens, passwords and clinical timeline content are absent from broad logs.

Doctor report consumption remains Phase 6 and must re-check the appointment/share authorization server-side when it is implemented.

## Explicit owner locks and release notes

- **Report-size limit:** the delivered Phase 5B implementation enforces **20 MB** in application configuration and the V14 database constraint. The older SRS mentions **50 MB**. This combined patch deliberately preserves the working 20 MB contract; changing it must be an explicit owner decision with memory/storage/runtime testing rather than an accidental Phase 5C–5G side effect.
- **External email delivery:** database notification/outbox creation is durable. Delivery rechecks that the recipient is still an active, email-verified Patient. Clinora's existing unconfigured email adapter is treated as an intentional local/development state and does not trigger infinite retries; a configured provider failure remains retryable. Transactional email is intentionally **at-least-once** at the external provider boundary, so a process crash after provider acceptance but before publication marking can rarely produce a duplicate email. Production publication must configure and smoke-test the intended email provider. Do not claim exactly-once email delivery.
- **Malware scanning:** production is expected to enable ClamAV scanning and fail closed. During scanner startup/unavailability, report upload can return a temporary-unavailable response rather than silently accepting an unscanned clinical file.
- **Publication status:** this patch is an implementation candidate for the real post-5B repository. It does not mark Phase 5G accepted until the full Maven/npm/Docker/security/accessibility/runtime matrix below passes in the actual checkout.

## Required local verification gate

Run from the real post-5B repository checkout. The combined patch expects the Phase 5B vault (including Flyway V14) to already be present. Do not claim Phase 5 publication until every applicable item passes.

```powershell
git status --short
git apply --check Clinora_AI_Phase5C_to_5G_Professional_Patient_Portal.patch
git diff --check

cd backend
mvn.cmd -q test
cd ..

cd frontend
npm.cmd run format
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run -- --maxWorkers=1
npm.cmd run build
cd ..

docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Runtime checks must cover PostgreSQL/Flyway through V18, append-only measurement persistence, MinIO report persistence, ClamAV readiness/scanning, RabbitMQ STOMP relay, WebSocket reconnect, Patient and Doctor role boundaries, report sharing/revocation, slot concurrency, and restart persistence.

Manual visual QA is mandatory at 1440, 1280, 1024, 768 and 390 CSS px. Confirm consistent Clinora tokens, readable information hierarchy, no duplicate content, keyboard/focus visibility, reduced-motion behavior, no horizontal overflow, meaningful loading/error/empty states, and calm healthcare copy.

## Verification performed while preparing this patch

The implementation workspace available to this review is a reconstructed post-5B staging tree rather than the user's complete Git checkout. Java 21 and TypeScript parser-level checks, patch whitespace checks, targeted source review, and repository-contract checks were performed while preparing the patch. The complete Maven dependency graph, installed frontend dependencies, live PostgreSQL/MinIO/RabbitMQ/ClamAV stack, and the user's exact post-5B worktree are not mounted here, so their gates are intentionally left **pending** rather than reported as passing.

## Deployment notes

The official ClamAV container is memory-intensive. Size the deployment appropriately and persist/update signature databases according to the ClamAV deployment model. Local development may temporarily disable scanning only through an explicit environment setting; production should remain enabled and fail closed.

## Deferred after Phase 5

- Phase 6 — Doctor clinical workspace, consultation, report consumption/review and prescriptions
- Phase 7 — research participation
- Phase 9 — OCR processing and extracted laboratory result UX
- Phase 10 — MedGemma/AI reasoning and disease prediction
- Phase 11 — full Patient ↔ OCR ↔ AI ↔ Doctor workflow
