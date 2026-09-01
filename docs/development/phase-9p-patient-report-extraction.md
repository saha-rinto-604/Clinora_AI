# Phase 9P — Patient Medical Report Extraction

## Authority and scope

Phase 9P implements the Patient-facing extraction half of Clinora's **AI Report Analysis** experience. It extends the existing Patient Medical Report Vault; it does not introduce a second document store or a public OCR upload API.

This document is the implementation authority for Phase 9P where older project material assumes Tesseract is the sole OCR engine.

## Locked decisions

- Patient-facing product wording is **AI Report Analysis**, **Analyze a Medical Report**, **Extract Report Data**, and **Extracted Results**. `OCR`, Paddle model names, and engine confidence are implementation details.
- PP-StructureV3 is the primary document extraction engine. Tesseract is retained as an automatic local fallback.
- Spring Boot remains the trusted business orchestrator. React never calls the Python service directly.
- The OCR service receives only an already-authorized private report from Spring and has no PostgreSQL credentials, Patient authorization logic, Research authorization, or MedGemma dependency. Spring authenticates its internal OCR request with a service token.
- Processing is asynchronous through RabbitMQ. The original report remains immutable.
- Structured observations preserve the OCR source value and an effective value. A Patient correction never destroys extraction provenance.
- Low-confidence observations are marked `REVIEW_REQUIRED`; unresolved flagged observations cannot be confirmed. Patients can correct the result type, label, value, comparator, unit, reference range, and source flag while the original OCR snapshot remains preserved.
- The later MedGemma phase must consume the effective reviewed values, not blindly reuse the original OCR value.
- Extraction completion, review-needed, interruption, and failure states reuse the existing Patient `REPORTS` notification/outbox pipeline without placing laboratory values in notification copy.

## Research privacy boundary

Phase 9P does **not** publish Research datasets. Extraction data is private Patient clinical data.

Research controllers and dataset builders must never directly expose or query as ordinary Research output:

- original report bytes or storage keys;
- raw OCR text;
- Patient/user/report/extraction identifiers;
- filename;
- name, email, phone, address, emergency contact, MRN/accession number;
- exact birth date or report/extraction timestamps;
- free-text report content, bounding boxes, or correction actor/timestamp.

A future Research dataset may only consume an explicitly approved, allowlisted, de-identified projection created by the Research dataset pipeline after its own project/dataset authorization policy. The Phase 9 tables are not Research API tables.

## Patient flow

1. Patient chooses **AI Report Analysis** from Home, navigation, or an existing Medical Report.
2. Patient uploads a new report through the existing Report Vault or selects an existing active report.
3. Spring verifies the authenticated Patient owns the report and creates an idempotent extraction job.
4. RabbitMQ dispatches the job. Spring retrieves the private MinIO object and sends it to the internal OCR service.
5. PP-StructureV3 extracts page text/layout; the deterministic Clinora parser normalizes laboratory observations. Tesseract can be used as fallback.
6. Patient sees the original report beside structured extracted results. Bounding-box provenance supports **View on report** for image sources; PDFs jump to the source page.
7. Questionable values are shown as **Needs review**. Patient uses **Correct extraction** to amend transcription errors while preserving the original OCR snapshot.
8. Patient confirms the extracted data only after all flagged observations are resolved.
9. The Patient receives a privacy-preserving report notification when extraction is ready or needs attention.
10. Verified/effective observations become the input contract for the later AI insight phase.

## Security and operational limits

- Accepted source types: PDF, JPEG/JPG, PNG.
- Patient Report Vault remains authoritative at 20 MB.
- The OCR service verifies file signatures, enforces page/pixel limits and processing timeouts, and never logs report contents.
- Model files are downloaded/cached outside Git. The OCR container uses CPU so Phase 10 can reserve local GPU resources for MedGemma.
- Raw OCR text is transient processing data: it is not persisted by Spring and is not returned in the Patient extraction response.
- Queued jobs are republished idempotently after transient queue failures; a processing job left stale after a worker/backend interruption is failed safely so the Patient can retry instead of seeing an endless processing state.

## Phase 9P definition of done

Phase 9P is complete when a real Patient report can be securely queued, extracted, persisted, visually reviewed, corrected with provenance, confirmed, and recovered from a processing failure; Patient ownership/RBAC remains enforced; Research has no direct extraction-data path; and backend/frontend/OCR tests plus Docker runtime gates pass.
