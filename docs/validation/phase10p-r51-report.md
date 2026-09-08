> Publication cleanup (2026-09-09): Generated JSON captures, temporary logs, and patch/backup artifacts referenced below were removed from the publication snapshot. This report preserves the historical validation results and limitations; the documented reusable acceptance harnesses remain. Statements about local-only work describe the original validation session.

Clinora AI Phase 10P-R5.1 implementation and validation report

Local changes are available for review. **R5.1 clinical runtime acceptance has NOT passed; the definition of done is not satisfied.** Deterministic grounding improved, but the latest real model run still lost legitimate assay reasoning, missed an independent thyroid process, retained overly specific medical prose, and truncated the 18-observation case. These results are not approval for clinical release.

No staging, commit, push, merge, reset, clean, publication, or database migration was performed. Existing R4/R5 work and governing documents were preserved. Local services were rebuilt/restarted for authorized runtime testing. The temporary capture route was subsequently removed: the backend container is stopped (`created`) and points to `http://host.docker.internal:8001`. Synthetic fixtures remain for review.

1. **Source of UNKNOWN-evidence leakage**

   The local R5 flow was traced from the complete prompt payload through raw cluster evidence, grounding, candidate filtering, public DTO/persisted JSON, and frontend rendering. UNKNOWN values were available to the model, but the contract did not state a sufficiently explicit shared positive-support eligibility boundary. The model could infer abnormality from remembered cutoffs. R5 removed invalid supporting IDs, yet surviving free-text rationale could continue depending on the removed UNKNOWN premises. An unrelated eligible finding could leave that rationale attached to an accepted candidate. Candidate rejection also did not independently validate diagnostic cluster titles and pattern prose; the frontend rendered those channels even when the candidate list was empty. R4's item-level pruning itself was not the defect.

2. **Exact files changed for R5.1**

   This inventory distinguishes this phase from the substantial pre-existing uncommitted R4/R5 tree. It includes files already untracked before R5.1 when this phase edited them.

   ```text
   .env (ignored; AI_MAX_NEW_TOKENS only)
   .env.example
   README.md
   docker-compose.yml
   start-clinora-local.ps1
   ai-service/README.md
   ai-service/app/clinical_evidence.py
   ai-service/app/model_runtime.py
   ai-service/app/prompts/patient_lab_report_v5.py
   ai-service/app/schemas/report_analysis.py
   ai-service/app/services/clinical_cluster_grounding.py
   ai-service/app/services/report_analysis_service.py
   ai-service/tests/test_model_runtime.py
   ai-service/tests/test_patient_lab_report_v51.py
   ai-service/tests/test_support_eligibility.py
   ai-service/tests/v51_cases.py
   ai-service/tests/runtime_acceptance_v51.py
   ai-service/tests/runtime_acceptance_v51_service.py
   backend/src/main/java/com/clinora/ai/client/MedGemmaClient.java
   backend/src/main/java/com/clinora/ai/service/PatientReportAiAnalysisService.java
   backend/src/test/java/com/clinora/ai/service/PatientReportAiAnalysisServiceTest.java
   frontend/src/features/patient-reports/patient-report-ai-types.ts
   frontend/src/features/patient-reports/patient-report-clinical-clusters.tsx
   frontend/src/features/patient-reports/patient-report-observation-presentation.ts
   frontend/src/pages/patient/patient-report-ai-insight-page.test.tsx
   docs/validation/phase10p-r51-runtime.json
   docs/validation/phase10p-r51-runtime-attempt-1.json
   docs/validation/phase10p-r51-runtime-attempt-2.json
   docs/validation/phase10p-r51-runtime-attempt-3.json
   docs/validation/phase10p-r51-runtime-attempt-4.json
   docs/validation/phase10p-r51-runtime-attempt-5.json
   docs/validation/phase10p-r51-frontend-tests.json
   docs/validation/phase10p-r51-report.md
   ```

   The runtime driver also writes an ignored synthetic manifest at `backend/target/r51-runtime-inputs.json`; test/build outputs remain in their normal ignored directories. Existing backup folders, old prompts, `clinical_ranges.py`, requirements changes, CI changes, and unrelated frontend changes were not reset or normalized.

