# Clinora AI — Phase 10P Patient MedGemma Report Intelligence SRS Update

**Document status:** OWNER-DIRECTED IMPLEMENTATION BASELINE
**Version:** 1.1
**Date:** 2026-09-03
**Scope:** Patient report AI insight generated from Phase 9P verified structured observations

## 1. Purpose and authority

This document defines the Phase 10P implementation boundary for Patient-facing MedGemma report intelligence.
For Phase 10P, this document supplements the current repository source and the Phase 4 Role/Auth SRS Update.
It does not authorize the Doctor clinical AI workspace, autonomous diagnosis, prescriptions, Research access to
Patient clinical data, or direct image interpretation by MedGemma.

## 2. Product outcome

Phase 10P adds one controlled workflow to the existing Patient AI Report Analysis feature:

```text
Private Patient report
  -> Phase 9P OCR/extraction
  -> Patient correction/review
  -> VERIFIED structured observations
  -> explicit Generate AI insight action
  -> Spring Boot authorization/orchestration
  -> private MedGemma service
  -> evidence-linked clinical reasoning
  -> validated Patient-safe insight
  -> private persistence + notification/timeline
```

The AI result is educational decision support. It is not a diagnosis and does not replace a qualified clinician.

## 3. Model baseline

Phase 10P uses `google/medgemma-1.5-4b-it` as the default local model.

Runtime rules:

- Spring calls only the dedicated FastAPI `ai-service` on port 8001.
- FastAPI sends the approved Phase 10 prompt to a local llama.cpp chat-completions server on `127.0.0.1:8002`.
- The configurable llama.cpp URL must remain an HTTP loopback URL; non-local URLs are rejected.
- No Gemini API or Gemini reasoning service is used.
- No OpenAI or other external inference API is used.
- AI concurrency is fixed at one request at a time and generation is deterministic.
- FastAPI `/ready` succeeds only when llama.cpp reports that its model is loaded and ready.
- The temporary local feasibility profile uses `gguf-org/medgemma-1.5-4b-it-gguf:Q4_0`.
- The final GGUF must be controlled by Clinora and converted/quantized from the already-downloaded official Google
  MedGemma weights; model files must never be committed.
- Production deployments should pin `HF_MODEL_REVISION` to an immutable model revision after validation.

## 4. Phase 9P is the only Patient AI input gate

Phase 10P may analyze a report only when the latest applicable extraction result has
`review_status = VERIFIED`.

The AI input snapshot is built only from effective, verified observations with one of:

- `PATIENT_CONFIRMED`
- `PATIENT_CORRECTED`
- `DOCTOR_VERIFIED`

The AI input must not contain:

- Patient name
- email
- phone
- address
- user UUID
- report filename
- MinIO/object-storage key or URL
- original report binary
- OCR bounding boxes
- raw OCR text
- authentication/session data

The internal observation UUID is allowed solely as a transient evidence anchor so model reasoning can be checked
against the exact supplied observations. It is not a Patient identity.

## 5. MedGemma reasoning contract

MedGemma itself generates the clinical reasoning text. JSON is used only as a transport/validation envelope so
Clinora can safely render and persist the model output; JSON is not a separate reasoning engine.

The model may return:

- notable findings;
- plausible clinical patterns;
- concise reasoning linking supplied findings to each pattern;
- contradictory supplied evidence;
- missing evidence that would reduce uncertainty;
- possible causes framed as possibilities;
- investigation/questions to discuss with a clinician;
- a Patient-friendly explanation;
- explicit limitations.

The model must be allowed to return:

- `NO_CLEAR_ABNORMAL_PATTERN`; or
- `INSUFFICIENT_EVIDENCE`.

The prompt must never force a fixed number of diseases.

## 6. Explicit Patient safety boundary

Phase 10P must not generate or present:

- a definitive diagnosis;
- medication recommendations;
- medication doses;
- instructions to start, stop, or change treatment;
- an LLM-invented numeric probability that the Patient has a disease;
- fabricated symptoms, demographics, history, tests, or laboratory values.

Clinical-pattern support is qualitative only:

- `LIMITED`
- `MODERATE`
- `STRONG`

These labels represent how strongly the supplied observations support the generated pattern; they are not calibrated
disease probabilities.

## 7. Evidence integrity

Every notable finding must reference an observation ID supplied to MedGemma.

Every proposed clinical pattern must include at least one supplied supporting observation ID.

The AI service rejects output when it:

- references unknown observation IDs;
- violates the strict response schema;
- crosses the treatment boundary;
- uses prohibited definitive-diagnosis language;
- presents numeric disease probability/confidence claims.

Rejected output is never persisted as a successful analysis and is never shown to the Patient.

## 8. Backend authorization and ownership

Only an authenticated active `PATIENT` may use the Phase 10P endpoints.

