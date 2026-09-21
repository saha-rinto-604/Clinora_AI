# Phase 6D R3.5 evidence scope and performance validation

Validated locally on 2026-09-18 on `phase-6d-doctor-clinical-support-foundation-router`, starting at `fac41ce4631dc08778245c33afcca2d9d50fafcf`. No commit or push was made.

## Bundle consolidation

The supplied bundle contains repeated diffs against intermediate versions of the same files and hunk contexts that do not all match the current source. The drawer companion targets the older `setBusy` implementation. It was treated as a specification, not reapplied with Git. The initial worktree contained only the two intentional drawer modifications; the failed apply check had left no additional source changes.

The final implementation also corrects gaps in the supplied patch: explicit selected reports take precedence over the current report, Compare does not silently add another report, deterministic comparison requires real comparison facts, and comparison candidates reuse the common eligibility resolver. The proposed comparison test with no comparison facts was replaced by real database evidence tests.

## Changed files

Backend production files under `backend/src/main/java/com/clinora/doctors/support/`:

- `DoctorSupportEvidenceScope.java` (new)
- `DoctorSupportEvidenceScopeResolver.java` (new)
- `DoctorSupportContextService.java`
- `DoctorSupportEvidenceAssembler.java`
- `DoctorSupportExecutionService.java`

Backend tests under `backend/src/test/java/com/clinora/doctors/support/`:

- `DoctorSupportContextServiceTest.java`
- `DoctorSupportExecutionServiceTest.java`
- `DoctorSupportEvidenceScopeIntegrationTest.java` (new; also covers the assembler scenarios proposed in the bundle)

AI service:

- `ai-service/app/prompts/doctor_request_router_v1.py`
- `ai-service/app/prompts/doctor_explore_explanations_v1.py`
- `ai-service/app/prompts/doctor_find_gaps_v2.py`
- `ai-service/app/prompts/doctor_support_common.py`
- `ai-service/app/schemas/doctor_support_execution.py`
- `ai-service/app/services/doctor_support_execution_service.py`
- `ai-service/app/services/doctor_support_grounding.py`
- `ai-service/tests/test_doctor_support_routing.py`
- `ai-service/tests/test_doctor_support_execution.py`

Frontend:

- `frontend/src/features/doctor/clinora-clinical-support-panel.tsx`: preserved the pre-existing local changes; added only `setResponse(null)` and `setResultSignature('')` to the common request-start function.
- `frontend/src/features/doctor/clinora-clinical-support-panel.test.tsx`: preserved existing local tests and added a stale-result/error-reset regression.

This validation document is the only additional documentation file.

## Scope and authorization

Precedence is selected observations, explicit selected reports, current report, then appointment-authorized evidence. A current report is not implicitly added to an explicit report list. Observation selections narrow the result to their eligible parent reports and selected observations; supplied report boundaries still constrain those observations.

Appointment discovery requires the exact appointment, Doctor, and Patient share; no revocation or archive; SELF subject; successful extraction; the latest successful VERIFIED extraction; and an eligible PATIENT_CONFIRMED, PATIENT_CORRECTED, or DOCTOR_VERIFIED observation. The discovery query joins job/report/Patient ownership. It never queries the Patient's entire record as an evidence scope.

Both context and assembly call `DoctorSupportEvidenceScopeResolver.resolve`. Comparison candidates also use this resolver. Context comparison availability requires actual scoped reports with a known matching type and distinct reliable dates. Execution rejects ambiguous numeric pairs, duplicate analytes, inequalities, mismatched report types, and incompatible normalized units. Choosing a comparison candidate is required before it can enter a narrow evidence scope.

Fresh appointment authorization and assembly precede cache reuse. PostgreSQL integration tests verify revocation removes reports even when the same idempotency key is reused. Guessed, unverified, superseded, or out-of-scope observation IDs retain opaque unavailable responses. Whole-current-report context still includes all eligible findings when there is no manual observation selection. Notes-only execution avoids sending unnecessary Patient evidence.

## Deterministic operations and inference

Production `BRIEF_PATIENT` builds highlights from authoritative statuses, exact authorized appointment context, and reliable comparison facts. Explicit Brief routing bypasses the semantic router. Execution and cache checks call neither MedGemma nor RAG; provenance has null model fields and `NOT_RUN`. Both offline-AI unit coverage and PostgreSQL integration coverage assert no AI client interactions.

