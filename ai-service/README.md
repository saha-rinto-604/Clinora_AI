# Clinora AI Service — Phase 10P MedGemma

This FastAPI service is the privacy and safety boundary for Patient report interpretation. Spring calls only this
service on port `8001`. It accepts verified structured Phase 9P observations and never receives or forwards the
original report, raw OCR text, Patient identity, report binary, storage keys, or authentication/session data.

## Local inference boundary

MedGemma inference runs in a separate local llama.cpp process bound to `127.0.0.1:8002`. Start the currently proven
local feasibility profile from a PowerShell terminal:

```powershell
llama-server -hf gguf-org/medgemma-1.5-4b-it-gguf:Q4_0 --no-mmproj --device Vulkan1 --gpu-layers auto --fit on --parallel 1 -c 8192 --port 8002
```

The `gguf-org` Q4_0 file is a temporary local feasibility artifact. Do not add GGUF/model files to Git. Final model
provenance must use a Clinora-controlled GGUF converted and quantized from the already-downloaded official Google
MedGemma weights.

The FastAPI adapter calls only llama.cpp's OpenAI-compatible local `/v1/chat/completions` endpoint. Generation is
deterministic (`temperature=0`, seed `0` by default), streaming is disabled, and Clinora permits one analysis at a
time. The adapter supplies a llama.cpp JSON schema that bounds optional output breadth and verbosity to fit the
2048-token default generation budget, then grounds individual evidence references and factual clauses before strict public-schema and safety validation. Raw llama.cpp
response envelopes are never returned to Spring or the Patient UI.

## FastAPI local development

Create a Python 3.12 environment and install:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements-medgemma.txt
```

With llama.cpp already listening on port `8002`, start Clinora's service on port `8001`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --log-level info
```

`GET http://127.0.0.1:8001/health` verifies the FastAPI process only. `GET /ready` calls llama.cpp `/health` and
returns `READY` only after llama.cpp reports that its model is loaded. The default `LLAMA_SERVER_URL` is
`http://127.0.0.1:8002`; connection and read timeouts are configurable with `LLAMA_CONNECT_TIMEOUT_SECONDS` and
`LLAMA_READ_TIMEOUT_SECONDS`. To prevent accidental disclosure, the adapter rejects non-loopback server URLs.

The repository-root `.env` is loaded automatically from the Python source location before application
configuration is read, regardless of the working directory. Explicit process environment variables win,
including explicitly empty values. No service-specific env file or manual `$env:` assignments are needed.
`AI_INTERNAL_TOKEN` is shared with the backend through that same root file. Tokens are never logged.
`AI_PROMPT_VERSION=patient-lab-report-v5` and `AI_SCHEMA_VERSION=1.1` must match backend job provenance. The service uses the v5 implementation; environment metadata does not dynamically select an older prompt. Use `AI_MAX_NEW_TOKENS=3072` for the bounded cluster response (accepted range: 256-3072). The context must also fit the complete verified input; the current local runtime acceptance uses an 8192-token context. Large reports may require more context or fail without an interpretation.

