> Publication cleanup (2026-09-09): Generated JSON captures, temporary logs, and patch/backup artifacts referenced below were removed from the publication snapshot. This report preserves the historical validation results and limitations; the documented reusable acceptance harnesses remain. Statements about local-only work describe the original validation session.

Clinora AI Phase 10P-R5 implementation and validation report

Implementation is present locally. Clinical runtime acceptance has NOT passed. The current local quantized model produces separate clusters, but its clinical labels and conclusions remain inconsistent. No commit, push, merge, reset, clean, publication, deployment, or database migration was performed. Existing app processes were not restarted.

1. **Exact files changed for R5**

   This inventory distinguishes R5 work from the pre-existing uncommitted R4 work. Existing backup directories and patch bundles were left untouched. The governing DOCX files were read only.

   ```text
   .env (ignored local file: only AI_PROMPT_VERSION, AI_SCHEMA_VERSION, AI_MAX_NEW_TOKENS settings)
   .env.example
   .github/workflows/ci.yml
   README.md
   docker-compose.yml
   start-clinora-local.ps1
   ai-service/README.md
   ai-service/requirements-test.txt
   ai-service/app/clinical_evidence.py
   ai-service/app/model_runtime.py
   ai-service/app/prompts/patient_lab_report_v4.py
   ai-service/app/prompts/patient_lab_report_v5.py
   ai-service/app/schemas/report_analysis.py
   ai-service/app/services/clinical_cluster_grounding.py
   ai-service/app/services/report_analysis_service.py
   ai-service/tests/runtime_acceptance_v5.py
   ai-service/tests/test_model_runtime.py
   ai-service/tests/test_patient_lab_report_v5.py
   ai-service/tests/test_report_analysis_service_v2.py
   ai-service/tests/test_report_analysis_service_v4.py
   ai-service/tests/v5_cases.py
   backend/src/main/java/com/clinora/ai/client/MedGemmaClient.java
   backend/src/main/java/com/clinora/ai/service/PatientReportAiAnalysisService.java
   backend/src/main/resources/application.yml
   backend/src/test/java/com/clinora/ai/service/PatientReportAiAnalysisServiceTest.java
   frontend/src/features/patient-reports/patient-report-ai-panel.tsx
   frontend/src/features/patient-reports/patient-report-ai-types.ts
   frontend/src/features/patient-reports/patient-report-clinical-clusters.tsx
   frontend/src/features/patient-reports/patient-report-observation-presentation.ts
   frontend/src/features/patient-reports/patient-report-range-state.ts
   frontend/src/features/patient-reports/patient-report-range-state.test.ts
   frontend/src/pages/patient/patient-report-ai-insight-page.tsx
   frontend/src/pages/patient/patient-report-ai-insight-page.test.tsx
   docs/validation/phase10p-r5-runtime.json
   docs/validation/phase10p-r5-frontend-tests.json
   docs/validation/phase10p-r5-report.md
   ```

   Pre-existing changes such as `ai-service/requirements.txt`, the environment bootstrap, `clinical_ranges.py`, older prompt/test files, and the dark theme CSS remain in the working tree; they were not introduced by this phase. Existing R4 range parsing and startup/runtime boundaries were retained.

2. **v5 model contract**

   Prompt version is `patient-lab-report-v5`. Raw generation returns `clusters` and `overallInterpretation`. Each cluster has `title`, `interpretation`, `evidence`, `candidates`, `missingEvidence`, and `alternatives`. Evidence contains an exact `observationId`, a `SUPPORTS`, `CONTRADICTS`, or `CONTEXT` role, and `clinicalRelevance`. A candidate contains `name`, `rationale`, supporting/contradictory observation IDs, missing evidence, and alternatives.

   Limits are three clusters and two candidates per cluster. The llama.cpp generation schema now matches this contract instead of constraining v4 reasoning to the older `clinicalPatterns` response. Candidate missing-context and alternative fields are required in generation. UUID enums constrain the model to supplied observation IDs, and final grounding independently verifies references.

3. **How clusters are created**

   MedGemma receives the complete confirmed observation list, including normal, qualitative, and unclassified findings, with authoritative range states and evidence classes. The disease-generic prompt instructs it to group related observations, assess coherence, choose condition/process/pattern specificity, then explain evidence relevance, contradictions, missing information, and alternatives. Generation orders group identification and evidence explanation before candidate naming. Clinora does not create disease associations or regroup unrelated findings deterministically.

