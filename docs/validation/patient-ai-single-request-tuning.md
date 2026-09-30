# Patient AI single-request runtime tuning — 2026-09-27

## 1. BASELINE

Branch: `perf/patient-ocr-ai-latency`, based on main/origin/main `40ca5af919ba63a521cc0340b33879eab7d4a64d`. All prior work was hashed before the experiment. No production source was modified before the reference measurements. OCR was neither changed nor benchmarked.

AC connected; Windows High performance plan selected (`8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c`), replacing the previously active Acer plan for these requested measurements. One WinGet Vulkan llama-server `b10752-b96806d96`; MedGemma 1.5 4B Q4_0 cached snapshot `2b768ebbb117270ea9b07e06bb18c3ef3c941a7e`; context 8192, parallel 1, no mmproj, automatic layers/fit, default 1024 MiB fit margin. Prompt v5, schema 1.1, output ceiling 3072, seed 0 and clinical source unchanged.

Reference direct hematology: 29/35 layers offloaded, 2678 prompt / 655 completion tokens, prompt evaluation 3569.179 ms, generation 44187.887 ms, 14.800 tokens/s, AI total 49047.122 ms. GPU model 1943.79 MiB, GPU KV 272 MiB, GPU compute 100.88 MiB. Sample device memory 3008 MiB used / 955 MiB free (device-wide, not process allocation).

Required full backend reference job `a99f82e8-6afb-4c07-9b6a-0f4f72ff454a` succeeded but was unusually slow: same 2678/655 tokens, generation 102772.005 ms at 6.364 tokens/s, prompt evaluation 991.536 ms, AI total 104197.470 ms, requested-to-persisted-success **104657.469 ms**. Queue 189.430 ms. This outlier is retained. Historical 40–43-second runs are not substituted for this session's baseline. Host RAM reached 95.9% used during the direct reference, and runtime speed varied substantially even on AC. A single-run percentage is not a controlled statistical estimate.

## 2. CONTEXT TEST

| Context, otherwise baseline | GPU layers | GPU KV | Completion | Generation | Tokens/s | AI total |
|---|---:|---:|---:|---:|---:|---:|
| 8192 | 29/35 | 272 MiB | 655 | 44.188 s | 14.800 | 49.047 s |
| 6144 | 29/35 | 240 MiB | 655 | 48.893 s | 13.376 | 54.653 s |

**KEEP_8192.** 6144 did not increase offload or improve speed; it saved only 32 MiB GPU KV and reduces available context for larger reports. Both returned exactly the same validated final response hash. No production context limit changed.

## 3. FLASH ATTENTION

The actual binary's help supports `--flash-attn [on|off|auto]`.

| Setting, context 8192/default fit | GPU layers | GPU compute | Completion | Prompt eval | Generation | Tokens/s | AI total |
|---|---:|---:|---:|---:|---:|---:|---:|
| OFF | 27/35 | 199.82 MiB | 692 | 24.160 s | 71.915 s | 9.609 | 96.842 s |
| ON | 29/35 | 100.88 MiB | 655 | 2.493 s | 44.897 s | 14.567 | 48.312 s |

Both passed grounding/response validation and produced the same final response hash. ON is materially better than OFF, but effectively equal to baseline Auto: it is not counted as a new baseline speed gain. The measured optional profile explicitly selects ON for reproducibility; the launcher's portable default remains Auto.

## 4. GPU OFFLOAD

The binary supports `--fit-target`, whose documented default is a 1024 MiB per-device margin. Two conservative automatic-fit experiments were made; no layer count was forced.

| Fit margin, FA ON / 8192 | GPU layers | Completion | Generation | Tokens/s | AI total | Decision |
|---|---:|---:|---:|---:|---:|---|
| 1024 MiB | 29/35 | 655 | 44.897 s | 14.567 | 48.312 s | Portable default |
| 768 MiB | 33/35 | 692 | 70.252 s | 9.836 | 79.314 s | Rejected |
| 640 MiB | 35/35 | 655 | 14.307 s | 45.713 | 17.137 s | Retained as optional measured profile |

At 640, automatic fitting selected full offload; it was not blindly forced. GPU model allocation 2254.03 MiB, GPU KV 334 MiB, GPU compute 87.52 MiB; CPU mapped model buffer 525.13 MiB remains (this does not mean repeating layers remain on CPU). Final application samples: 3282 MiB device-wide used / **681 MiB free**, versus roughly 3008/955 in the initial reference. No OOM, crash, repair or failed validation occurred.

Active full-offload samples reached 89–92% GPU and approximately 64–97% process CPU (about one logical core), versus substantial multi-core CPU use with partial offload. GPU samples reached 85–86°C. Increasing layer count alone was not sufficient: 33 layers was slower. Full offload removed the remaining CPU-layer boundary and coincided with much faster measured decoding. Exact causal proportions versus changing host load/temperature are not isolated.

Portable launcher defaults stay at 1024/Auto. The current local runtime was explicitly started with the measured profile, context unchanged:

```powershell
.\scripts\start-patient-llama.ps1 -LlamaServer <explicit-llama-server.exe-path> -ModelPath <same-Q4_0.gguf-path> -Device Vulkan1 -FitMarginMiB 640 -FlashAttention on
```

The launcher still refuses duplicate processes/occupied ports, uses automatic fitting, verifies ownership/readiness/context, and never stops an existing runtime. On a busier GPU, automatic fitting may select fewer layers; the 35/35 result is not guaranteed across memory conditions. No system thermal limits or GPU power limits were bypassed.

## 5. MODEL OUTPUT REDUNDANCY

