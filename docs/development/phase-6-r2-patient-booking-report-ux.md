# Phase 6 R2 — Patient booking and report-selection experience

Phase 6 R2 refines the Patient-facing Doctor booking flow without changing the Phase 6 appointment authorization model or starting Clinora AI consultation reasoning.

## Product rule

Patient-facing choices use recognizable clinical context first and technical provenance second. A Patient must not need to remember upload filenames, hashes, UUID-like labels, or capture names such as screenshots to identify a report.

## Report identity

Clinora resolves a safe display title in this order:

1. a recognizable Patient-managed report title;
2. a recognizable original filename stem;
3. report type plus clinical report date;
4. report type plus provider/laboratory;
5. the report-type label.

Common capture names, UUID/hash-like names, and timestamp-only filenames are treated as technical provenance rather than primary UI labels. The immutable original filename remains available in report details/preview. Renaming edits the Patient-managed title only; it does not rename the stored object, modify report bytes, alter checksums, or rewrite OCR evidence.

The same resolver is used in appointment report shares and Doctor authorized report/review projections so a technical stored title is not leaked back into a care workflow.

R2 deliberately adds no database migration. `patient_medical_reports.report_name` already represents Patient-managed display metadata, while `original_filename`, object storage keys, report bytes, checksums, OCR evidence, and archive state remain separate. The refinement changes presentation and safe metadata handling rather than duplicating the same title into another column.

## Booking report picker

The booking page uses a reusable report picker instead of rendering the first N reports as an inline checkbox dump.

- Reports load only when the picker is opened.
- Search is server-side across the Patient's active report collection.
- Report type filtering and server pagination keep the flow usable for large report libraries.
- The picker shows report date/provider/upload date only when useful; it does not repeat `Date not provided`.
- Preview stays inside the booking task so slot, reason, and selected reports are preserved.
- A Patient can edit the display title without leaving the picker.
- Selection is by report ID, never by title text.
- The UI enforces the existing API maximum of 20 reports per appointment.
- No report is shared until booking confirmation succeeds.

## Date and time selection

Availability is presented by Patient-local date. Concrete slots show start time, end time, and duration. Zero/negative-duration data is never offered as a selectable appointment. The booking review uses the selected concrete slot duration rather than a guessed percentage or derived progress value.

## Conflict recovery

Appointment creation remains idempotent.

If the selected slot is taken concurrently, Clinora refreshes availability, clears only the unavailable slot, and preserves the Patient's note and report choices. The Patient chooses another time and confirms again.

If a selected report becomes archived while the booking page is open, backend authorization rejects it. The UI re-checks the selected report, removes it only when the server confirms that it is archived, and preserves the chosen time and note. Unknown/network failures do not silently discard Patient choices.

## Patient-facing Doctor presentation

Doctor discovery and booking surfaces prioritize the verified professional identity already established in R1: profile photo, name/title, specialty, approved experience, organization/position when available, Clinora verification, and real next availability. Private registration identifiers and onboarding documents remain private.

## Explicit non-goals

R2 does not add disease prediction, consultation notes, prescriptions, messaging, payments, live queue position, or fake availability. Appointment token/serial, realtime readiness/presence, recurring availability policy, and later consultation workflow remain in their approved Phase 6 refinements.

## Validation expectations

Before publication, run backend tests, frontend lint/typecheck/tests/build, PostgreSQL/Flyway startup, Docker runtime smoke tests, and desktop/mobile browser QA. In particular verify a Patient with a large library can identify, preview, rename, select, remove, and share the intended reports without recognizing the original filenames.
