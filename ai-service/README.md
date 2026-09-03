# Clinora AI Service — Phase 10P MedGemma

This FastAPI service is the privacy and safety boundary for Patient report interpretation. Spring calls only this
service on port `8001`. It accepts verified structured Phase 9P observations and never receives or forwards the
original report, raw OCR text, Patient identity, report binary, storage keys, or authentication/session data.

## Local inference boundary

MedGemma inference runs in a separate local llama.cpp process bound to `127.0.0.1:8002`. Start the currently proven
local feasibility profile from a PowerShell terminal:

```powershell
llama-server -hf gguf-org/medgemma-1.5-4b-it-gguf:Q4_0 --no-mmproj --device Vulkan1 --gpu-layers auto --fit on --parallel 1 -c 2048 --port 8002
```

The `gguf-org` Q4_0 file is a temporary local feasibility artifact. Do not add GGUF/model files to Git. Final model
provenance must use a Clinora-controlled GGUF converted and quantized from the already-downloaded official Google
MedGemma weights.

The FastAPI adapter calls only llama.cpp's OpenAI-compatible local `/v1/chat/completions` endpoint. Generation is
deterministic (`temperature=0`, seed `0` by default), streaming is disabled, and Clinora permits one analysis at a
time. The adapter supplies a llama.cpp JSON schema that bounds optional output breadth and verbosity to fit the
768-token local budget, then applies the unchanged Clinora schema, evidence, and safety validators. Raw llama.cpp
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
$env:LLAMA_SERVER_URL="http://127.0.0.1:8002"
$env:HF_MODEL="google/medgemma-1.5-4b-it"
$env:HF_MODEL_REVISION="main"
$env:AI_QUANTIZATION="Q4_0"
$env:AI_INTERNAL_TOKEN="<same-secret-used-by-the-Spring-backend>"
$env:AI_MAX_CONCURRENT_REQUESTS="1"
$env:AI_MAX_NEW_TOKENS="768"
$env:AI_GENERATION_SEED="0"
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

`GET http://127.0.0.1:8001/health` verifies the FastAPI process only. `GET /ready` calls llama.cpp `/health` and
returns `READY` only after llama.cpp reports that its model is loaded. The default `LLAMA_SERVER_URL` is
`http://127.0.0.1:8002`; connection and read timeouts are configurable with `LLAMA_CONNECT_TIMEOUT_SECONDS` and
`LLAMA_READ_TIMEOUT_SECONDS`. To prevent accidental disclosure, the adapter rejects non-loopback server URLs.

If Spring runs in Docker while both local AI processes run on Windows, omit/stop the Compose `ai-service` container
and set `COMPOSE_AI_SERVICE_URL=http://host.docker.internal:8001`. Keep llama.cpp bound to loopback; it is an internal
runtime and is not a Patient or Spring endpoint.

## Tests

The CI-safe adapter tests use a mock HTTP transport and do not download or start a model:

```bash
python -m pip install -r requirements-test.txt
PYTHONPATH=. python -m unittest discover -s tests -v
python -m compileall -q app tests
```

A local runtime gate should separately exercise llama.cpp `:8002`, FastAPI `/ready` on `:8001`, a synthetic internal
analysis request, Spring connectivity, and a real VERIFIED Patient report through the Patient AI Insight view.

## Safety boundary

The existing strict output validator rejects model output that:

- cites observation IDs that were not supplied;
- contains direct medication or dose instructions;
- presents definitive diagnosis language;
- presents numeric disease probability/confidence as if calibrated;
- fails the approved response schema.

Timeouts, unavailable llama.cpp responses, capacity failures, and malformed output are converted to controlled AI
failure responses. The original report and verified observations remain unchanged.

Rejected responses are logged only with non-PII diagnostics such as finish reason, completion/character counts,
JSON parser position, schema field paths and error types, evidence-count mismatches, or the matched safety rule and
field path. Raw model text and clinical values are not logged.
