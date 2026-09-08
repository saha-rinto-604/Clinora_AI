# Clinora AI

Clinora AI is a role-aware healthcare platform under phased development. The repository includes the completed authentication/security foundation, the completed Phase 5A Patient Foundation, and the Phase 5B private Patient Medical Report Vault implementation.

## Current Development Status

- Phase 4: identity, authentication, RBAC, privileged onboarding, access review, professional activation, and security publication gate completed.
- Phase 5A: Patient Foundation completed and merged to `main` on 2026-08-30.
- Phase 5B: private Patient Medical Report Vault completed and publication-verified on 2026-08-31.

Phase 5B extends the existing Patient workspace with real private report upload, organization, authenticated viewing and download, metadata editing, archive/restore, and Patient Home summary data. OCR, AI interpretation, Doctor access, sharing, and fake processing states remain outside this phase.

## Approved Baseline

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4
- Backend: Spring Boot, Java 21, Maven
- Database: PostgreSQL, Spring Data JPA, Hibernate, Flyway
- Messaging: RabbitMQ with Spring AMQP and STOMP plugin
- Real time: Spring WebSocket with STOMP broker relay through RabbitMQ
- Cache/rate limits: Redis
- OCR: Python 3.12, FastAPI
- AI: Python 3.12, FastAPI

## Local Startup

Use the repository-root `.env` as the canonical local configuration. On first setup, copy `.env.example`
if `.env` does not already exist and configure its values. Keep
`COMPOSE_AI_SERVICE_URL=http://host.docker.internal:8001` and the shared `AI_INTERNAL_TOKEN` there.

1. Start Docker Desktop, then from the repository root:

```powershell
docker compose up -d
```

This starts frontend (:5173), backend (:8080), OCR (:8000), Postgres, RabbitMQ, Redis, MinIO, and ClamAV.
Docker AI is opt-in and does not claim port 8001 during default startup. Use `docker compose up -d --build`
after source/dependency changes. The backend can start while external AI is unavailable.

2. In a separate terminal start llama.cpp:

```powershell
llama-server -hf gguf-org/medgemma-1.5-4b-it-gguf:Q4_0 --no-mmproj --device Vulkan1 --gpu-layers auto --fit on --parallel 1 -c 8192 --host 127.0.0.1 --port 8002
```

3. In another terminal, from repository root (with the [AI virtual environment](ai-service/README.md) installed):

```powershell
cd ai-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --log-level info
```

FastAPI automatically loads root `.env`; explicit process environment variables take precedence.

4. Verify and open `http://localhost:5173`:

```powershell
Invoke-RestMethod 'http://127.0.0.1:8002/health'
Invoke-RestMethod 'http://127.0.0.1:8001/ready'
docker compose ps
docker compose exec backend printenv AI_SERVICE_URL
```

The backend URL must be `http://host.docker.internal:8001`.
Alternatively, `.\start-clinora-local.ps1` (optionally `-Rebuild`) starts/checks the eight Docker services,
stops a previously opted-in Docker AI container, and reports external AI readiness without launching or killing
Windows AI processes. AI unavailability does not block the Docker stack.

Docker AI remains available through the explicit `container-ai` profile; see its
[requirements and return-to-manual instructions](ai-service/README.md#optional-container-ai).

## Health Checks

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080/actuator/health`
- OCR: `http://localhost:8000/health`
- Manual FastAPI: `http://127.0.0.1:8001/health` (process), `http://127.0.0.1:8001/ready` (llama.cpp readiness)
- RabbitMQ Management: `http://localhost:15672`

## Development Documentation

Detailed phase implementation records live under `docs/development/`. Phase-specific security and architecture boundaries documented there remain authoritative for their respective scopes.
