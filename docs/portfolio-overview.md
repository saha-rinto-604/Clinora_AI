# Clinora AI repository scope

Clinora AI is an in-development healthcare system with a React interface, a Spring Boot application boundary, PostgreSQL persistence, and separate Python OCR and AI services. The existing [README](../README.md) retains operational setup, environment, architecture, and testing details.

## Source-backed engineering areas

| Area | Public source | What the code establishes |
| --- | --- | --- |
| Medical reports | [PatientReportController](../backend/src/main/java/com/clinora/patients/api/PatientReportController.java) | Patient-authorized report upload, listing, and retrieval boundaries |
| OCR and AI | [OCR service](../ocr-service/), [AI service](../ai-service/README.md) | Separate service responsibilities and structured evidence contracts |
| Research interface | [Research pages](../frontend/src/pages/research) | Project, dataset, and researcher-facing UI source |
| Research APIs | [Research controllers](../backend/src/main/java/com/clinora/research/api) | Project governance, dataset access, collaboration, audit, and evaluation endpoints |
| Evaluation | [AIEvaluationService](../backend/src/main/java/com/clinora/research/service/AIEvaluationService.java) | Evaluation orchestration, task definitions, dataset access checks, and metric calculators |

Code presence does not establish production readiness, clinical effectiveness, regulatory compliance, or measured AI quality. No clinical outcomes, benchmark results, or deployment claims are made here. Research integration and evaluation should be assessed through the relevant tests and documented configuration.

## Documentation boundaries

The local governing documents remain private and unchanged. This overview derives only from public repository source and does not expand implementation authorization. The presentation refresh changes documentation and branding only; it does not change application behavior, infrastructure, model configuration, or the Spring Boot baseline.