Production `COMPARE_EVIDENCE` renders trusted server comparison facts without MedGemma or RAG. Without sufficient facts it returns an evidence-selection requirement or safe failure, not invented success. Tests prove zero AI client calls with real matched findings. Private legacy AI-service Brief/Compare contracts remain for compatibility and existing regression coverage; Spring no longer dispatches those production tasks to them.

Default reasoning budgets passed per generation:

| Task | Maximum output tokens |
| --- | ---: |
| CONNECT_EVIDENCE | 384 |
| CROSS_CHECK_ASSESSMENT | 512 |
| FIND_GAPS | 448 |
| EXPLORE_EXPLANATIONS | 512 |
| STRUCTURE_NOTES | 384 |
| FOCUSED_EVIDENCE_QUESTION | 320 |
| Production Brief / deterministic Compare | No generation |

Task environment overrides are bounded to 128–1024 tokens. Compact inference payloads exclude null evidence fields and redundant bookkeeping while the full server snapshot remains available for grounding. Generation logs contain request ID, task, endpoint, attempt, budget, duration, prompt/completion token counts, and finish reason, without clinical content.

`finish_reason=length` returns `OUTPUT_TRUNCATED` immediately. A complete malformed JSON/schema response gets at most one repair using the same bounded task budget. Truncated repair stops. Grounding rejection does not launch a repair.

## References and routing

For REQUIRED_WHEN_AVAILABLE, KNOWLEDGE_UNAVAILABLE (including INDEX_UNAVAILABLE) or NO_RELEVANT_REFERENCE permits bounded reasoning with empty citations and a server-added independent-verification limitation. Available references enforce citations for explanation/gap claims. RETRIEVAL_FAILED_SAFE cannot produce success, including OPTIONAL retrieval failures. Python and Spring enforce the corresponding response contract. No index was created or simulated.

Possibility-seeking language is distinguished from definitive diagnosis in the semantic router prompt. Appointment-context integration cases cover explanation, connection, gaps, comparison, and broad clarification with Explore explanations available. Definitive diagnosis and treatment/dose remain unsupported. Semantic decisions in these integration cases are mocked; these tests prove context and routing-contract behavior, not live model language accuracy. No phrase dictionary was added, and R1–R3 interpreter/planner/shadow source files were left unchanged.

## Validation results

| Check | Result |
| --- | --- |
| Focused backend routing/execution/planner/shadow tests | 107 passed |
| Full backend `mvn.cmd -q test` | 396 passed; zero failed, errored, or skipped |
| PostgreSQL scope integration cases (included above) | 17 passed |
| Focused AI routing + execution | 75 passed, 3 subtests passed |
| Full AI `.venv/Scripts/python.exe -m pytest tests -q` | 273 passed, 6 subtests passed |
| Focused drawer tests | 11 passed |
| Full frontend `npm.cmd test` | 262 passed across 44 files |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed, seven warnings in unchanged files |
| `npm.cmd run build` | Passed, Vite large-chunk warning |

The new PostgreSQL tests use disposable Testcontainers databases with synthetic data, not the local application database. Docker 29 requires the existing Testcontainers/docker-java client to use API 1.44 for these runs. The focused command used `-Dapi.version=1.44`; the full command used the same setting in the process-local `JAVA_TOOL_OPTIONS`. No persistent runtime configuration or secrets were changed. Maven and esbuild required normal filesystem/cache access outside the restricted sandbox.

Live llama.cpp restart, model timing, and browser acceptance were intentionally deferred per the owner's latest instruction. The new budgets still need real-model latency/quality measurement after that restart. No live performance numbers are claimed. Repository implementation and automated validation have no remaining failures. No R4–R7, appointment/payment/schedule, deployment, commit, or push work was performed.


## September 20 current-runtime execution diagnosis and repair

Baseline remains `fac41ce4631dc08778245c33afcca2d9d50fafcf` on
`phase-6d-doctor-clinical-support-foundation-router`. All existing R3.5 and
frontend work was preserved. No commit, push, reset, stash or llama.cpp restart.
Only ai-service was reloaded during diagnosis; the backend was rebuilt from the
working tree for the two shared task-catalog description changes.

### Proven failure boundaries

