> Publication cleanup (2026-09-09): Generated JSON captures, temporary logs, and patch/backup artifacts referenced below were removed from the publication snapshot. This report preserves the historical validation results and limitations; the documented reusable acceptance harnesses remain. Statements about local-only work describe the original validation session.

Clinora AI Phase 10P-R5.1 resumed runtime validation — 2026-09-09

**PHASE 10P RUNTIME ACCEPTANCE NOT PASSED**

All four final jobs completed successfully as backend operations. Clinical acceptance failed. Backend SUCCEEDED does not mean that the interpretation met the acceptance criteria.

1. **Run inspected and run judged**

   The interrupted `phase10p-r51-continuation-runtime-3.json` had completed A/B/C/D in the background. Its B output combined independent processes and retained a wrong shared direction claim; C retained an unsupported combined candidate. It was not used to substitute successful cases into this result.

   One fresh complete run with the unchanged working tree was captured in `phase10p-r51-resume-runtime-1.json`. It failed A/B/C. After surgical grounding fixes, all four were rerun together. **Only `phase10p-r51-resume-runtime-2.json` is used for the final assessment below.** It records source hashes for seven AI files, raw output, accepted clusters, diagnostic counts, final patient interpretation, and persisted backend results. All source hashes matched the final code, and every captured cluster array matched its persisted counterpart.

2. **Same-run A/B/C/D results**

   | Report | Raw clusters / candidates | Accepted clusters / candidates | Prompt / completion tokens | Result |
   | --- | --- | --- | --- | --- |
   | A: infectious/qualitative assay | 3 / 3 | 3 / 3 | 1,423 / 1,014 | Partial: positive assay support and viral-process rationale survive; correlation remains broad and related findings are split into separate groups. |
   | B: verified multisystem | 1 / 1 | 1 / 1 | 1,552 / 684 | Failed: independent processes were combined, and overly specific renal complication language remains. |
   | C: one abnormality plus UNKNOWN context | 1 / 1 | 1 / 0 | 2,132 / 605 | Failed usefulness: no truncation, UNKNOWN stays context, candidate removed, but final interpretation is only `ABNORMAL`. |
   | D: mostly normal | 1 / 0 | 0 / 0 | 1,230 / 426 | Passed: no forced disease. |

   Every completion ended with `finishReason=stop`; none was truncated or produced a 502. Content lengths were A 3,943, B 2,346, C 1,822, and D 1,227 characters. Elapsed times were 61.91, 45.94, 37.27, and 25.03 seconds respectively. The model remained the existing MedGemma 1.5 4B Q4_0 through llama.cpp, with an 8,192-token context and a 3,072-token output budget.

   Final fresh job IDs:

   ```text
   A ed80b5df-5b00-479c-a570-a90740999eca
   B af4e2291-d185-4647-9d97-8466f0db3608
   C ed7a06a6-d0b2-40a3-aab4-bbb363312c53
   D e79fbf60-900c-420d-bb5d-2e1a19811196
   ```

   A's assay-backed candidate is `Viral Infection`, with rationale connecting the positive assay to a possible viral process. UNKNOWN findings were not used as positive support. This restores the mechanical support path but does not establish rich clinical correlation.

   B's single cluster mixes glycemic, thyroid, and urine findings. Its evidence relevance retains `early diabetic nephropathy`, while its accepted candidate is `Diabetes Mellitus`. Independent physiological processes are not adequately separated. The validator cannot create missing medical clusters or establish that a specific complication follows from a real outlier.

   C retained PDW as SUPPORTS and RDW as UNKNOWN CONTEXT, with no accepted candidate. Its output did not meet the requirement for a clinically useful pattern explanation. A one-word status is not an acceptable substitute for medical reasoning.

   D's final interpretation is: "The verified observations do not show a clear abnormal pattern. Clinical context may still matter when discussing this report with a clinician."

   Support-to-context and unknown-support pruning counts were zero in this final run because generation supplied eligible roles. Factual-claim pruning counts were A 0, B 0, C 3, D 0; condition-leakage neutralization counts were A 4, B 1, C 1, D 0. These counters count detected occurrences, not a medical proof that every remaining sentence is valid.

