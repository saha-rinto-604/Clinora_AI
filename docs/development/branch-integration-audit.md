# Clinora AI branch integration audit

Audit date: 30 September 2026 (Asia/Dhaka). Stage 1 only. **Stage 2 has not started and requires explicit owner approval.**

## Decision and scope

Use the current clinical branch at `7a9f453c73a05085e661c06fea72f8defb35c3ca` as the committed integration base, preserve its 42 modified and 16 untracked files separately, and integrate Shahed's exact fetched tip `3fa876032d74b8022ba980983b777d0fc976a289`. Do not replace the clinical application with Shahed's older clinical baseline. Most historical feature branches are already ancestors of the current branch.

The proposed destination is a **new local** `integration/clinora-unified-2026` branch in a separate checkout, created only after approval. This branch name did not exist during this audit. Existing temporary worktrees are unsuitable for reuse: all four report hundreds of deleted tracked files. Their references and files were left untouched.

The integration is feasible, but a mechanical merge is insufficient. Blocking findings include six duplicate Flyway versions, missing frontend editor dependencies, existing research authorization gaps, fabricated research AI evaluation scores, and incomplete Notepad concurrency. These findings are repair requirements, not reasons to discard Shahed's functionality.

No application source, migration, dependency manifest, configuration, governing DOCX, branch, stash, or database was changed. This audit file is the only intended repository addition. Tests produced normal ignored build/cache outputs. A source archive of Shahed's exact commit was extracted outside the repository for independent baseline tests; that archive is not an integration worktree or merge. No push, deployment, merge, cherry-pick, reset, stash, or service startup was performed.

## Authority and evidence limits

The attached owner prompt explicitly says “BEGIN WITH STAGE 1 ONLY” and “STOP AFTER STAGE 1. DO NOT EXECUTE STAGE 2 UNTIL I EXPLICITLY AUTHORIZE IT.” That is the approval gate for this task. The general request to start merging does not override the attached prompt's explicit two-stage requirement.

The current integration prompt and its source-of-truth order govern this audit. `AGENTS.md`, the Phase 4 role/auth SRS update, current implementation documentation, and relevant content extracted read-only from all five governing DOCX files were inspected. The old DOCX documents contain superseded NestJS and hospital-dependent assumptions; those must not be restored. DOCX files were not rendered, edited, normalized, or copied into this report. This was a targeted integration review, not a complete requirements traceability review of the approximately 500,000-character full SRS.

Current source confirms React 19, TypeScript, Vite, Tailwind v4, React Router, Zustand, React Hook Form/Zod, Spring Boot 3.5.4, Java 21, Maven, Flyway, PostgreSQL 16, Redis, RabbitMQ, MinIO, ClamAV, and private Python services. TanStack Query is named in the owner direction but is not declared in the inspected frontend manifests; do not add a broad data-fetching rewrite merely to make the manifest match the prompt. Existing code uses Axios and local state.

Patient inference uses local MedGemma through llama.cpp and configurable `HF_MODEL`. **Existing Doctor AI code already instantiates `GeminiRuntime` in `ai-service/app/main.py`.** Gemini is present in current clinical source, not introduced by Shahed or this audit. Preserve the existing provider implementation provisionally; do not add Gemini usage or silently replace a provider. The owner must resolve any intent to prohibit the already-existing Doctor provider, since that would require a separate functional change.

Source review identifies concrete behavior and defects, but it is not proof of runtime authorization. No authenticated browser flow, persistent database migration, real model inference, external email, or OCR model inference was executed in Stage 1. Tests below are explicitly scoped to the current dirty tree or Shahed's clean archive.

## Git baseline and ancestry

| Item | Finding |
|---|---|
| Repository | `https://github.com/saha-rinto-604/Clinora_AI.git` |
| Current branch | `ui/clinora-pre-release-ux-refinement` |
| Current HEAD | `7a9f453c73a05085e661c06fea72f8defb35c3ca` |
| Local and remote main | `40ca5af919ba63a521cc0340b33879eab7d4a64d` |
| Shahed branch | `origin/shaheds-branch` |
| Shahed tip before fetch | `437ef18` |
| Shahed tip after fetch | `3fa876032d74b8022ba980983b777d0fc976a289` |
| Clinical/Shahed merge base | `a7bd4f23b1c733e11376c268b84f518de49e0396` |
| Current vs main | 3 current-only commits; main is an ancestor |
| Main vs Shahed | 29 main-only and 16 Shahed-only commits |
| Current vs Shahed | 32 current-only and 16 Shahed-only commits |
| Shahed delta from merge base | 238 changed paths; 42,806 insertions, 149 deletions |
| Current working changes | 42 modified tracked paths, 16 untracked paths; no staged changes |
| In-progress operations | No MERGE_HEAD, CHERRY_PICK_HEAD, REBASE_HEAD, rebase-merge, or rebase-apply found in current checkout |
| Existing stashes | Four; inspected names only; not applied or dropped |

Current-only commits are `08443e3` (Patient dashboard density), `d0d46da` (booking report selection), and `7a9f453` (report review and failed-preview retry). They build on main's applicant recovery, continuing care, and report processing fixes.

Shahed's three newly fetched commits are `74f168c` (status/action styling), `6ac9320` (Clinora Library restructure), and `3fa8760` (Notepad). The full branch also contains project governance, datasets, collaboration, account administration, credential verification, and their associated schema/tests. Using the pre-fetch tip would lose Library and Notepad work.

All remote feature branches other than Shahed are already included in the current history. The local `ui/patient-home-clinical-intelligence-visual` branch has one unique older commit, `d7d364b`; it adds a standalone visual component and modifies the biomedical background. It is a design reference candidate, not a required wholesale merge. Its component is absent from the current tree, while later cinematic home/clinical interfaces are already present. Importing it blindly would risk duplicate visual systems and conflict with the requested quiet report vault.

### Protecting uncommitted work

The dirty tree is an additional source, not equivalent to HEAD. It includes Patient and Doctor navigation/layout changes, prescription handling, report-vault/analysis/insight refinements, OCR worker/timeout/performance changes, AI response and timing changes, backend queue telemetry, Compose/Vite changes, tests, and local validation notes. A branch-only merge would omit these files.

Stage 2 should first record byte hashes, export the tracked patch and copy the enumerated untracked files to a protected task directory, and verify the copy before replaying it into the separate integration checkout. Retain the original checkout unchanged. Preserve these changes in a dedicated integration checkpoint so they are independently reviewable. Do not automatically stage other developer files in the original checkout or copy ignored secrets, model weights, private Documents, or database files into Git.

A local SHA-256 manifest and source inventory were recorded under `C:/Users/rinto/AppData/Local/Temp/clinora-stage1-audit-20260930/inventory.json`. This is an integrity inventory, **not a backup of file contents**. Recheck it at Stage 2 entry because developers may continue work.

## Module comparison and preservation matrix

In this matrix, **C** means current HEAD `7a9f453c73a05085e661c06fea72f8defb35c3ca`, **M** means main `40ca5af919ba63a521cc0340b33879eab7d4a64d`, **S** means Shahed `3fa876032d74b8022ba980983b777d0fc976a289`, and **W** means the enumerated uncommitted working tree, which has no commit SHA. The planned destination for every retained module is the new integration branch.