No model-output reduction was attempted. The direct full-offload run was 17.14 seconds and the final application median was below 30 seconds, activating the requested runtime-tuning stop rule. Hematology completions remain **655 tokens**, exactly the baseline size. No token reduction is claimed.

## 6. INTERNAL CONTRACT CHANGE

**None.** No reconstruction logic, schema, prompt, clinical deduplication, grounding, candidate limits, safety validation, final API or UI changes were made in this task. Steps 5–7 were intentionally not pursued after runtime tuning reached the median target.

## 7. PERFORMANCE

All following cases used fresh backend jobs, existing verified observations, one generation, zero repairs, finish reason `stop`, and passed backend/AI validation.

| Hematology | Job ID | Prompt/completion | Tokens/s | Generation ms | Grounding ms | AI total ms | Backend total ms |
|---|---|---:|---:|---:|---:|---:|---:|
| Run 1 | `279e1b31-2f6a-4cc1-a88a-d6ac06719d11` | 2678/655 | 47.864 | 13663.827 | 394.378 | 14953.441 | 15240.290 |
| Run 2 | `b5c66703-cf49-42ec-a091-3bb3d78e1dc4` | 2678/655 | 32.257 | 20274.920 | 1347.360 | 22337.312 | 22420.261 |
| Run 3 | `003f9745-2405-47e4-bdb0-ef654839a327` | 2678/655 | 15.420 | 42411.182 | 3359.634 | 46624.300 | 46705.316 |
| Median | | 2678/655 | **32.257** | **20274.920** | **1347.360** | **22337.312** | **22420.261** |

Backend total means persisted `completed_at - requested_at`, including queue. Respective queue waits 113.011 / 22.085 / 23.787 ms; persistence spans 57.575 / 90.963 / 48.629 ms. API polling observed completion at 16.773 / 24.794 / 48.886 seconds, median **24.794 seconds**. These are not browser render measurements.

All three complete persisted result JSON hashes exactly match the baseline: `1a2cdf5fcb59187d494b64661d99b152e3071315397b12730a89c61cd2715ef3` (sorted JSON serialization). No facts/prose were dropped to obtain faster times. Median meets the target, but the third run **fails** the 30-second target and slightly exceeds 45 seconds. Temperature/power-limit counters and host variability were observed; no claim is made that temperature alone caused this specific outlier. The optional profile is a measured improvement, not a universal latency guarantee.

## 8. COMPLEX REPORT

Job `a863b782-e65c-47b5-b3e7-5399befb938e`: **SUCCEEDED**; prompt 3004, completion **1071**, prompt eval 2233.522 ms, generation **66365.568 ms**, 16.123 tokens/s, grounding 6190.324 ms, AI total 75486.313 ms, backend total **75711.562 ms**, observed terminal 77.012 s. One generation, no repair.

This misses the 35–45-second goal. It produced two validated clusters rather than the earlier partial-offload run's one cluster/657 tokens. The complete persisted result hash differs. Unchanged source and successful validation do not prove exact clinical equivalence of differing generations; **exact complex-output equivalence is not established**. No content was truncated to conceal this result, and the optional profile has not replaced the safer launcher defaults. This is a remaining acceptance limitation for review.

## 9. CLINICAL BEHAVIOR

Clinical implementation/prompt/schema/safety changes: **NO**. Hematology final-output equivalence: exact across all three runs and baseline. Complex generation: valid but different; equivalence is not claimed. No Doctor source/behavior was redesigned. No OCR source, settings, service or parsing behavior was modified in this task. Existing OCR file hashes and Compose/backend OCR files match the initial worktree hashes.

## 10. TESTS

- AI focused runtime, API, report-analysis, v5/v5.1, compact IDs, eligibility, optional-enrichment contract/grounding and telemetry: **156 passed, 0 failed**.
- Backend Patient AI service 33 + worker 9 + existing worker telemetry 2: **44 passed, 0 failures/errors/skips**. The telemetry suite includes one pre-existing mocked OCR test; no live OCR work was performed.
- All six direct configurations validated: baseline, 6144, FA OFF, FA ON, margin 768, margin 640. All produced the same final hematology response hash despite small raw generation differences in two runs.
- Backend application: baseline plus three final hematology and one complex = **5/5 SUCCEEDED**. This is functional success, not 5/5 latency-target success.
- Updated launcher successfully started the measured profile, owning port 8002 with context 8192 and one slot. Static PowerShell parse and diff whitespace checks passed.
- Frontend not changed in this task; no redundant frontend suite was run. No deterministic reconstruction tests were needed because no internal-contract change was implemented.

## 11. CHANGED FILES

Only this task's changes:

- `scripts/start-patient-llama.ps1`: validated optional `FitMarginMiB` and `FlashAttention` parameters; portable defaults preserved; selected values shown in readiness output.
- `docs/validation/patient-ai-single-request-tuning.md`: this report.

Benchmark scripts, initial worktree hashes and numeric logs remain under ignored `tmp/latency-*`. Real requests/responses were processed only in memory; no report text, values, patient filenames or credentials were printed/saved. Verbosity-4 benchmark output passed through a numeric allowlist filter; the final serving runtime uses normal logging.

## 12. GIT STATUS

Branch `perf/patient-ocr-ai-latency`; main/origin/main remain `40ca5af919ba63a521cc0340b33879eab7d4a64d`. Combined pre-existing and new work: 15 modified tracked files, 13 untracked project files, nothing staged. No commit, push, merge, reset, clean, file deletion, stash deletion, Flyway repair or Docker volume removal. The only pre-existing file whose hash changed during this task is the launcher. Windows High performance remains selected, charger connected at validation, one local Vulkan runtime uses the optional 640/ON profile.
