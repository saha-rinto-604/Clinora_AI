# Patient OCR and AI latency audit

Date: 2026-09-27. Branch: `perf/patient-ocr-ai-latency`. Performance work is unstaged, uncommitted, unpushed and unmerged.

## Preserved main

`main` and `origin/main`: **40ca5af919ba63a521cc0340b33879eab7d4a64d**.

Commit: **Fix applicant recovery, care continuity, and report processing**. Phase 1 reviewed and committed 30 source/config/test/documentation files: applicant verification-email recovery, appointment/consultation continuity, Doctor support presentation, Patient processing notices, compact Patient AI evidence references, associated tests, and OCR restart policy. Two stale frontend assertions were corrected. No secrets, local documents, patches, logs, generated outputs or IDE files were staged. Remote main had not advanced; normal push succeeded. Clean main and matching SHAs were verified before branching.

Phase 1 validation: OCR 40 tests; AI 376 plus 6 subtests; backend 23 focused tests; frontend typecheck passed; lint 0 errors and 7 existing warnings. Initial full frontend tests passed 335/337 with two stale wording assertions failing; the corrected focused run passed 67 tests covering those failures and changed features.

## 1. Current baseline

Original real 16-observation hematology report:

| Measurement | Milliseconds |
| --- | ---: |
| Cold extraction including construction | 73856.23 |
| Paddle construction | 31497.34 |
| Warm extraction 1 / 2 / 3 | 35244.06 / 34983.84 / 48788.64 |
| Median warm extraction | 35244.06 |
| Warm parser-only measurements | 14.03 / 24.57 / 10.06 |

These are engine measurements, not historical browser-to-database timings. All baseline runs had identical full-observation fingerprints, 16 observations, REVIEW_REQUIRED, no warnings and zero MedGemma calls. This complete report never triggered assist; removing assist alone could not speed it up.

A controlled baseline after restart measured 31.70 / 24.93 / 25.03 seconds. Laptop load, caches and thermal variability mean differences between dates cannot all be attributed to code.

## 2. Root cause breakdown

Benchmark instrumentation timed each advancement of PaddleX `BasePredictor.apply`, including lazy consumption. Model spans include their own preprocessing/post-processing, not just neural kernels.

| Same hematology report | 3.3, oneDNN off (ms) | 3.2.2, oneDNN on (ms) |
| --- | ---: | ---: |
| Image preparation/render | 21.94 | 25.89 |
| Layout: PP-DocLayout-S | 207.20 | 48.70 |
| Region: PP-DocBlockLayout | 1898.01 | 837.16 |
| Detection: PP-OCRv5_mobile_det | 1023.45 | 357.88 |
| Recognition: PP-OCRv5_mobile_rec | 19793.41 | 3959.33 |
| Actual Paddle prediction | 22964.32 | 5242.32 |
| Parser, normalizer and quality | 79.09 | 58.08 |
| Complete extraction | 23090.16 | 5349.97 |

**Text recognition dominated.** Parser optimization was unnecessary. Paddle post-processing is not separately observable in these spans; other adaptation/Python work is included in total.

No table-submodel calls were observed on these profiled pages. Table recognition remains enabled; this corpus does not establish complex-table latency. Hidden models remain PP-LCNet_x1_0_table_cls, SLANeXt_wired, SLANet_plus, RT-DETR-L wired/wireless cell detectors and PP-LCNet_x1_0_doc_ori. No model substitution was made.

Host: i7-11800H, 8 physical/16 logical processors. Container: 16 visible/affinity CPUs, unlimited `cpu.max`; Docker VM approximately 7.6 GiB RAM. OCR remains CPU-only.

## 3. Performance experiments

Seconds, hematology case. Batch experiments used three requests after startup. The selected runtime also had a separate first request before three warm runs. Clinical comparisons include ordered labels, raw/numeric values, units, references, comparators, review flags, page/row associations, warnings and quality. Confidence/bounding-box metadata is excluded from exact equality.

| Configuration | Run 1 | Run 2 | Run 3 | Median | Field accuracy | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Original 3.3, oneDNN off, warm | 35.244 | 34.984 | 48.789 | 35.244 | Preserved | Slow |
| 3.3, off, 10 threads, batch 8; controlled | 31.699 | 24.927 | 25.026 | 25.026 | Preserved | Slow |
| 3.3, off, 10 threads, batch 1 | 16.012 | 14.469 | 15.477 | 15.477 | One raw reference changed | Rejected |
| 3.3, off, 10 threads, batch 4 | 20.154 | 20.840 | 24.686 | 20.840 | Preserved | Intermediate |
| 3.3, off, 4 threads, batch 4 | 17.563 | 17.844 | 18.227 | 17.844 | Preserved on four cases | Intermediate |
| 3.3, HPI on, official CPU dependencies | — | — | — | — | Startup failed | Rejected |
| 3.2.2, HPI on, official CPU dependencies | — | — | — | — | Startup failed | Rejected |
| 3.2.2, oneDNN on, 10 threads, batch 8 | 6.225 | 6.143 | 5.485 | 6.143 | Preserved on five cases | Selected |
| Final live service, selected runtime | 3.662 | 3.499 | 3.665 | 3.662 | All 16 rows preserved | Confirmed |