3. **Shared supportEligibility**

   `clinical_evidence.support_eligibility()` maps Clinora's existing deterministic evidence classification to `VERIFIED_ABNORMAL`, `VERIFIED_QUALITATIVE_POSITIVE`, `VERIFIED_NORMAL`, `VERIFIED_QUALITATIVE_NEGATIVE`, `CONTEXT_ONLY`, or `UNKNOWN`. Only the first two qualify as positive support. Prompt payloads, grounding, candidate support calculation, final validation, public metadata, and diagnostic counts use this implementation. No population ranges, disease associations, diagnostic scores, or abnormal-count thresholds were added. The compatibility `supportLevel` remains the cautious `LIMITED` label for eligible support.

4. **UNKNOWN remains available as CONTEXT**

   The model receives the complete verified observation list, exact values, labels, supplied reference information, authoritative states, and eligibility. The prompt expressly prohibits substituting remembered cutoffs. UNKNOWN observations incorrectly marked SUPPORTS or CONTRADICTS become CONTEXT. Existing IDs explicitly mentioned by label in raw reasoning can be recovered as context if omitted from the evidence array; this recovery cannot create support. Context cards remain visible. No missing reference interval is manufactured.

5. **Preventing UNKNOWN factual abnormality**

   Evidence relevance is checked against its observation ID; prose claims are associated with verified labels and label-derived abbreviations. Detected direction, qualitative, numeric, and unit mismatches are pruned locally. UNKNOWN premises cannot establish a directional or diagnostic conclusion; explicit unavailable-classification statements can survive. Optional structured claims additionally declare observation IDs and states, which must match Clinora's facts. Undeclared named premises are rejected. This closes the tested failures, but free-text semantic coverage is incomplete; it is not an architectural proof that every possible wording is safe.

6. **Candidate support reevaluation**

   Candidate supporting IDs must remain eligible SUPPORTS inside that candidate's cluster. Unknown IDs are pruned individually. After an UNKNOWN premise is removed, surviving free-text rationale must explicitly depend on remaining eligible support rather than on that UNKNOWN observation. Optional structured rationale claims are reevaluated independently. A candidate requires a surviving name, rationale, eligible support, usable missing-information text, and alternatives. No surviving candidate is invented to satisfy the UI. A useful cluster can remain pattern-only. This validates explicit factual dependencies; it does not establish that one particular abnormality medically justifies a specific disease.

7. **Disease leakage through titles**

   Public `displayTitle` and legacy `title` are both built from at most three verified labels plus a neutral `pattern` suffix. The raw model title cannot be displayed by an older consumer as an unvalidated disease heading. The UI uses `displayTitle` with legacy `title` fallback for older stored responses. Production code contains no disease-to-test title mapping. Old persisted analyses are not retrospectively regrounded.

8. **Disease leakage through pattern interpretation**

   Candidate names, their declared parenthetical abbreviations, and generic hypothesis-language cues are removed from noncandidate channels. Unsafe UNKNOWN-dependent interpretation is removed while independent valid clauses survive. Overall interpretation is assembled from grounded cluster interpretations, so raw overall prose cannot resurrect a removed premise. Candidate rationale is not copied into a pattern-only explanation as a fallback. The exact anemia/thrombocytopenia/MDS regression passes. **This boundary is not fully closed for arbitrary free prose:** latest Report B retained disease-associated prose outside its candidate channel. No comprehensive disease blacklist or additional full diagnostic inference was introduced.

9. **Preserving valid MedGemma reasoning**

   Correct LOW/HIGH analyte explanations, physiological relationships, evidence relevance, candidate rationale, alternatives, and missing-context questions survive when grounding succeeds. Sentence-level pruning preserves independent reasoning rather than replacing every analyte mention. The live generation contract uses the concise v5 interpretation/rationale strings and ID-linked evidence. Optional premise-bound claim arrays are accepted and validated internally, but are not required in live generation: requiring duplicate structured claims caused repetition and truncation in runtime experiments. Where all useful model reasoning is rejected, a scoped explanation of unavailable reference information remains; latest Report A demonstrates that this can still become too generic.

10. **R4 behavior preserved**

   Valid support plus an unknown ID prunes the ID and can retain the candidate. Valid support plus incorrectly supporting UNKNOWN/normal context reclassifies that item and reevaluates the candidate. Unknown-only support cannot retain a candidate. A wrong factual clause does not erase unrelated valid reasoning. The legacy R4 path remains, and all 17 focused R4 regressions passed without changing the known legacy failures.