| Module | Source and implemented behavior | Dependencies and loss risk | Integration and verification |
|---|---|---|---|
| Authentication | C/M: six-role enum; Patient registration/verification; JWT; BCrypt; refresh/session/token services; application activation; admin bootstrap. S: role landing routes, auth-store name updates, researcher account management. | Copying old clinical source loses recovery fixes; approving an account must not grant a dataset. | Keep C security/access foundations, add S navigation/account behavior. Test public privileged-registration denial, inactive accounts, token reuse/expiry, refresh rotation, logout and suspension. |
| Doctor onboarding | C/M `access/**`, admin review UI and interview panel: email verification, professional application/documents, more-info, review, mandatory interview lifecycle, decision, activation. S retains core panel/services. | Admin redesign could hide review or overwrite newer applicant fixes. | Preserve C backend and C application routes; compose S Admin shell around existing review behavior. Test the full state sequence and document ownership. |
| Researcher onboarding | C/M researcher application details, review, documents, activation. S adds post-activation account directory, suspension/reactivation, session revocation and credentials. | Account administration is distinct from application approval, project approval and dataset grants. | Keep both workflows and route them separately. Test approval alone does not authorize project/dataset operations. |
| Patient | C/M: dashboard/home, profile, longitudinal health record, vault, OCR review, AI insight, booking/sharing, prescriptions/follow-up, blood network. W adds current UI/performance/care refinements. S adds research consent and shared-profile changes. | S branches before newer care work; S profile changes already break four baseline UI assertions. | Preserve C+W; integrate consent and scoped profile changes surgically. Retain SELF/OTHER isolation and four-part Patient profile behavior. |
| Doctor | C/M: accepted R3 dashboard, schedule/availability, inbox, appointments, patient detail, scoped report review/compare, clinical AI support, consultations, prescriptions and notifications. W improves navigation and continuing care. | Replacing App.tsx with S loses consultation, inbox, patient-detail, notification and prescription routes. | Keep C+W clinical implementation. Test explicit sharing, unrelated-doctor denial, cancellation/completion/follow-up and prescription access. |
| Research projects | S `ResearchProjectService`, controllers, entities, repositories and pages: creation/edit, lifecycle, review and collaborator access. | Requires S schema, audit actions, account status and project permissions. | Retain implementation and tests; repair project-scoped/active-account boundaries where missing. Exercise owner/co-researcher/supervisor/viewer and removed-member cases. |
| Datasets and privacy | S catalog/cohort, requests/review, asynchronous generation, MinIO storage, immutable versions/checksums, pseudonyms, consent/eligibility, downloads/grants. | Caller checks and grant revocation gaps; privacy defaults differ from example configuration. | Preserve pipeline and de-identification; enforce one consistent authorization path across lists, jobs, downloads, statistics and provenance. Test request/project approval, consent, SELF, minimum cohort, expiry/revocation. |
| Research statistics | S `DatasetStatisticsService`, dataset detail UI: aggregates from stored dataset bytes, histograms, trends, group comparisons; `DiseaseAnalyticsPolicy`. | Statistics reuse a weaker dataset access gate than downloads; disease interpretation is policy-limited. | Keep real-data aggregates; enforce dataset lifecycle before bytes are loaded. No invented disease analytics or statistics. |
| Research AI evaluation | S options, run lifecycle, task-specific calculators, storage/auditing and UI. | Actual run metrics are fabricated from fixed fractions of record count. No real prediction/ground-truth execution found in that calculation. | Preserve UI/contracts/calculators/history but stop synthetic completion results. Wire only an approved real evaluation input path, otherwise expose an honest unavailable/not-executed state. Preserve historical records with explicit provenance handling. |
| Collaboration | S invitations and lifecycle, project roles, workspace notes/comments/files, Library and Notepad/revisions/comments. | Notepad dependencies missing; autosave/concurrency and WebSocket authorization incomplete. | Retain all modules; repair dependencies and authorized persistence first. Test concurrent editors, stale saves, removed members, document/project mismatch, restoration and downloads. |
| Admin research | S Admin shell, project and dataset review, researcher account directory/detail and credential decisions. | Whole-directory replacement could remove existing approvals; incorrect `ADMIN` annotations occur elsewhere in research APIs. | Union of S governance and C professional approvals. Keep six canonical roles and resource limits, with route/API contract tests. |
| OCR | C lineage includes R6 parser/reprocessing and review flows; W modifies engine, timeout capacity, performance and golden cases. S does not modify the OCR service. | Parser regressions, lost W files, altered verification semantics. | Keep C+W. Preserve viewer, edits, review ranges and final verification; run all OCR tests and later synthetic PDF/image runtime checks. |
| Patient AI | C/M local MedGemma/llama.cpp grounded report analysis; W adds metrics/tuning and UI presentation. S does not change AI service implementation. | Model/provider changes or report scope expansion could invalidate clinical behavior. | Preserve verified observation input, report ownership, error handling and output grounding. Run all AI tests and authorized model runtime checks later. |
| Notifications | C Doctor+Patient delivery and secure appointment links; S Researcher delivery, target routes and collaboration topics. | Choosing S consumer drops Doctor eligibility; choosing C drops Researcher delivery. | Combine role eligibility and role-specific links; retain privacy-preserving email and outbox behavior. Test delivery, read ownership, targets and topic permissions. |
| Infrastructure | C+W Compose/frontend mount/polling, host AI profile, storage/malware/queues; S research storage and pseudonym configuration. | Duplicate Compose volume keys or wrong mounts, storage endpoint mismatch, default secret/cohort weaknesses. | Merge individual settings; preserve host inference topology. Validate Compose, storage buckets, queue bindings, health and startup on isolated services. |
| Shared UI/brand | C canonical mark and accepted clinical themes; S researcher/admin shell. W latest local refinements. | Global CSS or replacing shells can regress approved Doctor pages or logo. | Reuse tokens/primitives and retain page-specific layouts; compare actual desktop/mobile screenshots in Stage 2. |

### Admin preservation at function level

| Behavior | Existing implementation to retain | Shahed contribution and planned reconciliation |
|---|---|---|
| Apply, verify email, recover applicant access | `AccessApplicationService`, applicant session/token services, public application pages | S does not replace these backend services. Retain newer M/C recovery behavior rather than source them from S's old base. |
| Applicant credentials and private documents | `ApplicationDocumentService`, storage port, admin download tests | Keep existing document access checks; add S Researcher account/credential document views with equivalent checks and auditing. |
| Queue/detail, start review, request information | `AdminAccessReviewService` and `AccessReviewsPage` | S page changes are predominantly shell/header/navigation; existing review handlers and interview component remain. Preserve handlers and test each button/transition. |
| Interview require/schedule/reschedule/cancel | `DoctorInterviewService`, `AdminDoctorInterviewController`, `DoctorInterviewAdminPanel` | Keep current state restrictions, private links, timezone handling, notifications and audit. S research governance must not replace these. |
| Interview completion/no-show/reschedule request | Doctor interview service/controller/reminder paths | Retain applicant/admin distinction and reminders; test completion alone does not activate the Doctor. |
| Approve/reject and one-time activation | `AdminAccessReviewService`, application token handling, activation page | Preserve mandatory Doctor interview and post-approval password creation. Researcher approval remains its own application workflow. No mandatory Hospital. |
| Project protocol/IRB decisions | S `AdminResearchProjectReviewService` | Add alongside professional access review; separate project lifecycle and permission rules. |
| Dataset request decisions | S `AdminDatasetRequestReviewService` | Preserve review/generation linkage while enforcing approved projects, caller authorization and auditable decisions. |
| Researcher account maintenance | S `AdminResearcherAccountService` and credential service | Preserve list/detail/documents/activity/audits, suspend/reactivate and revoke-sessions actions; repair security test wiring and stale-token enforcement. |

Final Admin navigation should retain S's existing groups and explicit routes: `/admin/access-reviews` (Doctor/Researcher applications and interviews), `/admin/researchers` and detail (activated accounts), `/admin/research/projects` and detail, `/admin/research/dataset-requests` and detail, plus account/security. Do not create a second competing application-review page. An Admin-wide standalone AI evaluation dashboard was not established by this review; do not invent one.

## Conflict inventory

### Committed overlap

Six paths changed independently since the merge base. These are **overlap candidates**, not a claim that an actual merge was attempted or that all six produce textual conflict markers:

| File | Required resolution |
|---|---|
| `.env.example` | Add research settings without dropping current clinical runtime settings. Document real required secrets by variable name only. |
| `backend/src/main/java/com/clinora/audit/AuthAuditAction.java` | Preserve union of clinical and research events; check all emitters and persisted enum strings. |
| `backend/src/main/java/com/clinora/notifications/service/NotificationDeliveryConsumer.java` | Union PATIENT/DOCTOR/RESEARCHER eligibility, retain current email constructor and secure Doctor links; add Researcher targets. |
| `backend/src/main/resources/application.yml` | Preserve care/OCR/AI configuration while adding research storage/privacy configuration. Resolve conflicting cohort defaults explicitly. |
| `docker-compose.yml` | Keep current frontend root mount and node_modules volume, host AI routing and W tuning; add research settings without duplicate keys. |
| `frontend/src/App.tsx` | Union clinical routes with S research/admin routes and account shells. Preserve public research presentation and role-aware access. |

Additional W-versus-S overlaps are `frontend/src/features/patient/patient-home.tsx`, `frontend/vite.config.ts`, and `docker-compose.yml`. These must be handled even if Git reports a clean committed-branch merge.

### Semantic/API conflicts that Git will not catch

- Shahed reuses Patient profile pages/API for Researcher identity and adds first/last name updates. It widens Patient profile, timeline and body-measurement service checks to RESEARCHER. Inspect this as a deliberate self-profile capability, not permission to read other Patients. Preserve user-ID scoping and the Patient health-profile completion contract; four S frontend assertions currently fail in this area.
- `notification-target.ts` gains Researcher destinations while Doctor notifications have their own newer consumers and routes. Test all role callers, not just the shared bell.
- S's dataset, cohort and audit controllers refer to nonexistent role `ADMIN`; canonical role is `SYSTEM_ADMIN`. Do not globally substitute SYSTEM_ADMIN in a way that grants private clinical access. Determine which administrative research operations are intended, then test them.
- S `ResearchDatasetController` omits caller arguments in generation/latest-job endpoints; project dataset listing ignores the caller; request-to-dataset lookup directly queries the repository. Role gates do not supply missing resource checks.
- New audit entity/repository methods, API exception handlers, user name methods, profile image permissions, research storage properties and notification changes are dependencies of S's module even though most do not textually overlap C. Importing only `research/**` would be incomplete.
- TipTap imports in Notepad are absent from S package.json/package-lock.json. A clean `npm ci` succeeds but typecheck/build fail. Dependency reconciliation is required; do not replace the rich editor with a stub to pass checks.
- The approved-model/evaluation contracts represent workflows, not proof of actual evaluated predictions. Preserve types and real calculations; remove fabricated execution outcomes from the production path.
- Old unmerged visual component `d7d364b` and old stashes are not automatically approved integration sources. Keep them recoverable; review a specific delta only if a current feature/reference requires it.

## Database history and migration plan

V1–V26 have identical Git blobs in C and S. C has V27–V32 for clinical care; S has V27–V39 for research. The six duplicate version numbers have different filenames and content, so Git may keep both files without a conflict while Flyway rejects the resulting migration set.

| Version | Clinical C | Research S |
|---|---|---|
| V27 | Appointment consultation modes | Research domain foundation |
| V28 | Doctor practice location | Research project reviews |
| V29 | Doctor consultations | Dataset requests |
| V30 | Consultation care actions | Dataset generation/versions/access grants |
| V31 | Prescription documents | AI evaluation runs |
| V32 | Weekly availability/default meeting room | Research project members |

S's later chain is V33 publications, V34 Patient research consent, V35 invitation lifecycle, V36 collaboration workspace, V37 credential verification, V38 Library restructure, and V39 Notepad. Research foundation must precede review/requests/generation; membership precedes collaboration; publications precede Library; projects/users precede Notepad/revisions/comments. Preserve foreign keys and unique indexes. Notepad has a unique `(document_id, revision_number)` index but no demonstrated optimistic concurrency protocol.

**Applied schema histories are unknown.** Docker is unavailable, no database port is listening, and no representative database dump/history was supplied. Do not infer that S migrations are unapplied merely because they are absent from main. Do not run `flyway repair`, baseline, out-of-order migration, or SQL against an unknown database to hide conflicts.

Proposed decision procedure for Stage 2:

