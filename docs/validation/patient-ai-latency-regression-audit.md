# Patient AI latency regression audit — 2026-09-27

## 1. KNOWN-GOOD BASELINE

The [previous audit](patient-ocr-ai-latency-audit.md) records the uncommitted `perf/patient-ocr-ai-latency` worktree based on `40ca5af919ba63a521cc0340b33879eab7d4a64d`. Main and origin/main still have that SHA. AI telemetry changes were present; the v5 prompt, clinical grounding and schema were not performance modifications. Compact observation IDs were already on main.

MedGemma 1.5 4B IT, Q4_0, WinGet Vulkan llama.cpp `b10752-b96806d96`, RTX 3050 Ti 4 GiB, `Vulkan1`, automatic GPU layers, fit on, context 8192, parallel 1, no mmproj. Cached GGUF snapshot: `2b768ebbb117270ea9b07e06bb18c3ef3c941a7e`. Patient prompt `patient-lab-report-v5`, response schema `1.1`, constrained `response_format.type=json_object`, output allowance 3072, temperature 0, top_p 1, seed 0.

| Historical application case | Prompt/completion tokens | Generation | Generation rate | Request-to-persisted-success |
|---|---:|---:|---:|---:|
| Short, 4 observations | 1474 / 291 | 11.854 s | 24.464 tokens/s | 14.546 s |
| Complex, 22 observations | 3004 / 657 | 30.386 s | 21.589 tokens/s | 32.991 s |

Each used one generation and no repair. Historical request JSON/schema byte hashes and the exact historical backend image digest were not recorded: **NOT PROVEN**. Source and settings can be reconstructed from the audit and retained scripts, but this is not a historical binary attestation.

## 2. CURRENT LIVE RUNTIME

Initial inspection found two Vulkan processes. PID 26284, started at approximately 07:08 local, owned port 8002 and retained the original benchmark log. PID 25132, started at approximately 08:40, did not own that port. Both commands selected the WinGet Vulkan binary; the second was launched from the `llama-cuda13` directory, which did not make it a CUDA executable. Its command used `-hf`; the listener used the cached `-m` path.

Initial AI PID 15908 used this repository's `ai-service` directory and was started after the inspected source modifications. Its allowlisted environment confirmed output 3072, prompt v5, Q4_0, and concurrency 1. The initial backend image was `sha256:1f6e1a6cb6372ab6752f3ccffe84824ae532440a66e41625008d26d3d25b6fa1`.

Final restored runtime: Vulkan PID 15484 on 8002, AI PID 20432 on 8001, backend container on 8080. AI uses the repository virtual environment; Windows reports its underlying Python 3.12 executable. Backend was rebuilt from this worktree, image `sha256:cc711555dc954b3dfefd00c4116f65bcd60e6e0517bc34eacbb53b3e7655fea1`. Frontend was rebuilt, image `sha256:81739cbd28a9d5b5ee2328b06942df74fa2f555595f29a0ef5c0294a23ca5e1e`. Existing services/volumes were restored after the session break. No volumes or database state were removed.

Final Vulkan command uses the explicitly selected WinGet executable and cached GGUF with `--no-mmproj --device Vulkan1 --gpu-layers auto --fit on --parallel 1 -c 8192 --host 127.0.0.1 --port 8002`. No output allowance or clinical setting was changed.

## 3. REGRESSION DIFFERENCE

- The claimed CUDA experiment was not a verified CUDA switch. The original Vulkan log shows task 955 starting at the failed job's time and being cancelled approximately 240 seconds later. The same listener subsequently generated 655 tokens in 76.030 seconds (8.60 tokens/s).
- There were two model processes and an ambiguous launch path. A fresh single Vulkan process recovered the short/complex cases to 18.461/44.282 seconds, with exactly the historical 291/657 completion counts. No prompt or schema change was needed.
- The hematology application result uses 655 tokens. The older direct hematology replay reported 386; its exact request envelope was not retained. Why that older replay differed is **NOT PROVEN**. Comparing its total time to a 655-token output without accounting for output length would be misleading.
- The later resumed session ran on battery. Windows reported AC offline, 56% battery; NVIDIA reported active software power and thermal slowdown during generation. An Event 105 records the AC disconnect after the morning benchmark window. This explains a measured present-day performance constraint, but does **not** prove that the earlier morning degradation had the same cause.
- Initial inspection and the later cold replay also showed substantially smaller resident working sets than the warm morning runs. Memory pressure is a possible contributor, not an established historical cause.