11. **R5 multi-cluster contract preserved**

   Prompt version remains `patient-lab-report-v5`; schema version remains `1.1`. `clinicalClusters` remains the primary patient contract with interpretation, evidence, and candidates. Each candidate owns rationale, supporting/contradictory IDs, missing information, and alternatives. Limits remain three clusters and two candidates per cluster; equivalent repeated groups can merge without collapsing independent groups. The legacy `clinicalPatterns` projection remains additive, capped at its existing five entries. Optional `displayTitle` and evidence `supportEligibility` fields are carried by Pydantic, Java DTO serialization, and TypeScript. Java compatibility constructors preserve old call sites. Generic JSON persistence requires no migration. Deterministic independent-cluster and multiple-candidate tests pass; actual model grouping quality remains inconsistent.

12. **Disease-specific assay evidence**

   Verified POSITIVE/REACTIVE/DETECTED qualitative results remain first-class support through the same eligibility function as LOW/HIGH numeric results. The focused assay-plus-UNKNOWN-context test passes with a surviving grounded candidate. Earlier archived real runs also retained assay-based candidates. However, the latest Report A did not retain that reasoning, so live assay acceptance is not established. Report titles are still excluded from the reasoning payload; actual assay labels remain intact. Disease names occur in acceptance fixtures, not production prediction rules.

13. **Focused AI tests**

   Validation was run in the requested sequence, with focused checks repeated after relevant edits. Final results:

   | Check | Result |
   | --- | --- |
   | Syntax, compile/import, schema construction | Passed |
   | Focused R5.1 tests | 25 passed |
   | Exact 18-observation regression, separately | 1 passed |
   | R4 regression files | 17 passed |
   | R5 and model-runtime tests | 40 passed |
   | Shared eligibility and clinical-range tests | 11 passed |

   Coverage includes independent clusters/candidates, pattern-only output, UNKNOWN support pruning, neutral support, unknown IDs, local factual contradiction removal, valid analyte reasoning, candidate leakage and declared abbreviations, assay evidence, title-only disease suggestions, incomplete candidate context, mostly normal output, existing safety restrictions, and fail-closed truncation. The exact fixture contains PDW HIGH and 17 UNKNOWN observations; all remain available as context without forcing a candidate.

14. **Full AI suite**

   **143 passed, 7 failed, 150 total.** The seven failures reproduce the documented local legacy baseline in untouched `tests/test_report_analysis_service.py`:

   ```text
   test_allows_no_clear_pattern_without_forcing_conditions
   test_grounded_id_linked_finding_uses_verified_status
   test_preserves_fact_free_pattern_level_reasoning_when_no_condition_is_named
   test_rejects_malformed_json_with_specific_diagnostic
   test_repair_is_bounded_to_one_retry
   test_replaces_wrong_direction_in_model_finding_with_verified_fact
   test_reports_schema_type_error_without_logging_model_values
   ```

   They were not weakened or silently counted as passing. The R5.1 prompt's seven-failure baseline was used; the earlier R5 request's historical nine-failure description does not describe the reproduced current baseline.

15. **Backend validation**

   Affected `PatientReportAiAnalysisServiceTest`: **24 passed, zero failures/errors/skips**, confirmed in the Surefire XML. The added roundtrip test verifies neutral display titles and UNKNOWN context eligibility survive serialization. Actual runtime jobs also traversed authenticated backend APIs, RabbitMQ, AI service, and persisted result JSON. This is not a claim that the complete unrelated backend suite was rerun.

16. **Frontend validation**

   Targeted patient insight tests: **21 passed**. Full frontend: **162 passed, 2 failed, 164 total**, recorded in `phase10p-r51-frontend-tests.json`. Both failures are the pre-existing Patient Home locale assertions: localized September/August strings differ from expected English month abbreviations. Typecheck passed. Lint passed with zero errors and six pre-existing warnings.

   The added 18-observation test checks neutral display title selection, one verified abnormality, 17 visible UNKNOWN context cards with `Range status unavailable`, exact values/reference rendering, no forced candidate, and the verified summary. The existing dark layout, interpretation-first hierarchy, candidate sections, context/support distinction, and processing stages without fake percentages remain. No interactive browser or screenshot QA was completed for this phase.

