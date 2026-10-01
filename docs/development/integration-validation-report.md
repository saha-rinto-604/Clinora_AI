# Stage 2 executed validation

Date: 2026-10-01. Worktree: `C:/Users/rinto/.codex/worktrees/clinora-unified-2026/Clionara_AI`. Validated implementation commit: `cfdd22a1aa887ac0230ca6a6d91c0c22f1a3d18f`. Later report commits do not alter implementation.

## Automated checks

| Check | Executed command / result |
|---|---|
| Frontend clean install | `cd frontend; npm.cmd ci` passed after compatible security lockfile updates |
| TypeScript | `npm.cmd run typecheck` passed |
| Lint | `npm.cmd run lint` passed, zero errors and seven existing Fast Refresh warnings |
| Formatting | `npm.cmd run format:check` passed |
| Frontend tests | `npm.cmd test -- --run`: 57 files, 361 tests passed (two workers from configuration) |
| Frontend build | `npm.cmd run build` passed; Vite reports the existing large-bundle warning (about 2.69 MB JS, 719 KB gzip) |
| Backend | `mvn.cmd -B -f backend/pom.xml verify`: 668 tests, zero failures/errors/skips; packaged JAR |
| OCR | From `ocr-service`, original documented venv Python `-m pytest --basetemp=<private-backup>/pytest-ocr-stage2-final`: 51 passed |
| AI | From `ai-service`, original documented venv Python `-m pytest --basetemp=<private-backup>/pytest-ai-stage2-final`: 383 passed plus six subtests |
| Diff hygiene | `git diff --check` passed |
| Setup script | PowerShell AST parser reports no syntax errors; constituent startup/verification commands executed separately |

The two-worker setting is now in `vitest.config.ts`, so normal `npm test` uses the verified concurrency. No tests were disabled. The complete final 361-test run includes six Notepad regression tests, including delayed save completion after navigation and recovery. Typecheck, lint, formatting and build passed against the same final implementation. Private `frontend-tests-final.log` and `notepad-recovery-tests.log` record these results. Backend verification was repeated after the live RabbitMQ destination repair, and the successful JAR was rebuilt into the running image.

Stage 1 results were historical: clinical frontend 355 passes with 51 formatting failures; backend 461 passes and two Docker initialization errors; OCR 51 passes; AI 383 passes. Shahed's frontend had missing TipTap dependencies/typecheck/lint/test/build failures. Integration repaired those issues. Earlier integration runs caught the clinical profile identity regression, programmatic editor-load autosaves, a consultation-mode selection race, unsafe cohort filter omission and unsupported RabbitMQ topic syntax. Regression tests or live reruns verified their fixes.

The first unconstrained frontend run had three accessibility timeouts while multiple runtimes consumed resources, plus the consultation-mode race. The race was repaired without weakening the test; bounded workers eliminated the timeout contention. Both de-identification fixtures that previously used under-threshold variable groups were corrected to valid synthetic cohorts, and separate negative tests now assert rejection of small variable groups. Test constructors allowing small cohorts remain isolated; the Spring-managed constructor cannot reduce the deployment minimum below five.

## Database verification

Read-only inspection used `docker exec <retained-postgres> psql ...` with explicit read-only transactions to capture Flyway version, description, script, checksum and success. Private `existing-database-histories.json` records results. Backups used `pg_dump -Fc`; `database-backups.json` records SHA-256 and successful `pg_restore` verification.

The separate tmpfs PostgreSQL container `clinora-integration-stage2-postgres-20260930` on loopback 55439 holds disposable restore databases only. `ValidateCloneUpgrade.java` used the resolved Maven classpath and fixed clone database names, ran Flyway migration/validation and compared all original table columns using sorted row fingerprints before/after. It never points at retained databases.

| History | Result |
|---|---|
| Clinical V1–V32 retained source | Read-only inspection, backup, restore verified |
| V32 clone `clinora_integration_restore_0` | 14 migrations applied; V46 validated; 48 original tables / 4,741 rows unchanged |
| Clinical V1–V4 retained source | Read-only inspection, backup, restore verified |
| V4 clone `clinora_integration_restore_1` | 42 migrations applied; V46 validated; five original tables / zero rows unchanged |
| Fresh integration schema | All 46 migrations applied and validated by real PostgreSQL tests and actual startup; JPA validation passed |
| Retained database upgrades | Not executed; startup guard keeps unapproved histories blocked |
| Shahed-applied or unknown shared histories | No accessible representative instance; convergence/upgrade validation blocked pending history inspection and approval |

The backup manifest, dump integrity and final source-preservation evidence remain private. No real rows, passwords, access tokens or clinical records are in this report.

## Authorization and privacy evidence