Batch 1 was rejected despite its speed. Early blank-page startup took 10.90 s for batch 4, 11.55 s for batch 8, and 10.61 s for 4 threads/batch 4. Selected-runtime generated lab-table warm-up took 18.07 s in validation and 18.86 s live.

HPI used separate containers, `paddleocr install_hpi_deps cpu`, and automatic backend selection. Both versions failed an ONNX/OpenVINO scalar Reshape shape check during startup. No production HPI dependency was added; the unstable variant was abandoned. See [official HPI guidance](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/inference_deployment/local_inference/high_performance_inference.en.md).

Concurrency exposed a correctness issue: shared predictors used across native threads triggered fallback and changed output. Two workers returned 13 instead of 16 observations with changed quality/warnings, and the experiment failed. Recreating a one-thread pool between batches also eventually changed warnings. A persistent thread owning initialization and requests passed six queued extractions: first completion 5.33 / 6.88 / 5.81 s; both requests completed in 10.31 / 12.51 / 11.51 s. All fields, warnings and quality matched. This shared pipeline therefore uses one persistent worker.

Region disabling, resizing, lightweight table replacements, PDF DPI changes and host migration were not pursued after the safe runtime met the stop target.

## 4. Winning OCR configuration

| Setting | Value |
| --- | --- |
| PaddleOCR / PaddleX | 3.5.0 / 3.5.2 |
| PaddlePaddle | 3.2.2, pinned after validation |
| HPI / oneDNN | Off / On |
| CPU threads / recognition batch | 10 / 8 |
| Layout / detector / recognizer | PP-DocLayout-S / PP-OCRv5_mobile_det / PP-OCRv5_mobile_rec |
| Table / region detection | On / On |
| Device / workers | CPU / one persistent native thread |
| Inference resizing / PDF DPI | Existing behavior / 200 DPI |

Startup constructs the global primary pipeline and consumes a generated, non-PHI lab-table prediction on the persistent thread. It constructs the existing basic fallback there too. Primary initialization/warm-up failure aborts startup; optional fallback construction failure is remembered instead of retried on requests. `/health` remains liveness; `/ready` means primary warm-up completed. Startup grace is 180 seconds.

Requests use the same thread with timing context propagated. Tasks retain capacity until native work exits, including after HTTP timeout/client cancellation. Same active UUID retries share the task. Unsupported multi-worker configuration fails explicitly; Compose selects one worker.

Live testing found Paddle initialization raises the root logger to WARNING. The fixed-field metrics logger explicitly uses INFO, preserving telemetry without enabling verbose third-party logs. Regression coverage verifies this.

## 5. Before / after

| Measurement | Before | After |
| --- | ---: | ---: |
| Hematology cold request including construction | 73.86 s | 5.35 s first request in freshly warmed candidate |
| Hematology median warm extraction | 35.24 s original; 25.03 s controlled | 6.14 s isolated; 3.66 s live HTTP |
| Live hematology median inference | — | 3.569 s |
| Paddle construction within requests | About 31.5 s on original cold request | 0 ms |
| Live startup, outside Patient requests | Previously lazy | 18.863 s: 15.071 construction + 3.774 warm inference |
| Normal synthetic first application request | No application baseline | 3.738 s to observed SUCCEEDED |
| Normal synthetic warm application requests | No application baseline | 3.246 / 3.342 / 3.394 s; median 3.342 s |

Four normal application jobs succeeded: four observations, READY_FOR_CONFIRMATION. Warm DB requested-to-completed durations were 2.791 / 2.736 / 3.169 s; worker totals including transaction return were 2.803 / 2.749 / 3.181 s. Source loading was 6–8 ms, persistence 13–19 ms, queue/claim wait about 11 ms. Poll-observed totals include HTTP/polling overhead. DB `completed_at` precedes transaction return; worker timing better captures persistence completion.

One clearly named synthetic report and four extraction-history entries were created. Existing verified observations were untouched. Real hematology HTTP replays did not persist clinical results.