17. **Whitespace validation**

   Final `git diff --check` passed (exit 0). Git emitted line-ending notices for existing working-tree files, with no whitespace errors. A separate check of 19 untracked phase files also passed because ordinary git diff does not include them.

18. **Runtime Report A: infectious assay case**

   Latest new persisted job: `d1b6c811-2fbc-4352-ae4e-dd99b5493d02`. Backend SUCCEEDED, 44.53 seconds. Raw clusters/candidates: **3/2**; accepted: **2/0**. Two support items were reclassified, one UNKNOWN support occurrence pruned, four reasoning fields/claims pruned. UNKNOWN context remained visible, but accepted interpretation omitted the legitimate positive-assay reasoning and became mostly reference-context prose. **Clinical acceptance not passed.** Earlier successful assay candidates are preserved in archived attempts, not substituted for this latest result.

19. **Runtime Report B: verified multisystem case**

   Latest new persisted job: `68b12ef2-f633-4587-aaa2-b7eca0ae3386`. Backend SUCCEEDED, 61.06 seconds. Raw clusters/candidates: **2/4**; accepted: **2/2**. Accepted candidates were Diabetes Mellitus and Kidney Disease. No support was reclassified; four reasoning fields/claims were pruned. Multiple candidates remain operational, but the model combined unrelated evidence, failed to retain the independent thyroid process, and retained overly specific renal reasoning and disease-associated pattern prose. **Clinical acceptance not passed.** Clinora must not invent a missing thyroid cluster to make this test appear successful.

20. **Runtime Report C: PDW plus 17 UNKNOWN results**

   Latest new persisted job: `db7d07dd-344f-44e6-bd7c-9eac204ce04f`. Backend FAILED with `AI_RESPONSE_REJECTED`; AI reason `OUTPUT_TRUNCATED`, finish reason `length`, 3,072 output tokens, 181.66 seconds, one generation. Raw JSON was not parseable, so raw cluster/candidate counts and downstream pruning counts are unavailable. No final clinical clusters or patient interpretation were produced. Truncation correctly failed closed. **Clinical acceptance not passed**, despite the exact deterministic 18-observation regression passing.

21. **Runtime Report D: mostly normal case**

   Latest new persisted job: `7e537355-4361-40e5-9847-311a6d0411ae`. Backend SUCCEEDED, 51.55 seconds. Raw clusters/candidates: **3/0**; accepted: **0/0**. Twelve normal support occurrences were reclassified across repeated raw groups. Final interpretation: "The verified observations do not show a clear abnormal pattern. Clinical context may still matter when discussing this report with a clinician." **This case passed: no forced disease.**

22. **Remaining limitations and review status**

   The current free-text validator cannot prove medical coherence, detect every implicit diagnosis, or guarantee that a medically specific candidate is justified merely because its cited facts are real. Report B is direct evidence of this limitation. Optional premise-bound claims strengthen explicit factual checks but are not mandatory in the live generation contract. Missing-context/alternative completeness checks may discard otherwise useful candidates; their effect is visible in Report A. Group overlap and omitted processes remain model quality problems. Context fallback can still dilute meaningful reasoning.

   The local model and llama.cpp were preserved. The output budget increased from 2,048 to 3,072 and the documented/local model context from 4,096 to 8,192 after measuring the larger verified payload. This did not resolve Report C's repetition/truncation. Neither truncated JSON nor a failed job is treated as an empty successful analysis. No second full clinical inference was added.

   Runtime captures contain synthetic cases only. The opt-in capture service limits full output capture to the exact synthetic observation ID sets; normal application diagnostics remain aggregate counts. Counter values count field/reference occurrences and should not be interpreted as a precise count of distinct medical assertions. Full captures include raw model output, accepted clusters, final patient interpretation, pruning diagnostics where available, new job IDs, and persisted results. `phase10p-r51-runtime.json` is the latest run; attempts 1-5 preserve unsuccessful iterations. The tests seed confirmed observations and exercise analysis, not real PDF upload/OCR or manual confirmation UI.

   Existing saved analyses are not retroactively regrounded or invalidated by a new version fingerprint; all acceptance jobs used newly seeded reports to avoid cached results. Synthetic records remain locally. No governing documents were edited. No clinical release or publication was performed. **The reviewable implementation is partial against the runtime definition of done and is stopped for owner review; it must not be described as accepted R5.1.**