1. Inspect read-only schema history and schema identity for every database that must be preserved. Record `version`, `description`, `script`, `checksum`, and success; avoid exporting clinical records to the report. Obtain verified backups before any real upgrade.
2. If only the clinical V1–V32 lineage has been applied and research migrations are confirmed unapplied on supported databases, preserve C V1–V32 byte-for-byte and map S's thirteen migrations, in dependency order, to new V33–V45. This is a **conditional proposal**, not an approved renumbering performed in Stage 1. Update filename-sensitive tests/docs together.
3. If any database already has S V27–V39, simple renumbering is unsafe. Design separate explicit upgrade paths for the two histories, preserve their historical migrations and checksums, and converge with new migrations/audited data transfer as necessary. A Flyway version is global within its history: do not combine divergent histories by overwriting rows. Bring that concrete lineage-specific plan back for review before applying it to retained data.
4. Validate the chosen combined schema in a newly named disposable PostgreSQL database. Verify table/column types, constraints, indexes, JPA compatibility, and checksum validation. Then test upgrades on disposable copies of each supported history.
5. Compare pre/post row counts and relationship integrity for users, applications, interviews, reports, observations, appointments, prescriptions, projects, memberships, consent, datasets/versions/grants, publications and documents/revisions. Keep object-storage keys and pseudonym secret stable for existing exports.

Additional migration/data risks:

- S V38 defaults existing publications to `PUBLISHED`, visible to `CLINORA_RESEARCHERS`, and a generic author. Review legacy-row visibility/provenance before adopting this upgrade; do not invent authorship or expose drafts inadvertently. If already applied, correct behavior with a new migration rather than editing history.
- Research pseudonym secret is required outside dev/test, but Compose supplies a shared development fallback. Production configuration must reject placeholder secrets. Changing the secret changes pseudonyms; do not rotate it accidentally during integration.
- `.env.example` suggests cohort minimum 5, while S YAML/Compose default to 1 and the dev/test constructor caps configured minimum at 2. Reconcile this with an explicit privacy policy; a small synthetic test fixture does not justify weakening a real deployment.
- Patient consent revocation is persisted and checked for new eligibility/generation. Withdrawal behavior for already-issued datasets must be verified; the inspected consent service does not itself revoke existing dataset grants or stored versions. Do not claim retroactive withdrawal is implemented.

## Security and integrity findings

| ID / severity | Source evidence | Required acceptance condition |
|---|---|---|
| R1 Critical | Duplicate V27–V32 across clinical and research migration sets | Clean installation and retained-history upgrade both validate without overwritten migration history or clinical/research data loss. |
| R2 High | S `ResearchDatasetController`: generation/latest-job/request lookup lack requester-scoped checks; `DatasetGenerationService.listDatasetsForProject` ignores requestingUserId | Unrelated Researcher cannot inspect metadata/jobs, trigger work, or retrieve datasets by guessed project/request/dataset IDs. |
| R3 High | S `verifyDatasetAccess` allows project owner or active membership even after an explicit grant is inactive; `DatasetStatisticsService.loadRecords` uses getDataset, while only downloadVersion checks dataset expiry/revocation | One consistent gate enforces project, dataset, grant and lifecycle policy across bytes, statistics, versions, evaluation and references. Revoked or expired grants cannot be bypassed by membership. |
| R4 High | S WebSocket SUBSCRIBE accepts any `/topic/research/projects/` prefix; edit handler checks project role but not document/project association or payload identity | Subscription checks project/document access; validate destinations; bind sender identity server-side; reject archived/cross-project documents and removed collaborators. Test existing connection after removal/suspension. |
| R5 High | S `ResearchAuditController.getProjectAuditHistory` has role gate but no caller/project authorization; service accepts only projectId | Unauthorized Researcher cannot read another project's audit metadata; administrative access uses canonical role and explicit scope. |
| R6 High | S `AIEvaluationService.computeMetricsForRun` uses `max(10, recordCount)`, fixed fractions 0.82/0.94 etc., and fixed error 0.042, then marks completed | No fabricated evaluation is reported as an executed model result. Preserve real metric calculators and expose unavailable execution honestly until a real approved path exists. |
| R7 High | S Notepad frontend imports undeclared TipTap modules; autosave sends content JSON without a base revision; no client STOMP/CRDT wiring found; service takes latest revision then writes next without @Version | Install declared compatible dependencies; preserve revision history; stale/concurrent saves cannot silently overwrite work. Claim live collaboration only after multi-client verification. |
| R8 High / requires execution proof | JWT converter trusts signed role claim; ResearchAuthorizationService checks membership but no current account status; suspension revokes refresh sessions | Suspended/revoked users cannot continue sensitive research operations with an already-issued access token or socket. Verify service/global checks and add missing enforcement. |
| R9 Medium–High | S profile/API reuse broadens RESEARCHER access; frontend Patient completion regressions confirmed | Researcher self-profile is bounded; no access to other Patient identities/records; accepted Patient profile behavior survives. |
| R10 Medium–High | Notification consumer independently expanded to Doctor on C and Researcher on S | Union eligibility/links without silently dropping either role. Existing current WebSocket CONNECT is Patient-only, so do not claim Doctor live sockets already work. |
| R11 Medium–High | Cohort minimum mismatch, dev placeholder pseudonym secret, V38 visibility defaults | Explicit deployment privacy configuration and reviewed legacy-data handling; no silent broadening of data visibility. |
| R12 Medium | S baseline failures and C formatting debt; current dirty work not committed | Repair identified defects with meaningful checks; preserve every W source/test file, and do not disable suites or reformat unrelated source in Stage 1. |

Positive safeguards present and worth retaining: Patient/Doctor clinical queries explicitly filter SELF and appointment/patient relationships; S eligibility fails closed for unknown/withheld/revoked consent and OTHER reports; S de-identification uses project-scoped pseudonyms; dataset downloads check dataset revocation/expiry and record audits; research project roles and explicit request review exist; professional approval remains distinct from email verification. These do not negate the gaps above.

## Design selection

| Surface | Evidence and proposed source | Approval status / verification |
|---|---|---|
| Canonical logo | `brand/canonical-clinora-logo` at `d1b6db2`, already in C | Explicitly protected by owner; retain unchanged. |
| Public home | Animated public background `63a30d7`, already integrated | Preserve current cinematic biomedical presentation. |
| Patient home/dashboard | Cinematic home `a9ebb44` already integrated; dashboard reference/R3 lineage `5c9a5f9`; current `08443e3` and W refinements | Keep current functional design; distinguish historical reference approval from approval of every latest local edit. |
| Doctor dashboard | R3/reference lineage; `docs/development/phase-6-dashboard-r5-1-reference-fidelity.md` explicitly records owner-approved references; subsequent clinical branch `2041512` | Owner prompt requires preservation. Keep current accepted structure; only verified defect repairs. |
| Doctor care workspaces | `2816205`, `2041512`, M continuing-care fixes, W navigation/prescription refinements; care/availability validation notes | Preserve implementation and compare current rendered routes before any shared styling changes. |
| Report vault | C page plus W quiet-vault refinements | Preserve search/filter/current/archive/open/analyze behavior. Do not import decorative older `d7d364b` component automatically. |
| Extraction/verification | R6 `58dc4ae` through integration `3eee8ee`, C `7a9f453`, W workstation changes | Preserve original document priority, correction/confirmation and retry; use real verified observations. |
| AI insight | R6/M grounded analysis and W evidence layout | Retain clinical grounding and error states; no probabilities/diagnoses invented for appearance. |
| Research/Admin | S shells/pages, including `74f168c`, `6ac9320`, `3fa8760` | Owner selects Shahed as functional baseline and asks to preserve design. No pixel comparison or separate approval for every S patch was established. Repair without discarding behavior. |

The repository has textual reference-fidelity records, but the actual owner-approved screenshots were not visually compared in this audit. Neither newest commit nor passing tests proves visual approval. Stage 2 should capture desktop/mobile references from the preserved current application, retain the Doctor design, and request owner review for any material design choice not settled by supplied references. Avoid global CSS replacement, duplicate shells, fake statistics or placeholder production data.

## Baseline validation executed

Commands ran against existing installed dependencies for the **current dirty tree**, not pristine main. Shahed was tested in an isolated source archive at the exact fetched SHA. No source was patched to pass a check.

| Target / command | Status | Result |
|---|---|---|
| Repository `git fetch --all --prune` | Passed | Only Shahed tracking tip advanced: `437ef18` → `3fa8760`. No pull/merge. |
| Current frontend `npm.cmd run lint` | Passed with warnings | 0 errors, 7 React-refresh export warnings. |
| Current frontend `npm.cmd run typecheck` | Passed | Exit 0. |
| Current frontend `npm.cmd run test:run` | Passed | 56 files, 355 tests. |
| Current frontend `npm.cmd run build` | Passed with warning | Vite production build; main bundle approximately 1.86 MB / 518 KB gzip, chunk-size warning. |
| Current frontend `npm.cmd run format:check` | Failed | 51 files have formatting differences. No formatter run in write mode. |
| Current backend `mvn.cmd -B test` | Failed due to environment | 463 reported cases: 461 passed, 0 assertion failures, 2 suite-initialization errors. `WeeklyCareIntegrationTest` and `DoctorSupportEvidenceScopeIntegrationTest` require Docker. |
| Current OCR `.\.venv\Scripts\python.exe -m pytest tests -q` | Passed with warning | 51 passed; pre-existing pytest cache path permission warning. |
| Current AI `.\.venv\Scripts\python.exe -m pytest tests -q` | Failed due to environment on first run | 368 passed, 15 setup errors because existing `%TEMP%/pytest-of-rinto` is inaccessible; 6 subtests passed. |
| Current AI same full suite with fresh task-owned `--basetemp` and `-o cache_dir` | Passed | 383 passed, 6 subtests passed. No source change or tests removed. |
| Shahed frontend `npm.cmd ci --ignore-scripts` | Passed with advisory | Clean isolated install, 440 packages. npm reported 7 dependency advisories (2 moderate, 5 high); not triaged or auto-fixed. |
| Shahed frontend `npm.cmd run typecheck` | Failed | Four missing TipTap modules plus implicit-any editor argument; exit 2. |
| Shahed frontend `npm.cmd run lint` | Failed | 44 errors, 7 warnings. Preserve logic while repairing unused bindings/type issues later. |
| Shahed frontend `npm.cmd run test:run` | Failed | 31 files passed, 11 failed; 183 tests passed, 4 failed; 8 suites could not initialize due to missing TipTap import. Three files contain the 4 assertion failures. |
| Shahed frontend `npm.cmd run build` | Failed | Same TipTap/type errors stop TypeScript before Vite build. |
| Shahed backend `mvn.cmd -B test` | Failed | 416 cases: 409 passed, 1 assertion failure, 6 errors. Details below. |
| `docker compose config --quiet` | Passed | Current Compose syntax/interpolation validates. Does not prove container startup. |
| `docker ps --format ...` | Blocked | Docker Desktop Linux named pipe missing; engine unavailable. |
| TCP availability check on expected local ports | No listeners | 5173, 8080, 8000, 8001, 8002, 5432, 5672, 15672, 9000, 9001, 6379 all closed at inspection time. |
| `git diff --check` | Passed | No whitespace errors in current tracked patch; CRLF advisory warnings are separate. |
| Migration clean-install / upgrade / checksums | Blocked / not executed | No running database or applied histories. No migrations were executed. |
| Authenticated browser, desktop/mobile visual comparisons | Not executed | Stage 2 runtime work; no live application running during audit. |
| Live OCR/model/email/storage/queue flows | Not executed | Unit/API tests above do not establish live external-service readiness. |

