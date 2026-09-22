# Phase 6D.5 — Contextual Doctor Clinical Support

## Delivered scope

Clinora Clinical Support is embedded in the existing Doctor appointment and shared-report review workflows. It is not a standalone AI page or an unrestricted chat surface. The Spring backend remains the only public entry point; the browser never calls the AI service directly.

The final executable registry contains:

| Task | Purpose | RAG policy |
| --- | --- | --- |
| `BRIEF_PATIENT` | Prepare for the current appointment from its authorized context | Disabled |
| `CONNECT_EVIDENCE` | Explain relationships among selected findings | Optional |
| `COMPARE_EVIDENCE` | Compare reliable, authorized evidence over time | Disabled |
| `CROSS_CHECK_ASSESSMENT` | Check temporary Doctor-authored assessment text against evidence | Optional |
| `FIND_GAPS` | Identify relevant information absent from the authorized snapshot | Required when available |
| `EXPLORE_EXPLANATIONS` | Present at most three non-ranked possible explanations | Required when available |
| `STRUCTURE_NOTES` | Organize Doctor-authored text without adding facts | Disabled |
| `FOCUSED_EVIDENCE_QUESTION` | Answer a narrow question about current authorized evidence | Optional |

## Contextual interaction

The appointment surface provides **Brief me**. The server independently loads the active appointment reason and currently shared, non-revoked reports with verified evidence. Contact, address, emergency, hidden-report, and unrelated profile data are not included in the model request.

The report-review surface permits keyboard-accessible selection of exact verified observation IDs. Selection is visually apparent and independent of the existing source-review controls. Available actions are constrained by context: multi-finding operations require multiple selections; comparison is enabled only when a same-type shared report is available.

The panel follows the existing dark navy Clinora family, cyan/teal interaction color, purple reference color, shared radii and border tokens, and reduced-motion behavior. It becomes a right-side modal panel without replacing report evidence on desktop, and occupies the available sheet width on smaller screens.

## Route → clarify → execute

Natural language always enters the existing hybrid router. A routed decision is executed with the same authorization-checked context. `CLARIFICATION_REQUIRED` renders labels and descriptions supplied by the backend Task Registry; choosing one directly executes that registered task, so the Doctor does not need to rewrite the question. `UNSUPPORTED` produces a short scope explanation and never falls back to general chat.

Assessment and note inputs are temporary request data. The UI explicitly states that an assessment is not saved as a diagnosis and notes are not persisted automatically. Changes to selected evidence or temporary text mark an existing result stale and offer a fresh run.

## Structured result boundary

Results keep the following concepts visually separate:

- authoritative Patient evidence, resolved from the backend response by observation ID;
- Clinora interpretation in task-specific sections;
- temporary Doctor assessment or notes;
- missing information and limitations;
- general clinical references resolved from the approved knowledge store.

The UI never parses Patient values from model prose. Evidence chips use the authoritative evidence array returned by Spring. Citation labels use server-resolved title, publisher, section, version and publication date; model-created URLs and retrieval internals are not rendered.

## Safety and chronology

Fresh appointment ownership, professional account state, report share state, report ownership, archival state, verified extraction, and observation eligibility are checked by Spring for every execution. Unavailable IDs retain the existing opaque semantics. The AI model receives only this snapshot.

Brief chronology is constrained as follows: one result supports only a current finding; two reliably dated results may support change; persistence requires at least three reliably dated reports. Upload time is not supplied as clinical chronology.

`EXPLORE_EXPLANATIONS` is bounded to three possibilities and rejects ranking, probability, diagnostic certainty, treatment and dosage. Patient-specific statements require authorized observation references, while general clinical claims require retrieved approved references. `STRUCTURE_NOTES` receives notes as explicitly delimited untrusted data, preserves uncertainty, and fails safely when generated content adds material terms or changes numeric content.

## Execution states

The client represents submitting/running work without fake percentages, renders `SUCCEEDED`, `PARTIAL_SUCCESS`, and `FAILED_SAFE`, and translates known failures into safe language. Raw model output, prompts, stack traces, embeddings, retrieval scores, index paths and internal chunk identifiers are not shown.

## Explicit boundary

Phase 6D.5 does not automatically create or modify diagnoses, assessments, consultation notes, prescriptions, investigations, care plans, or follow-ups. Phase 6E and later clinical-record workflows remain out of scope.
