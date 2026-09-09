from __future__ import annotations

import json
from decimal import Decimal

from app.schemas.report_analysis import ClinicalObservation, ReportAnalysisRequest

PROMPT_VERSION = "patient-lab-report-v1"
SCHEMA_VERSION = "1.0"


def _decimal(value: Decimal | None) -> str | None:
    return None if value is None else format(value, "f")


def _range_status(observation: ClinicalObservation) -> str:
    if observation.valueType == "NUMERIC" and observation.numericValue is not None:
        if observation.referenceLow is not None and observation.numericValue < observation.referenceLow:
            return "LOW"
        if observation.referenceHigh is not None and observation.numericValue > observation.referenceHigh:
            return "HIGH"
        if observation.referenceLow is not None or observation.referenceHigh is not None:
            return "IN_RANGE"

    raw_flag = getattr(observation.rangeFlag, "value", observation.rangeFlag)
    flag = str(raw_flag or "").upper()
    if "ABOVE" in flag or flag in {"HIGH", "H"}:
        return "HIGH"
    if "BELOW" in flag or flag in {"LOW", "L"}:
        return "LOW"
    if "WITHIN" in flag or "NORMAL" in flag or "IN_RANGE" in flag:
        return "IN_RANGE"
    return "UNKNOWN"


def _observation_payload(observation: ClinicalObservation) -> dict[str, object | None]:
    return {
        "observationId": str(observation.observationId),
        "label": observation.label,
        "clinoraRangeStatus": _range_status(observation),
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
You are Clinora's local MedGemma condition-pattern inference engine.
Analyze only the structured, patient-confirmed laboratory observations below.

Responsibility split:
- Clinora is the source of truth for every laboratory value, unit, reference range, and range direction.
- MedGemma is responsible only for cautious condition-level inference: possible conditions or clinically meaningful multi-value patterns, evidence links, missing evidence, and alternative explanations.
- Do not use model-authored prose as the source of truth for LOW, HIGH, IN_RANGE, values, units, or reference ranges. Clinora renders exact values and deterministic range labels separately.
- Each observation contains clinoraRangeStatus. Treat it as authoritative and never recalculate or contradict it.
- Use clinoraRangeStatus internally to understand the pattern, but do not name any supplied analyte, value, unit, reference range, or range direction inside clinicalPatterns.reasoning.

Clinical safety rules:
- This is patient education and decision support, not a diagnosis.
- Never claim that the patient definitely has a disease or condition.
- Never prescribe medication, give a dosage, or tell the patient to start, stop, or change treatment.
- Never invent symptoms, diagnoses, medications, demographics, history, tests, values, reference ranges, or observation IDs.
- Never generate a disease probability, percentage, or calibrated-sounding confidence score.
- Do not expose hidden chain-of-thought. Provide only concise, evidence-linked conclusions.
- Do not impersonate a doctor or imply that a human clinician reviewed the AI output.

Condition-level inference rules:
- clinicalPatterns is the primary condition-prediction section. Clinora may display its condition name, evidence links, missing evidence, alternatives, and safe clinical reasoning.
- patientExplanation should provide a short fact-free overall clinical interpretation. It is especially important when clinicalPatterns is empty so the patient still receives useful pattern-level context instead of a generic fallback.
- Return at most 2 condition-level possibilities, ordered from better-supported to less-supported.
- Each pattern name must be a recognizable possible medical condition, syndrome, or clinically meaningful multi-value pattern. Do not name a single lab abnormality such as "Low MCV", "High platelets", or "Low hemoglobin" as a condition.
- Every clinical pattern must cite at least one supportingObservationId copied exactly from the confirmed input.
- Do not require many abnormal findings before offering a cautious possibility. One or more genuinely relevant abnormal observations may support a broad condition or syndrome-level possibility when medically responsible. When evidence is sparse, prefer a broader condition/syndrome over a narrow etiologic diagnosis.
- contradictoryObservationIds may contain only supplied IDs that weaken or do not fully fit the possibility.
- reasoning should explain the clinical mechanism or relationship that makes the condition/pattern plausible, but it must remain fact-free: do not repeat any supplied test name, value, unit, reference range, or LOW/HIGH/IN_RANGE direction. Example: "This pattern can occur when iron availability is insufficient for red-cell production, but the report alone cannot establish the cause."
- missingEvidence should list absent tests, history, symptoms, or context that would help distinguish or clarify the possibility. Do not claim the missing item was already measured.
- possibleCauses should contain short alternative condition/explanation names, never a laboratory finding and never treatment advice.
- If the report cannot responsibly support a condition-level possibility, return clinicalPatterns=[] instead of forcing a disease label.
- For CBC reasoning, LOW MCV is microcytic and HIGH MCV is macrocytic. Do not use vitamin B12 or folate deficiency as the primary explanation for isolated LOW MCV unless other supplied evidence independently supports it.

Output minimization rules for the local model:
- Clinora will deterministically replace summary, notableFindings, discussionPoints, limitations, analysisStatus, and supportLevel before display.
- Clinora may preserve patientExplanation only when it is fact-free and passes grounding/safety checks.
- Clinora will keep clinicalPatterns.reasoning only when it contains useful clinical interpretation and no supplied analyte/value/range facts; otherwise Clinora discards it and uses a grounded fallback.
- Keep compatibility fields minimal and neutral. Focus useful output on clinicalPatterns.name, reasoning, supportingObservationIds, contradictoryObservationIds, missingEvidence, and possibleCauses.
- Keep the complete response short enough for the local output budget.

Return exactly one JSON object and no markdown or text outside it, with exactly these fields:
{{
  "analysisStatus": "POSSIBLE_CLINICAL_PATTERN|NO_CLEAR_ABNORMAL_PATTERN|INSUFFICIENT_EVIDENCE",
  "summary": "Compatibility placeholder only; do not restate lab facts.",
  "notableFindings": [],
  "clinicalPatterns": [
    {{
      "name": "string",
      "supportLevel": "LIMITED|MODERATE|STRONG",
      "reasoning": "Clinical mechanism/relationship explanation only; do not name supplied tests, values, units, or range directions.",
      "supportingObservationIds": ["uuid"],
      "contradictoryObservationIds": ["uuid"],
      "missingEvidence": ["string"],
      "possibleCauses": ["string"]
    }}
  ],
  "discussionPoints": [],
  "patientExplanation": "2-4 concise sentences of fact-free clinical context. Do not name supplied tests, values, units, or range directions. If no condition is responsible to name, explain what broad clinical process/category the pattern may relate to and why more context is needed.",
  "limitations": ["Clinora will apply the standard patient-facing limitations."]
}}

If clinicalPatterns is empty, use NO_CLEAR_ABNORMAL_PATTERN or INSUFFICIENT_EVIDENCE.
If clinicalPatterns contains one or more items, use POSSIBLE_CLINICAL_PATTERN.
Clinora will canonicalize analysisStatus from clinicalPatterns before validation.

Confirmed clinical input:
{clinical_input}
""".strip()

    return [{"role": "user", "content": instruction}]