## 4. ISOLATION TESTS

Gate 1 succeeded: fresh single-process Vulkan completed the unchanged historical short and complex application cases. Following the requested gate, A (tiny), B (unconstrained), and C (schema comparison) were **not run as optimization experiments**. No grammar/schema optimization was justified or implemented. D, the full application flow, was measured repeatedly.

Separate lifecycle diagnostic: a synthetic constrained array request with a two-second injected client timeout exercised the existing runtime exception/cancellation path. This was not a production timeout or token-limit change.

A later identical-request comparison used the full existing hematology prompt/schema. CUDA and Vulkan request SHA-256 matched: `5e1d2ad0151b2d576ce3ce467fda2dced675cd116d8738088eeb40dfe12be996`. Schema: 10086 serialized bytes; one message; 3072 allowed output tokens. CUDA finished successfully in 49.490 s. The later cold Vulkan replay took 58.504 s under different host/power conditions, so these two totals are **not** a controlled backend speed ranking.

## 5. TOKENS

| Run | Prompt | Completion | Prompt evaluation ms | Generation ms | Tokens/s |
|---|---:|---:|---:|---:|---:|
| Clean Vulkan short | 1474 | 291 | 1613.28 | 16560.97 | 17.51 |
| Clean Vulkan complex | 3004 | 657 | 2312.09 | 40127.72 | 16.35 |
| Hematology 1 | 2678 | 655 | 3244.292 | 37838.086 | 17.284 |
| Hematology 2 | 2678 | 655 | 682.089 | 41565.715 | 15.734 |
| Hematology 3 | 2678 | 655 | 600.647 | 39570.310 | 16.528 |
| Final morning complex | 3004 | 657 | 2654.259 | 40038.347 | 16.384 |
| Verified CUDA replay | 2678 | 687 | 2364.710 | 46062.615 | 14.893 |
| Resumed cold Vulkan replay | 2678 | 655 | 11852.941 | 44362.868 | 14.742 |
| Actual browser rerun, battery | 2678 | 655 | 8074.556 | 71848.502 | 9.102 |

All successful measured cases above used one generation, zero repairs, and finish reason `stop`. No clinical output was shortened. Prompt-cache reuse is included in telemetry; small new-token counts do not mean the complete prompt was shortened.

## 6. LLAMA RUNTIME

Startup-only verbosity-4 diagnostics were captured on port 8003, with no patient request sent there. Normal serving was restored at verbosity 3.

| Allocation | Vulkan b10752-b96806d96 | CUDA build 11064, a894dae93 |
|---|---:|---:|
| GPU layers / total including output layer | 29 / 35 | 28 / 35 |
| CPU-resident repeating layers | 6 | 7 |
| GPU model buffer | 1943.79 MiB | 1893.12 MiB |
| CPU mapped model buffer | 835.37 MiB | 886.04 MiB |
| GPU KV buffers, summed | 272 MiB | 266 MiB |
| CPU KV buffers, summed | 62 MiB | 68 MiB |
| GPU compute buffer | 100.88 MiB | 104.07 MiB |
| Host compute buffer | 19.52 MiB | 19.52 MiB |

The model has 34 repeating layers. Both runtimes used context 8192, one slot, Q4_0 and no multimodal projection; vision/audio/video were false. CUDA executable: `C:\Users\rinto\llama-cuda13\llama-server.exe`. Automatic fit demonstrably does **not** mean full GPU offload. Allocation diagnostics describe the measured fresh startups, not the unrecoverable allocation state of every historical process.

Warm Vulkan device-wide VRAM was approximately 2371 MiB; active GPU samples 22–42%, clocks 637–900 MHz, CPU process use approximately 478–752% (about 4.8–7.5 logical cores). During the resumed battery browser run, a sample showed 2384 MiB, 39% GPU, 435 MHz, 625% CPU. These are samples, not whole-run averages or per-process VRAM totals. Partial CPU offload and power throttling constrain the observed inference speed.

