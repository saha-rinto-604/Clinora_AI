# Phase 6D.1 and 6D.2 Doctor Clinical Support Foundation and Router

## Scope

This increment establishes the production boundary for Doctor-facing Clinora Clinical Support and routes Doctor requests to supported operations. It does not generate clinical answers. The router identifies the operation, determines whether one targeted clarification is required, or rejects an unsupported request.

The supported task IDs are:

1. `BRIEF_PATIENT`
2. `CONNECT_EVIDENCE`
3. `COMPARE_EVIDENCE`
4. `CROSS_CHECK_ASSESSMENT`
5. `FIND_GAPS`
6. `EXPLORE_EXPLANATIONS`
7. `STRUCTURE_NOTES`
8. `FOCUSED_EVIDENCE_QUESTION`

Routing status is a separate concept: `ROUTED`, `CLARIFICATION_REQUIRED`, or `UNSUPPORTED`. Clarification and unsupported states are never represented as clinical tasks.

## Request flow

```text
Doctor
  -> Context Collector
  -> Task Router
  -> clarification if needed
  -> Task Registry
  -> Authorization
  -> Authorized Evidence
  -> [future Clinical RAG where task requires it]
  -> [future MedGemma clinical task]
  -> Grounding and Safety
  -> Doctor UI
```

In the current phase, processing stops after the routing or clarification decision. The future evidence, RAG, clinical-task, grounding, and response stages are documented insertion points rather than implemented behavior.

## Authoritative Task Registry

`DoctorSupportTaskRegistry` is the backend source of truth. Each `DoctorSupportTaskSpec` contains the task ID, purpose, routing description, example utterances, required context, multiplicity policy, label, and short Doctor-facing description. The registry preserves a deterministic task order and generates clarification options. The semantic model cannot create clarification labels or new task IDs.

The specification is intentionally extensible. Later phases may add a prompt template, clinical response schema, and per-task RAG policy without changing the routing status or task identity model.

## Authorization and context boundary

The Spring backend is the only public entry point:

`POST /api/v1/doctor/appointments/{appointmentId}/clinical-support/route`

The frontend never calls the AI service directly. Spring derives the Doctor identity from the authenticated JWT, requires an active approved Doctor, requires a currently active Doctor-owned appointment, and authorizes every referenced report through `DoctorClinicalAccessService.requireSharedReport`.

Every selected observation must belong to a Patient-verified extraction for one of those already authorized reports. Missing, unshared, revoked, foreign, archived, and unrelated report IDs retain the existing opaque unavailable semantics. No hidden report metadata, count, report type, observation, or existence signal is added to the routing context.

The AI-accessible evidence boundary is therefore always a subset of the Doctor-accessible evidence boundary. A fresh request rebuilds context from current shares, so revocation is effective immediately.

The semantic router receives only minimized context: screen type, current report type when authorized, selected object counts, assessment/notes availability, comparable-report availability, and selection type. It does not receive Patient identifiers, Doctor identifiers, report identifiers, observation identifiers, medical values, filenames, or hidden-record counts.

## Hybrid routing

Routing proceeds in three stages:

1. A valid explicit UI task routes deterministically and does not invoke MedGemma.
2. Bounded high-confidence phrase rules route direct, casual, contextual, and compound requests that are safe to classify deterministically. This includes longitudinal comparison, assessment cross-checking, evidence connections, gap finding, explanation exploration, note structuring, and common encounter-briefing wording.
3. Requests not safely resolved by those stages use the private MedGemma semantic classifier.

Required context is evaluated after either deterministic or semantic task selection. For example, “Compare this with the previous one” routes without clarification when the current authorized report has a comparable authorized report. If no comparable authorized report exists, the response is `CLARIFICATION_REQUIRED` with reason `MISSING_REQUIRED_CONTEXT` rather than an invented comparison.

Task arrays are deduplicated and returned in registry order. Unknown IDs, duplicate IDs, malformed JSON, empty `ROUTED` results, task IDs on non-routed statuses, and clarification options on incompatible statuses are rejected.

## Clarification behavior

Casual language alone is not ambiguous. Context can resolve “this,” “that,” and “the previous one.” Broad requests such as “Check this” and “What do you think?” return `CLARIFICATION_REQUIRED` with reason `AMBIGUOUS_INTENT`.

Clarification options are valid registry entries filtered by available context. Each option contains the registry task ID, label, and short description. The semantic model may propose only task IDs; it never writes option labels. One selection returns as an explicit task on the next request and bypasses the model, preventing repeated interpretation loops.

`MISSING_REQUIRED_CONTEXT` is distinct from `AMBIGUOUS_INTENT` and includes the missing context kinds, such as `COMPARABLE_REPORTS` or `DOCTOR_ASSESSMENT`.

## Router prompt and untrusted input

The AI service uses the dedicated `doctor-request-router-v1` prompt and router-specific JSON schema. It instructs the model to classify only, never perform clinical reasoning, diagnose, recommend treatment, answer the medical question, create tasks, or expose hidden reasoning.

Doctor text is placed in an explicitly delimited untrusted-data section of the user message. It is never used as a system message. Instructions embedded in Doctor text cannot override the router role or authorization boundary.

Generation remains deterministic with temperature zero, top-p one, a configured seed, local loopback-only llama.cpp access, and the existing internal-token boundary. The shared `MedGemmaRuntime` now accepts an optional caller-owned response schema; Patient report analysis continues to use its existing schema and prompt unchanged.

## Unsupported requests

Treatment or dosing requests, attempts to access private evidence, prompt-injection attempts that ask to ignore access restrictions, diagnosis requests, and unrelated questions are not forced into an evidence task. They return `UNSUPPORTED`. Authorization failures continue to return the existing opaque unavailable response before semantic routing.

## Non-goals and later phases

Phase 6D.1 and 6D.2 intentionally do not implement:

- clinical answers or task execution;
- evidence comparison or connection reasoning;
- assessment validation;
- gap analysis or differential generation;
- RAG, vector storage, or a clinical knowledge corpus;
- consultation-note generation;
- the full Doctor Clinora drawer;
- consultation, prescription, order, referral, or follow-up workflows;
- any change to Patient AI, Patient Gemini Health Summary, or appointment lifecycle behavior.

Phase 6D.3 can add task execution contracts behind the registry while retaining this router and authorization boundary. Phase 6D.4 can insert task-specific RAG between authorized evidence selection and future MedGemma clinical execution. Phase 6D.5 can build the contextual Doctor experience using the routing states and clarification option contract added here.