Shahed backend failures:

- Five `AdminResearcherAccountControllerSecurityTest` cases cannot initialize the MVC context because `ResearcherCredentialService` is not supplied in its test slice. This is a test wiring failure, not a demonstrated production permission outcome.
- `AdminResearcherAccountServiceTest.testClinicalPrivacyBoundaryInModels` flags `submittedAt` as a prohibited clinical field. Review the assertion's matching logic and DTO semantics; do not delete legitimate audit timestamps or weaken actual privacy boundaries to silence it.
- `ResearchSecurityLifecycleMatrixTest.testResearcherACannotReadResearcherBProject` errors on Mockito unnecessary stubbing. Preserve the negative authorization assertion while correcting fixture setup.

Shahed's four frontend assertion failures concern Patient Health Profile completion/section structure in `patient-foundation.test.tsx`, `patient-product.test.tsx`, and `patient-health-record.test.tsx`. They are real baseline mismatches, independent of the missing editor dependencies. Eight other suites fail import resolution, including route, shared-component, public/auth and Notepad suites because App imports the editor page.

### Reproduction and evidence locations

Private temporary evidence root: `C:/Users/rinto/AppData/Local/Temp/clinora-stage1-audit-20260930/`. It contains `inventory.json`, `ports.json`, the exact S source archive extraction under `shahed/`, and logs named `frontend-lint.log`, `frontend-typecheck.log`, `frontend-tests.log`, `frontend-build.log`, `frontend-format.log`, `backend-tests.log`, `ocr-tests.log`, `ai-tests.log`, `ai-tests-rerun.log`, `shahed-npm-ci.log`, `shahed-typecheck.log`, `shahed-lint.log`, `shahed-frontend-tests.log`, `shahed-build.log`, and `shahed-backend-tests.log`. These temporary artifacts are not committed/public deliverables.