## 6. Accuracy

Golden comparisons preceded candidate acceptance. Synthetic outputs additionally matched authored fixture truth.

| Case | Type | Rows | First / warm median, candidate | Outcome |
| --- | --- | ---: | --- | --- |
| Established hematology (A) | Existing local report | 16 | 5.350 / 6.143 s | Exact fields; REVIEW_REQUIRED; no warnings |
| Additional CBC (benchmark B) | Existing local report | 13 | 5.901 / 5.193 s | Exact fields; existing malformed-row suppression warning retained |
| Thyroid/metabolic (C) | Synthetic different layout | 4 | 3.289 / 3.085 s | Exact fields; REVIEW_REQUIRED; no warnings |
| Normal CBC (D) | Synthetic normal | 4 | 4.278 / 3.608 s | Exact fields; HIGH_CONFIDENCE; no warnings |
| Qualitative assay + CBC (E) | Synthetic edge cases | 8 | 3.809 / 3.306 s | Exact fields; REVIEW_REQUIRED; no warnings |

Each ran once plus three warm repeats. Accepted configuration changed no clinical raw/numeric result, unit, reference, comparator, normalized label, review flag, ordered row association, warning or quality state. Checks protect one-sided ranges, qualitative positives, decimals/commas and small units, and reject metadata observations. Exact confidence/bounding-box bit equality is not claimed; clinical associations and review decisions were checked explicitly.

Hematology retains Haemoglobin, ESR, WBC, Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils, RBC, HCT, MCV, MCH, MCHC, Platelets, MPV and PCT. Four final live HTTP runs again preserved all 16 rows and clinical fields, REVIEW_REQUIRED and no warnings.

## 7. MedGemma OCR

**llama.cpp/MedGemma calls per OCR request: ZERO.**

Active assist imports/invocations and OCR MedGemma Compose settings were removed. The path remains Paddle → deterministic parser v3/normalizer → existing quality/review rules. Historical assist/crop helpers remain unused for regression coverage.

Tests force legacy assist settings on and spy on its extractor, including incomplete documents. Benchmarks replace the legacy extractor and `httpx.Client.post` with forbidden-call counters. Every run recorded zero calls. Incomplete extraction still fails quality gates. Parser, normalizer, reviewRequired and verified-observation authority are preserved.

## 8. Patient AI

Two fresh jobs used the normal backend API with unchanged force/re-run behavior. Both reached SUCCEEDED. Short case: NO_CLEAR_ABNORMAL_PATTERN, zero clinical clusters. No clinical input/output content is recorded here.

| Metric | Short normal: 4 observations | Complex: 22 observations |
| --- | ---: | ---: |
| Job ID | d6e02dc2-1463-4bce-9bc3-a55e3e9a2511 | 0139ff60-b4b1-4525-839e-7c442ed6a2eb |
| Backend queue/claim wait | 38.963 ms | 13.963 ms |
| AI semaphore wait | 0.012 ms | 0.006 ms |
| Prompt / completion tokens | 1474 / 291 | 3004 / 657 |
| Cached prompt tokens | 0 | 957 |
| Prompt evaluation | 2179.932 ms | 1759.419 ms |
| Token generation | 11854.203 ms | 30385.754 ms |
| Generation tokens/second | 24.464 | 21.589 |
| Inference HTTP span | 14202.401 ms | 32204.517 ms |
| Generation count / repair | 1 / no | 1 / no |
| Repair duration / finish reason | 0 ms / stop | 0 ms / stop |
| Grounding/validation | 105.008 ms | 752.463 ms |
| AI service total | 14310.856 ms | 32958.190 ms |
| Persistence, transaction-inclusive | 18.920 ms | 16.310 ms |
| Backend worker total | 14557.225 ms | 33005.453 ms |
| DB requested-to-SUCCEEDED timestamp | 14546.165 ms | 32991.008 ms |
| Request-to-observed-SUCCEEDED, including polling | 15840.985 ms | 33943.545 ms |

Complex prompt evaluation processed 2047 new tokens and reused 957. Timings follow the [llama.cpp server contract](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md). Repair duration, when present, is a subset of inference; missing token usage stays null. Backend/service spans overlap and must not be added together.

**AI Insight behavior changed: NO.** UI, v5 prompt, reasoning, eligibility, verified authority, grounding/safety, alternatives/missing evidence, schema, re-run behavior and composition are unchanged. Output limit remains 3072 tokens. No Doctor behavior changed. Clinical suites and identical-response persistence checks pass.

