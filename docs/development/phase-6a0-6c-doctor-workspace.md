# Phase 6A0–6C — Doctor Clinical Workspace Foundation

## Scope

This increment establishes the first complete Doctor workspace slice while deliberately stopping before Doctor-facing Clinora AI and consultation authoring.

Included:

- twelve dev-only, login-ready Doctor accounts that behave like approved professional accounts;
- verified email, `ACTIVE` user state, `ACTIVATED` professional application, completed interview, qualifications, required application documents and booking profile for every seeded Doctor;
- varied, derived professional-workspace completion from 60–100%;
- realistic Doctor availability, appointment and care-history fixtures;
- Doctor shell and role landing;
- real Doctor dashboard and paginated schedule;
- Doctor-owned appointment detail with minimized Patient clinical context;
- Doctor cancellation/rescheduling using the existing appointment invariants;
- explicit Patient-shared report list and no-share consultation state;
- original report review through the existing checksum-verified secure Doctor file endpoints;
- Patient-verified structured OCR evidence for shared reports;
- additive Doctor observation review provenance;
- comparison of two independently authorized shared reports.

Deferred by design:

- professional Clinora AI reasoning (Phase 6D);
- consultation notes/final diagnosis (Phase 6E);
- prescriptions/tests/follow-up (Phase 6F);
- generalized Doctor notifications/profile editing (Phase 6G).

## Patient consent is the hard boundary

A Doctor booking creates a care relationship for that appointment; it does **not** create global medical-record access.

A raw report or any structured values derived from it are available only when:

1. the authenticated user is an active, verified, activated Doctor with a currently valid registration when an expiry date is present;
2. the appointment belongs to that Doctor;
3. the appointment is still `BOOKED` and within the current active report-access window;
4. the Patient explicitly shared that exact report for that exact appointment;
5. the share is not revoked; and
6. the report is not archived.

Unshared, revoked, unrelated and nonexistent report IDs intentionally converge on the same unavailable response. Clinora must not leak filenames, OCR observations, abnormal-result counts or AI-derived content from an unshared report.

Cancellation revokes active report shares through the existing Patient appointment service. Rescheduling keeps the same appointment and therefore keeps its Patient-selected report shares.

## Doctor experience

The workspace is a clinical work surface, not an admin dashboard.

- **Home:** next Patient is the dominant action; today/upcoming/shared-report/availability numbers are secondary context.
- **Schedule:** Today / Upcoming / History with incremental loading. A `BOOKED` appointment is already confirmed; there is no fake Accept button.
- **Appointment:** scheduled care, relevant Patient context, Doctor-initiated cancel/reschedule, and only explicitly shared reports.
- **Report review:** original source document is authoritative; verified structured results are a convenience layer.
- **Compare:** two Patient-shared reports can be compared side by side only after the backend authorizes both independently.

The Doctor shell reuses the same Clinora application primitives as the Patient product: `ClinoraBrandMark`, `AppSurface`, `AppSectionHeader`, `StatusPill`, `IconWell`, shared dark navy/cyan/teal tokens, existing auth store/logout behavior and reduced-motion conventions.

## Patient context minimization

Appointment detail can show clinically useful context already stored in the Patient profile:

- name;
- date of birth;
- gender;
- blood group;
- recorded allergies;
- recorded chronic conditions;
- recorded current medicines.

It intentionally does not expose Patient address, phone number, emergency contact, family history or unrelated profile fields just because they exist in the database.

## OCR and Doctor source-check policy

Only extraction results with `review_status = 'VERIFIED'` are exposed in the Doctor structured-evidence surface.

Clinora displays persisted effective values and persisted `reference_range_raw` / `derived_range_flag`; it does not ask the model to classify values. Patient confirmation/correction provenance remains visible.

A Doctor review is additive and appointment-scoped. It never overwrites the Patient's corrected observation. `medical_report_observation_doctor_reviews` supports:

- `CONFIRMED` → UI: **Looks correct**;
- `NEEDS_SOURCE_REVIEW` → UI: **Check source**;
- `DISAGREES` → UI: **Doesn't match**.

`doctor_report_reviews` records report-review activity separately from the immutable authentication/security audit stream.

## Development Doctor accounts

Enable the fixture seeder only in the Spring `dev` profile:

```env
CLINORA_DEV_DOCTORS_ENABLED=true
CLINORA_DEV_DOCTORS_PASSWORD=<one local common Doctor password>
CLINORA_DEV_PATIENTS_PASSWORD=<separate supporting Patient password>
```

`.env.example` never contains either password. The seeder is additionally guarded by `@Profile("dev")` and an explicit enable property. Doctor and supporting Patient fixture credentials are intentionally separate.

The twelve Doctor accounts use stable, reserved `@clinora.test` email addresses so test mail can never be delivered to a real person. Inside the application they otherwise behave as normal approved Doctor accounts: there is no “dummy”, “demo” or “synthetic” badge in the Doctor UI.

Every Doctor has:

- active verified `users` record;
- `ACTIVATED` Doctor access application;
- completed Doctor interview;
- complete mandatory professional/registration data;
- at least one structured qualification;
- CV, medical-registration and qualification PDFs physically stored through the existing application-document storage adapter;
- Doctor booking profile.

Credential PDFs contain a quiet development-only validity notice so a generated fixture cannot be mistaken for a genuine professional credential outside the product. No real person, real BMDC registration number or real credential file is used.

The derived workspace-completion matrix is intentionally varied:

`60%, 65%, 70%, 75%, 80%, 80%, 85%, 85%, 90%, 90%, 95%, 100%`.

Approval itself is complete for all twelve Doctors. The remaining percentage reflects optional professional-profile/registration metadata and booking availability, not missing mandatory onboarding evidence.

Fixture care scenarios include upcoming care with no report shared, one report shared, two reports shared for comparison, a revoked report share, Patient-verified OCR values, and historical completed/cancelled appointments. Access remains scoped to the Doctor/Patient/appointment relationships represented in those fixtures. Normal restarts preserve local appointment/share/review changes; scenarios refresh only when prior fixture care is no longer active and has not already been changed during the current Dhaka day.

## Validation checklist

### Backend/security

- Flyway V22 references `patient_medical_reports` and V16 appointment ownership keys.
- Doctor A cannot read Doctor B's appointment or report by UUID.
- `SYSTEM_ADMIN`, `RESEARCHER`, `HOSPITAL_ADMIN` and unrelated Doctors do not inherit clinical access.
- Unshared/revoked/archived reports return unavailable without metadata leakage.
- Raw report content still passes the existing SHA-256 integrity check before display/download.
- Structured OCR uses only Patient-verified extraction data.
- Doctor observation reviews remain additive.
- Appointment cancel/reschedule preserves the existing slot/share/Patient-notification behavior.
- Fixture seeding is idempotent and dev-only.

### Frontend/UX

- Doctor login lands at `/doctor`.
- Doctor Account & Security remains inside the Doctor shell.
- 1440 / 1280 / 1024 / 768 / 390 px visual checks have no horizontal overflow.
- Normal desktop (`xl`) shows source report and structured results as a practical dual-pane workspace.
- Appointment with no shared report remains a valid, calm consultation state.
- Pagination has a visible Load more action.
- Original file supports inline preview, open and secure download.
- Report compare requires two different Patient-shared reports.
- No 6D AI reasoning appears on the 6C report surface.
- No fake clinical scores, fake alerts or fake appointment-acceptance controls appear.

### Repository gates

Run the normal CI-equivalent gates after application:

- `npm run lint`;
- `npm run format:check`;
- `npm run typecheck`;
- `npm run test:run`;
- `npm run build`;
- backend Maven tests;
- existing Patient booking/report-sharing/OCR regression tests;
- Docker/Flyway runtime smoke test;
- browser visual/accessibility review.
