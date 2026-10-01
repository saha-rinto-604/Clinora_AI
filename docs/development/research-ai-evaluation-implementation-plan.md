# Clinora AI — Research AI Model Evaluation Implementation Plan

## Purpose

The Research AI Model Evaluation workspace benchmarks a specific research model/model version against an approved, de-identified, immutable Research DatasetVersion with an explicit ground-truth definition.

It is not Patient AI Insight, not autonomous diagnosis, and not a production deployment console.

Canonical flow:

Approved Research Project
→ Approved Dataset Request
→ Generated De-identified Dataset
→ Immutable Dataset Version
→ Authorized Researcher
→ Evaluation Run
→ Metrics + provenance
→ Team review / Research Notes
→ Publication / research output

Research evaluation must never automatically promote, replace, or overwrite Clinora's production clinical AI.

## Binding Safety Rules

1. RESEARCHER role alone never grants identifiable Patient data.
2. Only approved/de-identified Research DatasetVersions may be evaluated.
3. OTHER-subject reports remain excluded from the logged-in Patient's research data.
4. Raw/unverified OCR values must not become ground truth.
5. Project membership does not automatically grant DatasetAccessGrant.
6. Evaluation results cannot overwrite production AI.
7. Ground truth must be explicit and authoritative for the task.
8. Do not introduce fake models, fake datasets, fake runs, fake metrics, or fake chart points.

## Recommended V1 Task Types

### EXTRACTION
Evaluate extracted structured values against verified reference values.

Recommended metrics depend on output type:
- exact match
- field-level precision/recall/F1 where appropriate
- numeric absolute error
- tolerance match

Do not force classification metrics onto numeric extraction tasks.

### CLASSIFICATION
For validated class labels.

Metrics:
- Accuracy
- Precision
- Recall
- F1
- Balanced Accuracy
- Confusion Matrix
- FPR
- FNR

### ABNORMALITY_DETECTION
For verified normal/abnormal labels. Use binary classification metrics.

### RISK_SCORING
Do not expose as complete unless authoritative outcomes, continuous scores, and correct score-based metrics exist.

## ROC-AUC Rule

Never label `(recall + specificity) / 2` as ROC-AUC. That is Balanced Accuracy at a fixed threshold.

Only show ROC-AUC when continuous prediction scores/probabilities exist and a real ROC curve is evaluated across thresholds.

Current fixed-label UI should show:
- Accuracy
- Precision
- Recall
- F1
- Balanced Accuracy
- Confusion Matrix
- FPR
- FNR

## Branding

Research/product-facing copy should say `Clinora AI`, not `MedGemma`.

Technical model provenance may still store the actual internal model identifier/version for reproducibility.

Recommended empty state:

> Benchmark Clinora AI model versions or approved research models against authorized de-identified dataset versions.

## Evaluation Run Model

Use the existing AIEvaluationRun if already present. Required conceptual fields:

- id UUID
- projectId UUID
- datasetVersionId UUID
- name
- modelId
- modelVersion
- promptVersion nullable
- taskType
- groundTruthDefinition
- status
- configuration JSONB
- metrics JSONB
- startedAt nullable
- completedAt nullable
- failureReason nullable
- createdBy UUID
- createdAt

Recommended provenance additions where available:
- evaluationEngineVersion
- datasetChecksum
- model/configuration hash

## Lifecycle

Use current enum where compatible:

QUEUED → RUNNING → COMPLETED
                  ↘ FAILED
QUEUED/RUNNING → CANCELLED

Completed runs should be immutable except for separate research annotations/notes.

## Authorization Before Starting a Run

Backend must verify:

1. authenticated user has global RESEARCHER role
2. account is active
3. project exists
4. project is APPROVED or ACTIVE
5. project permission allows creating evaluation
6. DatasetVersion belongs to same project
7. dataset is READY
8. dataset is not revoked
9. dataset is not expired
10. user has canonical dataset authorization / DatasetAccessGrant
11. task is supported
12. ground truth exists
13. model/version is allowed for Research evaluation

Project membership must never bypass DatasetAccessGrant.

## Project Role Permissions

OWNER:
- create/cancel permitted runs
- view all project runs
- compare results
- link runs to notes/publications

CO_RESEARCHER:
- create runs when dataset authorization exists
- view permitted runs
- compare results
- contribute Research Notes

