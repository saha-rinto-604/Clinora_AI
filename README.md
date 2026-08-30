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

1. Copy `.env.example` to `.env` and configure the local development values required by the current stack.
2. Build and start the Docker Compose stack:

```powershell
docker compose up --build -d
```

3. Check service status:

```powershell
docker compose ps
```

## Health Checks

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080/actuator/health`
- OCR: `http://localhost:8000/health`
- AI: `http://localhost:8001/health`
- RabbitMQ Management: `http://localhost:15672`

## Development Documentation

Detailed phase implementation records live under `docs/development/`. Phase-specific security and architecture boundaries documented there remain authoritative for their respective scopes.