3. **Surgical fixes made after the fresh unchanged-code run failed**

   Runtime A exposed over-pruning of factual sentences such as `the patient has a verified positive ... test`. The existing assertion exception now recognizes that wording and `evidence of`, while still requiring a supplied test label and factual validation. Plural count labels can match their singular `... count` form; the count qualifier prevents confusing a size explanation with an unclassified count.

   A shared adjective in `high A, B, and C` is now checked against each explicitly named supplied observation. Matching stops at unrecognized text or a new direction, so `high A and low B` preserves the separate directions. Independent valid sentences remain intact.

   A verified HIGH/LOW/positive result cannot be relabelled `unclassified` in missing information to preserve a candidate. Incomplete trailing list fragments are removed. Internal eligibility metadata is removed from patient prose. Combined `X or Y` hypotheses are handled like slash-separated alternatives; their individual names and rejected cluster alternatives cannot remain as an unvalidated replacement candidate channel.

   These changes do not solve the remaining model-level grouping, specificity, and usefulness failures. No prompt, inference engine, public schema, frontend, or backend architecture was changed during this resumption.

4. **Exact files changed during this resumption**

   ```text
   ai-service/app/services/clinical_cluster_grounding.py
   ai-service/app/services/report_analysis_service.py
   ai-service/tests/test_patient_lab_report_v51.py
   docs/validation/phase10p-r51-resume-runtime-1.json
   docs/validation/phase10p-r51-resume-runtime-2.json
   docs/validation/phase10p-r51-resume-report.md
   ```

   The runtime driver also refreshed its ignored synthetic-input manifest and local runtime logs under `backend/target`. Existing uncommitted R4/R5/R5.1 files and earlier captures remain intact. No governing documents were edited. The previous continuation's changes are not misrepresented as new edits in this resumption.

5. **Hard-coding audit**

   Reviewed the v5 prompt, runtime grammar, Pydantic contract, shared evidence eligibility, clinical-range classifier, cluster grounding, and report-analysis service. The changed AI files contain no disease-specific inference rules, analyte-to-disease mappings, disease dictionary, or introduced population ranges/diagnostic cutoffs. Disease terms occur in synthetic acceptance data and model captures, not as production prediction rules.

   The inspected logic uses supplied labels/IDs, Clinora range/qualitative states, generic word association, bounded text checks, and output limits. Evidence-label/UUID/state grammar constraints are generated from each verified request. The input ordering priority is a presentation order for factual categories; it neither creates medical clusters nor assigns disease strength. Report titles remain excluded from the reasoning input.

   The service retains a pre-existing count-based compatibility check in the legacy `clinicalPatterns` path. The `clinicalClusters` path returns through its separate shared-eligibility validator before that check. No new abnormal-count threshold or disease prediction rule was added. This audit confirms code structure, not medical correctness of free-form model output.

6. **Validation**

   Final focused regression command, run after the final A/B/C/D set: **109 passed**. This includes 41 R5.1 tests, 17 R4 tests, 40 R5/runtime tests, and 11 shared-eligibility/range tests.

   Full AI suite after the surgical fixes: **159 passed, 7 failed, 166 total**. The seven failures are the unchanged documented legacy failures in `test_report_analysis_service.py`; none was modified to turn it green. Backend/frontend source and public contracts were unchanged in this resumption, so their previously validated results are not claimed as new executions here.

   Final `git diff --check`: **passed** (exit 0; existing line-ending notices only). Source-hash consistency and persisted-cluster equality checks passed for all four final jobs. No browser visual validation was performed in this resumption.

7. **Limitations and disposition**

   Factual identity and range checks do not prove that real findings justify a specific medical condition. The model still omits independent processes, makes overly specific associations, and sometimes supplies status words instead of useful interpretation. Candidate rationale can still make broader associations than its declared supporting subset. The current free-text checks do not establish complete semantic isolation between all hypothesis and pattern channels.

   Truncation was resolved in this same-run assessment, but B and C still block acceptance. A remains limited. No successful cases from other runs were substituted. The source is reviewable locally; this report does not authorize a clinical release. No commit, push, merge, reset, clean, or publication was performed. Synthetic fixtures remain for review. The acceptance helper and model started for this run were stopped, and the containers were returned to their initial stopped state with the backend's normal AI endpoint restored.
