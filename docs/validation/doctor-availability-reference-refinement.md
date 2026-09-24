# Doctor Availability reference refinement

Branch: `phase-6e-6h-premium-clinical-workflow`

Starting SHA: `74404e23b415a44040ddd5e14f7a10a24954e0ef` (clean working tree).

## Route and architectural trace

`frontend/src/App.tsx` routes `/doctor/availability` to `DoctorAvailabilityWorkspacePage` in `pages/doctor/doctor-availability-r3-page.tsx`.

The existing `GET/PUT /api/v1/doctor/availability/weekly` contract reads/writes the routine through `WeeklyAvailabilityService`. Its JDBC persistence uses `doctor_weekly_availability_rules` and the version, duration and preferred timezone in `doctor_booking_profiles`. Saving materializes real `doctor_availability_slots`, retiring only future AVAILABLE generated slots and preserving BOOKED/manual/history records. `WeeklyAvailabilityScheduler` tops up the 12-local-week horizon (default hourly). Patient booking reserves concrete slots under the existing locks/conditional updates and snapshots the current meeting room for ONLINE appointments. BOTH slots support either mode.

`PUT /api/v1/doctor/availability/meeting-room` continues through `DoctorMeetingRoomService` and the existing authoritative HTTPS/host/credential validation. It updates eligible future online appointments and their notifications. No scheduling, booking, meeting propagation, Patient joining or notification behavior was changed.

## UX changes

Previously, settings were detached from a schedule heading, days used per-block checkboxes and repeated Add block controls, room/security information was stacked, and the preview was a raw timestamp list. The approved image now guides the compact page heading, horizontal consultation/security card, weekly schedule surface and calendar preview.

- Meeting URL and save/change action are inline on desktop, with security guidance on the right. The saved-link test action never opens an unsaved draft. Saving, backend validation and success use real API results. URL validation is no longer separately reimplemented in this component.
- Duration and timezone sit in the Weekly schedule header. All backend-supported five-minute duration increments from 15 to 120 are selectable; the selected value comes from the persisted routine.
- Seven labelled day switches reveal compact start/end/mode controls. Enabling a new day creates an empty local draft. Disabled-day drafts remain available locally; only enabled blocks are published. Add/remove, multiple blocks and friendly consultation labels are supported.
- Row-level validation catches missing/reversed times, blocks shorter than the duration, overlaps, and online modes without a saved room. Backend validation remains authoritative. Adjacent minute/second-formatted times are compared numerically.
- Save status distinguishes unsaved, saving, saved and failed requests. Failed requests keep edits. A preview refresh failure does not falsely report that a successful routine save failed. Room and routine writes cannot race through this UI.
- The preview covers today plus the next 13 dates in the persisted timezone, seven columns at a time with previous/next week navigation. Each day initially shows three real slots and prioritizes visibility of a booking when present; expansion shows the remaining slots. BOOKED slots have a lock, neutral styling and no mutation controls. AVAILABLE uses cyan; no availability is quiet. Mobile CSS stacks days and editor controls.
- The 12-week explanation matches the existing materializer. No last-updated timestamp is displayed because the routine response has no reliable routine-specific timestamp. No client timestamp is substituted.

The saved URL, timezone, duration, rules, modes and slot statuses come from the backend. Calendar dates derive from the current clock and saved timezone; times and counts derive from concrete slots. No sample schedule, meeting URL, appointment, slot or status is seeded in product code. Synthetic values exist only in tests.

## Minimal API addition

The original Doctor list was capped at 120 future rows, including BLOCKED inventory. It cannot guarantee a complete busy two-week preview. Optional `from`/`until` Instant query parameters now select a complete future AVAILABLE/BOOKED range, scoped to the authenticated Doctor and bounded to 16 days. The UI requests 15 elapsed days to cover 14 local dates across timezone/DST boundaries. Calls without range parameters retain the original contract and limit. No DTO change, migration or materialization change was needed.

## Changed files

- `frontend/src/pages/doctor/doctor-availability-r3-page.tsx`
- `frontend/src/pages/doctor/doctor-weekly-availability.test.tsx`
- `frontend/src/features/appointments/appointment-api.ts`
- `frontend/src/features/appointments/doctor-meeting-room.tsx`
- `frontend/src/features/appointments/doctor-meeting-room.test.tsx`
- `frontend/src/features/appointments/availability-calendar.tsx`
- `frontend/src/features/appointments/weekly-schedule-editor.tsx`
- `frontend/src/features/appointments/weekly-availability.ts`
- `frontend/src/features/appointments/use-weekly-availability.ts`
- `frontend/src/styles/doctor-availability.css`
- `backend/src/main/java/com/clinora/doctors/api/DoctorAvailabilityController.java`
- `backend/src/main/java/com/clinora/appointments/service/PatientAppointmentService.java`
- `backend/src/test/java/com/clinora/appointments/service/DoctorAvailabilityRangeTest.java`
- `backend/src/test/java/com/clinora/doctors/service/WeeklyCareIntegrationTest.java`
- This validation record.

App routing, the global sidebar, other Doctor/Patient pages, shared surface primitives and `styles-r3.css` were inspected and left unchanged. Availability styling lives in its own imported stylesheet.

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed; seven existing Fast Refresh warnings in unrelated files, no errors.
- `npm run test:run`: initial unrestricted concurrency produced three unrelated accessibility-test timeouts. `npm run test:run -- --maxWorkers=2`: **50 files / 301 tests passed**. No timeout or test configuration was changed.
- `npm run build`: passed; Vite retained its existing large-chunk advisory.
- `mvn -q "-Dapi.version=1.44" "-Dtest=DoctorAvailabilityRangeTest,WeeklyAvailabilityServiceTest,PatientAppointmentServiceTest,WeeklyCareIntegrationTest" test`: **24 tests passed**, including **13 disposable PostgreSQL integration tests**. Coverage includes real range results beyond 120 slots, hidden blocked inventory, booking concurrency/protection, multiple weekly blocks, DST/top-up behavior, room assignment/propagation and notifications. The repository-documented Docker API compatibility option was required; no persistent environment setting changed.
- Frontend focus includes persisted/off/on/multiple-block states, add/remove, friendly modes, duration/timezone, unsaved/saving/saved/failure states, backend URL validation, saved-room requirement, calendar statuses/expansion/navigation, timezone boundaries, preview-refresh failure and an automated accessibility audit.
- Local Compose backend/frontend were rebuilt/refreshed. Backend health is UP. Authenticated local API smoke loaded a real routine with one block and an existing room/timezone, and 57 real upcoming AVAILABLE/BOOKED slots. A partial range returned HTTP 400. No Doctor routine/room/booking was changed by the smoke check. No credentials or raw room URL were included in outputs or committed files.
- `git diff --check`: passed before commit.

## Visual verification limit

Runtime visual comparison could not be performed.

The browser inventory returned no browsers; creating an in-app browser failed with `Browser is not available: iab`. The local runtime was reachable, but screenshots at 1440, 1280, 1024, 768 and 390 pixels could not be captured. Responsive layout is implemented and structural/interaction tests pass, but pixel-level similarity, rendered spacing and absence of horizontal overflow at those sizes are not claimed as visually verified.

No merge or force-push was performed. Only the feature branch is the publication target; main remains untouched.
