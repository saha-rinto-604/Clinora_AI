# Phase 6D.4 — Doctor Clinical Knowledge RAG

## Scope and safety boundary

Phase 6D.4 adds curated general clinical reference retrieval to the Phase 6D.3 Doctor task executor. It does not
add a chatbot, Patient evidence search, live web access, arbitrary URL ingestion, diagnosis, prescribing, or a new
Doctor UI. Patient AI behavior is unchanged.

Two grounding channels remain deliberately separate:

1. **Patient-specific verified evidence** is assembled and authorized by Spring for the current Doctor and
   appointment. Observation IDs ground statements about this Patient.
2. **General clinical reference knowledge** comes only from an explicitly ingested, locally reviewed corpus.
   Reference chunk IDs ground general medical statements and cannot prove a Patient-specific fact or expand access.

No Patient identifier, report identifier, appointment identifier, clinical value, or raw Doctor sentence is stored
in the knowledge index or retrieval cache. Retrieval queries contain the operation, report type, canonical
observation concepts, and a small allowlist of clinical assessment concepts only.

## Architecture

```text
Doctor request
  -> Spring Context Collector + fresh authorization
  -> Task Registry / task execution policy
  -> Authorized Patient evidence snapshot
  -> controlled clinical-concept query builder
  -> approved-only hybrid clinical knowledge retrieval
  -> Patient evidence and reference knowledge in separate untrusted delimiters
  -> MedGemma clinical task
  -> schema validation + Patient evidence grounding + reference citation grounding
  -> Spring response validation
  -> Doctor UI contract
```

The original Phase 6D flow remains: Context Collector -> Task Router -> clarification if needed -> Task Registry ->
Authorization -> Authorized Evidence. RAG is inserted only after authorization and only for a task whose registry
policy permits it. It never participates in authorization or reveals the existence of inaccessible reports.

## Source lifecycle and ingestion

`ClinicalKnowledgeStore` is vendor-neutral. The current adapter uses a separate SQLite file owned by the private AI
service; it does not alter Clinora's PostgreSQL schema and does not require a network service. The stored document
metadata includes source ID, document ID, title, publisher, source type, clinical domain, publication date, version,
jurisdiction, source reference, review status, content checksum, and ingestion time. Review status is one of
`DRAFT`, `APPROVED`, or `RETIRED`; only `APPROVED` content can be searched or cited.

Ingestion is an explicit CLI operation, never an application-startup side effect. Manifests are strict, content
paths must remain beneath the manifest directory, and input is local UTF-8 text. The section-aware chunker has a
recorded version, stable chunk IDs, bounded size and overlap, checksums, and deterministic ordering. Re-ingesting an
unchanged manifest is idempotent. Updating, approving, or retiring a document produces a new deterministic index
version. No crawler or arbitrary URL importer exists.

The embedding boundary is local and offline. The current `clinora-clinical-hash-embedding-v1` baseline uses a small
controlled clinical synonym map and downloads nothing. The index records the embedding model/version. A later
validated clinical embedding model can replace the provider without changing ingestion, storage, or execution.

## Retrieval

Retrieval combines independent semantic and lexical channels. Results are filtered by approval state and, when the
report type safely maps to one, clinical domain. Central configuration controls candidate count, threshold, top-K,
maximum characters, per-document diversity, and cache size. Merge ordering is deterministic, duplicate chunks and
duplicate content checksums are removed, and one failed channel can fall back to the other. Cache keys contain only
a query hash, task, domain filters, index version, and retrieval configuration version; index updates naturally
invalidate old entries.

The Phase 6D.4 defaults are 12 candidates per channel, a 0.16 hybrid-score threshold, 55% semantic plus 45% lexical
weighting, four final chunks, at most two chunks per document, a 5,000-character reference budget, a 1.5-second
safe timeout, and 128 process-local cache entries. These values belong to version `clinical-hybrid-retrieval-v1`
and must be re-versioned when materially recalibrated.

