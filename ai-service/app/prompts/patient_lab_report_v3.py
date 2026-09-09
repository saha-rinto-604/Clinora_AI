from __future__ import annotations

import json
import re
from decimal import Decimal

from app.clinical_ranges import range_state
from app.schemas.report_analysis import ClinicalObservation, ReportAnalysisRequest

PROMPT_VERSION = "patient-lab-report-v3"
SCHEMA_VERSION = "1.0"

_POSITIVE_QUALITATIVE = {
    "abnormal",
    "detected",
    "positive",
    "present",
    "reactive",
}
_NEGATIVE_QUALITATIVE = {
    "absent",
    "negative",
    "non reactive",
    "nonreactive",
    "not detected",
}


def _decimal(value: Decimal | None) -> str | None:
    return None if value is None else format(value, "f")


def _enum_text(value: object | None) -> str | None:
    if value is None:
        return None
    return str(getattr(value, "value", value))


def _normalized_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", (value or "").lower())).strip()


def evidence_class(observation: ClinicalObservation) -> str:
    state = range_state(observation)
    if state in {"LOW", "HIGH"}:
        return "OUTSIDE_RANGE"

    value_type = _enum_text(observation.valueType) or ""
    if value_type in {"TEXT", "QUALITATIVE"} and observation.textValue:
        normalized = _normalized_text(observation.textValue)
        if normalized in _POSITIVE_QUALITATIVE:
            return "QUALITATIVE_POSITIVE"
        if normalized in _NEGATIVE_QUALITATIVE:
            return "QUALITATIVE_NEGATIVE"
        return "QUALITATIVE_REPORTED"

    if state == "IN_RANGE":
        return "IN_RANGE"
    return "UNCLASSIFIED"


def has_reasoning_signal(request: ReportAnalysisRequest) -> bool:
    return any(
        evidence_class(observation)
        in {"OUTSIDE_RANGE", "QUALITATIVE_POSITIVE", "QUALITATIVE_REPORTED"}
        for observation in request.observations
    )


def should_retry_reasoning(request: ReportAnalysisRequest) -> bool:
    """Return whether an empty first-pass differential deserves one bounded second look.

    Avoid spending a second local-model generation on a single nonspecific numeric
    abnormality. A verified qualitative positive is independently meaningful, while
    two or more usable signals can justify another condition-correlation pass.
    """

    summary = reasoning_signal_summary(request)
    if summary["qualitativePositive"] > 0:
        return True
    usable_signals = (
        summary["outsideRange"]
        + summary["qualitativePositive"]
        + summary["qualitativeReported"]
    )
    return usable_signals >= 2


def reasoning_signal_summary(request: ReportAnalysisRequest) -> dict[str, int]:
    summary = {
        "observations": len(request.observations),
        "outsideRange": 0,
        "inRange": 0,
        "qualitativePositive": 0,
        "qualitativeNegative": 0,
        "qualitativeReported": 0,
        "unclassified": 0,
    }
    key_by_class = {
        "OUTSIDE_RANGE": "outsideRange",
        "IN_RANGE": "inRange",
        "QUALITATIVE_POSITIVE": "qualitativePositive",
        "QUALITATIVE_NEGATIVE": "qualitativeNegative",
        "QUALITATIVE_REPORTED": "qualitativeReported",
        "UNCLASSIFIED": "unclassified",
    }
    for observation in request.observations:
        summary[key_by_class[evidence_class(observation)]] += 1
    return summary


def _observation_payload(observation: ClinicalObservation) -> dict[str, object | None]:
    return {
        "observationId": str(observation.observationId),
        "label": observation.label,
        "clinoraRangeStatus": range_state(observation),
        "clinoraEvidenceClass": evidence_class(observation),
        "valueType": _enum_text(observation.valueType),
        "numericValue": _decimal(observation.numericValue),
        "textValue": observation.textValue,
        "comparator": observation.comparator,
        "unit": observation.unit,
        "referenceRangeRaw": observation.referenceRangeRaw,
        "referenceLow": _decimal(observation.referenceLow),
        "referenceHigh": _decimal(observation.referenceHigh),
        "rangeFlag": _enum_text(observation.rangeFlag),
    }


def _sorted_observations(request: ReportAnalysisRequest) -> list[dict[str, object | None]]:
    rank = {
        "OUTSIDE_RANGE": 0,
        "QUALITATIVE_POSITIVE": 1,
        "QUALITATIVE_REPORTED": 2,
        "UNCLASSIFIED": 3,
        "QUALITATIVE_NEGATIVE": 4,
        "IN_RANGE": 5,
    }
    indexed = [(index, _observation_payload(item)) for index, item in enumerate(request.observations)]
    indexed.sort(key=lambda pair: (rank[str(pair[1]["clinoraEvidenceClass"])], pair[0]))
    return [item for _, item in indexed]


