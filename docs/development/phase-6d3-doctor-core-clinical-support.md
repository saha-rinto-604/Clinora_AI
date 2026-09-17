# Phase 6D.3 — Grounded Doctor Clinical Support Tasks

## Scope

Phase 6D.3 executes the four routed operations `CONNECT_EVIDENCE`, `COMPARE_EVIDENCE`,
`CROSS_CHECK_ASSESSMENT`, and `FIND_GAPS`. It does not add a general Doctor chatbot,
diagnostic automation, prescriptions, consultation-note generation, or RAG.

## Request and execution flow

```text
Doctor UI
  -> Spring /clinical-support/execute
  -> active Doctor + active owned appointment check
  -> exact report-share/observation authorization
  -> deterministic authorized evidence snapshot + SHA-256
  -> private AI /internal/v1/doctor-support/execute
  -> independent task prompt + strict task schema
  -> grounding and safety validation
  -> task results + provenance
  -> Doctor UI contract
```

The execution contract has a stable `executionId`, aggregate job-compatible status
(`QUEUED`, `RUNNING`, `SUCCEEDED`, `PARTIAL_SUCCESS`, `FAILED_SAFE`) and independent
per-task statuses. Execution is synchronous in this phase. A client execution key
suppresses duplicate work in the running backend process and rejects reuse with a
different payload. Durable queue/persistence can replace that boundary without changing
the API contract; outputs are not part of the legal medical record.

## Authoritative evidence assembly

Spring, not MedGemma, assembles clinical truth. It rechecks the current Doctor account,
appointment, every report share, and every selected observation at execution time. A
fresh request therefore immediately excludes a revoked share. Unshared, revoked,
unrelated, and foreign IDs retain the existing opaque unavailable semantics and do not
reveal whether hidden evidence exists.

Only the latest successful, `VERIFIED` extraction for each authorized `SELF` report is
eligible. Only `PATIENT_CONFIRMED`, `PATIENT_CORRECTED`, and `DOCTOR_VERIFIED`
observations are included. The snapshot uses effective corrected values, exact units,
supplied reference ranges, deterministic Clinora range status, extraction ID, source
checksum, and authorization-safe report metadata. Raw documents and unnecessary Patient
identity data never enter the model request.

`report_date` is the only clinical chronology source. Upload dates are never substituted.
Missing clinical dates remain `DATE_UNAVAILABLE`. Canonical biomarker identity and unit
normalization reuse `HealthRecordLabTaxonomy`; numeric direction is computed by Spring.
MedGemma may explain a supplied comparison fact but cannot decide identity, compatibility,
chronology, or direction. If fewer than two reliably dated selected reports are available,
the comparison task returns `EVIDENCE_SELECTION_REQUIRED` and only authorized report
candidates.

## Task isolation and output contracts

Each task has a registry-declared prompt version, response-schema version, execution flag,
and `RagPolicy`. All Phase 6D.3 policies are `DISABLED`. Multi-task requests execute each
task independently from the same immutable evidence snapshot; no model output becomes a
sibling task's input. One failure therefore yields a safe per-task failure while valid
siblings can produce `PARTIAL_SUCCESS`.

Dedicated prompts and strict Pydantic schemas are:

- `doctor_connect_evidence_v1` / `doctor-support-connect-v1`
- `doctor_compare_evidence_v1` / `doctor-support-compare-v1`
- `doctor_cross_check_assessment_v1` / `doctor-support-cross-check-v1`
- `doctor_find_gaps_v1` / `doctor-support-gaps-v1`

The original question and Doctor assessment are delimited untrusted data. An assessment is
ephemeral execution input and is never written to the appointment, consultation, or medical
record. A single retry may repair malformed JSON/schema structure only. Grounding or safety
failure is never repaired by asking the model again.

## Grounding and safety

Post-generation validation rejects unknown observation IDs, ID/label mismatches, wrong
comparison directions or evidence pairs, claims that an in-range observation is abnormal,
treatment/dose language, definitive certainty or numeric clinical probability, ranked
diagnoses, truncated prose, invented symptoms/history, and hypotheses phrased as established
causes. A rejected output is not returned as clinical content.

Successful provenance contains authorized report/observation IDs, evidence snapshot hash,
model/revision/quantization, prompt and schema versions, and grounding status. It never
contains hidden-report metadata or chain-of-thought.

## Future insertion points and non-goals

The task registry already carries a `RagPolicy`, but retrieval is disabled and no vector
database, corpus, or external medical-knowledge source exists in this phase. A later phase
may insert authorized clinical RAG between evidence authorization and the clinical task,
subject to task policy and its own provenance:

```text
Doctor -> Context Collector -> Task Router -> clarification if needed -> Task Registry
       -> Authorization -> Authorized Evidence -> [future task-scoped Clinical RAG]
       -> MedGemma clinical task -> Grounding/Safety -> Doctor UI
```

Deferred work includes the remaining routed tasks, richer evidence-selection UX, durable
asynchronous job storage/queueing, actual RAG, final Doctor drawer, consultation lifecycle,
prescriptions, and all Phase 6E/6F/6G behavior.