| Required negative case | Evidence |
|---|---|
| Inactive/unverified Researcher | Active account/verification guard and PostgreSQL privacy lifecycle tests |
| Cross-project dataset/metadata | Central guard tests and live unauthorized metadata denial |
| Unauthorized generation/latest job | Service/controller guard tests and live unauthorized generation denial |
| Expired/revoked grant | PostgreSQL lifecycle tests and statistics authorization tests; authorization before storage reads |
| Removed member | PostgreSQL resource tests and live existing-socket delivery denial |
| Suspended access token | Live suspend → existing token denied → reactivate → same token still denied → new login succeeds |
| Suspended live WebSocket | Live broker delivery blocked while another authorized subscriber still receives the event |
| Unauthorized subscription | Live STOMP ERROR plus exact destination/wildcard tests |
| Cross-project Notepad | Service scope tests and live unauthorized document read denial |
| Stale/concurrent revision | Unit stale-save test, frontend queued/conflict/recovery tests, and real simultaneous HTTP saves yielding one 200/one 409 |
| Cross-project audit | Live `/audit-events` denial and audit service tests |
| Doctor unrelated Patient reports | Preserved clinical relationship/share authorization suites |
| OTHER report in SELF history | Preserved clinical ownership/longitudinal tests and research eligibility query tests |
| Unauthorized Admin operations | Controller security tests and live Patient-to-Admin denial |
| Minimum cohort | Real PostgreSQL contribution tests, per-variable statistics tests, live one-patient generation rejected / five-patient generation succeeds |
| Consent withdrawal/restoration | Real PostgreSQL tests and live metadata/statistics/download suspension, failed unauthorized/noncompliant restore, no auto-restoration after reconsent, explicit valid Admin restore |

The live harness recorded 24 successful research/governance HTTP checks, nine minimum-cohort checks, 19 generation/privacy checks, nine upload/OCR checks and 16 verification/AI checks (77 HTTP checks total, including polling). Five additional live WebSocket scenarios passed: unauthorized subscription, server-owned identity, removed member delivery denial, suspended account delivery denial and no revival of a revoked socket token after reactivation. These counts are HTTP assertions/polls, not 77 independent test cases.

Live accounts, projects, reports and observations were clearly labeled synthetic and existed only in the disposable integration database/storage. Four extra cohort patients and their observations were explicitly provisioned as SQL test fixtures from the synthetic upload's reviewed values. Those four are fixture seeding, not four additional end-to-end OCR runs. No fixture was placed in a retained database. Test account provisioning likewise does not count as professional onboarding/activation verification.

## Actual service and workflow launch

Executed:

```powershell
docker compose -p clinora-integration-stage2 --env-file .env.integration -f docker-compose.yml -f docker-compose.integration.yml up -d --build backend frontend ocr-service
```

Frontend 5174, Spring 8084, PostgreSQL 55440, OCR 8004, RabbitMQ, Redis, MinIO and ClamAV launched on a dedicated network/volumes. Existing projects and retained volumes were not replaced. Frontend, backend, PostgreSQL, OCR, RabbitMQ, Redis and ClamAV reported healthy; MinIO was exercised through real private upload/download. The host llama.cpp process on 8006 loaded the existing MedGemma Q4_0 model; the host AI service on 8005 reported READY. The backend-to-host inference route was proven by a completed queued analysis, not only health checks.

Patient workflow: synthetic PDF upload → malware scan/private storage → OCR SUCCEEDED with three observations → initial bulk confirmation correctly rejected while values were flagged → individual review/confirmation → report confirmation → queued MedGemma analysis SUCCEEDED → result rendered in the preserved Patient insight page. It returned `NO_CLEAR_ABNORMAL_PATTERN` for the verified synthetic input; this is a test execution, not evidence of clinical model accuracy.

Research workflow: synthetic Researcher login → project draft/submit → Admin review/approve → document create → concurrent edits/history/comments → dataset request/submit/review/approve → minimum-cohort rejection → five-subject generation/private download/statistics → consent withdrawal/suspension → explicit compliant restoration. Library metadata browse succeeded. Research AI performance evaluation remains unavailable by design because no genuine executor is configured; tests verify honest states and withheld unverified metrics.

Browser inspection covered public home/login, combined Admin navigation and professional review controls, Patient dashboard, verified report values the generated insight layout, and the Researcher project Notepad with saved document content and formatting controls. The first insight request during a deliberate backend image restart failed; reloading after backend health returned displayed the result correctly. The in-app embedded PDF pane remained blank while download and OCR worked, so source-PDF preview is not claimed as verified. Browser screenshots are private local evidence under the backup directory.

## Remaining warnings, blocked and unexecuted checks

- Full live registration → email verification and Doctor/Researcher application → email activation journeys are blocked by the intentionally unconfigured email provider. Their application, review, interview and activation service/component tests pass. Live external email was not sent.
- Doctor Gemini execution, Google Maps routing and reference-required clinical tasks were not exercised against external providers. Approved provider credentials/reference corpus are absent from this isolated setup; no provider was replaced and no new external inference integration was added.
- Research AI evaluation has no verifiable executor; unavailable states are intentional and documented rather than a passing performance claim.
- npm audit originally reported high-severity dependency issues. `npm audit fix` failed with an npm internal `edgesOut` error; targeted compatible `npm update axios brace-expansion js-yaml nanoid undici --package-lock-only` plus `npm ci` succeeded. High-severity findings are resolved; 28 moderate advisories remain in the dependency graph. No force/major update was applied. This prevents a claim of a clean dependency-security audit.
- Seven pre-existing Fast Refresh warnings and the large JS bundle warning remain. Formatting and lint errors are resolved.
- Broader desktop/mobile/browser compatibility and embedded PDF preview need follow-up. Doctor UI has automated regression coverage but no full live consultation journey through an email-activated professional account in this run.
- Unknown/shared database histories, any Shahed-applied lineage, and production upgrades/deployment are not verified. Separate lineage review/approval remains mandatory.

The local integrated system is runnable and the recorded isolated checks pass. It is not declared fully production verified. No remote push, main merge or deployment occurred.