def _clinical_input(request: ReportAnalysisRequest) -> str:
    return json.dumps(
        {
            "reportType": request.reportType,
            "observations": _sorted_observations(request),
        },
        separators=(",", ":"),
        ensure_ascii=True,
        default=str,
    )


def _output_contract() -> str:
    return """
Return exactly one JSON object and no markdown or text outside it, with exactly these fields:
{
  "analysisStatus": "POSSIBLE_CLINICAL_PATTERN|NO_CLEAR_ABNORMAL_PATTERN|INSUFFICIENT_EVIDENCE",
  "summary": "short neutral compatibility sentence",
  "notableFindings": [],
  "clinicalPatterns": [
    {
      "name": "recognizable possible condition or syndrome",
      "supportLevel": "LIMITED|MODERATE|STRONG",
      "reasoning": "brief clinical mechanism/relationship explanation without copying report facts",
      "supportingObservationIds": ["uuid copied exactly from input"],
      "contradictoryObservationIds": ["uuid copied exactly from input"],
      "missingEvidence": ["missing symptom/history/test/context"],
      "possibleCauses": ["alternative condition or explanation"]
    }
  ],
  "discussionPoints": [],
  "patientExplanation": "1-2 concise sentences of clinical context without copying report facts",
  "limitations": ["Clinora will apply the standard patient-facing limitations."]
}
""".strip()


def _base_instruction(request: ReportAnalysisRequest) -> str:
    return f"""
You are Clinora AI's local medical reasoning engine for verified laboratory reports.
The report facts below were already extracted and confirmed before they reached you. Do not perform OCR and do not change any supplied fact.

Main task:
- Use general medical knowledge to decide whether the COMBINATION of verified findings supports up to 2 medically plausible possible conditions or clinically meaningful syndromes/patterns.
- Do real clinical correlation. Do not merely paraphrase which results are high, low, positive, negative, or normal.
- A condition name does NOT need to appear in a test label. Infer cautiously from the combined laboratory pattern when medically responsible.
- Prefer the most specific responsibly supported possibility. When the report is sparse or nonspecific, prefer a broader syndrome/process over a narrow etiologic diagnosis.
- Missing symptoms, illness timing, history, examination, or confirmatory tests belong in missingEvidence. Their absence should reduce specificity, not automatically erase a supported laboratory possibility.

Grounding rules:
- clinoraRangeStatus and every supplied value/unit/reference are immutable Clinora facts. Never recalculate or contradict them.
- clinoraEvidenceClass is a prioritization hint: OUTSIDE_RANGE and QUALITATIVE_POSITIVE are stronger signals; QUALITATIVE_REPORTED can carry clinical meaning; IN_RANGE and QUALITATIVE_NEGATIVE can provide context or contradiction; UNCLASSIFIED must not be described as high/low/normal.
- Every proposed condition must cite one or more supportingObservationIds copied exactly from the input. Cite contradictoryObservationIds when supplied findings weaken the possibility.
- Do not invent symptoms, history, medications, demographics, tests, values, ranges, or observation IDs.
- If no condition or syndrome is responsibly supportable after considering the full pattern, return clinicalPatterns=[] and give useful broad clinical context in patientExplanation.

Patient-safety rules:
- These are possible conditions to discuss, never a diagnosis or confirmation.
- Never provide treatment, dosage, start/stop medication instructions, or a disease probability/confidence percentage.
- Keep reasoning concise. Do not expose hidden chain-of-thought.
- clinicalPatterns.reasoning should explain the medical relationship/mechanism without repeating supplied test names, values, units, or range directions; Clinora renders the exact evidence separately.

{_output_contract()}

Verified clinical evidence:
{_clinical_input(request)}
""".strip()


def build_messages(request: ReportAnalysisRequest) -> list[dict[str, object]]:
    return [{"role": "user", "content": _base_instruction(request)}]


def build_reasoning_retry_messages(request: ReportAnalysisRequest) -> list[dict[str, object]]:
    retry_instruction = f"""
You are Clinora AI's medical reasoning engine. A previous pass returned no condition-level pattern even though this verified report contains one or more clinically usable signals.

Re-evaluate the SAME verified evidence once, carefully and independently:
- Do not force a disease label.
- Ask whether the combined findings support a broad condition, syndrome, physiologic process, or a more specific condition using general medical knowledge.
- Do not require the condition name to appear in a test label.
- Missing history/symptoms/timing should lower specificity and go in missingEvidence; they are not an automatic reason to return an empty differential.
- If a responsible possibility exists, return at most 2 clinicalPatterns with exact supporting observation IDs.
- If the evidence is genuinely nonspecific after this second look, clinicalPatterns=[] is correct; explain the broad process/category in patientExplanation instead of inventing a condition.
- Preserve all grounding and patient-safety rules: no diagnosis certainty, no treatment/dose advice, no invented report facts, no probability percentages.

{_output_contract()}

Verified clinical evidence:
{_clinical_input(request)}
""".strip()
    return [{"role": "user", "content": retry_instruction}]
