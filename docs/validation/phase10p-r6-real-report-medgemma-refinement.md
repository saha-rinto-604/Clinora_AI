# Phase 10P R6 — Real-report extraction + MedGemma reasoning refinement

## Scope

This refinement fixes two separate failure classes without adding disease-specific rules:

1. real laboratory tables being flattened into incorrect OCR rows; and
2. otherwise grounded MedGemma candidates being discarded because optional explanation fields were empty after sanitization.

The clinical safety boundary remains unchanged: Clinora owns report facts and range states; MedGemma may reason only over verified observations. A model result is not a diagnosis or treatment instruction.

## Document extraction design

Production OCR now uses a new v3 document engine/parser. PP-StructureV3 table recognition and region detection are enabled. When Paddle returns table HTML/cell boxes they are preferred for row reconstruction; table OCR boxes remain the fallback.

The parser:

- rejects common report metadata/identifiers as clinical observations;
- supports merged `label + result` cells and result cells that include units;
- supports western and Indian thousands formatting;
- preserves complex demographic reference text; when the same report explicitly states Sex/Gender or Age, it deterministically selects the matching printed subgroup range but keeps the observation review-required;
- normalizes common CBC, iron-study and hemoglobin-fraction labels without attaching any disease rule;
- adds an extraction-quality gate so clearly incomplete/structurally unreliable output cannot proceed to clinical AI reasoning.

## Optional MedGemma 1.5 document assist

MedGemma is a secondary document reader, not the authority. It is used only against a local/host-only HTTP endpoint. It receives the report page image with a transcription-only prompt. It is forbidden by prompt from diagnosing, interpreting, normalizing from memory, or turning metadata/comments into result rows.

Reconciliation rules are deliberately asymmetric:

- Paddle and MedGemma agree on label/value: keep the deterministic OCR fact;
- MedGemma sees a row Paddle missed: add it as `reviewRequired=true`;
- they disagree on the result: never auto-resolve; keep the Paddle row and force user review;
- MedGemma is unavailable/text-only/invalid: continue with Paddle and emit a warning;
- poor extraction after reconciliation: fail the extraction job rather than allow a corrupted AI snapshot.

## Multimodal local runtime requirement

The current text-only llama.cpp command must not use `--no-mmproj` if document assist is enabled.

Preferred local GGUF command on the existing Windows/Vulkan setup:

```powershell
llama-server -hf gguf-org/medgemma-1.5-4b-it-gguf:Q4_0 --device Vulkan1 --gpu-layers auto --fit on --parallel 1 -c 8192 --host 127.0.0.1 --port 8002
```

If using already-downloaded local files, provide both the text model and the matching projector:

```powershell
llama-server -m .\medgemma-1.5-4b-it-q4_0.gguf --mmproj .\mmproj-medgemma-1.5-4b-it-q4_0.gguf --device Vulkan1 --gpu-layers auto --fit on --parallel 1 -c 8192 --host 127.0.0.1 --port 8002
```

If 8192 context does not fit the available GPU/host memory, reduce context to 4096 before disabling vision. The OCR service treats multimodal assist as optional and continues with Paddle if the local model server cannot accept images.

Compose defaults introduced by this patch:

```text
OCR_TABLE_RECOGNITION_ENABLED=true
OCR_REGION_DETECTION_ENABLED=true
OCR_MEDGEMMA_ASSIST_ENABLED=true
OCR_MEDGEMMA_ASSIST_MODE=suspect
OCR_MEDGEMMA_URL=http://host.docker.internal:8002
```

Use `OCR_MEDGEMMA_ASSIST_MODE=always` only during evaluation; `suspect` avoids a second model pass when extraction is already structurally clean.

## Clinical reasoning refinement

The v5 reasoning contract still requires a condition candidate to have a valid name, a surviving rationale, and at least one eligible grounded supporting observation. `VERIFIED_NORMAL` and verified negative observations remain unable to directly establish a candidate, but the prompt explicitly allows them as differential context/contradiction.

`missingEvidence` and `alternatives` remain required JSON arrays for a stable schema, but they may be empty. They are explanation enrichment, not proof of candidate validity. Grounding no longer deletes a grounded candidate solely because sanitization removes one of those optional items.

This intentionally does **not** add a second unrestricted model-retry loop and does **not** add hard-coded disease thresholds.

## Three-run validation checklist

Run the provided validator with a de-identified/synthetic real-format report after starting OCR + multimodal llama.cpp + ai-service:

```powershell
python .\scripts\validate_real_report_pipeline.py --file .\path\to\report.jpg --runs 3
```

Set `OCR_INTERNAL_TOKEN` and `AI_INTERNAL_TOKEN` in that shell. The checker fails if metadata becomes a laboratory observation, extraction reports insufficient structural quality, repeated OCR fingerprints differ, or deterministic AI status/candidate signatures differ.

A passing repeatability check validates pipeline stability only. It does not establish clinical accuracy. Clinical acceptance still requires a labeled, de-identified/synthetic regression corpus covering report formats and condition patterns, with separate OCR extraction and clinical-reasoning metrics.