Spring Boot remains authoritative for:

- JWT authentication;
- active-account validation;
- report ownership;
- archive state;
- verified-extraction state;
- AI job creation;
- AI input minimization;
- persistence;
- timeline and notification events.

The browser never calls the FastAPI AI service directly.

## 9. Internal service contract

Spring calls:

```text
POST /internal/v1/report-analysis
X-Clinora-Internal-Token: <server-only secret>
```

The AI service does not access PostgreSQL, MinIO, JWTs, appointments, Research data, or user accounts.

## 10. Persistence and reproducibility

Flyway V20 introduces private Patient AI job and result tables.

Each job stores:

- Patient/report/extraction foreign keys for authorization and audit inside the backend;
- a SHA-256 input fingerprint;
- the minimized structured input snapshot actually sent for inference;
- model name and configured revision;
- prompt version;
- schema version;
- lifecycle timestamps and failure code.

The input fingerprint covers the input snapshot plus configured model/prompt/schema versions.

If verified observations later change, an older result is surfaced as stale rather than silently treated as current.
Identical successful inputs are reused instead of generating duplicate inference work.

## 11. Patient API

```text
GET  /api/v1/patient/reports/{reportId}/ai-analysis
POST /api/v1/patient/reports/{reportId}/ai-analysis
```

`POST` is idempotent at the database/business-contract level for the same verified input snapshot and configured
model/prompt/schema versions.

Possible job states:

```text
NOT_READY
NOT_REQUESTED
QUEUED
PROCESSING
SUCCEEDED
FAILED
```

## 12. Patient UX

The existing `/patient/analyze/:reportId` workspace is extended after Phase 9P verification.

The Patient must see:

1. clear indication that only verified values are analyzed;
2. an explicit **Generate AI insight** action;
3. queued/processing state without fake percentage progress;
4. notable findings;
5. possible clinical patterns;
6. evidence-support labels;
7. MedGemma-generated concise reasoning;
8. missing/uncertain evidence;
9. discussion points for a clinician;
10. a plain-language explanation;
11. prominent limitations;
12. a path to Doctor discovery.

The UI must not show a prediction as a confirmed diagnosis.

## 13. Failure behavior

A MedGemma failure must not modify the original report or verified extraction.

Failures are stored as controlled codes, for example:

- `AI_SERVICE_UNAVAILABLE`
- `AI_MODEL_UNAVAILABLE`
- `AI_RESPONSE_REJECTED`
- `AI_SERVICE_AUTH_FAILED`
- `AI_TIMEOUT`
- `AI_PROCESSING_INTERRUPTED`
- `AI_PROCESSING_FAILED`

llama.cpp timeout, unavailability, busy/capacity, or malformed output is converted by the AI service to an existing
controlled failure state rather than exposing a traceback or raw runtime response to the Patient.

## 14. Notifications and privacy

Successful analysis may create an in-app/report notification that the insight is ready.

Notification/email content must not contain disease names or other AI-derived clinical conclusions. The Patient must
authenticate to view the insight.

## 15. Research boundary

Research controllers and dataset builders must not query Phase 9 extraction tables or Phase 10 Patient AI tables
directly.

Any future Research use requires a separately approved, purpose-limited, de-identified projection with project and
dataset approval controls.

## 16. Doctor boundary

Phase 10P does not create an official diagnosis. A future Doctor clinical phase may add a professional view of:

- original report;
- verified structured values;
- Patient-facing AI insight;
- richer professional reasoning;
- Doctor accept/modify/reject workflow.

That future workflow requires its own authorization and clinical-record rules.

## 17. Test and publication gates

Phase 10P is not publishable until all applicable repository gates pass, including:

- AI-service contract/safety unit tests;
- Python compilation;
- frontend formatting, lint, TypeScript, tests, and build;
- backend Maven tests;
- Flyway V20 migration on the intended PostgreSQL baseline;
- PATIENT ownership/RBAC tests;
- verified-extraction gate test;
- stale-input behavior test;
- invalid AI response test;
- local MedGemma `/ready` smoke test;
- at least one real end-to-end report -> OCR review -> MedGemma insight flow;
- desktop and mobile visual/interactive review.

A software test pass does not establish medical-model accuracy. Any medical performance claim requires a separate,
clinician-reviewed evaluation protocol and representative held-out data.

## 18. Phase 10P non-goals

This phase does not authorize:

- Gemini API integration;
- autonomous diagnosis;
- prescriptions or treatment recommendations;
- symptom-chatbot workflows;
- direct MedGemma analysis of the original Patient PDF/image;
- Doctor clinical approval workflows;
- Research access to identifiable Patient AI data;
- Hospital/Blood Bank AI features;
- model fine-tuning or claims of clinical validation.
