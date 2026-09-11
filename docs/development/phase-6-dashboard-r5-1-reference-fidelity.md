# Phase 6 Dashboard R5.1 — Reference Fidelity

This frontend-only patch replaces the earlier R5 dashboard interpretation with a stricter implementation of the two owner-approved dashboard references.

## Design rules

- Keep the canonical Clinora logo and existing role shells.
- Use the uploaded Doctor cinematic MP4 as the Doctor dashboard header media, with a generated first-frame poster fallback.
- Keep the existing Patient `PatientCoreExperience` cinematic MP4/poster and its three real actions intact.
- Match the reference hierarchy closely: cinematic header, four compact real-data metrics, primary working surface, and contextual right rail.
- Never add placeholder Patient/Doctor profile photos. Existing `ProfileAvatar` remains authoritative: uploaded image when available, initials otherwise.
- Never fabricate unsupported clinical values, analytics, counts, messages, appointments, AI results, room numbers, or activity.
- Existing backend contracts, security, appointment invariants, report sharing, OCR, and AI logic are unchanged.

## Real data mapping

Doctor dashboard uses only current `DoctorDashboard` fields: `todayCount`, `upcomingCount`, `sharedReportsForUpcomingCare`, `availableSlotCount`, `nextAvailableAt`, `nextAppointment`, `today`, and profile-completion fields.

Patient dashboard uses only current Patient APIs already loaded by `PatientPortalPage`: report dashboard, profile, upcoming appointments, timeline, longitudinal Health Record, and sharing summary. The visual health snapshot uses actual stored height, weight, BMI, clinical-essential counts, and profile completeness; unsupported blood-pressure, heart-rate, sleep, and AI-insight counters from the concept art are intentionally not invented.
