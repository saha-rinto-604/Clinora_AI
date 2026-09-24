# Patient care reference redesign

Date: 2026-09-24

Branch: `phase-6e-6h-premium-clinical-workflow`

Starting SHA: `20cd5d28275a2639f617c2da66788eb22d2deee9` (clean working tree).

## Routes and reference mapping

The existing routes in `frontend/src/App.tsx` remain unchanged.

| Route | Routed source under `frontend/src/pages/patient/` | Reference |
| --- | --- | --- |
| `/patient/appointments` | `patient-appointments-page.tsx` | Image 3: appointments overview |
| `/patient/doctors` | `patient-doctors-page.tsx` | Image 2: Doctor discovery |
| `/patient/appointments/:appointmentId` | `patient-appointment-detail-page.tsx` | Image 1: appointment details |

Image 4 is the single decorative asset at `frontend/public/assets/biomedical/patient-care-header-background.webp`. The supplied PNG was converted to WebP at its original 2172 × 724 dimensions (38,964 bytes). No new artwork was generated. The same CSS background appears behind the two directory headers and only the appointment identity banner on the detail page.

## Implementation

- Shared `PatientCareHeader` in `frontend/src/components/patient/` keeps header text and actions in accessible React content. Scoped layout rules are in `frontend/src/styles/patient-care.css`.
- Existing `AppSurface`, `AppSectionHeader`, `IconWell`, `StatusPill`, `Button`/`buttonVariants`, `ProfileAvatar`, `EmptyState`, `Skeleton`, and `Dialog` components are reused. Existing Patient tokens own colors, radii, and interactive styling.
- Overview: compact summary/navigation cards, collection-specific counts, date sorting, date blocks, consultation modes, report-share counts, and detail links. Unknown collection counts remain a “View” action until loaded. Only the selected collection is requested. The report metric is explicitly scoped to the current view and counts appointment/report shares, not distinct report files across bookings.
- Doctor discovery: one labeled search/filter surface; next-available/name sorting over returned results; real availability filtering; compact horizontal identity/professional-context rows; and profile/appointments navigation. The existing 30-result cap is preserved and disclosed when reached. Results and counts are hidden during loading/errors so stale matches are not presented as current results.
- Details: compact identity/date/mode banner, horizontal metadata rows, separate consultation context, actual report links with sharing/revocation, date-grouped available times, mode-compatible rescheduling, cancellation confirmation, and actual booking time. Date grouping and appointment display consistently use the booking timezone. The secure join component remounts after rescheduling to reload its authorization state.
- Existing completed-consultation summaries remain available below shared reports. No clinical or report workflow was removed.

Desktop row padding is 16px; detail surfaces use the existing compact 16–20px padding. Controls retain 40–44px heights. Icon wells remain 40px, Doctor avatars are 48px, and row spacing is 10–12px. Layouts wrap at tablet widths and stack at mobile widths. Heights remain content-driven so long real names and organizations can wrap.

No reference names, appointment dates, organizations, filenames, or counts were hardcoded into production UI. Test data is confined to tests. Doctor verification presentation retains the existing discovery contract, whose server query restricts results to booking-enabled active Doctors with verified email and eligible registration dates; no verification DTO was invented.

No backend, API contract, migration, authentication, RBAC, sidebar, logo, notification placement, or global shell changes. Existing join authorization, 15-minute restriction, provider admission, and suppression of reusable room URLs are preserved.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed with zero errors; seven existing React Fast Refresh warnings in unchanged files.
- `npm run test:run`: 53 files / 310 tests passed.
- Focused care/header and existing Patient regression tests: 5 files / 28 tests passed, repeated after the final metadata accessibility adjustment.
- New coverage includes loaded counts, collection requests, sorting, navigation, Doctor search/specialty/availability, stale-result errors, real detail metadata, report sharing/revocation, date grouping, incompatible modes, rescheduling, cancellation confirmation, and disabled secure joining. Axe checks cover the shared header and populated appointment detail.
- `npm run build`: passed. Vite retains its application bundle-size warning (chunk above 500kB).
- `git diff --check`: passed.

The initial Vite/Vitest invocations encountered sandbox filesystem restrictions while reading their configuration. Authorized reruns outside the sandbox succeeded.

Browser inventory returned no available browser; attempting to connect to the local preview also returned “No browser is available.” Runtime screenshot comparison and actual viewport measurements at 1440, 1280, 1024, 768, and 390 remain unverified. No pixel-match or measured card-height claim is made. Functional checks above use mocked API contracts, not a live-backend end-to-end session.

## Git scope

Only the three care pages, their shared header/styles/artwork, focused tests, and this report are included. The governing DOCX files were read without modification. No merge with `main` was performed. The local `main` reference remains `1b774536d53beac11e863b848dd026a2dbb628ce`. The delivery response records the final commit and feature-branch push result.