The initial real authorized appointment execution of the explanation question
returned HTTP 200 with `FAILED_SAFE / OUTPUT_TRUNCATED`. The internal execute
endpoint also returned HTTP 200. Python stopped at the explicit
`generation.finish_reason == "length"` check, before parsing/schema/grounding.
The diagnostic reproduction recorded 3,629 prompt tokens, 512 completion tokens,
24,972 ms generation, no repair, `KNOWLEDGE_UNAVAILABLE`, no retrieved/cited
references. The public failure envelope called grounding `REJECTED`; the new
stage diagnostic correctly records `NOT_RUN` for this early exit.

Compact inference then exposed a separate false rejection in
`validate_grounding`: `NORMAL_AS_ABNORMAL` scanned concatenated result text,
including reference-label metadata and unrelated fields. Live diagnostics proved
`claim_field_match=False`. The check now scans individual clinical claim fields;
actual abnormal claims about normal observations still fail. Exact ID, label,
value, unit, status, diagnosis, treatment and reference checks remain active.
Duplicate relatedEvidence entries in Find Gaps are now rejected as well.

Other intermediate model outputs were correctly rejected for invented-history,
definitive-Patient-claim and changed-status wording. Those guards were retained.
Generation prompts now keep trusted evidence rendering on the server and require
bounded possibility language. Neutral introductions are server-supplied; unsafe
model-authored text is never removed to convert a failed result into success.

There was no Python/Spring REQUIRED_WHEN_AVAILABLE mismatch causing these
failures. Both layers accept unavailable references with empty citations and an
explicit independent-verification limitation. True RETRIEVAL_FAILED_SAFE still
fails safely, and available approved references still require valid citations.

### Final implementation

Explore and Find Gaps use short observation handles scoped to the fresh request.
The inference schema constrains those handles and at most two concise task items.
Handles expand to the exact authorized UUIDs and labels before the existing
public schema and grounding validators run. The full authoritative snapshot is
unchanged. Unknown handles fail safely without a repair call. Public result
contracts remain compatible. Output budgets remain Explore 512 and Find Gaps
448. Truncation never retries; complete malformed structure permits one bounded
repair; unsafe grounded output never retries.

The descriptive-findings routing error also reproduced. Prompt-only changes
were insufficient because the shared task catalog still described focused
questions only as a fallback. Updating the two routing descriptions to distinguish
present findings from absent information fixed the current Doctor endpoint.
There are still eight tasks, with no new regex, phrase-specific route, or R1-R3
production migration.

### Final live results (authorized Doctor API, not browser click-through)

| Request/task | Backend/internal HTTP | Result | Prompt/completion tokens | Finish | Generation / backend execution |
| --- | --- | --- | --- | --- | --- |
| Explanation question / EXPLORE_EXPLANATIONS | 200 / 200 | SUCCEEDED, two explanations, grounding PASSED | 3115 / 262 | stop | 33.318 s / 33.578 s |
| Missing-information question / FIND_GAPS | 200 / 200 | SUCCEEDED, two gaps, grounding PASSED | 3086 / 233 | stop | 21.827 s / 22.016 s |
| Descriptive-findings question / FOCUSED_EVIDENCE_QUESTION | 200 / 200 | ROUTED | 1837 / 28 | stop | router generation 3.529 s; backend route 3.719 s |

Both execution successes had `safeFailureCode=null`, schema PASSED,
`ragUsed=false`, `retrievalStatus=KNOWLEDGE_UNAVAILABLE`, empty retrieved/cited
reference lists, and the explicit independent-verification limitation. Model
provenance remained MedGemma 1.5 4B / main / Q4_0. No Patient contents, values,
identifiers or credentials are recorded here.

Health checks: backend `/actuator/health` 200 UP; AI `/ready` 200 READY with
clinical knowledge INDEX_UNAVAILABLE; llama.cpp `/health` 200 ok. The index was
not created, substituted or bypassed. Timing includes local runtime variation
and concurrent validation workload; these are observations, not a benchmark.

### Validation

- Focused backend: 115 passed, zero failures/errors/skips.
- Full `mvn.cmd -q test`: 404 passed, zero failures/errors/skips. Docker
  Testcontainers API compatibility used `JAVA_TOOL_OPTIONS=-Dapi.version=1.44`.
