# Clinora AI Agent Instructions

## Governing Order

Follow project-owner approvals and implementation overrides first, then the local governing documents in this order:

1. `Documents/Clionara_AI_SRS_full.docx`
2. `Documents/Clionara_AI_SRS_usermanual.docx`
3. `Documents/ui_ux_plan.docx`
4. `Documents/Clinora AI Codex Development Manual.docx`
5. `Documents/MedGemma_Setup_Guide.docx` as prototype-only auxiliary guidance

The `Documents/` directory is intentionally local and ignored. Do not edit, rename, move, regenerate, publish, or normalize those DOCX files.

## Approved Baseline

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui-compatible primitives, Framer Motion, Lucide React, Recharts, React Router, React Hook Form, Zod, Zustand, Axios.
- Backend: Spring Boot with Java 21, Maven, Spring Data JPA, Hibernate, PostgreSQL, Flyway, Spring Security, RabbitMQ with Spring AMQP, Spring WebSocket with STOMP broker relay through RabbitMQ, Redis for non-authoritative ephemeral responsibilities.
- Internal services: private Python 3.12 FastAPI OCR and AI services.
- AI inference: hosted Hugging Face inference only in a later authorized phase; `HF_MODEL` remains configurable.
- Roles: `PATIENT`, `DOCTOR`, `HOSPITAL_ADMIN`, `RESEARCHER`, `BLOOD_BANK_STAFF`, `SYSTEM_ADMIN`.

## Prohibited Technologies

Do not introduce NestJS, Prisma, Passport, BullMQ, Socket.IO, a Node.js backend, Material UI, Bootstrap, Font Awesome, Redux, a second frontend framework, or a broad alternate component library.

## Phase Boundaries

Phase 2A is limited to repository governance, CI foundation correction, and frontend design-system foundation primitives. Do not implement authentication, roles, dashboards, domain pages, business APIs, OCR upload, AI analysis, appointments, prescriptions, blood assistance, research, analytics, or backend behavior unless a later prompt explicitly authorizes it.

## Engineering Rules

- Keep shared UI primitives in `frontend/src/components`.
- Keep visual tokens and shared utilities in `frontend/src/styles` and `frontend/src/lib`.
- Keep pages free of business logic.
- Do not call backend, OCR, AI, PostgreSQL, RabbitMQ, Redis, storage, or Hugging Face directly from design-system primitives.
- Add tests alongside frontend primitives when implementing UI foundation work.
- Preserve the Spring Boot backend baseline.
