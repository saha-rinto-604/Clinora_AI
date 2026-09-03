from __future__ import annotations

import json
from decimal import Decimal

from app.schemas.report_analysis import ClinicalObservation, ReportAnalysisRequest

PROMPT_VERSION = "patient-lab-report-v1"
SCHEMA_VERSION = "1.0"


def _decimal(value: Decimal | None) -> str | None:
    return None if value is None else format(value, "f")


def _observation_payload(observation: ClinicalObservation) -> dict[str, object | None]:
    return {
        "observationId": str(observation.observationId),
        "label": observation.label,
        "valueType": observation.valueType,
        "numericValue": _decimal(observation.numericValue),
        "textValue": observation.textValue,
        "comparator": observation.comparator,
        "unit": observation.unit,
        "referenceRangeRaw": observation.referenceRangeRaw,
        "referenceLow": _decimal(observation.referenceLow),
        "referenceHigh": _decimal(observation.referenceHigh),
        "rangeFlag": observation.rangeFlag,
    }


def build_messages(request: ReportAnalysisRequest) -> list[dict[str, object]]:
    observations = [_observation_payload(item) for item in request.observations]
    clinical_input = json.dumps(
        {"reportType": request.reportType, "observations": observations},
        separators=(",", ":"),
        ensure_ascii=True,
    )
    instruction = f"""
You are the Clinora patient medical-report interpretation engine powered by MedGemma.
Analyze only the structured, patient-confirmed laboratory observations supplied below.

Safety and evidence rules:
- This is decision support and patient education, not a diagnosis.
- Never claim that the patient definitely has a disease or condition.
- Never prescribe medication, provide a dosage, or tell the patient to start, stop, or change treatment.
- Never invent a laboratory value, reference range, symptom, diagnosis, medication, demographic fact, or medical history.
- Do not infer that a missing test was performed.
- A clinically plausible pattern may be proposed only when it is supported by supplied observation IDs.
- If the evidence is normal, weak, contradictory, or insufficient, return NO_CLEAR_ABNORMAL_PATTERN or INSUFFICIENT_EVIDENCE instead of forcing a diagnosis.
- Use LIMITED, MODERATE, or STRONG only as qualitative evidence-support labels. Do not generate disease probability percentages.
- Explain the result with concise evidence-linked clinical rationale. Do not reveal or describe hidden chain-of-thought.
- Suggested investigations must be framed only as topics a clinician may consider discussing with the patient.
- Keep the patientExplanation understandable to a non-clinician and explicitly communicate uncertainty.
- Keep the complete JSON response concise enough for the local output budget: prioritize at most 2 clinically
  meaningful notable findings, 1 clinical pattern, 1 discussion point, and 2 limitations.

Return exactly one JSON object and no markdown or prose outside it. The object must have exactly these fields:
{{
  "analysisStatus": "POSSIBLE_CLINICAL_PATTERN|NO_CLEAR_ABNORMAL_PATTERN|INSUFFICIENT_EVIDENCE",
  "summary": "string",
  "notableFindings": [
    {{"observationId":"uuid","title":"string","interpretation":"string"}}
  ],
  "clinicalPatterns": [
    {{
      "name":"string",
      "supportLevel":"LIMITED|MODERATE|STRONG",
      "reasoning":"string",
      "supportingObservationIds":["uuid"],
      "contradictoryObservationIds":["uuid"],
      "missingEvidence":["string"],
      "possibleCauses":["string"]
    }}
  ],
  "discussionPoints": [
    {{"type":"POSSIBLE_TEST|CLINICAL_QUESTION|FOLLOW_UP","title":"string","reason":"string"}}
  ],
  "patientExplanation":"string",
  "limitations":["string"]
}}

If analysisStatus is not POSSIBLE_CLINICAL_PATTERN, clinicalPatterns must be an empty array.

Confirmed clinical input:
{clinical_input}
""".strip()
    return [{"role": "user", "content": instruction}]
