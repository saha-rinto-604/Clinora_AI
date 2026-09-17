# Phase 6D-R1 to R3 — Generalized Doctor Query Understanding

Base branch: `phase-6d-doctor-clinical-support-foundation-router`

Patch base SHA: `47d89a7fa053a45151955e53c2fd0ef87f779f93`

## Scope

This refinement adds a generalized semantic understanding layer above the existing eight Clinora Clinical Support tasks without replacing production routing yet.

### R1 — Doctor Clinical Query Frame

The new `DoctorClinicalQueryFrame` represents the Doctor's information need independently from surface wording. It captures:

- information needs;
- clinical focus terms;
- Doctor-authored assertions and stance;
- relationship/pattern mode;
- temporal intent;
- evidence scope;
- discourse referents;
- unresolved ambiguities.

Doctor assertions are context only. They never become Patient facts, diagnoses, or evidence.

### R2 — Local query interpreter

`POST /internal/v1/doctor-support/interpret` is an internal-token-protected AI-service endpoint backed by the same local MedGemma/llama.cpp runtime already used by Clinora.

The interpreter:

- never answers the clinical question;
- never receives Patient identity, hidden reports, report values, or unrelated Patient data;
- interprets wording compositionally instead of relying on a phrase list;
- uses conservative local normalization only as a parsing aid;
- returns strict JSON constrained by `doctor-query-frame-v1`;
- uses a small per-call generation budget (`DOCTOR_QUERY_INTERPRETER_MAX_TOKENS`, default 320, clamped to 128–512);
- rejects truncation instead of launching a costly repair generation;
- reports prompt/completion token counts and wall-clock duration for evaluation.

No external runtime API is introduced.

### R3 — Deterministic planner and shadow comparison

`DoctorSupportPlanner` maps semantic information needs into the existing `DoctorSupportTaskRegistry`. The registry remains authoritative and all existing required-context gates are preserved.

`DoctorQueryShadowEvaluationService` can compare the current production route with the candidate semantic plan. It is intentionally **not called by the production routing path** in R1–R3, so this patch does not add an extra MedGemma call or latency to live Doctor requests.

The shadow result contains task/status/performance metadata only. It does not contain the raw Doctor message, Patient evidence, or model prose.

## Existing task mapping

- `SUMMARIZE` → `BRIEF_PATIENT` for appointment scope, otherwise `FOCUSED_EVIDENCE_QUESTION`
- `INTERPRET_FINDING` → `FOCUSED_EVIDENCE_QUESTION`
- `RELATE_FINDINGS` → `CONNECT_EVIDENCE`
- `COMPARE` / `TRACE_CHANGE` → `COMPARE_EVIDENCE`
- `CHECK_ASSESSMENT` / `CHALLENGE_HYPOTHESIS` → `CROSS_CHECK_ASSESSMENT`
- `IDENTIFY_GAPS` → `FIND_GAPS`
- `EXPLAIN_POSSIBILITIES` / `DIFFERENTIATE` → `EXPLORE_EXPLANATIONS`
- `ORGANIZE_NOTES` → `STRUCTURE_NOTES`

Compound frames are deduplicated and returned in registry order.

## Safety boundary

This patch does not change Doctor authorization, report sharing, evidence assembly, RAG, grounding, execution prompts, frontend behavior, or medical-record persistence.

The production router remains authoritative until the R4–R7 migration is separately validated.

## Recommended validation

```powershell
# Backend focused
cd backend
mvn.cmd -q -Dtest=DoctorSupportPlannerTest,DoctorQueryShadowEvaluationServiceTest,DoctorSupportRoutingServiceTest test

# Backend full
mvn.cmd -q test

# AI focused
cd ..\ai-service
.\.venv\Scripts\python.exe -m pytest -q tests\test_doctor_query_interpreter.py tests\test_doctor_support_routing.py

# AI full
.\.venv\Scripts\python.exe -m pytest -q

# Syntax
.\.venv\Scripts\python.exe -m compileall -q app tests scripts
```

When local llama.cpp and ai-service are running, manually call the internal interpretation endpoint only through an authenticated backend/dev harness. Do not print or paste the internal token into logs.

## Deliberately deferred to R4–R7

- bounded multi-turn conversation/discourse state;
- pronoun/referent carry-over across turns;
- passing the semantic frame into clinical execution prompts;
- switching production routing to the new interpreter/planner;
- task-specific production generation budgets and broader latency tuning;
- generalized live clinical-quality benchmark and production migration.
