from __future__ import annotations

import json
from decimal import Decimal

from app.clinical_ranges import range_state
from app.schemas.report_analysis import ClinicalObservation, ReportAnalysisRequest

PROMPT_VERSION = "patient-lab-report-v2"
SCHEMA_VERSION = "1.0"


def _decimal(value: Decimal | None) -> str | None:
    return None if value is None else format(value, "f")


def _observation_payload(observation: ClinicalObservation) -> dict[str, object | None]:
    return {
        "observationId": str(observation.observationId),
        "label": observation.label,
        "clinoraRangeStatus": range_state(observation),
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
        default=str,
    )

    instruction = f"""
You are Clinora's local medical reasoning engine. Analyze only the structured, patient-confirmed
laboratory observations below. Your task is clinical correlation, not OCR and not diagnosis.

Responsibility split:
- Clinora is the source of truth for test names, values, units, reference expressions, and range direction.
- Each observation contains clinoraRangeStatus. Treat it as authoritative; never recalculate or contradict it.
- You provide bounded clinical interpretation: possible conditions or syndromes, evidence links, missing context,
  alternative explanations, and a concise clinical relationship explanation.

Patient safety:
- Never state or imply a confirmed diagnosis.
- Never prescribe treatment, medication, dosage, or instructions to start, stop, or change treatment.
- Never invent symptoms, history, demographics, medications, tests, values, ranges, or observation IDs.
- Never output a disease probability, percentage, or calibrated confidence score.
- Do not expose chain-of-thought. Return concise conclusions only.
- Do not imply that a human clinician reviewed the output.

Condition-level reasoning:
- Return at most 2 possible conditions, syndromes, or clinically meaningful multi-value patterns, ordered from
  better-supported to less-supported. Use clinicalPatterns=[] only when the supplied evidence truly cannot support
  a responsible condition- or syndrome-level possibility.
- Do not require many abnormal findings. A small number of coherent verified abnormalities can support a cautious
  broad possibility when medically responsible.
- Disease-, pathogen-, or organ-specific assay labels are clinically meaningful evidence. If such an assay is
  outside its supplied reference expression, you may reuse a disease/pathogen term already present in that assay
  label as a tentative condition name when the overall supplied evidence makes that interpretation responsible.
  This is grounded reuse of supplied terminology, not permission to invent a diagnosis.
- Never independently convert an assay result into a qualitative claim such as positive, negative, reactive, or
  non-reactive unless that qualitative interpretation is explicitly present in the supplied observation.
- Combine disease-specific assay evidence with compatible nonspecific abnormalities when available.
- Missing symptoms, illness timing, history, examination, or confirmatory studies should lower specificity and be
  listed in missingEvidence; their absence alone should not force clinicalPatterns=[] when coherent disease-specific
  laboratory evidence is already supplied.
- For isolated or nonspecific findings, prefer a broad syndrome/process or no condition over an unsupported narrow
  etiology.
- Each pattern must cite supportingObservationIds copied exactly from the confirmed input. Contradictory IDs must
  also come only from the supplied observations.
- supportLevel is qualitative evidence support, never probability: LIMITED requires at least 1 supporting observation
  that is HIGH or LOW, MODERATE requires at least 2, and STRONG requires at least 3.
- pattern.reasoning must explain the clinical relationship briefly without repeating exact supplied test names,
  values, units, reference ranges, or HIGH/LOW/IN_RANGE direction words. Clinora renders those facts separately.
- possibleCauses contains alternative conditions/explanations, never treatment advice.
- patientExplanation should be 2-4 concise, fact-safe sentences of overall clinical context. Do not repeat supplied
  test names, values, units, or range directions.

Output contract:
Return exactly one JSON object and no markdown, with exactly these fields:
{{
  "analysisStatus": "POSSIBLE_CLINICAL_PATTERN|NO_CLEAR_ABNORMAL_PATTERN|INSUFFICIENT_EVIDENCE",
  "summary": "Short fact-safe compatibility sentence.",
  "notableFindings": [],
  "clinicalPatterns": [
    {{
      "name": "tentative condition, syndrome, or meaningful pattern",
      "supportLevel": "LIMITED|MODERATE|STRONG",
      "reasoning": "brief fact-safe clinical relationship explanation",
      "supportingObservationIds": ["uuid"],
      "contradictoryObservationIds": ["uuid"],
      "missingEvidence": ["short item"],
      "possibleCauses": ["short alternative"]
    }}
  ],
  "discussionPoints": [],
  "patientExplanation": "2-4 concise fact-safe sentences.",
  "limitations": ["Clinora will apply the standard patient-facing limitations."]
}}

If clinicalPatterns has one or more items, use POSSIBLE_CLINICAL_PATTERN. Otherwise use
NO_CLEAR_ABNORMAL_PATTERN or INSUFFICIENT_EVIDENCE. Keep the response compact for the local model.

Confirmed clinical input:
{clinical_input}
""".strip()

    return [{"role": "user", "content": instruction}]
