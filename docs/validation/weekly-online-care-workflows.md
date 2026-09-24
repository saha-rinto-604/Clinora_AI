# Weekly scheduling and online care validation

Branch: `phase-6e-6h-premium-clinical-workflow`

Starting commit: `b610776427369244020cf1a60bb91f6cbe916c87`.

## Implementation

- Only new migration V32 (`V32__add_weekly_availability_and_default_meeting_room.sql`) adds weekly rules, a nullable generated-slot link, routine version/duration and the default meeting URL. Applied migrations are unchanged.
- Weekly rules persist local weekday/time, mode, enabled state, duration and IANA timezone. Multiple blocks per day are supported. Version checking rejects stale edits.
- Existing concrete slots remain booking authority. Saving regenerates only future free generated inventory. Historical, manual and BOOKED slots are preserved; cancelling a booking from a retired rule does not reopen retired time.
- Materialization covers 12 local-calendar weeks. An hourly scheduled top-up extends the horizon. DST gaps are skipped; ambiguous times use the first offset once; intervals whose elapsed duration differs from the configured duration are skipped.
- A shared Doctor lock serializes routine changes, room changes and booking/rescheduling. Existing conditional slot reservation and `APPOINTMENT_SLOT_UNAVAILABLE` remain.
- Doctor configuration accepts HTTPS URLs without embedded credentials. ONLINE/BOTH weekly publication requires a room. ONLINE booking and rescheduling snapshot the current room; IN_PERSON always stores null.
- Default-room changes update only future BOOKED ONLINE appointments, refresh `meeting_link_updated_at`, emit idempotent notifications, and audit counts without the raw URL. Completed/cancelled/past/in-person appointments are excluded.
- Patient list/detail/booking responses do not return the raw room URL. GET Join returns status only; POST Join rechecks owner, active account, appointment status, online mode, room and server time. Access opens 15 minutes before the start through scheduled end, or beyond it while the consultation remains IN_PROGRESS. Join responses use `Cache-Control: no-store`.
- Provider admission is outside Clinora control. The Doctor UI explains waiting room/host approval, passcodes, disabling join-before-host and participant admission restrictions. No provider settings are claimed to be verified.
- The existing prescription pipeline was already upload-first. Regression tests prove upload with zero medications, draft privacy, document-only completion and final immutability; production prescription code is unchanged.
- Existing booking/reschedule/cancel/meeting notifications and 24h reminders remain. A 1h reminder uses the same scheduler with a +/-10-minute scan window and stable per-appointment/time source key. Only BOOKED appointments qualify.
- Follow-up recommendation notification is emitted only on completion. Hourly scans create 7d/1d reminders in the original appointment timezone. Recommendations created on/after that window's local day are not sent retroactively.
- Follow-up reminders are suppressed by a future BOOKED appointment with the same Doctor within seven calendar days either side of the recommended date. Cancellation restores eligibility if the window remains open and that reminder has not already been sent.
- Existing notification preferences, PatientNotificationService, outbox and delivery consumer remain authoritative. Email contains generic wording and configured `clinora.email.frontend-url` links to authenticated Clinora, never clinical content or a reusable meeting URL.
- Approved Patients list, Patient detail and Consultation Workspace production layouts are unchanged. No demo routine is hardcoded or imposed on existing Doctors.

## Validation evidence

- Full backend suite: 471 tests passed. Subsequently strengthened integration suite: 12 tests passed (adds multiple blocks/rolling horizon and cancellation-window coverage).
- Focused frontend meeting/editor/patient mode/workspace suite passed; upload-first regression passed.
- Typecheck passed. Lint passed with seven existing Fast Refresh warnings in unrelated files.
- Production build passed with the existing large-chunk warning.
- Final full frontend run: all 50 files / 288 tests passed with `npm run test:run -- --maxWorkers=1 --testTimeout=30000`. Initial parallel run had one showcase accessibility timeout under concurrent build load; no assertion was removed or weakened.
- Docker backend/frontend rebuilt; both healthy. Compose frontend owns localhost:5173; backend owns localhost:8080.
- After the successful smoke test, Docker Desktop's Linux engine became unavailable. A final frontend-only refresh (for the accessible heading rename from "Booking times" to "Weekly availability") could not run. Start Docker Desktop and run `docker compose up -d --no-deps --build backend frontend` to refresh the final checkout. The final production frontend build passed independently.
- Real local API smoke passed using dedicated `@clinora.test` accounts: room configuration, recurring routine, generated-slot booking, automatic room snapshot, BOOKED notification/outbox, early Join denial, idempotent room propagation, IN_PERSON null room, consultation start, first-action PDF upload through real ClamAV/private MinIO, document-only completion, finalized Patient document access and follow-up notification.
- Smoke fixture email was opted out to avoid external test messages; notification/outbox and preference flags were checked. Generic email content and preference-aware delivery were tested against the delivery port in the PostgreSQL integration suite. External provider email receipt and provider meeting admission were not tested.
- Smoke accounts were suspended and their generated availability disabled afterward. The labelled completed test encounter remains auditable. Existing users' routines and appointments were not edited.
- Runtime visual comparison could not be performed: the browser automation inventory was empty and opening localhost returned "No browser is available". No screenshot-based match is claimed.

## Changed files

Backend:

- `appointments/service/PatientAppointmentService.java`
- `appointments/service/PatientConsultationJoinService.java`
- `appointments/api/PatientConsultationJoinController.java`
- `audit/AuthAuditAction.java`
- `consultations/service/ConsultationService.java`
- `doctors/api/DoctorAvailabilityController.java`
- `doctors/service/DoctorMeetingRoomService.java`
- `doctors/service/WeeklyAvailabilityService.java`
- `doctors/service/WeeklyAvailabilityScheduler.java`
- `notifications/service/AppointmentReminderScheduler.java`
- `notifications/service/FollowUpReminderScheduler.java`
- `notifications/service/NotificationDeliveryConsumer.java`
- V32 migration and `PrescriptionUploadFirstTest`, `WeeklyAvailabilityServiceTest`, `WeeklyCareIntegrationTest`.

Frontend:

- `features/appointments/appointment-api.ts`
- `features/appointments/doctor-meeting-room.tsx` and its test
- `features/appointments/patient-consultation-join.tsx`
- `pages/doctor/doctor-availability-r3-page.tsx` and `doctor-weekly-availability.test.tsx`
- `pages/doctor/doctor-appointment-page.tsx`
- `pages/patient/patient-appointment-detail-page.tsx`
- Existing regression tests: `doctor-consultation-reference-layout`, `doctor-route-integration`, `doctor-workspace`, `appointment-consultation-mode`.

Testing entry point: http://localhost:5173/doctor/availability
