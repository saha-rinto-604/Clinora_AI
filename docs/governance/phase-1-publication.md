# Phase 1 Publication Governance

## Status

Phase 0 is approved and complete.
Phase 1 project initialization is approved and complete.
Phase 2 is not authorized.

## Publication Boundary

This repository publication contains only the Phase 1 foundation:

- React, TypeScript, Vite, and Tailwind CSS frontend startup shell.
- Spring Boot Java 21 backend startup shell.
- Empty Spring package-by-feature module boundaries.
- FastAPI OCR and AI health services.
- PostgreSQL, RabbitMQ, Redis, and Docker Compose foundation.
- Flyway dependency and empty migration location.
- Local development and CI foundation.

## Explicitly Excluded

The repository must not include Phase 2 implementation until separately authorized. Excluded work includes authentication flows, RBAC, clinical domain entities, report upload, OCR processing, AI inference, appointments, prescriptions, notifications, blood assistance, research, analytics, dashboards, and production pages.

## Governing Documents

The original governing DOCX files remain local under `Documents/` and are intentionally ignored by Git. They must not be modified, renamed, moved, regenerated, or published to GitHub as part of Phase 1 publication.

Repository documentation may summarize approved decisions, but it does not replace the local source documents.

## Approved Implementation Baseline

- Backend: Spring Boot with Java 21.
- Persistence: PostgreSQL, Spring Data JPA, Hibernate, and Flyway.
- Background messaging: RabbitMQ with Spring AMQP.
- Real-time foundation: Spring WebSocket with STOMP broker relay through RabbitMQ.
- Redis: non-authoritative ephemeral responsibilities only.
- OCR and AI: private Python 3.12 FastAPI services.
- AI inference: hosted Hugging Face only in a later authorized phase.
- `HF_MODEL` remains configurable.

Prohibited implementation technologies include NestJS, Prisma, Passport, BullMQ, Socket.IO, Express as the backend, and a Node.js backend.
