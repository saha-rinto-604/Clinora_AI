# Clinora AI Stage 2 integration report

Review date: 2026-10-01. Branch: `integration/clinora-unified-2026`.

Validated implementation HEAD: `cfdd22a1aa887ac0230ca6a6d91c0c22f1a3d18f`. Subsequent handover commits contain documentation only; obtain the final delivery HEAD with `git rev-parse HEAD`. The final chat handover records that SHA. This distinction avoids a self-referential commit hash in a committed report.

## Sources and preservation

| Source | Exact audited commit |
|---|---|
| Clinical `ui/clinora-pre-release-ux-refinement` | `7a9f453c73a05085e661c06fea72f8defb35c3ca` |
| `origin/shaheds-branch` | `3fa876032d74b8022ba980983b777d0fc976a289` |
| `main` reference | `40ca5af919ba63a521cc0340b33879eab7d4a64d` |
| Shared ancestor | `a7bd4f23b1c733e11376c268b84f518de49e0396` |

The original checkout remains unchanged. The audited 42 modified and 16 untracked paths were backed up as actual files plus patches, verified, replayed into a new managed worktree, and committed separately. The additional Stage 1 audit report makes 59 files in the private Stage 2 backup. Final hash verification confirms all 59 originals, five governing DOCX files, four stashes and the clinical source HEAD are unchanged. Ignored credentials, database dumps, model weights and patient documents were not copied into Git.

Private recovery evidence is under `C:/Users/rinto/.codex/clinora-integration-backups/stage2-20260930`: `manifest.json`, `files/`, tracked/staged patches, database dumps and verification logs. These are local recovery materials, not repository deliverables. Preserve this directory privately.

The [preservation matrix](stage2-feature-preservation-matrix.md) accounts for all 238 Shahed paths and all 58 protected clinical paths. It records 161 source files integrated unchanged, 74 integrated with adaptation and three intentional exclusions. The excluded Windows elevation scripts are `enable-docker-prerequisites.bat`, `enable-features.ps1` and `run-enable-features.bat`; changing Windows optional features is outside the approved work and Docker is already available. Their originals remain in the audited Git commit.

## Local checkpoints and conflict resolutions

| Checkpoint | Purpose |
|---|---|
| `1edf70a` | Preserve all audited clinical working-tree changes before integration |
| `ada5e50` | Import the research backend while retaining clinical approval flows |
| `caeb04d` | Centralize research authorization, consent lifecycle, evaluation integrity and revision protection |
| `fccef45` | Enforce approved filters, variable cohorts, migration startup guards and RabbitMQ-compatible destinations |
| `65fd138` | Integrate frontend roles/navigation, TipTap, safe draft handling and isolated setup |
| `cfdd22a` | Preserve newer recovered drafts when previous-view saves complete; retain drafts on reload failure |

Integration used the shared ancestor and exact audited sources with explicit reconciliation, not a blind directory replacement or blanket conflict strategy. Local checkpoint commits deliberately record the import rather than marking Shahed's entire branch history as merged. There has been no fetch of newer source changes, remote push, main merge or deployment.

Clinical Patient/Doctor pages and protected OCR/AI latency changes remain the baseline. App routes are the union of clinical and Research/Admin routes, including Doctor notifications. Shahed's Admin shell retains the existing professional access queue, Doctor interviews and Researcher onboarding alongside project reviews, dataset reviews and ongoing Researcher account governance. Consent is a separate Patient privacy preference; it does not inflate health-profile completeness or permit Patient account-name edits through the health profile.

Frontend dependencies preserve React 19/Vite/Tailwind and the established primitives. The explicitly approved TipTap 2.27.1 dependencies repair the missing editor packages. Compatible lockfile updates address high-severity npm advisories without force-upgrading major versions. Formatting changes are bounded to integrated/protected work and the remaining 20 baseline format failures; `endOfLine: auto` handles Windows worktree endings without rewriting unrelated files. DOM test workers are capped at two to keep accessibility tests reliable while Docker and inference run.

## Database decisions

Two accessible retained PostgreSQL databases were inspected read-only. `clinora-ai-postgres-1/clinora` follows clinical V1–V32; `clionara_ai-postgres-1/clinora` follows V1–V4. Their `postgres` maintenance databases have no Flyway history. Neither accessible history contains Shahed's conflicting research lineage. This does not establish the state of unknown/shared databases.

Both databases have custom-format `pg_dump` backups with SHA-256 manifests and successful restore verification. Their disposable restores upgraded to V46: 14 migrations on the V32 clone and 42 on the V4 clone. Every original column-content fingerprint and row count was preserved: 48 tables/4,741 rows on the V32 clone, five tables/zero rows on the V4 clone. Clinical V1–V32 remain unchanged after Git line-ending normalization and were not edited. No retained database was upgraded and no Flyway history was repaired or overwritten.