## 7. SLOT / REQUEST LIFECYCLE

The slot was idle before the clean restart and controlled tests. The old task 955 cancellation was followed by slot release about 230 ms later. The controlled two-second timeout raised `ModelTimeoutError` at 2261.8 ms; llama logged cancellation followed by release 27.5 ms later. Subsequent slot polls were idle. No orphaned generation or queued retry was demonstrated, so no speculative cancellation endpoint or lifecycle rewrite was added.

Python semaphore waits were 0.009–0.020 ms for the morning final jobs. Exact llama internal queue wait is not exposed by the recorded response; it is **NOT PROVEN** as a separate numeric duration. One slot was confirmed idle before controlled runs, and no overlapping manual/Doctor inference was introduced. Backend requested-to-start times include queue/claim scheduling and are not a separately measured RabbitMQ-only duration.

## 8. TIMEOUT CLASSIFICATION

Before: Patient `ModelTimeoutError`, a subclass of `ModelUnavailableError`, became HTTP 503; backend transport timeouts became `AI_SERVICE_UNAVAILABLE`. Corrected: Patient model timeout is caught first and returns HTTP 504. Backend 504, nested `SocketTimeoutException`, and `HttpTimeoutException` become `AI_TIMEOUT`. Connection refusal remains `AI_SERVICE_UNAVAILABLE`; genuine HTTP 503 remains `AI_MODEL_UNAVAILABLE`. Cause traversal is cycle-safe and does not parse or log potentially sensitive exception text.

Tests cover the Python subclass distinction and nine backend failure paths. No Doctor exception mapping was changed.

## 9. EXACT ROOT CAUSE

**Proven:** the 240-second failure exhausted the model HTTP read timeout; the supposed CUDA run was served by the old Vulkan listener. Its Python queue wait was negligible, there was one attempted generation, and repair/grounding did not run. Timeout inheritance/handling then mislabeled the failure. The 78-second successful run spent 76 seconds generating only 655 tokens at 8.60 tokens/s. It was slow model execution, not a large new prompt, repair loop or database queue.

**Proven current constraint:** the resumed battery-powered browser run again slowed to 9.10 tokens/s while NVIDIA reported power/software thermal throttling; rendering and polling added only about 2.5 seconds. Warm AC runs completed in 40–43 seconds. This is a runtime/hardware constraint that prompt changes would conceal rather than solve.

**Not proven:** which internal/resource condition made the original morning Vulkan process degrade, and whether the second process caused that degradation. Restarting while removing a duplicate changed two aspects of process state; it does not establish the duplicate as the sole cause. There is no honest evidence for an exact historical hardware-level explanation. Performance recovery and the definite timeout/launch defects are established; universal sub-45-second performance is not.

## 10. FIX IMPLEMENTED

- Restored a clean, explicitly identified single Vulkan listener with unchanged clinical/inference settings.
- Added `scripts/start-patient-llama.ps1`: requires explicit binary/model paths; refuses an existing llama process or occupied port; serializes startup; verifies listener PID, health, context and slot count; uses hidden launch; cleans up only its own failed startup. This prevents mistaking a launch from a CUDA directory for a successful CUDA switch. It never kills an existing runtime.
- Corrected Patient timeout mapping in Python and Java with regression tests.
- Added the requested small notice above a preserved older successful result after a failed rerun, using the existing previous-result flag/job IDs. Result composition, clinical content and rerun behavior remain unchanged.
- Rebuilt/restarted the affected local services. OCR source/configuration was not changed in this debugging task.

## 11. PERFORMANCE AFTER FIX

| Same 16-observation hematology | Job ID | Queue ms | DB request-to-SUCCEEDED | Observed terminal via API polling |
|---|---|---:|---:|---:|
| Run 1 | `8afa7d7f-b9bb-46e1-8d0e-716b95828e1f` | 14.927 | 42.370 s | 42.819 s |
| Run 2 | `2dc0051b-dc04-4a9d-be7d-9c0436e3e20e` | 23.276 | 42.780 s | 44.312 s |
| Run 3 | `f21c7b4c-7d4a-47cb-b1a5-a40153d872b0` | 25.700 | 40.689 s | 42.343 s |
| Median | | | **42.370 s** | **42.819 s** |