Safe statuses are:

- `NOT_REQUIRED`
- `USED`
- `NO_RELEVANT_REFERENCE`
- `KNOWLEDGE_UNAVAILABLE`
- `RETRIEVAL_FAILED_SAFE`

Readiness exposes only status, approved chunk count, embedding model, and index version. An absent optional knowledge
index does not fail general AI readiness and does not trigger automatic creation or ingestion.

## Task policy

The authoritative Spring Task Registry supplies the policy with each internal execution request:

| Task                               | RAG policy                | Behavior                                                                                                    |
| ---------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `CONNECT_EVIDENCE`                 | `OPTIONAL`                | Uses relevant references when available; can operate from Patient evidence alone.                           |
| `COMPARE_EVIDENCE`                 | `DISABLED`                | Comparison remains a deterministic Patient-evidence operation.                                              |
| `CROSS_CHECK_ASSESSMENT`           | `OPTIONAL`                | References may support general criteria; the result evaluates evidence consistency, not Doctor correctness. |
| `FIND_GAPS`                        | `REQUIRED_WHEN_AVAILABLE` | Fails safely with `CLINICAL_REFERENCE_REQUIRED` when no approved relevant reference is usable.              |
| `EXPLORE_EXPLANATIONS`             | `REQUIRED_WHEN_AVAILABLE` | Registry policy is ready; task execution remains deferred.                                                  |
| `FOCUSED_EVIDENCE_QUESTION`        | `OPTIONAL`                | Policy is ready; task execution remains deferred.                                                           |
| `BRIEF_PATIENT`, `STRUCTURE_NOTES` | `DISABLED`                | No general reference retrieval.                                                                             |

Multi-task requests retrieve and fail independently, so one unavailable required-reference task cannot contaminate a
sibling task.

## Prompt, citation, and injection controls

Prompts separate `<PATIENT_SPECIFIC_VERIFIED_EVIDENCE>`, `<UNTRUSTED_DOCTOR_QUESTION>`,
`<UNTRUSTED_DOCTOR_ASSESSMENT>`, and `<GENERAL_CLINICAL_REFERENCE_KNOWLEDGE>`. Retrieved text is data, never an
instruction. It cannot override the system policy, request hidden evidence, or change the schema. The generated JSON
schema constrains citation fields to the retrieved chunk IDs. Post-generation grounding rejects unknown IDs,
duplicate IDs within a claim, invented links, treatment/dose language, unsupported certainty, and the pre-existing
Patient evidence violations.

The model returns chunk IDs only. Citation metadata and source references are resolved by Clinora from the approved
retrieved objects, not copied from model prose. The API exposes RAG policy/status, index version, retrieved and cited
chunk IDs, duration, and safe source metadata; it never exposes retrieval scores or chain-of-thought.

Cross-check outcomes use neutral evidence language:

- `CONSISTENT_WITH_AVAILABLE_EVIDENCE`
- `MIXED_OR_LIMITED_EVIDENCE`
- `NOT_SUPPORTED_BY_AVAILABLE_EVIDENCE`
- `INSUFFICIENT_EVIDENCE`

## Tests and non-goals

Synthetic test-only references cover hematology, thyroid evaluation, an unapproved draft, and adversarial retrieved
text. Tests cover deterministic/idempotent ingestion, approval filtering, domain filtering, retirement, missing-index
fallback, citation resolution, unknown citation rejection, prompt delimiting, and required-reference fail-safe
behavior. The fixtures are explicitly not a production clinical corpus.

Deferred work includes production source governance and licensing review, a clinically validated embedding model,
operational reviewer tooling, `EXPLORE_EXPLANATIONS` execution, full Doctor drawer/citation presentation, RAG quality
benchmarking with an approved corpus, and all Phase 6E+ consultation, prescription, and follow-up workflows.