SUPERVISOR:
- view configuration/results
- review through notes/comments
- no production deployment authority

VIEWER:
- read-only finalized permitted summaries
- no run creation/cancellation

## Efficient UI Flow

Add `+ New Evaluation` and use a guided form:

### Step 1 — Dataset Version
Show only READY, non-expired, non-revoked versions from the current project that the user may access.

Display dataset name, version, generated date, record count, variables, and checksum/provenance summary.

### Step 2 — Task
Only show task types actually supported by backend/data.

### Step 3 — Model
Use real model registry/configuration data. Never hardcode fake model cards.

Show Clinora-facing label plus technical model ID/version where needed.

### Step 4 — Ground Truth
Require explicit authoritative source, e.g. doctor-verified label, patient-confirmed structured value, or validated reference annotation.

Explain: `Ground truth defines what this evaluation considers correct.`

### Step 5 — Review & Start
Show project, dataset/version, model/version, task, ground truth, eligible sample count, and configuration.

Then `Start Evaluation`.

## Execution Architecture

Do not run long evaluations synchronously in the browser request.

Preferred flow:

Frontend
→ POST evaluation
→ backend authorization/validation
→ create AIEvaluationRun = QUEUED
→ RabbitMQ job
→ evaluation worker
→ RUNNING
→ model adapter executes
→ metrics calculator
→ persist metrics/provenance
→ COMPLETED / FAILED

Reuse existing RabbitMQ infrastructure. Do not add another queue technology.

## Model Adapter Boundary

Do not hard-wire evaluation logic to one model.

Use a conceptual adapter such as `ResearchEvaluationModelAdapter` to:
- resolve approved model/version
- execute supported task
- return structured predictions
- expose model provenance

Do not introduce Gemini APIs.

## Ground Truth / Sample Contract

Prefer evaluation from the immutable generated Research DatasetVersion instead of directly querying Patient clinical tables.

Conceptual `EvaluationSample`:
- sampleId: project-scoped/de-identified
- approved features
- groundTruth
- approved de-identified metadata only

The worker must never load identifiable Patient fields merely because they exist in PostgreSQL.

## Metrics Engine

Use task-specific calculators instead of one generic metric function:

- ClassificationMetricsCalculator
- ExtractionMetricsCalculator
- AbnormalityDetectionMetricsCalculator

Handle zero denominators explicitly. Never fabricate missing predictions.

## Result Workspace

Completed run view should contain:

Header:
- evaluation name
- status
- model/version
- dataset/version
- task
- started/completed time

Metrics:
- real backend metrics only
- exact confusion matrix values where relevant

Provenance:
- DatasetVersion
- dataset checksum
- model ID/version
- prompt/config version
- ground truth definition
- evaluation configuration
- engine version where available
- created by
- timestamps

Governance copy:

> Research evaluation results are experimental research artifacts and cannot automatically promote or replace Clinora's production clinical AI.

## Compare Runs

After single-run correctness is proven, allow comparing 2–5 COMPLETED runs.

Do not compare incompatible tasks as equivalent. If dataset versions differ, surface that prominently.

Suggested table columns:
- Run
- Model
- Dataset Version
- Task
- Accuracy
- Precision
- Recall
- F1
- Balanced Accuracy

Charts may use only real returned metric values.

## Collaboration Integration

Integrate AI Evaluation with the project Collaboration Workspace:

Evaluation Run
→ create/link Research Note
→ team discusses results via note comments
→ Supervisor reviews interpretation
→ publication may reference the run

Do not add generic chat dependency to AI Evaluation.

## Publication Integration

Publication metadata may reference project ID, DatasetVersion IDs, and AIEvaluationRun IDs.

Project membership must not automatically become publication authorship.

## Audit Events

Record at minimum:
- AI_EVALUATION_CREATED
- AI_EVALUATION_QUEUED
- AI_EVALUATION_STARTED
- AI_EVALUATION_COMPLETED
- AI_EVALUATION_FAILED
- AI_EVALUATION_CANCELLED

Audit metadata may include actor ID, project ID, run ID, datasetVersion ID, model/version, task, and timestamp.

Never log raw Patient identifiers, dataset contents, secrets, tokens, or model credentials.

## API Plan

Adapt to current conventions. Conceptually:

- POST /api/v1/research/projects/{projectId}/evaluations
- GET  /api/v1/research/projects/{projectId}/evaluations
- GET  /api/v1/research/projects/{projectId}/evaluations/{runId}
- POST /api/v1/research/projects/{projectId}/evaluations/{runId}/cancel

Recommended addition:

- GET /api/v1/research/projects/{projectId}/evaluations/options

The options endpoint should return only real authorized dataset versions, supported task types, approved research model versions, and supported ground-truth definitions.

Optional later:
- POST /api/v1/research/projects/{projectId}/evaluations/compare

No production deployment endpoint should exist under Research controllers.

## UX States

Required:
- loading skeleton
- empty state
- no-authorized-dataset state
- error + Retry
- explicit 403 permission state
- QUEUED / RUNNING / COMPLETED / FAILED / CANCELLED states

Do not disguise authorization failures as empty states.

## Backend Rejection Rules

Reject:
- project not APPROVED/ACTIVE
- dataset from another project
- dataset not READY
- expired/revoked dataset
- missing DatasetAccessGrant where required
- unsupported task
- missing ground truth
- unknown/fake model version
- illegal restart of completed/cancelled run
- VIEWER mutation
- unauthorized SUPERVISOR mutation
- any attempt to deploy/promote production model from Research

## Implementation Phases

E0 Current-code audit:
Inspect AIEvaluationRun, task/status enums, repository, service, controller, API models, frontend section, research API/types, DatasetVersion, DatasetAccessGrant, project authorization, RabbitMQ, current AI integration, and audit infrastructure. Do not edit before audit.

E1 UI/terminology:
- Clinora AI branding
- Balanced Accuracy wording
- New Evaluation CTA
- correct empty/no-dataset states

E2 Authorization/options:
- centralize permission checks
- expose authorized options only
- enforce DatasetAccessGrant

E3 Reproducible run creation:
- validate dataset/model/ground truth
- persist configuration/provenance
- queue run

E4 Evaluation worker:
- read immutable DatasetVersion
- execute through model adapter
- task-specific metrics
- persist result

E5 Result workspace:
- metrics
- confusion matrix
- provenance
- failure details

E6 Run comparison:
- compatible-run selection
- exact real metrics only

E7 Collaboration integration:
- link Research Notes to evaluation runs
- team review/comments

E8 Audit and validation:
- focused tests
- full backend/frontend validation
- git diff --check

## Tests

Backend must prove at minimum:
1. owner can create authorized evaluation
2. permitted co-researcher can create one
3. viewer cannot create one
4. cross-project researcher cannot access run
5. DatasetVersion must belong to project
6. dataset must be READY
7. revoked dataset rejected
8. expired dataset rejected
9. DatasetAccessGrant enforced
10. ground truth required
11. unsupported task rejected
12. model/version validated
13. Balanced Accuracy calculation correct
14. zero-denominator cases handled
15. completed run persists provenance
16. cancellation rules enforced
17. Research cannot promote production model
18. no identifiable Patient fields leak
19. audit event emitted

Frontend tests:
- loading
- empty
- error
- 403
- no-dataset
- new evaluation flow
- selectors
- review step
- statuses
- metrics
- confusion matrix
- provenance
- comparison
- role restrictions

## Validation

Before code changes:

    git status
    git branch --show-current
    git rev-parse HEAD
    git log -1 --oneline

Backend:

    mvn test -Dtest=<focused AI evaluation tests>
    mvn test

Frontend:

    npm run typecheck
    npm run lint
    npm test -- --run
    npm run build

Repository:

    git diff --check

Do not claim a test passed if it was not run.

Do not commit, push, merge, rebase, reset, or discard unrelated work unless explicitly authorized.

Any source-code patch must be generated against the exact current source and verified with:

    git apply --check <patch-file>

Use `--ignore-space-change` only when CRLF/LF differences are the sole cause of failure.

## Definition of Done

The Research AI Evaluation feature is complete for this release only when:
- only authorized de-identified DatasetVersions can be selected
- ground truth is explicit
- model/version/config provenance is saved
- metrics are scientifically named/correct
- runs are reproducible
- no production promotion path exists
- project role and dataset authorization are both enforced
- no identifiable Patient information leaks
- loading/empty/error/403 states work
- Collaboration Workspace can reference runs where supported
- audit events exist
- relevant backend tests pass
- frontend validation is accurately reported
- git diff --check is clean

No fake production data may be added to demonstrate the feature.
