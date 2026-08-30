# Clinora AI — Phase 5B Patient Medical Report Vault

- **Status:** implementation and publication verification complete on `phase-5b-patient-report-vault`
- **Baseline:** `main` at `41d5657b9964c230d7e0090b42a7208679be7164`
- **Scope:** Patient-owned report storage, organization, secure retrieval, and Patient workspace integration

## Purpose

Phase 5B turns the Patient Medical Reports experience into a real, end-to-end document vault. It extends the Phase 5A Patient shell and design system, reuses the Phase 4 private S3-compatible storage pattern, and keeps all ownership decisions tied to the authenticated Patient account.

The interface is a Patient-facing health-record workspace, not a generic administration dashboard. It presents useful report metadata and deliberate loading, error, empty, no-results, current, archived, and restore states without inventing clinical data or processing activity.

## Data and storage

- Flyway `V14__create_patient_medical_report_vault.sql`
- one Patient user to many medical reports
- metadata in PostgreSQL; original bytes in a private S3-compatible bucket
- randomized owner-scoped object keys; no object keys or storage credentials in API responses
- SHA-256 recorded at upload and checked before every view or download
- immutable original file bytes; metadata remains editable
- archive/restore timestamps instead of permanent deletion
- rollback cleanup prevents an object from remaining when its database transaction fails
- strict PDF/JPG/JPEG/PNG signature, terminator, MIME, extension, non-empty, and 20 MB validation

Local Compose uses MinIO bucket `clinora-medical-reports`. The production profile requires explicit report-storage endpoint, region, bucket, and credentials and defaults bucket auto-creation off.

## Patient API

All routes require `ROLE_PATIENT`. The service also rechecks that the authenticated user exists, is an active Patient, and owns the requested report. Own-report routes never accept a Patient ID.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/patient/reports` | Upload validated file and useful metadata |
| `GET` | `/api/v1/patient/reports` | Search, filter, paginate, and select current/archive collection |
| `GET` | `/api/v1/patient/reports/{reportId}` | Read owned report metadata |
| `PATCH` | `/api/v1/patient/reports/{reportId}` | Edit report name, type, date, and provider/laboratory |
| `GET` | `/api/v1/patient/reports/{reportId}/content` | Authenticated inline content response |
| `GET` | `/api/v1/patient/reports/{reportId}/download` | Authenticated attachment response |
| `POST` | `/api/v1/patient/reports/{reportId}/archive` | Preserve report in the archive |
| `POST` | `/api/v1/patient/reports/{reportId}/restore` | Restore report to the current library |

Inline and download responses use `no-store`, `must-revalidate`, `nosniff`, and a sanitized content disposition. Upload, view, download, metadata update, archive, and restore actions are audited without placing clinical content in audit metadata.

## Patient experience

### Medical Reports

- concise Patient-facing page header and primary **Upload report** action
- report search by name, original filename, provider, or laboratory
- type filtering and current/archive collection control backed by real active and archived collection counts
- report rows with report name, type, report date, provider/laboratory, original filename, file type/size, upload date, and **Open**
- responsive pagination and distinct first-use, loading, error, no-results, archive-empty, and restore behavior

### Upload report

- file, report name, report type, date on report, and provider/laboratory only
- drag/drop and file picker
- client validation backed by stricter server content validation
- actual Axios upload progress
- no fabricated OCR, AI analysis, or processing pipeline

### Report detail

- document preview is the primary workspace
- metadata is arranged in a secondary panel
- Download, Edit details, and Archive/Restore actions
- secure-preview recovery and archive confirmation states

### Patient Home

The existing Medical Reports hero remains visually intact and is now functional. It shows the active report count and latest persisted report when available, opens the same upload experience, and links to the full report library.

## Explicitly outside Phase 5B

- OCR or extracted laboratory values
- AI summaries, interpretation, or medical advice
- Doctor review or Doctor access
- report sharing and consent grants
- public/presigned browser object URLs
- destructive report deletion

## Verification record

- frontend formatting: passed
- frontend lint: passed with eight pre-existing Fast Refresh warnings outside Phase 5B
- frontend TypeScript: passed
- frontend tests: 106 passed across 17 files, including Phase 5B interaction and accessibility tests
- frontend production build: passed
- backend Maven suite: 122 passed across 28 suites with Maven 3.9.11 and Java 21.0.12
- Docker Compose rebuild: passed for frontend, backend, OCR, and AI services
- backend health and Flyway V14: passed
- live Patient report vault smoke: passed for authenticated PDF upload, private MinIO object persistence, list, preview, download, metadata edit, archive, restore, ownership denial, and persistence after backend restart

The Phase 5B publication gate completed successfully on 2026-08-31.