Observed runtime: llama.cpp build `b10752-b96806d96`; MedGemma 1.5 4B IT GGUF Q4_0; Vulkan1 on RTX 3050 Ti Laptop GPU; GPU layers auto, fit on; context 8192; parallel/slots 1; no mmproj. Server vision/video/audio flags are false. Device-wide VRAM after jobs: 2363 MiB of 4096 MiB, including other device users. Exact automatically offloaded layers and model/KV/compute allocations were not exposed by normal startup logging or inspected endpoints; no exact count is claimed.

Generation is the measured current bottleneck, especially the complex 657-token response. Queueing, persistence and repair do not explain these runs. JSON-constrained decoding stayed enabled; grammar overhead was not separately isolated. Historical 112–177 second jobs did not recur. Their old records lack tokens/repair/stages, so the exact historical cause cannot honestly be recovered. Current source was freshly started; historical stale-code/load effects remain unproven.

Next AI optimization if needed: benchmark the installed CUDA backend against Vulkan with identical GGUF, quantization, context, prompt, grammar, output limit and parallelism, then require clinical regression checks before adoption. No runtime switch or reasoning change was made here.

## 9. Target result

**TARGET ACHIEVED** on measured normal single-page cases. Full normal application median: **3.342 s** to observed SUCCEEDED. Live hematology inference median: **3.569 s**; HTTP extraction median: **3.662 s**. Both satisfy the 15-second inference and 20-second extraction targets.

Optimization stopped after the safe configuration passed. These results cover this hardware/acceptance set; complex or multipage reports are not promised equal latency. Recognition remains the largest measured OCR stage, already within target.

## 10. Tests

- Final OCR full suite: **51 passed**, one existing Starlette/AnyIO deprecation warning. Includes golden/parser fields, zero assist, quality, startup/readiness, thread affinity, logging, timeout and duplicate capacity.
- AI full suite: **382 passed, 6 subtests passed**. Initial invocation from repository root failed import collection; the service-directory rerun passed the complete suite.
- Backend focused OCR/Patient AI/security/reprocessing/telemetry: **54 passed; 0 failures/errors/skips**.
- Golden extraction: **20/20** without clinical-field/quality/warning regressions. Authored synthetic truth: **3/3**.
- Persistent-thread queued extraction: **6/6** matched. Live hematology HTTP: **4/4** matched all 16 rows.
- Full application synthetic OCR: **4/4 SUCCEEDED**. Fresh AI jobs: **2/2 SUCCEEDED**.
- Configured Python static checks (`compileall`) passed; no separate Python/Java lint task is configured. `git diff --check` passed.
- Frontend untouched in this phase; no redundant frontend tests/typecheck. Rejected experiments were documented and not adopted. Final relevant suites have no known failures.

## 11. Changed files

Production:

- `ocr-service/Dockerfile`
- `ocr-service/app/engine_v3.py`
- `ocr-service/app/main.py`
- `ocr-service/app/performance.py` (new)
- `docker-compose.yml`
- `ai-service/app/model_runtime.py`
- `ai-service/app/services/report_analysis_service.py`
- `ai-service/app/services/patient_analysis_metrics.py` (new)
- `backend/src/main/java/com/clinora/patients/service/PatientReportExtractionService.java`
- `backend/src/main/java/com/clinora/patients/service/PatientReportExtractionWorker.java`
- `backend/src/main/java/com/clinora/ai/service/PatientReportAiAnalysisService.java`
- `backend/src/main/java/com/clinora/ai/service/PatientReportAiAnalysisWorker.java`

Tests/docs: OCR quality edits plus new `golden_cases.py`, `test_golden_fields.py`, `test_performance.py`, `test_timeout_capacity.py`; AI `test_patient_analysis_metrics.py`; backend `PatientReportWorkerTelemetryTest.java`; this audit.

## 12. Temp files

Benchmark scripts/logs/process IDs remain in ignored `tmp/` or temporary containers and will not be committed. Private real-report comparison snapshots are removed after validation; real source documents were never written into the repository. Credentials stayed in process memory and were never printed or committed. `.env`, account files and governing DOCX documents were not edited.

Temporary benchmark containers are stopped after validation. No volume, database, stash or uncertain user file is deleted. The synthetic application report and authorized AI job history remain locally for review. Normal local services use the validated code.

## 13. Git status

Branch: `perf/patient-ocr-ai-latency`. Main/origin SHA: `40ca5af919ba63a521cc0340b33879eab7d4a64d`. Performance changes are **not staged, committed, pushed or merged**.

Change set: 11 modified tracked files and 9 new source/test/documentation files listed above. No frontend changes, secret files or benchmark artifacts are staged. No hard reset, clean, force push, stash deletion, Flyway repair or volume removal occurred.