- Actual AI venv, execution file: 69 passed.
- Actual AI venv, routing file: 28 passed plus 3 subtests.
- Actual AI venv, full `python -m pytest tests -q`: 295 passed plus 6 subtests.
- Tests cover real missing-index behavior, both unavailable-reference tasks,
  available-reference citation requirements, failed retrieval, unknown/duplicate
  evidence, invented references, diagnosis/treatment/history rejection, zero
  explanations, bounded repair, truncation, sanitized logs and the metadata
  field-boundary regression. Existing authorization and R1-R3 suites passed.
- Frontend was not changed during this repair, so its validation was not rerun.
  Earlier R3.5 frontend results above remain historical, not a new live UI claim.
- `git diff --check` passed. Runtime logs and probes stayed ignored; no artifacts
  or credentials were staged or committed.

### Files edited in this execution repair (pre-existing R3.5 work retained)

- `ai-service/app/prompts/doctor_explore_explanations_v1.py`
- `ai-service/app/prompts/doctor_find_gaps_v2.py`
- `ai-service/app/prompts/doctor_request_router_v1.py`
- `ai-service/app/prompts/doctor_support_common.py`
- `ai-service/app/services/doctor_support_execution_service.py`
- `ai-service/app/services/doctor_support_grounding.py`
- `ai-service/app/services/doctor_support_inference_contract.py` (new)
- `ai-service/tests/test_doctor_support_execution.py`
- `ai-service/tests/test_doctor_support_routing.py`
- `backend/src/main/java/com/clinora/doctors/support/DoctorSupportTaskRegistry.java`
- `backend/src/test/java/com/clinora/doctors/support/DoctorSupportExecutionServiceTest.java`
- `backend/src/test/java/com/clinora/doctors/support/DoctorSupportRoutingServiceTest.java`
- This validation record.

## September 20 systemic browser execution follow-up

The appointment-browser request shape was reproduced through the frontend proxy and
Spring endpoints before the active appointment window expired. Appointment mode sent
`currentReportId=null`, empty explicit report/observation selections, and resolved to
`APPOINTMENT_AUTHORIZED`: 2 verified shared reports and 25 eligible observations. A
previous successful report-review direct execution instead sent one current report
and resolved to 1 report / 7 observations. Routing and execution used the same fresh
backend-resolved snapshot; no browser-side authorization construction was found.

There was no single common rejection code. The observed failure boundaries were:

- `CONNECT_EVIDENCE`: `OUTPUT_TRUNCATED`, generation boundary, `finish_reason=length`,
  3,756 prompt tokens and 384 completion tokens; schema and grounding did not run.
- Two `EXPLORE_EXPLANATIONS` attempts: `OBSERVATION_STATUS_CHANGED` and
  `OBSERVATION_VALUE_CHANGED`, grounding boundary after schema passed, with
  `finish_reason=stop`.

`NORMAL_AS_ABNORMAL` did not recur. The shared architectural cause was that Connect
and Focused still used full UUID/label output references and broad prose schemas while
Explore/Gaps used snapshot-local short handles. The large appointment snapshot thus
created task-dependent prompt/output pressure and encouraged redundant value/status
restatement. Grounding also associated a label with numbers/statuses after independent
schema fields had been concatenated.

The common inference contract now applies to Connect, Focused, Explore and Find Gaps.
The model receives snapshot-local handles; the server expands them to exact authorized
UUID/label pairs before the unchanged public schema and grounding validators run. The
full authoritative snapshot remains untouched. Claim association is field-local.
Unknown/duplicate handles, wrong labels or values, invented references, abnormal claims
about normal evidence, diagnosis, treatment/dose and failed retrieval still reject.
Connect no longer prunes unsafe model-authored patterns into success: any unsafe claim
fails the complete output.

Post-fix synthetic live-model probes under the production missing-index condition used
one generation and `finish_reason=stop`: Connect succeeded (1,193/112 prompt/completion
tokens), Focused succeeded (877/133), and Explore succeeded (1,080/239). Find Gaps
completed without truncation but correctly failed one sampled generation with
`OBSERVATION_STATUS_CHANGED`; the protection was retained. Earlier live Find Gaps had
succeeded with grounding passed. Post-fix execution on the original real appointment
could not be repeated because its scheduled access window expired; the API now returns
the intended opaque 404 before evidence assembly. No appointment/access data was
modified to bypass that boundary.

Final validation after this follow-up: backend full suite 405 passed; AI full suite
315 passed plus 6 subtests; `git diff --check` passed. No commit or push was made.
