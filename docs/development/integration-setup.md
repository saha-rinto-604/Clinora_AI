# Isolated Stage 2 integration setup

This branch currently runs only against disposable databases whose names begin with `clinora_integration_`. Normal retained-database startup is intentionally blocked pending lineage-specific rollout review. Do not point this setup at existing clinical or research volumes.

## Prerequisites and startup

Use Java 21, Maven, the frontend's supported Node runtime, Python 3.12 for host AI, and a running Docker Desktop with Compose supporting `!override`. Preserve existing PostgreSQL and storage volumes. From this integration checkout in PowerShell:

```powershell
.\scripts\start-isolated-integration.ps1
```

The script creates `.env.integration` only if absent, generates private local credentials, verifies that Git ignores it, runs backend verification plus frontend install/checks/tests/build, and starts the dedicated `clinora-integration-stage2` Compose project. It does not seed patient data or alter Windows features. Existing `.env.integration` is reused; do not regenerate secrets for an existing volume. Read that private file locally for the test administrator login. Never commit it or reuse its credentials in deployment.

The runtime backend Dockerfile copies the JAR produced by `mvn verify`; it does not skip tests to produce validation evidence. OCR is built from the integrated Python service. Frontend `/api` requests use Vite's backend proxy. Research datasets use a private MinIO bucket; RabbitMQ handles generation jobs and the STOMP relay. Redis remains non-authoritative. The minimum cohort is five even if a lower value is supplied to the Spring-managed de-identification service.

| Component | Isolated endpoint |
|---|---|
| Frontend | http://localhost:5174 |
| Backend | http://localhost:8084/actuator/health |
| PostgreSQL | localhost:55440, `clinora_integration_clean` |
| OCR | http://localhost:8004/health |
| Host AI | http://localhost:8005/ready |
| Host llama.cpp | http://localhost:8006/health |
| RabbitMQ | localhost:5674; management localhost:15674; STOMP localhost:61615 |
| MinIO | localhost:9010; console localhost:9011 |
| Redis / ClamAV | Private Compose network only |

Published integration ports bind to loopback. The ordinary topology remains frontend 5173, backend 8080, OCR 8000, host AI 8001 and llama.cpp 8002; integration uses separate ports to preserve existing services.

## Host AI

Keep the existing clinical host-AI topology. Start the installed llama.cpp binary using `scripts/start-patient-llama.ps1` with the existing local GGUF model and port 8006 (see that script's parameters). Do not redownload or commit weights. In a separate terminal, use the integrated `ai-service` working directory and its Python environment:

```powershell
# Set AI_INTERNAL_TOKEN to the value from this checkout's private .env.integration.
$env:LLAMA_SERVER_URL = 'http://127.0.0.1:8006'
python -m uvicorn app.main:app --host 127.0.0.1 --port 8005
```

The backend calls `host.docker.internal:8005`; this path was exercised successfully through a queued Patient analysis. Preserve `HF_MODEL` configurability. The optional AI Compose profile is not required when host AI is running. Do not start both on port 8005. Existing Doctor Gemini support is retained, but this isolated configuration provides no provider key and does not invoke it. The optional curated clinical knowledge index requires separately approved sources and explicit ingestion; an absent index is reported honestly, not populated from synthetic fixtures for clinical use.

## Database behavior and upgrade boundary

`dev,integration-clean` loads unchanged clinical V1–V32 plus isolated research V33–V46. `IntegrationMigrationSafetyConfig` rejects ordinary profiles, non-disposable database names, and existing histories without the integration marker. A database name alone is not permission to migrate an existing database. The dedicated project must use fresh volumes.

The two accessible retained databases were backed up and restore-verified. Disposable restored copies of clinical V1–V32 and V1–V4 both upgraded to V46 with original table row counts and column-content fingerprints unchanged. No retained database was upgraded. Unknown shared databases and any applied Shahed V27–V39 lineage still require read-only history inspection, verified backup, and an approved convergence plan. Never run `flyway repair`, baseline over conflicts, or delete volumes to force startup.

Consent starts unknown. No migration creates consent on behalf of existing patients. Existing versions without contribution provenance are suspended. Withdrawal preserves dataset bytes, versions, grants and audit records while blocking access. Restoration requires an active System Administrator, a recorded reason and current eligibility of every recorded contributor; reconsent alone does not restore access. The endpoint is `POST /api/v1/admin/research/dataset-versions/{versionId}/privacy-review/restore` with JSON `{"reason":"documented governance decision"}`. Previously downloaded copies cannot be recalled.

## Validation and troubleshooting

```powershell
mvn.cmd -B -f backend/pom.xml verify
Push-Location frontend
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run build
Pop-Location
docker compose -p clinora-integration-stage2 --env-file .env.integration -f docker-compose.yml -f docker-compose.integration.yml ps
```

Run each Python service's full pytest suite from its own directory using its documented environment. Use a new test-owned `--basetemp` directory, not an unknown existing directory. Docker integration tests require Docker Desktop; the test-only `docker-java.properties` selects API 1.44 for the installed Testcontainers client on Docker 29.

If login returns 429, wait for the configured limit window; do not disable rate limits. If OCR confirmation returns 409, review and confirm each flagged observation first. If a Notepad save conflicts, export the retained local draft, then explicitly reload the saved revision. Unsaved drafts survive in-app navigation only in memory and are cleared on logout/account changes; closing/reloading the browser can lose them, so heed the unload warning.

Research presence subscriptions use `/topic/research.projects.{projectId}.documents.{documentId}.presence` because RabbitMQ topic destinations cannot contain nested slash segments. Presence is sent to `/app/research/projects/{projectId}/documents/{documentId}/presence`. Account, token, membership and document scope are rechecked on delivery. Notepad content uses serialized HTTP saves with expected revisions; CRDT broadcasting remains unavailable.

Email is deliberately unconfigured in the isolated stack, so live registration/activation email delivery is unavailable. Configure an authorized email transport separately to verify the entire professional onboarding journey. Google Maps routes, approved Doctor provider calls and reference-required clinical tasks likewise depend on their approved external configuration.

Stop only this project with the same Compose arguments and `stop`. Do not use `down -v` against retained projects. This setup is for review and testing, not production deployment.