4. **How multiple conditions are represented**

   Candidates belong to their own clusters. Supporting IDs must exist in that cluster's supporting evidence. Candidate-specific contradictions can reference local verified context without stealing evidence from another group. Up to six candidates can appear in the full cluster structure. Pattern-only clusters survive with an empty candidate list. Duplicate candidate names are removed. Shared evidence eligibility does not turn a count of abnormalities into diagnostic strength; the legacy compatibility support label remains `LIMITED`.

5. **How model reasoning is preserved**

   v5 bypasses the legacy patient-summary reconstruction pass. Safe model interpretations, rationales, relevance, alternatives, and missing-context text are retained. Accurate analyte names and directional statements, such as reduced TSH when Clinora owns a LOW result, survive. If synthesis is unavailable, surviving model cluster interpretations can supply it. Exact laboratory cards are rendered from verified observations, independently of model prose.

6. **How factual hallucinations are removed**

   Grounding checks references and factual clauses against supplied observations. It removes detected wrong range directions, unsupported qualitative assertions, mismatched numeric values/units, internal IDs in prose, report-title reasoning, and unsupported patient-history assertions. It removes a bad clause while retaining independent safe text. If a candidate has no valid support or safe rationale left, it is removed; a meaningful cluster can remain pattern-only. This is conservative lexical grounding, not a complete semantic proof of factual or medical correctness.

7. **How R4 evidence pruning was preserved**

   Unknown IDs are pruned individually. Neutral/unclassified positive support is removed from candidate support and can remain as context. Remaining abnormal or verified-positive support is reevaluated instead of deleting the whole candidate. R4's compact-output compatibility path remains. R4 and v5 prompting/validation now share factual evidence classification through `clinical_evidence.py`, including qualitative facts that coexist with numeric range classification. Existing pruning regression tests remain passing. Historical v2/v4 service tests only had prompt-version expectations updated for the live v5 service.

8. **How report-title leakage is prevented**

   The report title/type is excluded from model reasoning input and replaced by generic organizational context. The original verified test labels remain intact. Repair prompts use the same neutral input. Explicit title-based reasoning is pruned, and candidates cannot survive on a title without grounded observation support. No disease-specific production rules or prompt examples were added.

9. **Schema and backend changes**

   Schema `1.1` adds `clinicalClusters` and `overallInterpretation`; public candidates also carry the cautious compatibility `supportLevel`. Historical `1.0` responses remain readable. Existing `clinicalPatterns` remains a flattened compatibility projection with its existing five-item limit; the complete cluster array retains up to six candidates. Java records, serialization, status validation, evidence scope checks, and safety scans include the new fields. Pattern-only clusters can use `POSSIBLE_CLINICAL_PATTERN` without a legacy condition candidate. Stored result JSON is generic, so no migration was needed. Prompt/schema settings and backend job provenance defaults now agree.

10. **Frontend changes**

   The dark Clinora theme is retained. Clinical interpretation and cluster cards precede the verified summary. Each candidate has possible-condition framing, clinical rationale, exact verified evidence cards, contradictions when supplied, missing context, and alternatives. Pattern-only and no-clear-pattern outputs are supported. Old saved v1.0 results still show legacy conditions even when backend deserialization supplies an empty cluster list. The raw summary retains exact values, references, counts, and authoritative status helpers. Scientific-unit ranges and H/L flags have regression coverage. Patient-visible model branding was removed; text encoding defects in touched UI text were corrected. Processing has the four conceptual stages without fabricated percentages or timed completion claims.

11. **Focused AI results**

   `python -m pytest tests/test_patient_lab_report_v5.py tests/test_model_runtime.py -q -p no:cacheprovider`: **40 passed**. This includes 33 v5 cases/parameterizations plus seven runtime-adapter tests. A broader focused run including R4 prompt/service/pruning regressions passed **57 tests**. Coverage includes the twelve requested behaviors, candidate-local contradictions, six candidates across three groups, duplicates, numeric/qualitative coexistence, wrong numeric facts and units, invented history, safety rejection, and bounded JSON repair. `compileall` passed. Pytest is now a test dependency and AI CI explicitly runs the focused v5 checks followed by the full suite.