AI environment-only retry, from `ai-service/`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q --basetemp='C:\Users\rinto\AppData\Local\Temp\clinora-stage1-audit-20260930\pytest-ai-rerun' -o cache_dir='C:\Users\rinto\AppData\Local\Temp\clinora-stage1-audit-20260930\pytest-ai-cache'
```

The basetemp directory was confirmed absent before the run. For future reruns use a fresh task-owned directory: pytest may clear an existing basetemp. Do not point it at another developer's temporary files.

Read-only Git inventory used `git status --short --branch`, `git rev-parse HEAD`, `git remote -v`, `git branch -avv`, `git log --all --graph --decorate --oneline -100`, `git worktree list --porcelain`, `git stash list`, `git for-each-ref`, `git rev-list --left-right --count`, `git merge-base`, `git log origin/main..origin/shaheds-branch --oneline`, and `git diff --name-status/--stat` against the actual SHAs. Blob identities were compared with `git ls-tree` and `git rev-parse <ref>:<path>`. No merge simulation was used to claim final conflict resolution.

## Dependency-aware Stage 2 sequence proposed for approval

1. **Freeze and preserve sources.** Recheck branch SHAs, status and hashes; record any newly changed work. Back up the 58 original dirty paths and protect the four stashes/old worktrees. Create a fresh `integration/clinora-unified-2026` branch at C in a separate checkout. Replay and checkpoint W without modifying the original checkout. Keep an explicit file/feature checklist.
2. **Resolve migration lineage before integrated startup.** Read schema histories and choose the conditional migration strategy above. Prepare clean and upgrade test databases using fresh names and isolated storage. No operation against retained unknown volumes. If both divergent histories exist, finish the lineage-specific transition design before proceeding to a real upgrade.
3. **Integrate S incrementally by dependency.** Use the exact S tree with provenance tracked per path/commit, not a directory overwrite. Start with research schema, audit/user/error/storage/shared types and frontend dependencies. An explicit-path incremental integration is appropriate because S has large mixed feature commits and the migration tree cannot be blindly accepted. Preserve the complete S changed-file inventory; document any excluded path and why. Retain source history references and make reviewable checkpoint commits.
4. **Keep clinical foundations green.** Union App routes, notification delivery/settings, role checks and profile contracts while retaining all Patient/Doctor/access-application functionality. Run core auth/application/interview/care/ownership tests before adding research navigation. Keep current Doctor visuals intact.
5. **Integrate research core with repaired authorization.** Projects/reviews → consent/eligibility/catalog → dataset requests/review → generation/storage/versions/grants → statistics/audit. Add negative authorization/lifecycle tests for the confirmed gaps, including suspension, expiry/revocation, cross-project access and OTHER exclusion. Do not publish research endpoints with known bypasses.
6. **Preserve and stabilize collaboration.** Invitations/members → workspace notes/files → credentials/account administration → Library → Notepad. Restore declared editor dependencies, safe revision/autosave semantics and WebSocket permissions. Verify role-specific behavior and multi-client editing before representing collaboration as complete. Keep existing Library/Notepad records and associated tests.
7. **Combine Admin workflows.** Use S Admin shell/navigation; retain current Doctor/Researcher application review and interview services/panel; add S project/dataset/account/credential governance. Fix Admin security test fixtures and exercise both administrative workflow families end to end.
8. **Reconcile AI/OCR and research evaluation.** Preserve C+W Patient OCR/MedGemma pipeline and existing Doctor provider unless explicitly changed. Keep measured telemetry. Preserve research evaluation contracts/calculators, but remove fabricated completion results and either use a real authorized execution path or mark execution unavailable honestly. Do not invent predictions, ground truth or production charts.
9. **Consolidate design with bounded edits.** Keep current Patient/Doctor behavior and accepted Doctor design, S Research/Admin behavior/design and canonical branding. Compare real routes at desktop/mobile widths; retain report-vault quietness and original-report priority. Resolve only documented visual incompatibilities, not a rewrite.
10. **Run final gates and hand over locally.** Full frontend lint/format/typecheck/tests/build; backend tests including container suites; full Python suites; clean/upgrade Flyway validation; negative API tests; real startup/health; synthetic authorized workflow fixtures; browser navigation/network/console checks; real OCR/model checks where available. Check conflict markers, whitespace, generated files, secrets and unrelated changes. Produce the Stage 2 integration report, validation report and runnable setup documentation. Leave the dedicated branch for review. No main merge/push/deploy without separate authorization.

### Runtime plan and blockers

Inspected normal topology: frontend 5173, backend 8080, OCR 8000; host AI FastAPI 8001 calls loopback llama.cpp 8002. Backend Compose normally reaches host AI using `host.docker.internal`. AI container is opt-in via `container-ai`; its loopback default cannot be assumed to reach host llama.cpp. Preserve the documented host configuration rather than enabling a competing AI container.

`start-clinora-local.ps1` expects Docker, starts PostgreSQL/RabbitMQ/Redis/MinIO/ClamAV/backend/frontend/OCR, and checks host AI readiness. It also stops an optional AI container, so it was inspected rather than run blindly. Research additionally needs its storage bucket, messaging queue, pseudonym secret and reviewed cohort policy. SMTP and external Doctor AI configuration may be required for full acceptance; secret values were not printed or inventoried.

Before claiming a complete launch, Docker must run; database histories must be known; safe isolated DB/storage configuration must be selected; model files/runtime and required email credentials must be available. Stage 1 did not start or stop any services or modify Windows optional features. S's `enable-features.ps1`, `enable-docker-prerequisites.bat`, and `run-enable-features.bat` are OS-management helpers, not application feature requirements; leave them out of the integration unless specifically justified.

## Final audit integrity check

After writing this report, all 58 recorded working-file hashes and all five recorded DOCX hashes matched the audit manifest. Git status had no removed original entries and exactly one new entry: this audit report. The original branch/HEAD remained unchanged. `git diff --check` passed, and the new report was checked separately for trailing whitespace. The report contains the complete 238-path Shahed checklist. No Stage 2 validation result is implied by these integrity checks.

## Approval requested

Approve Stage 2 using C + preserved W as the clinical baseline and S as the complete research/admin source, on the new local integration branch, including repairs for the explicitly documented build/security/data-integrity defects. This approval should preserve functional behavior, not retain fabricated evaluation results or known authorization bypasses.

Migration execution remains conditional on actual applied histories. Preserve the existing Doctor AI provider pending a specific owner decision if “do not introduce Gemini” was intended to require removal of existing usage. Material visual choices without reference approval remain review items; default to the current accepted Doctor design and supplied Shahed direction.

**Stage 1 stops here. No Stage 2 work is authorized by this report itself.**

## Appendix A — exact branch inventory

The tables below are generated from fetched references. “Main-only / branch-only” counts describe ancestry, not functional completeness.

| Branch | Exact SHA | Main-only / branch-only |
|---|---|---|
| `backup/pre-main-consolidation-2026-09-24` | `204151242dc40178b622a5bba209ee812e6a8301` | 3 / 0 |
| `brand/canonical-clinora-logo` | `d1b6db23a293ab718efc1db2eae6f5678b917870` | 60 / 0 |
| `chore/ci-and-docs-refresh` | `a7bd4f23b1c733e11376c268b84f518de49e0396` | 29 / 0 |
| `integration/clinora-final-consolidation` | `7dec504035c5f8c9049f778be861d753242616c0` | 43 / 0 |
| `integration/final-clinora-system` | `715e5d178b80640fce498cf7cba284f74cd289b9` | 47 / 0 |
| `main` | `40ca5af919ba63a521cc0340b33879eab7d4a64d` | 0 / 0 |
| `perf/patient-ocr-ai-latency` | `40ca5af919ba63a521cc0340b33879eab7d4a64d` | 0 / 0 |
| `phase-10p-patient-medgemma-report-insights` | `fc4fbd47ef0cc4f220c86b3968e8a3ff88faf534` | 55 / 0 |
| `phase-10p-r-ai-insight-ux-refinement` | `c74efa720d58a1fd81ba9b9221de9fdbbb6685ce` | 52 / 0 |
| `phase-11-blood-network-runtime-refinement` | `c412015af1e864f71b55c4b9ba0c731b1c209057` | 50 / 0 |
| `phase-4d-1-admin-bootstrap` | `346705b9dec51ab457ae7189c60727e976a90455` | 82 / 0 |
| `phase-4d-2-access-review` | `5c73fad8edc357d590b420226bd8065817153232` | 81 / 0 |
| `phase-5a-patient-foundation` | `d3ca91dcaa6d9e52d9063cad36e50a42e947a163` | 67 / 0 |
| `phase-5b-patient-report-vault` | `fc4f5882754b3495e1be4de9f884ecdf060c2480` | 64 / 0 |
| `phase-5c-to-5g-patient-product` | `cf08ab980d988b4578069ed64a650be1dda8d350` | 62 / 0 |
| `phase-6-doctor-workspace` | `c3e640aa8e52855d3555634c8288652c0a19fc07` | 41 / 0 |
| `phase-6d-doctor-clinical-support-foundation-router` | `0835123dde5bd9f23851ee8aad38e9b454f9f77f` | 20 / 0 |
| `phase-6e-6h-doctor-product-completion` | `281620503d4990528af5ab5e5083ec2340dfea22` | 17 / 0 |
| `phase-6e-6h-premium-clinical-workflow` | `204151242dc40178b622a5bba209ee812e6a8301` | 3 / 0 |
| `phase-9p-patient-report-extraction` | `c2b2233ba38a823799af2e908f28fa29fec28798` | 58 / 0 |
| `phase-9p-r-report-extraction-refinement` | `e60105101061daf135b336841f9b30a373baad23` | 57 / 0 |
| `ui/animated-public-biomedical-background` | `63a30d77b8ebb8c65bcf6addf71aab15029cc054` | 55 / 0 |
| `ui/clinora-pre-release-ux-refinement` | `7a9f453c73a05085e661c06fea72f8defb35c3ca` | 0 / 3 |
| `ui/patient-home-clinical-intelligence-visual` | `d7d364b2c3cc3418190f21c056d0bf62bb5facd1` | 56 / 1 |
| `ui/patient-home-core-cinematic-experience` | `a9ebb44bd088992784f36a6a310f806547a907ab` | 49 / 0 |
| `origin/brand/canonical-clinora-logo` | `d1b6db23a293ab718efc1db2eae6f5678b917870` | 60 / 0 |
| `origin/chore/ci-and-docs-refresh` | `a7bd4f23b1c733e11376c268b84f518de49e0396` | 29 / 0 |
| `origin/integration/clinora-r6-phase6-final` | `3eee8ee97d1c489b123a3e80fec6fe91b31e94f3` | 32 / 0 |
| `origin/main` | `40ca5af919ba63a521cc0340b33879eab7d4a64d` | 0 / 0 |
| `origin/phase-10p-patient-medgemma-report-insights` | `fc4fbd47ef0cc4f220c86b3968e8a3ff88faf534` | 55 / 0 |
| `origin/phase-10p-r-ai-insight-ux-refinement` | `c74efa720d58a1fd81ba9b9221de9fdbbb6685ce` | 52 / 0 |
| `origin/phase-10p-r6-real-report-medgemma-refinement` | `58dc4aeefc5a9e6e1c6f1ed0ce3b39bc867d6155` | 36 / 0 |
| `origin/phase-11-blood-network-runtime-refinement` | `c412015af1e864f71b55c4b9ba0c731b1c209057` | 50 / 0 |
| `origin/phase-5a-patient-foundation` | `d3ca91dcaa6d9e52d9063cad36e50a42e947a163` | 67 / 0 |
| `origin/phase-5b-patient-report-vault` | `fc4f5882754b3495e1be4de9f884ecdf060c2480` | 64 / 0 |
| `origin/phase-5c-to-5g-patient-product` | `cf08ab980d988b4578069ed64a650be1dda8d350` | 62 / 0 |
| `origin/phase-6-doctor-workspace` | `c3e640aa8e52855d3555634c8288652c0a19fc07` | 41 / 0 |
| `origin/phase-6d-doctor-clinical-support-foundation-router` | `0835123dde5bd9f23851ee8aad38e9b454f9f77f` | 20 / 0 |
| `origin/phase-6e-6h-premium-clinical-workflow` | `204151242dc40178b622a5bba209ee812e6a8301` | 3 / 0 |
| `origin/phase-9p-patient-report-extraction` | `c2b2233ba38a823799af2e908f28fa29fec28798` | 58 / 0 |
| `origin/phase-9p-r-report-extraction-refinement` | `e60105101061daf135b336841f9b30a373baad23` | 57 / 0 |
| `origin/shaheds-branch` | `3fa876032d74b8022ba980983b777d0fc976a289` | 29 / 16 |
| `origin/ui/animated-public-biomedical-background` | `63a30d77b8ebb8c65bcf6addf71aab15029cc054` | 55 / 0 |
| `origin/ui/phase-6-ux-r3-clinical-product-experience` | `5c9a5f931a410552f69218c3a933b5559e4c29a5` | 37 / 0 |

## Appendix B — complete migration inventory

Same shared blob means byte-identical committed content. No applied-database checksum was read. All paths are under `backend/src/main/resources/db/migration/`.

| Version | C filename / blob | S filename / blob |
|---|---|---|
| V1 | `V1__create_users.sql` / `1fbe4be1cb05b7295ff28f049a687bea30bb8336` | `V1__create_users.sql` / `1fbe4be1cb05b7295ff28f049a687bea30bb8336` |
| V2 | `V2__create_auth_sessions.sql` / `ab584b074e9ea63fb18588162d8c33c77d32c964` | `V2__create_auth_sessions.sql` / `ab584b074e9ea63fb18588162d8c33c77d32c964` |
| V3 | `V3__create_auth_one_time_tokens.sql` / `02996c8113c739b09956cb2fa8bcb522f8fde452` | `V3__create_auth_one_time_tokens.sql` / `02996c8113c739b09956cb2fa8bcb522f8fde452` |
| V4 | `V4__create_auth_audit_events.sql` / `9f05de93d4f6ff0fbca75c528faeffd7fbbecc6e` | `V4__create_auth_audit_events.sql` / `9f05de93d4f6ff0fbca75c528faeffd7fbbecc6e` |
| V5 | `V5__create_access_applications.sql` / `f3efdde5f392325c52f0246355ae602a75f010ec` | `V5__create_access_applications.sql` / `f3efdde5f392325c52f0246355ae602a75f010ec` |
| V6 | `V6__create_application_detail_tables.sql` / `d25b43d653402efe6d20c1a3398c7a9f3470b4e9` | `V6__create_application_detail_tables.sql` / `d25b43d653402efe6d20c1a3398c7a9f3470b4e9` |
| V7 | `V7__create_application_documents.sql` / `15360f0e0156db14b3c574d7861ec972446e7594` | `V7__create_application_documents.sql` / `15360f0e0156db14b3c574d7861ec972446e7594` |
| V8 | `V8__create_application_tokens_and_sessions.sql` / `48e37e53f7b9754aefb73db24ee39e12056784fe` | `V8__create_application_tokens_and_sessions.sql` / `48e37e53f7b9754aefb73db24ee39e12056784fe` |
| V9 | `V9__create_application_events.sql` / `eb6da237a241a70672974e0c173e48aa80db6868` | `V9__create_application_events.sql` / `eb6da237a241a70672974e0c173e48aa80db6868` |
| V10 | `V10__create_application_review_notes.sql` / `20db43e9c8482f3ff86f6ffd4b62674b1aacb27d` | `V10__create_application_review_notes.sql` / `20db43e9c8482f3ff86f6ffd4b62674b1aacb27d` |
| V11 | `V11__create_doctor_interviews.sql` / `c3a0dad407e16096114403c591c9dfaefe814dab` | `V11__create_doctor_interviews.sql` / `c3a0dad407e16096114403c591c9dfaefe814dab` |
| V12 | `V12__allow_application_activation_tokens.sql` / `3d861fb482017467acc5b48317d1932abbca58c4` | `V12__allow_application_activation_tokens.sql` / `3d861fb482017467acc5b48317d1932abbca58c4` |
| V13 | `V13__create_patient_profile_foundation.sql` / `3e303c8393ad17fbbde2a923008e0852d0104910` | `V13__create_patient_profile_foundation.sql` / `3e303c8393ad17fbbde2a923008e0852d0104910` |
| V14 | `V14__create_patient_medical_report_vault.sql` / `7f01110924a0f92f905ce97c159eb4a142f4066d` | `V14__create_patient_medical_report_vault.sql` / `7f01110924a0f92f905ce97c159eb4a142f4066d` |
| V15 | `V15__create_patient_health_timeline.sql` / `ba4edb1657e8d2841723e878093ec913c2fc99a2` | `V15__create_patient_health_timeline.sql` / `ba4edb1657e8d2841723e878093ec913c2fc99a2` |
| V16 | `V16__create_patient_booking_and_report_sharing.sql` / `9d3c73e258bbadb7692e5d1f92c5f51ebc45d01e` | `V16__create_patient_booking_and_report_sharing.sql` / `9d3c73e258bbadb7692e5d1f92c5f51ebc45d01e` |
| V17 | `V17__create_patient_notifications_and_outbox.sql` / `b5921a9654458151be6c24b816f24060773bbed0` | `V17__create_patient_notifications_and_outbox.sql` / `b5921a9654458151be6c24b816f24060773bbed0` |
| V18 | `V18__create_patient_body_measurement_history.sql` / `5a62d089c50f5e7d46439cd6e3a861ac3a909048` | `V18__create_patient_body_measurement_history.sql` / `5a62d089c50f5e7d46439cd6e3a861ac3a909048` |
| V19 | `V19__create_patient_report_extraction.sql` / `6e50f2abd50fe7b3307e38bfe6e493e1ad0aca44` | `V19__create_patient_report_extraction.sql` / `6e50f2abd50fe7b3307e38bfe6e493e1ad0aca44` |
| V20 | `V20__create_patient_report_ai_analysis.sql` / `b38ca93a07cd477cd0f5af0580ff592aa79f7559` | `V20__create_patient_report_ai_analysis.sql` / `b38ca93a07cd477cd0f5af0580ff592aa79f7559` |
| V21 | `V21__create_patient_blood_network.sql` / `e2f26edc65d9331a227cd2c22227580ccd7f43e3` | `V21__create_patient_blood_network.sql` / `e2f26edc65d9331a227cd2c22227580ccd7f43e3` |
| V22 | `V22__create_doctor_observation_reviews.sql` / `0f369a7f93e294fd88a7f86f79c46c4ec0651d2f` | `V22__create_doctor_observation_reviews.sql` / `0f369a7f93e294fd88a7f86f79c46c4ec0651d2f` |
| V23 | `V23__create_professional_profiles_and_profile_images.sql` / `03d58be74ba4e9589b4d21d371cbb9cc9653f93f` | `V23__create_professional_profiles_and_profile_images.sql` / `03d58be74ba4e9589b4d21d371cbb9cc9653f93f` |
| V24 | `V24__classify_patient_report_subjects.sql` / `e5b2e1849ab7841e36fd9fabd9d7df95b32a6cab` | `V24__classify_patient_report_subjects.sql` / `e5b2e1849ab7841e36fd9fabd9d7df95b32a6cab` |
| V25 | `V25__preserve_medical_report_observation_raw_value.sql` / `a54c571b61faa87a788bcec7e4ad42f53cbc8985` | `V25__preserve_medical_report_observation_raw_value.sql` / `a54c571b61faa87a788bcec7e4ad42f53cbc8985` |
| V26 | `V26__add_patient_report_reprocessing_history.sql` / `360b8ceff295a7c0426b1790085df63d481fa376` | `V26__add_patient_report_reprocessing_history.sql` / `360b8ceff295a7c0426b1790085df63d481fa376` |
| V27 | `V27__add_appointment_consultation_modes.sql` / `8129cc10ed947eb50e82166dfa74a79bf1333141` | `V27__create_research_domain_foundation.sql` / `8ded772226ef0ecf409d7aafc92578d6a88eabd5` |
| V28 | `V28__add_doctor_practice_location.sql` / `697729dbd8cc59f899c8c1de2e9c6be7c927ea75` | `V28__create_research_project_reviews.sql` / `597dbd9cc756c61c7fba18b50665917689695d69` |
| V29 | `V29__create_doctor_consultations.sql` / `bed5304352d2befb5e62083124cce11685339b30` | `V29__create_research_dataset_requests.sql` / `750dd6813e1da001843292bed7ce432f4ed2c030` |
| V30 | `V30__create_consultation_care_actions.sql` / `1a7a9a4b71d05de7ab7d07ac70c980b042ff1b5b` | `V30__create_research_dataset_generation_and_versions.sql` / `2e08675b64e833f754cd11dc6bd02e5cc2844381` |
| V31 | `V31__create_consultation_prescription_documents.sql` / `3dd4ba8dfbf39cdd3d1047910c8ae4ee7e173fcd` | `V31__create_ai_evaluation_runs.sql` / `1ca383c2cb9fd8833ebdf38db684d131ba0dfcce` |
| V32 | `V32__add_weekly_availability_and_default_meeting_room.sql` / `5054747dc11de38bfc15f8391c35d77473a8dd8e` | `V32__create_research_project_members.sql` / `ad405e84cb641425e5f085e766919801370ae982` |
| V33 | Absent | `V33__create_research_publications.sql` / `cc14c963b07d148434540df384205006dd7c67e2` |
| V34 | Absent | `V34__create_patient_research_consents.sql` / `a5a88f8725e626adaf26e867cc4c4dbc142f4c88` |
| V35 | Absent | `V35__research_collaboration_invitation_lifecycle.sql` / `1d4bda7b5e80dc8ca780c1c25bdb3a1a0281a717` |
| V36 | Absent | `V36__research_collaboration_workspace.sql` / `d96a90bce0fa3a89c3e7a70ca795bf855b3b2778` |
| V37 | Absent | `V37__researcher_credential_verification.sql` / `4b25c7c6ed3a7ab244d8b9fcf618390a271a8a81` |
| V38 | Absent | `V38__clinora_library_publications_restructure.sql` / `86192564ca1f5af0f4afc6eb35a6fcbead115cb3` |
| V39 | Absent | `V39__create_research_notepad_documents.sql` / `c03eea8b04586c19a464fe569cc0dc00bf310cac` |

## Appendix C — working tree preservation inventory

Original 58 paths at audit entry (42 modified, 16 untracked). The audit report itself is excluded. No staged paths were present.

```text
 M ai-service/app/api/internal_analysis.py
 M ai-service/app/model_runtime.py
 M ai-service/app/services/report_analysis_service.py
 M ai-service/tests/test_internal_analysis_api.py
 M backend/src/main/java/com/clinora/ai/service/PatientReportAiAnalysisService.java
 M backend/src/main/java/com/clinora/ai/service/PatientReportAiAnalysisWorker.java
 M backend/src/main/java/com/clinora/patients/service/PatientReportExtractionService.java
 M backend/src/main/java/com/clinora/patients/service/PatientReportExtractionWorker.java
 M docker-compose.yml
 M frontend/src/features/consultations/prescription-document-file.ts
 M frontend/src/features/doctor/doctor-layout-r3.tsx
 M frontend/src/features/patient-reports/report-processing-notice.tsx
 M frontend/src/features/patient/patient-dashboard.tsx
 M frontend/src/features/patient/patient-home.tsx
 M frontend/src/features/patient/patient-layout.tsx
 M frontend/src/pages/doctor/doctor-appointment-page.tsx
 M frontend/src/pages/doctor/doctor-clinical-inbox-page.tsx
 M frontend/src/pages/doctor/doctor-consultation-page.tsx
 M frontend/src/pages/doctor/doctor-consultation-reference-layout.test.tsx
 M frontend/src/pages/doctor/doctor-continuing-care-r2.test.tsx
 M frontend/src/pages/doctor/doctor-dashboard-r3-page.tsx
 M frontend/src/pages/doctor/doctor-patient-detail-page.test.tsx
 M frontend/src/pages/doctor/doctor-patient-detail-page.tsx
 M frontend/src/pages/doctor/doctor-patients-page.tsx
 M frontend/src/pages/doctor/doctor-report-compare-page.tsx
 M frontend/src/pages/doctor/doctor-report-review-page.tsx
 M frontend/src/pages/doctor/doctor-schedule-r3-page.tsx
 M frontend/src/pages/patient/patient-prescriptions-page.test.tsx
 M frontend/src/pages/patient/patient-prescriptions-page.tsx
 M frontend/src/pages/patient/patient-report-ai-insight-page.test.tsx
 M frontend/src/pages/patient/patient-report-ai-insight-page.tsx
 M frontend/src/pages/patient/patient-report-analysis-page.test.tsx
 M frontend/src/pages/patient/patient-report-analysis-page.tsx
 M frontend/src/pages/patient/patient-report-reference-workspaces.css
 M frontend/src/pages/patient/patient-reports-page.tsx
 M frontend/src/pages/patient/patient-reports.test.tsx
 M frontend/src/styles/patient-dashboard.css
 M frontend/vite.config.ts
 M ocr-service/Dockerfile
 M ocr-service/app/engine_v3.py
 M ocr-service/app/main.py
 M ocr-service/tests/test_engine_v3_quality.py