Shahed's V27–V39 are mapped in dependency order to V33–V45 in `db/integration-clean`, separate from the production migration location. V40 defaults consent to UNKNOWN and removes automatic consent seeding. V44 preserves historical outputs as private drafts without fabricated authors. New V46 records token revocations, contributed-patient lineage and version privacy reviews; legacy versions without lineage are suspended. The explicit integration profile and database identity/history guard allow fresh isolated startup and reject unreviewed retained histories.

## Security and research privacy

`ResearchAccessGuard` applies current account status, verified Researcher role, token issue-time cutoff, project scope/lifecycle, active membership, explicit unexpired/unrevoked grants, dataset lifecycle and version privacy. Dataset owners do not bypass grants. Generation requests, job metadata, lists, versions, bytes, statistics, evaluation and safe references use these checks. Research REST and WebSocket paths recheck active access rather than relying only on a previously issued JWT.

Generation requires at least five distinct consenting eligible patients, not five observations; each exported variable also meets the threshold. Approved observation predicates are parameterized and reapplied during generation. Malformed/unknown criteria fail closed. Demographic-only requests do not export unrequested clinical values. Statistics suppress unsafe groups, complements and partitions, and coarsen histograms as needed. Existing SELF/OTHER eligibility, verification and archive boundaries remain in the query. Cohort preview query failures report unavailability instead of inventing a zero result.

Consent updates, generation and restoration use a transactional advisory lock. Withdrawal records audit events and suspends affected versions immediately while preserving bytes, versions, grants and history. Metadata, statistics, downloads and evaluations are denied. Reconsent does not lift suspension. An active System Administrator must record a reason and satisfy current contributor eligibility before restoration. Live tests verified generation rejection at one patient, success at five synthetic patients, private download, withdrawal blocking, unauthorized restoration denial, denied restoration while consent is absent, continued suspension after reconsent and explicit approved restoration.

The current policy conservatively blocks an entire dataset if any version is unsafe. An unsafe historical version may require a separate compliant replacement dataset rather than automatic reactivation. Contribution lineage is restricted backend governance data. Minimum five and pseudonymization are not a claim of anonymity: repeated-query/differencing risk and quasi-identifiers still require protocol review, controlled access and export governance. Previously downloaded copies cannot automatically be recalled. A request already delivering bytes cannot retract bytes already transmitted.

## Collaboration, Library and AI integrity

Notepad writes lock the document and require its expected revision for edit, rename, archive and restoration. Restoring creates a new revision. Frontend saves are serialized; edits arriving during a save use the returned revision for the next save. A conflict pauses saving and retains the draft. A save completing after navigation clears only its matching cached content, preserving newer recovered edits; failed reloads retain the local draft. Export and explicit reload are available. In-memory recovery survives workspace navigation and is cleared on logout/account changes; browser closure/reload remains a limitation, surfaced by an unload warning. Live simultaneous updates produced exactly one 200 and one 409.

CRDT edit broadcasting is disabled in favor of this approved revision mode. Presence uses authenticated server identity. RabbitMQ requires dot-separated research topic routing keys; the inherited nested slash topic was repaired after a live broker test. Exact destination patterns reject wildcards and cross-document/project scopes. Every outbound delivery rechecks current token/account/membership permissions. Live tests confirmed unauthorized subscription denial, spoofed identity replacement, blocked delivery after membership removal, blocked delivery after suspension and continued denial after account reactivation with a revoked socket token.

Clinora Library retains metadata, methodology, citations, ownership and authorized references, with private draft defaults and no invented authorship. Evaluation records, history and UI remain available, but no real research evaluator is configured. Creation returns an honest failed/unavailable state, and unverified historical metrics are withheld without deleting stored records. No random or fabricated metrics are presented as executed performance.

Clinical Patient MedGemma inference remains functional and was executed through the backend queue with verified synthetic observations. Existing Doctor Gemini support is retained without expansion or provider changes. The isolated configuration supplies no Doctor provider key. The optional clinical knowledge corpus is unavailable; required-reference tasks remain limited until an approved corpus is ingested.

## Design and remaining release boundaries

Canonical branding, Patient cinematic/clinical pages, accepted Doctor layouts, Shahed's Researcher workspace and Admin personality are preserved. No new frontend framework or broad UI library was introduced. Browser checks covered the public/login pages, Admin research and professional-review navigation, the Patient report/insight workflow, and the integrated Researcher Notepad with its saved document and formatting controls. The embedded source PDF viewer was blank in the in-app browser during inspection, while download, OCR and verified-value rendering worked; native PDF preview across supported browsers needs follow-up. This is recorded rather than treated as a verified visual pass.

See [validation](integration-validation-report.md) for precise results and [setup](integration-setup.md) for runnable commands. Production readiness is not claimed. Remaining external gates are unknown/shared database lineage review and retained rollout approval, authorized email delivery/complete live professional activation, approved Doctor provider configuration, approved clinical knowledge sources, remaining moderate npm advisories and broader browser/device validation. No additional approval is needed for the completed local work; retained rollout, external configuration, push or main merge require separate authorization.
