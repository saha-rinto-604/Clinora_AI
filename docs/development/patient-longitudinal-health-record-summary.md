# Patient Longitudinal Health Record + Personal Health Summary

## Scope

This feature extends the existing Patient Health Record without replacing the report vault, OCR/review workflow, body measurement snapshots, timeline, appointments, or report-specific Clinora AI/MedGemma analysis.

The longitudinal Health Record is a read-only projection over existing trusted data. Lab observations come from the latest **VERIFIED** extraction of each active `SELF` report and only `PATIENT_CONFIRMED`, `PATIENT_CORRECTED`, or `DOCTOR_VERIFIED` observations may participate. Body & Vitals reuse existing `patient_body_measurement_snapshots`.

No second clinical fact store is introduced and opening Health Record never reruns OCR or calls an LLM.

## Data flow

```text
verified report observations + body measurement snapshots
  -> clinical-observation eligibility filter
  -> deterministic canonical biomarker normalization
  -> safe unit compatibility / range validation
  -> reliable-date longitudinal projection
  -> deterministic change/trend facts
  -> Health Record UI
  -> deterministic Personal Health Summary
  -> optional Gemini 2.5 Flash explanation
  -> backend-generated PDF export
```

## Clinical date safety

Medical chronology uses a reliable clinical/report date. An upload date may be shown only as a display fallback when the report date is missing. Upload-date fallback observations remain visible, but they are excluded from chronological graphs, trend/change calculations, returned-to-range logic, and period-filtered Personal Health Summaries until the report date is confirmed.

Existing report metadata editing remains the place to correct a missing report date; Health Record itself is not manually maintained.

## Eligibility and canonicalization

The Health Record projection rejects administrative/report metadata, addresses/contact text, tracking identifiers, date-only metadata, review-required rows, contaminated value/range text, and other obvious OCR noise. The source extraction is preserved for review; the projection simply refuses to treat those rows as clinical facts.

Known aliases map to stable canonical concepts, e.g. WBC variants -> `WBC`, HbA1c variants -> `HBA1C`, HCT variants -> `HEMATOCRIT`. Unknown numeric clinical tests may remain under **Other Tests**, but `Other Tests` is not a generic sink for arbitrary OCR text.

Health areas are data-driven: Body & Vitals, Blood & Hematology, Glucose & Metabolic, Lipids, Kidney & Urine, Liver, Thyroid, Inflammation, Vitamins & Nutrition, Infectious & Serology, and Other Tests only appear when eligible data exists.

## Longitudinal rules

- 1 reliable comparable result: latest value only; not enough history; no graph.
- 2 reliable comparable results: change between results, including absolute/percentage change where meaningful; not described as a long-term trend.
- 3+ reliable comparable results: may be classified as increasing, decreasing, stable, or mixed.

Range status and direction are separate. `HIGH + decreasing` does not automatically mean improving.

## Personal Health Summary

The default period is the last 12 months with 3/6/12 months, all reliably dated history, and custom ranges available. The deterministic summary includes changes over time, latest results outside supplied ranges, returned-to-range results, relatively stable multi-point histories, a concise latest-values-by-area snapshot, and source reports.

Gemini 2.5 Flash is optional wording only. It receives a minimized structured payload of canonical facts and never receives Patient identity, contact details, original PDFs, raw OCR dumps, storage keys, or administrative metadata. Provider failures never remove the deterministic summary.

The backend maps provider failures to safe reason codes and caches a generated narrative for unchanged facts/model inputs to avoid unnecessary repeated API usage.

## PDF export

`POST /api/v1/patient/health-record/summary/pdf` renders a controlled backend PDF using OpenHTMLtoPDF. Browser print chrome, localhost URLs, artificial blank pages, and the old full-page print CSS are not part of the export flow.

The PDF is intentionally concise: snapshot, optional Clinora AI Explanation, key deterministic findings, concise latest values by health area, source reports, and disclaimer.

## Configuration

Set only in local/runtime environment configuration; never commit a real key:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

The frontend never receives the API key. Docker Compose forwards the variables only to Spring Boot.

## Endpoints

- `GET /api/v1/patient/health-record/labs`
- `GET /api/v1/patient/health-record/summary/provider`
- `POST /api/v1/patient/health-record/summary`
- `POST /api/v1/patient/health-record/summary/pdf`

All endpoints remain Patient-role protected.