AI totals: 42300.939 / 42733.279 / 40631.860 ms. Grounding: 962.266 / 372.769 / 339.566 ms. Transaction-inclusive persistence: 22.539 / 13.985 / 17.854 ms. All succeeded and meet the 45-second ceiling; the preferred 30 seconds was not reached.

Complex job `a7f9ed93-879b-456e-ab45-21184a7f190c`: queue 13.815 ms, generation 40.038 s, grounding 1485.627 ms, persistence 13.998 ms, DB total **44.636 s**, observed by API polling **45.709 s**. One generation, no repair, same 657-token size as the historical complex benchmark.

Actual browser rerun after the session break: `44b0eca8-de51-4a0c-83f8-eb3c9de629e5`, **SUCCEEDED**, queue 120.921 ms, DB total **83.090 s**, UI observed/rendered at **85.811 s**. Frontend observation delay from completedAt: **2377 ms**; render after response: **92 ms**. The displayed result job matched the new successful job; previous-result flag was false. This run was on battery with active GPU throttling and **fails the latency target**. It is retained as evidence, not excluded from the report. An initial browser probe used the unconfigured 127.0.0.1 origin and was CORS-rejected before any job; the successful run used the configured localhost origin without weakening CORS.

## 12. PATIENT AI BEHAVIOR

Clinical behavior changed: **NO**. Prompt v5, schema 1.1, evidence/cluster/candidate logic, grounding, safety, verified authority, alternatives/missing evidence, output allowance, result composition and rerun semantics were preserved. Prompt/schema source hashes match main. The only UI addition identifies an older result after a failed new run, as explicitly requested. No Doctor behavior or OCR implementation changed.

## 13. TESTS

- Focused AI runtime, Patient report services, v5/v5.1 schema/grounding, telemetry and API mapping: **144 passed, 0 failed**.
- Backend Patient AI service **33**, worker mapping **9**, existing worker telemetry **2**: **44 passed, 0 failures/errors/skips**.
- Patient AI Insight frontend: **17 passed, 0 failed**.
- Frontend typecheck and changed-file ESLint: passed. `git diff --check`: passed.
- Launcher: duplicate-process rejection verified without starting/stopping a process; successful owned-port startup verified for CUDA and Vulkan.
- Runtime validation: initial clean short/complex 2/2; repeated hematology/complex 4/4; CUDA and resumed Vulkan direct validations 2/2; actual browser rerun 1/1 succeeded. Battery runtime success is not a latency-target pass.

Initial frontend/Maven sandbox invocations were blocked by dependency/configuration access; authorized reruns passed. OCR suites were not repeated or changed in this task; prior OCR results remain in the earlier audit.

## 14. CHANGED FILES

New changes for this debugging task (earlier performance changes remain intact):

- `ai-service/app/api/internal_analysis.py`
- `ai-service/tests/test_internal_analysis_api.py`
- `backend/src/main/java/com/clinora/ai/service/PatientReportAiAnalysisWorker.java`
- `backend/src/test/java/com/clinora/ai/service/PatientReportAiAnalysisWorkerTest.java`
- `frontend/src/pages/patient/patient-report-ai-insight-page.tsx`
- `frontend/src/pages/patient/patient-report-ai-insight-page.test.tsx`
- `scripts/start-patient-llama.ps1`
- This audit.

Ignored `tmp/ai-regression-*` artifacts contain scripts and safe metrics, not saved report text or credential values. Existing evidence was preserved. Real report snapshots and authentication credentials used by probes remained in process memory; browser screenshots, storage-state files and traces were not saved.

## 15. GIT STATUS

Branch `perf/patient-ocr-ai-latency`; main/origin/main both `40ca5af919ba63a521cc0340b33879eab7d4a64d`. Combined worktree: 15 modified tracked files and 12 untracked project source/test/documentation files. Nothing staged, committed, pushed or merged. No reset, clean, stash deletion, Flyway repair or Docker volume deletion occurred.