12. **Full AI results and independently reproduced baseline**

   Before R5 changes, the local suite produced **77 passed, nine failed**. The final full run produced **112 passed, seven failed**. The untouched `test_report_analysis_service.py` still fails these previously reproduced tests:

   ```text
   test_allows_no_clear_pattern_without_forcing_conditions
   test_grounded_id_linked_finding_uses_verified_status
   test_preserves_fact_free_pattern_level_reasoning_when_no_condition_is_named
   test_rejects_malformed_json_with_specific_diagnostic
   test_repair_is_bounded_to_one_retry
   test_replaces_wrong_direction_in_model_finding_with_verified_fact
   test_reports_schema_type_error_without_logging_model_values
   ```

   The two original truncation failures (`test_does_not_repair_truncated_output` and `test_rejects_token_limit_truncation_before_parsing`) now pass because R5 rejects `finish_reason=length` before accepting or repairing output. The seven unrelated legacy expectations were not rewritten to make the suite green.

13. **Backend results**

   `mvn.cmd -q -Dtest=PatientReportAiAnalysisServiceTest test`: **23 tests passed**, Java 21, zero failures/errors/skips. Coverage includes additive serialization, historical responses, independent clusters, pattern-only output, evidence isolation, limits, and safety checks across new text fields. Maven initially could not resolve dependencies inside the sandbox; the authorized retry with dependency-cache/network access succeeded. The complete unrelated backend suite was not run.

14. **Frontend results**

   Targeted insight/range tests: **20 passed**, including accessibility checks. Typecheck: **passed**. Lint: **zero errors**, six existing React Fast Refresh warnings in untouched access-application files. Full frontend suite: **161 passed, two failed** (163 tests). The two failures also reproduce independently in `patient-home-refinement.test.tsx`: they expect English `Sep`/`Aug`, while this machine renders Italian `set`/`ago`. Those unrelated tests were left unchanged. Vitest used `--configLoader native` because the default bundler could not traverse a parent directory under the Windows sandbox. The saved full test report is `phase10p-r5-frontend-tests.json`.

15. **Diff validation and repository state**

   `git diff --check`: **passed**, exit 0. Git reported only normal LF-to-CRLF conversion warnings. Existing local changes, backups, patch bundles, and source DOCX files remain. No commit, push, merge, reset, clean, publication, or migration occurred.

16. **Runtime acceptance and remaining limitations**

   Real synthetic A/B/C requests ran through the current FastAPI route in-process and the actual local MedGemma llama.cpp server on loopback, using a 4096-token model context and a 2048-token output budget. No mocked model output, patient records, patient-identifying information, or patient persistence was used. Final counts and complete synthetic `clinicalClusters` and patient interpretations are in `phase10p-r5-runtime.json`.

   | Report | Raw clusters | Raw candidates | Accepted clusters | Accepted candidates | Evidence-reference occurrences pruned/reclassified |
   | --- | ---: | ---: | ---: | ---: | ---: |
   | A: infectious/hematology | 1 | 1 | 1 | 1 | 0 |
   | B: metabolic + thyroid | 3 | 3 | 3 | 3 | 0 |
   | C: mostly normal | 1 | 0 | 0 | 0 | 4 |

   A retained a possible viral process grounded in the verified positive assay. B retained separate thyroid, glycemic, and renal groups. C's four normal support entries were reclassified and its ungrounded abnormal cluster removed; no condition was forced.

   **Clinical acceptance is NOT passed.** In the final B run the model's cluster title is `Hypothyroidism`, while its candidate and explanation are `Hyperthyroidism`. Earlier real runs also supplied incorrect thyroid candidate reasoning, and renal specificity remains questionable. This inconsistency is retained in the capture instead of hidden by a disease-specific deterministic rewrite. The synthetic acceptance checker checks the title as well as candidate names and records the failure. Structural success is not clinical correctness, and the model output still requires clinical evaluation before approval for patient use.

   Additional limitations: deterministic wording checks cannot validate all medical relationships or every possible paraphrase; the small quantized model does not consistently follow pattern-title/specificity instructions; large confirmed reports can exceed the local context/output budget and fail safely; full test suites are not entirely green due to the documented baseline failures; browser discovery returned no available browser, so visual inspection and a fresh persisted browser/backend/FastAPI end-to-end workflow were not completed. Local nonsecret `.env` settings were updated, but existing running processes were not restarted or redeployed. The five-item legacy projection cannot show a sixth candidate that remains available in `clinicalClusters`.

Work is stopped for the project owner's approval, with the clinical runtime failure explicitly unresolved.