The default `docker compose up -d` starts frontend, backend, OCR, Postgres, RabbitMQ, Redis, MinIO, and ClamAV.
It leaves FastAPI and llama.cpp manual on Windows. The Docker backend receives
`AI_SERVICE_URL=${COMPOSE_AI_SERVICE_URL:-http://host.docker.internal:8001}`. Keep llama.cpp bound to loopback.
See the root [startup instructions](../README.md#local-startup) for the full command sequence.

### Optional container AI

The Docker definition and Dockerfile remain available with `docker compose --profile container-ai up -d ai-service`.
Stop manual FastAPI before explicitly using that profile: both use host port 8001. To return to manual AI, run
`docker compose --profile container-ai stop ai-service` before starting FastAPI. Compose does not stop a previously
started optional container merely because its profile is no longer selected. The startup helper performs this stop.
Do not set `COMPOSE_PROFILES=container-ai` in normal development.

The image receives configuration through Compose environment variables; it does not contain the root `.env`.
The existing llama.cpp client still only accepts loopback URLs. Thus optional container inference requires a
llama.cpp server reachable on loopback in that container's network namespace; it cannot use the Windows
loopback-only llama.cpp server through bridge networking. Enabling the profile alone does not make inference ready.


## Tests

The CI-safe adapter tests use a mock HTTP transport and do not download or start a model:

```bash
python -m pip install -r requirements-test.txt
python -m pytest tests -q
python -m compileall -q app tests
```

A local runtime gate should separately exercise llama.cpp `:8002`, FastAPI `/ready` on `:8001`, a synthetic internal
analysis request, Spring connectivity, and a real VERIFIED Patient report through the Patient AI Insight view.

## Safety boundary

The existing strict output validator rejects model output that:

- has no safely parseable contract after one JSON repair; unknown or neutral support references are pruned individually before validation, preserving remaining grounded support;
- contains direct medication or dose instructions;
- presents definitive diagnosis language;
- presents numeric disease probability/confidence as if calibrated;
- fails the approved response schema.

Timeouts, unavailable llama.cpp responses, capacity failures, and malformed output are converted to controlled AI
failure responses. The original report and verified observations remain unchanged.

Rejected responses are logged only with non-PII diagnostics such as finish reason, completion/character counts,
JSON parser position, schema field paths and error types, evidence-count mismatches, or the matched safety rule and
field path. Raw model text and clinical values are not logged.

## Phase 10P-R5 cluster contract

MedGemma receives every patient-confirmed observation with Clinora-owned range status and evidence class. Report titles are omitted from reasoning input; verified assay labels are preserved. The model creates up to three clinical clusters, each containing evidence roles, clinical relevance, interpretation and zero to two condition/syndrome/process candidates. Pattern-only clusters are valid.

The response adds `clinicalClusters` and `overallInterpretation` in schema `1.1`. Existing `clinicalPatterns` consumers retain a bounded five-candidate compatibility projection; the full cluster array can hold six candidates. JSON persistence needs no migration. Shared `clinical_evidence.py` establishes support eligibility; count does not measure clinical specificity, so compatibility support metadata remains `LIMITED`. Medical significance and grouping come from MedGemma.

Wrong factual clauses, unknown references and neutral positive-support references are pruned locally. Evidence IDs stay scoped to their own cluster. A candidate with no support or no safe rationale is removed; an otherwise meaningful cluster remains pattern-only. Fact validation is conservative lexical validation, not a proof that every medical inference is correct. The local quantized model requires clinical review; structural acceptance does not establish medical validity.

Focused checks and real-model synthetic acceptance (from `ai-service`):

```powershell
.venv/Scripts/python.exe -m pytest tests/test_patient_lab_report_v5.py tests/test_model_runtime.py -q -p no:cacheprovider
.venv/Scripts/python.exe -m pytest tests -q -p no:cacheprovider
.venv/Scripts/python.exe tests/runtime_acceptance_v5.py
```

The opt-in runtime runner sends synthetic reports A/B/C through the current FastAPI route in-process to the real loopback model. It records counts and synthetic final interpretations under `docs/validation/phase10p-r5-runtime.json`. It never logs or reads patient records, and does not restart the existing app services.


### Phase 10P-R5.1 evidence premises

The active prompt remains `patient-lab-report-v5` and the public schema remains
`1.1`. Public clusters add optional `displayTitle`; evidence adds optional
`supportEligibility`. Older cluster JSON remains readable. No migration is needed.

`clinical_evidence.support_eligibility` is the shared authority for positive
support: only verified abnormal and verified qualitative-positive observations
qualify. Unknown/context-only values stay in the complete input, with their exact
reported values, but never receive population reference ranges from the model.

Live generation retains R5's concise evidence-linked `interpretation` and
candidate-specific `rationale` fields. Grounding also accepts optional structured
`interpretationClaims` / `rationaleClaims`, with observation IDs and authoritative
statuses in `premises`. Unknown structured premises are permitted only for
classification limitations. Requiring those duplicate states during live local
model generation caused runtime regressions, so they remain optional. Grounding prunes individual invalid claims/references, reevaluates
candidate support, and preserves independently grounded reasoning. Patient titles
come from up to three verified evidence labels; hypotheses belong to candidates.
The public interpretation retains grounded model relationships; the synthesis
uses those accepted interpretations instead of unvalidated overall prose.
This is factual grounding, not a guarantee of semantic medical correctness.

Focused checks: `python -m pytest tests/test_patient_lab_report_v51.py -q`.
The opt-in `tests/runtime_acceptance_v51.py` and acceptance-only FastAPI host test
new synthetic backend jobs against the real local model. They require explicit
local runtime setup and Docker access; they never run as part of pytest and leave
synthetic fixtures for review. See `docs/validation/phase10p-r51-report.md` in the
repository root for setup, captures, acceptance results and limitations.

The local 18-observation runtime fixture exceeds the old 4096-token context when
combined with the response budget. The documented launcher now uses `-c 8192`
with the same MedGemma Q4_0 model, and `AI_MAX_NEW_TOKENS` defaults to `3072`.
Truncated outputs still fail closed and are never repaired or presented as results.
Candidate grounding requires surviving model-provided missing context and an
alternative explanation, in addition to eligible support and an independent rationale.
Explicitly mentioned unclassified tests omitted from the evidence array can be
recovered as CONTEXT only. Repeated identical groups are consolidated; independent
supported processes remain separate.


The R5.1 runtime continuation binds each generated evidence label to its exact
verified UUID and authoritative state using a case-specific grammar. Allowed
roles and candidate-support IDs come from the shared support eligibility function;
this grammar contains no medical associations. The ID sequence remains compatible
with older runtime adapters. Grounding independently rechecks optional label/state
bindings, preserving older v5 payloads that omit them.

Live generation limits evidence to six entries per cluster and asks for one short
missing-context item and one alternative per candidate. The complete observation
list remains in the prompt and verified report summary; a compact positive-support
ledger reinforces the factual boundary without creating clinical groups. Synthesis
and relationship text precede naming in generation. A rejected interpretation no
longer discards an independently grounded candidate; its rationale remains in the
candidate channel. Explicit model withdrawals, combined alternative-name objects,
and test labels masquerading as candidates are handled locally. Role-only strings
such as `Context` cannot become the patient interpretation.

Acceptance capture paths can be selected with `R51_CAPTURE_PATH`; the default
historical capture remains unchanged unless explicitly selected. Captures include
prompt tokens, completion tokens, finish reason and content length. These changes
do not guarantee medical correctness: consult the latest continuation validation
report before treating any runtime case as accepted.
