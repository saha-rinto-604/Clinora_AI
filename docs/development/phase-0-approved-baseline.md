# Phase 0 Approved Baseline

Phase 0 is approved and complete. The local governing DOCX files remain the requirements basis and are intentionally ignored by Git.

## Authority

Project-owner decisions and implementation overrides supersede conflicting implementation references in source documents. Functional requirements, workflows, roles, permissions, security requirements, API behavior, database requirements, UI requirements, OCR workflow, AI workflow, concurrency requirements, and acceptance criteria remain valid unless explicitly superseded.

## Architecture

```text
React Frontend
    |
    | HTTPS REST and future authenticated STOMP
    v
Spring Boot Modular Monolith
    |
    |-- PostgreSQL through Spring Data JPA and Hibernate
    |-- Flyway migrations
    |-- RabbitMQ through Spring AMQP
    |-- Spring WebSocket with STOMP broker relay through RabbitMQ
    |-- Redis for non-authoritative ephemeral responsibilities
    |-- S3-compatible private object storage abstraction
    |-- OCR FastAPI Service
    `-- AI FastAPI Service
            |
            `-- Hosted Hugging Face inference in a later authorized phase
```

## Approved Roles

- `PATIENT`
- `DOCTOR`
- `HOSPITAL_ADMIN`
- `RESEARCHER`
- `BLOOD_BANK_STAFF`
- `SYSTEM_ADMIN`

## Backend Override

The backend is Spring Boot with Java 21. NestJS, Prisma, Passport, BullMQ, Socket.IO, and a Node.js backend are prohibited.

## Persistence And Messaging

- PostgreSQL is the authoritative store for clinical and business state.
- Spring Data JPA and Hibernate are used for persistence.
- Flyway controls schema migrations.
- RabbitMQ and Spring AMQP provide durable background messaging.
- Redis is limited to rate limiting, non-sensitive caching, ephemeral coordination, operational counters, justified short-lived locks, and revocation acceleration where PostgreSQL remains authoritative.

## OCR And AI

- OCR and AI are private Python 3.12 FastAPI services.
- The frontend never calls OCR, AI, PostgreSQL, RabbitMQ, Redis, storage, or Hugging Face directly.
- AI inference uses hosted Hugging Face providers in a later authorized phase.
- `HF_MODEL` and provider credentials remain configurable through environment variables.
- AI output is advisory and requires physician oversight.

## Frontend Baseline

Frontend implementation uses React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui-compatible primitives, Framer Motion, Lucide React, Recharts, React Router, React Hook Form, Zod, Zustand, and Axios.

The UI must follow the local UI/UX plan: dark biomedical SaaS, WCAG AA contrast, keyboard navigation, focus indicators, responsive behavior at 390px and above, Lucide icons, and no generic hospital-template appearance.