?? ai-service/app/services/patient_analysis_metrics.py
?? ai-service/tests/test_patient_analysis_metrics.py
?? backend/src/test/java/com/clinora/ai/service/PatientReportAiAnalysisWorkerTest.java
?? backend/src/test/java/com/clinora/patients/service/PatientReportWorkerTelemetryTest.java
?? docs/validation/patient-ai-latency-regression-audit.md
?? docs/validation/patient-ai-single-request-tuning.md
?? docs/validation/patient-ocr-ai-latency-audit.md
?? frontend/src/features/consultations/prescription-document-file.test.ts
?? frontend/src/features/doctor/doctor-navigation.test.ts
?? frontend/src/features/doctor/doctor-navigation.ts
?? ocr-service/app/performance.py
?? ocr-service/tests/golden_cases.py
?? ocr-service/tests/test_golden_fields.py
?? ocr-service/tests/test_performance.py
?? ocr-service/tests/test_timeout_capacity.py
?? scripts/start-patient-llama.ps1
```

## Appendix D — complete Shahed changed-path checklist

Diff from common base `a7bd4f23b1c733e11376c268b84f518de49e0396` to `3fa876032d74b8022ba980983b777d0fc976a289`. Every path must be retained or explicitly dispositioned during Stage 2. This includes added modules and shared files; it is not a recommendation to overwrite them wholesale.

```text
M	.env.example
A	backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountController.java
A	backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountModels.java
A	backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountService.java
A	backend/src/main/java/com/clinora/admin/researcher/AdminResearcherApiException.java
M	backend/src/main/java/com/clinora/audit/AuthAuditAction.java
M	backend/src/main/java/com/clinora/audit/AuthAuditEvent.java
M	backend/src/main/java/com/clinora/audit/AuthAuditEventRepository.java
M	backend/src/main/java/com/clinora/common/api/ApiExceptionHandler.java
A	backend/src/main/java/com/clinora/config/ResearchStorageConfig.java
A	backend/src/main/java/com/clinora/config/ResearchStorageProperties.java
M	backend/src/main/java/com/clinora/notifications/api/PatientNotificationController.java
M	backend/src/main/java/com/clinora/notifications/config/ClinoraWebSocketConfig.java
M	backend/src/main/java/com/clinora/notifications/service/NotificationDeliveryConsumer.java
M	backend/src/main/java/com/clinora/notifications/service/PatientNotificationService.java
M	backend/src/main/java/com/clinora/patients/api/PatientProfileController.java
A	backend/src/main/java/com/clinora/patients/api/PatientResearchConsentController.java
M	backend/src/main/java/com/clinora/patients/service/PatientBodyMeasurementService.java
M	backend/src/main/java/com/clinora/patients/service/PatientProfileService.java
M	backend/src/main/java/com/clinora/patients/service/PatientTimelineService.java
M	backend/src/main/java/com/clinora/profile/api/ProfileImageController.java
M	backend/src/main/java/com/clinora/profile/service/ProfileImageService.java
A	backend/src/main/java/com/clinora/research/api/AIEvaluationController.java
A	backend/src/main/java/com/clinora/research/api/AIEvaluationModels.java
A	backend/src/main/java/com/clinora/research/api/AdminDatasetRequestReviewController.java
A	backend/src/main/java/com/clinora/research/api/AdminResearchProjectModels.java
A	backend/src/main/java/com/clinora/research/api/AdminResearchProjectReviewController.java
A	backend/src/main/java/com/clinora/research/api/CohortQueryModels.java
A	backend/src/main/java/com/clinora/research/api/DatasetRequestModels.java
A	backend/src/main/java/com/clinora/research/api/DatasetStatisticsController.java
A	backend/src/main/java/com/clinora/research/api/DatasetStatisticsModels.java
A	backend/src/main/java/com/clinora/research/api/ResearchAuditController.java
A	backend/src/main/java/com/clinora/research/api/ResearchCollaborationController.java
A	backend/src/main/java/com/clinora/research/api/ResearchCollaborationModels.java
A	backend/src/main/java/com/clinora/research/api/ResearchDatasetController.java
A	backend/src/main/java/com/clinora/research/api/ResearchDatasetModels.java
A	backend/src/main/java/com/clinora/research/api/ResearchDocumentCollaborationController.java
A	backend/src/main/java/com/clinora/research/api/ResearchDocumentController.java
A	backend/src/main/java/com/clinora/research/api/ResearchDocumentModels.java
A	backend/src/main/java/com/clinora/research/api/ResearchLibraryController.java
A	backend/src/main/java/com/clinora/research/api/ResearchProjectController.java
A	backend/src/main/java/com/clinora/research/api/ResearchProjectModels.java
A	backend/src/main/java/com/clinora/research/api/ResearchPublicationController.java
A	backend/src/main/java/com/clinora/research/api/ResearchPublicationModels.java
A	backend/src/main/java/com/clinora/research/api/ResearchWorkspaceController.java
A	backend/src/main/java/com/clinora/research/api/ResearchWorkspaceModels.java
A	backend/src/main/java/com/clinora/research/api/ResearcherCohortController.java
A	backend/src/main/java/com/clinora/research/api/ResearcherCredentialController.java
A	backend/src/main/java/com/clinora/research/api/ResearcherCredentialModels.java
A	backend/src/main/java/com/clinora/research/api/ResearcherDatasetRequestController.java
A	backend/src/main/java/com/clinora/research/config/ResearchMessagingConfig.java
A	backend/src/main/java/com/clinora/research/deid/DefaultDeidentificationService.java
A	backend/src/main/java/com/clinora/research/deid/DeidentificationResult.java
A	backend/src/main/java/com/clinora/research/deid/DeidentificationService.java
A	backend/src/main/java/com/clinora/research/deid/DeidentifiedRecord.java
A	backend/src/main/java/com/clinora/research/domain/AIEvaluationRun.java
A	backend/src/main/java/com/clinora/research/domain/CohortEligibilityReport.java
A	backend/src/main/java/com/clinora/research/domain/CredentialVerificationStatus.java
A	backend/src/main/java/com/clinora/research/domain/DatasetAccessGrant.java
A	backend/src/main/java/com/clinora/research/domain/DatasetFormat.java
A	backend/src/main/java/com/clinora/research/domain/DatasetGenerationJob.java
A	backend/src/main/java/com/clinora/research/domain/DatasetRequest.java
A	backend/src/main/java/com/clinora/research/domain/DatasetRequestStatus.java
A	backend/src/main/java/com/clinora/research/domain/DatasetVersion.java
A	backend/src/main/java/com/clinora/research/domain/EligibilityCandidate.java
A	backend/src/main/java/com/clinora/research/domain/EligibilityDecision.java
A	backend/src/main/java/com/clinora/research/domain/EligibilityIneligibilityReason.java
A	backend/src/main/java/com/clinora/research/domain/EligibilityStatus.java
A	backend/src/main/java/com/clinora/research/domain/EvaluationRunStatus.java
A	backend/src/main/java/com/clinora/research/domain/EvaluationTaskType.java
A	backend/src/main/java/com/clinora/research/domain/InvitationStatus.java
A	backend/src/main/java/com/clinora/research/domain/LibraryVisibility.java
A	backend/src/main/java/com/clinora/research/domain/PatientResearchConsent.java
A	backend/src/main/java/com/clinora/research/domain/ProjectMemberRole.java
A	backend/src/main/java/com/clinora/research/domain/PublicationStatus.java
A	backend/src/main/java/com/clinora/research/domain/PublicationType.java
A	backend/src/main/java/com/clinora/research/domain/ResearchConsentStatus.java
A	backend/src/main/java/com/clinora/research/domain/ResearchDataset.java
A	backend/src/main/java/com/clinora/research/domain/ResearchDocument.java
A	backend/src/main/java/com/clinora/research/domain/ResearchDocumentComment.java
A	backend/src/main/java/com/clinora/research/domain/ResearchDocumentRevision.java
A	backend/src/main/java/com/clinora/research/domain/ResearchDocumentType.java
A	backend/src/main/java/com/clinora/research/domain/ResearchNote.java
A	backend/src/main/java/com/clinora/research/domain/ResearchNoteComment.java
A	backend/src/main/java/com/clinora/research/domain/ResearchNoteStatus.java
A	backend/src/main/java/com/clinora/research/domain/ResearchProject.java
A	backend/src/main/java/com/clinora/research/domain/ResearchProjectFile.java
A	backend/src/main/java/com/clinora/research/domain/ResearchProjectFileVersion.java
A	backend/src/main/java/com/clinora/research/domain/ResearchProjectInvitation.java
A	backend/src/main/java/com/clinora/research/domain/ResearchProjectMember.java
A	backend/src/main/java/com/clinora/research/domain/ResearchProjectReview.java
A	backend/src/main/java/com/clinora/research/domain/ResearchProjectReviewAction.java
A	backend/src/main/java/com/clinora/research/domain/ResearchProjectStatus.java
A	backend/src/main/java/com/clinora/research/domain/ResearchPublication.java
A	backend/src/main/java/com/clinora/research/domain/ResearcherCredentialVerification.java
A	backend/src/main/java/com/clinora/research/domain/catalog/ResearchCatalogVariable.java
A	backend/src/main/java/com/clinora/research/domain/catalog/ResearchDataCatalog.java
A	backend/src/main/java/com/clinora/research/exception/ResearchApiException.java
A	backend/src/main/java/com/clinora/research/exception/ResearchErrorCode.java
A	backend/src/main/java/com/clinora/research/repository/AIEvaluationRunRepository.java
A	backend/src/main/java/com/clinora/research/repository/DatasetAccessGrantRepository.java
A	backend/src/main/java/com/clinora/research/repository/DatasetGenerationJobRepository.java
A	backend/src/main/java/com/clinora/research/repository/DatasetRequestRepository.java
A	backend/src/main/java/com/clinora/research/repository/DatasetVersionRepository.java
A	backend/src/main/java/com/clinora/research/repository/PatientResearchConsentRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchDatasetRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchDocumentCommentRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchDocumentRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchDocumentRevisionRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchNoteCommentRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchNoteRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchProjectFileRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchProjectFileVersionRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchProjectInvitationRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchProjectMemberRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchProjectRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchProjectReviewRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearchPublicationRepository.java
A	backend/src/main/java/com/clinora/research/repository/ResearcherCredentialVerificationRepository.java
A	backend/src/main/java/com/clinora/research/service/AIEvaluationService.java
A	backend/src/main/java/com/clinora/research/service/AdminDatasetRequestReviewService.java
A	backend/src/main/java/com/clinora/research/service/AdminResearchProjectReviewService.java
A	backend/src/main/java/com/clinora/research/service/CohortBuilderService.java
A	backend/src/main/java/com/clinora/research/service/DatasetGenerationService.java
A	backend/src/main/java/com/clinora/research/service/DatasetGenerationWorker.java
A	backend/src/main/java/com/clinora/research/service/DatasetRequestService.java
A	backend/src/main/java/com/clinora/research/service/DatasetStatisticsService.java
A	backend/src/main/java/com/clinora/research/service/DefaultCohortBuilderService.java
A	backend/src/main/java/com/clinora/research/service/DefaultResearchDataEligibilityService.java
A	backend/src/main/java/com/clinora/research/service/DiseaseAnalyticsPolicy.java
A	backend/src/main/java/com/clinora/research/service/PatientResearchConsentService.java
A	backend/src/main/java/com/clinora/research/service/ResearchAuditService.java
A	backend/src/main/java/com/clinora/research/service/ResearchAuthorizationService.java
A	backend/src/main/java/com/clinora/research/service/ResearchCollaborationService.java
A	backend/src/main/java/com/clinora/research/service/ResearchDataEligibilityService.java
A	backend/src/main/java/com/clinora/research/service/ResearchDocumentService.java
A	backend/src/main/java/com/clinora/research/service/ResearchProjectService.java
A	backend/src/main/java/com/clinora/research/service/ResearchPublicationService.java
A	backend/src/main/java/com/clinora/research/service/ResearchWorkspaceService.java
A	backend/src/main/java/com/clinora/research/service/ResearcherCredentialService.java
A	backend/src/main/java/com/clinora/research/service/evaluation/AbnormalityDetectionMetricsCalculator.java
A	backend/src/main/java/com/clinora/research/service/evaluation/ClassificationMetricsCalculator.java
A	backend/src/main/java/com/clinora/research/service/evaluation/ExtractionMetricsCalculator.java
A	backend/src/main/java/com/clinora/research/storage/ResearchDatasetStoragePort.java
A	backend/src/main/java/com/clinora/research/storage/S3ResearchDatasetStorageAdapter.java
M	backend/src/main/java/com/clinora/users/domain/UserAccount.java
M	backend/src/main/java/com/clinora/users/repository/UserAccountRepository.java
M	backend/src/main/resources/application.yml
A	backend/src/main/resources/db/migration/V27__create_research_domain_foundation.sql
A	backend/src/main/resources/db/migration/V28__create_research_project_reviews.sql
A	backend/src/main/resources/db/migration/V29__create_research_dataset_requests.sql
A	backend/src/main/resources/db/migration/V30__create_research_dataset_generation_and_versions.sql
A	backend/src/main/resources/db/migration/V31__create_ai_evaluation_runs.sql
A	backend/src/main/resources/db/migration/V32__create_research_project_members.sql
A	backend/src/main/resources/db/migration/V33__create_research_publications.sql
A	backend/src/main/resources/db/migration/V34__create_patient_research_consents.sql
A	backend/src/main/resources/db/migration/V35__research_collaboration_invitation_lifecycle.sql
A	backend/src/main/resources/db/migration/V36__research_collaboration_workspace.sql
A	backend/src/main/resources/db/migration/V37__researcher_credential_verification.sql
A	backend/src/main/resources/db/migration/V38__clinora_library_publications_restructure.sql
A	backend/src/main/resources/db/migration/V39__create_research_notepad_documents.sql
A	backend/src/test/java/com/clinora/admin/researcher/AdminResearcherAccountControllerSecurityTest.java
A	backend/src/test/java/com/clinora/admin/researcher/AdminResearcherAccountServiceTest.java
M	backend/src/test/java/com/clinora/patients/service/PatientProfileServiceTest.java
A	backend/src/test/java/com/clinora/research/AIEvaluationServiceTest.java
A	backend/src/test/java/com/clinora/research/AdminDatasetRequestReviewServiceTest.java
A	backend/src/test/java/com/clinora/research/AdminResearchProjectReviewServiceTest.java
A	backend/src/test/java/com/clinora/research/ClinoraLibrarySecurityAndRestructureTest.java
A	backend/src/test/java/com/clinora/research/CohortBuilderServiceTest.java
A	backend/src/test/java/com/clinora/research/DatasetGenerationServiceTest.java
A	backend/src/test/java/com/clinora/research/DatasetRequestServiceTest.java
A	backend/src/test/java/com/clinora/research/DeidentificationServiceTest.java
A	backend/src/test/java/com/clinora/research/PatientResearchConsentServiceTest.java
A	backend/src/test/java/com/clinora/research/ResearchAuditServiceTest.java
A	backend/src/test/java/com/clinora/research/ResearchCollaborationServiceTest.java
A	backend/src/test/java/com/clinora/research/ResearchDataEligibilityServiceTest.java
A	backend/src/test/java/com/clinora/research/ResearchDocumentServiceTest.java
A	backend/src/test/java/com/clinora/research/ResearchDomainFoundationTest.java
A	backend/src/test/java/com/clinora/research/ResearchProjectServiceTest.java
A	backend/src/test/java/com/clinora/research/ResearchPublicationServiceTest.java
A	backend/src/test/java/com/clinora/research/ResearchSecurityLifecycleMatrixTest.java
A	backend/src/test/java/com/clinora/research/ResearchWorkspaceServiceTest.java
M	docker-compose.yml
A	docs/development/admin-researcher-account-management-plan.md
A	docs/development/clinora-library-publications-restructure.md
A	docs/development/remove-deidentified-ui-badges-plan.md
A	docs/development/research-ai-evaluation-implementation-plan.md
A	docs/development/research-notepad-collaborative-editor-plan.md
A	enable-docker-prerequisites.bat
A	enable-features.ps1
M	frontend/index.html
M	frontend/package-lock.json
A	frontend/public/assets/biomedical/researcher_3D_home_design.mp4
M	frontend/src/App.tsx
A	frontend/src/components/app/cinematic-background.tsx
A	frontend/src/features/admin/admin-layout.tsx
A	frontend/src/features/admin/admin-researchers-api.ts
M	frontend/src/features/auth/auth-navigation.ts
M	frontend/src/features/auth/auth-store.ts
M	frontend/src/features/auth/protected-route.test.tsx
M	frontend/src/features/notifications/notification-target.ts
M	frontend/src/features/notifications/patient-notification-bell.tsx
M	frontend/src/features/patient/patient-api.ts
M	frontend/src/features/patient/patient-home.tsx
M	frontend/src/features/patient/patient-profile-state.ts
M	frontend/src/features/patient/patient-profile-ui.tsx
M	frontend/src/features/patient/patient-types.ts
A	frontend/src/features/research/research-api.ts
A	frontend/src/features/research/research-credentials-api.ts
A	frontend/src/features/research/research-layout.tsx
A	frontend/src/features/research/research-status-badge.tsx
A	frontend/src/features/research/research-types.ts
M	frontend/src/pages/admin/access-reviews-page.test.tsx
M	frontend/src/pages/admin/access-reviews-page.tsx
A	frontend/src/pages/admin/admin-research-dataset-requests-page.tsx
A	frontend/src/pages/admin/admin-research-projects-page.tsx
A	frontend/src/pages/admin/admin-researcher-detail-page.tsx
A	frontend/src/pages/admin/admin-researchers-page.tsx
M	frontend/src/pages/auth/login-page.test.tsx
M	frontend/src/pages/patient/patient-notifications-page.tsx
M	frontend/src/pages/patient/patient-profile-page.tsx
A	frontend/src/pages/research/ai-evaluation-section.tsx
A	frontend/src/pages/research/dataset-detail-page.tsx
A	frontend/src/pages/research/dataset-request-detail-page.tsx
A	frontend/src/pages/research/dataset-request-form-page.tsx
A	frontend/src/pages/research/datasets-page.tsx
A	frontend/src/pages/research/project-audit-trail-section.tsx
A	frontend/src/pages/research/project-collaborators-section.tsx
A	frontend/src/pages/research/project-notepad-section.test.tsx
A	frontend/src/pages/research/project-notepad-section.tsx
A	frontend/src/pages/research/research-credentials-page.tsx
A	frontend/src/pages/research/research-dashboard-page.tsx
A	frontend/src/pages/research/research-library-page.tsx
A	frontend/src/pages/research/research-project-detail-page.tsx
A	frontend/src/pages/research/research-project-form-page.tsx
A	frontend/src/pages/research/research-projects-page.tsx
M	frontend/vite.config.ts
A	run-enable-features.bat
```

## Appendix E — old worktrees and stashes

These were inspected read-only. No missing files were restored and no worktree was cleaned up.

| Worktree | HEAD/branch | Status |
|---|---|---|
| `C:/Users/rinto/OneDrive/Documenti/ChatGPT/Clionara_AI` | HEAD 7a9f453c73a05085e661c06fea72f8defb35c3ca; branch refs/heads/ui/clinora-pre-release-ux-refinement | 42 M, 16 ?? |
| `C:/Users/rinto/AppData/Local/Temp/Clinora_AI_final_consolidation` | HEAD 7dec504035c5f8c9049f778be861d753242616c0; branch refs/heads/integration/clinora-final-consolidation | 556 D |
| `C:/Users/rinto/AppData/Local/Temp/Clinora_AI_final_integration` | HEAD 715e5d178b80640fce498cf7cba284f74cd289b9; branch refs/heads/integration/final-clinora-system | 553 D |
| `C:/Users/rinto/AppData/Local/Temp/Clinora_AI_landing_ambient_video` | HEAD 63a30d77b8ebb8c65bcf6addf71aab15029cc054; branch refs/heads/ui/animated-public-biomedical-background | 477 D |
| `C:/Users/rinto/AppData/Local/Temp/Clinora_AI_main_merge` | HEAD fa2fc054846527796cbd3869724c40e014004cb5; detached | 556 D |

Existing stash names (contents were not applied):

```text
stash@{0}: On ui/phase-6-ux-r3-clinical-product-experience: r6-work-after-phase6-separation
stash@{1}: On phase-10p-r6-real-report-medgemma-refinement: safety-backup-before-phase6-r6-separation
stash@{2}: On ui/patient-home-core-cinematic-experience: codex-preserve-pre-phase6-untracked
stash@{3}: On ui/patient-home-clinical-intelligence-visual: codex-preserve-before-phase-11-blood-network-runtime-refinement-2026-09-09
```

