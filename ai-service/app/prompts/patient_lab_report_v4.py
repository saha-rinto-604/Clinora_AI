from __future__ import annotations

import json
import re
from decimal import Decimal
from typing import Any

from app.clinical_ranges import range_state
from app.clinical_evidence import evidence_class, is_strong_evidence
from app.schemas.report_analysis import ClinicalObservation, ReportAnalysisRequest

PROMPT_VERSION = "patient-lab-report-v4"
SCHEMA_VERSION = "1.0"

_MAX_CANDIDATES = 2
_MAX_EVIDENCE_IDS = 10
_MAX_LIST_ITEMS = 8
_UUID_PATTERN = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-"
    r"[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b"
)


class CandidateOutputError(ValueError):
    pass


def _decimal(value: Decimal | None) -> str | None:
    return None if value is None else format(value, "f")


def _enum_text(value: object | None) -> str | None:
    if value is None:
        return None
    return str(getattr(value, "value", value))


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


def _clinical_input(request: ReportAnalysisRequest) -> str:
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
    return json.dumps(
        {
            "reportType": request.reportType,
            "observations": [item for _, item in indexed],
        },
        separators=(",", ":"),
        ensure_ascii=True,
        default=str,
    )


def _candidate_contract() -> str:
    return """
Return exactly one JSON object and no markdown:
{
  "candidates": [
    {
      "name": "recognizable possible condition, syndrome, or physiologic process",
      "rationale": "1-2 concise sentences explaining the medical relationship without copying exact report values",
      "supportingObservationIds": ["uuid copied exactly from input"],
      "contradictoryObservationIds": ["uuid copied exactly from input"],
      "missingEvidence": ["missing symptom/history/test/context"],
      "alternatives": ["alternative condition or explanation"]
    }
  ],
  "noCandidateReason": "short reason only when candidates is empty"
}
""".strip()


def build_messages(request: ReportAnalysisRequest) -> list[dict[str, object]]:
    instruction = f"""
You are Clinora AI's local clinical-correlation engine. The laboratory observations below were already extracted and patient-verified. Do not perform OCR and do not rewrite the report.

Your ONLY job in this call is to identify 0-2 medically plausible condition-level, syndrome-level, or physiologic-process candidates that could explain the verified laboratory pattern.

Reasoning rules:
- Use general medical knowledge and correlate the COMBINATION of findings; do not merely restate which values are abnormal.
- A candidate name does not need to appear in a test label. Infer cautiously from the overall laboratory pattern when medically responsible.
- Disease-, pathogen-, organ-, antibody-, antigen-, hormone-, enzyme-, and other clinically specific assay labels can be meaningful evidence, but do not invent a qualitative interpretation that is not supplied.
- clinoraRangeStatus and the supplied report facts are authoritative. Never contradict values, units, references, or range direction.
- UNCLASSIFIED does not mean normal. Such observations may provide context, but you must not call them high/low/normal unless Clinora supplied that status.
- When multiple coherent verified abnormalities or positive qualitative findings exist, prefer a responsible broad syndrome/process or condition candidate over an empty list when medical knowledge supports one.
- Return an empty candidates list only when no responsible condition/syndrome/process can be supported from the supplied evidence.

Grounding rules:
- Every candidate must cite at least one supportingObservationId copied exactly from the input.
- supportingObservationIds are for verified OUTSIDE_RANGE or explicit QUALITATIVE_POSITIVE evidence only. Do not use IN_RANGE, QUALITATIVE_NEGATIVE, or UNCLASSIFIED observations as positive support.
- A single highly informative verified finding may support a cautious LIMITED candidate when general medical knowledge makes that medically responsible; do not require an arbitrary number of abnormalities.
- Use contradictoryObservationIds only for supplied findings that genuinely weaken the candidate. Normal findings are often neutral, so do not automatically treat every IN_RANGE observation as contradictory.
- Put missing symptoms, illness timing, history, examination, or confirmatory tests in missingEvidence; missing context lowers specificity but is not automatically a reason to erase a laboratory-supported possibility.
- Do not invent symptoms, demographics, history, medications, tests, values, ranges, or IDs.

Patient-safety rules:
- A candidate is a possibility to discuss, never a diagnosis or confirmation.
- Do not provide treatment, dosage, or start/stop medication advice.
- Do not output probability percentages or diagnostic confidence scores.
- Keep rationale concise; do not expose hidden chain-of-thought.

{_candidate_contract()}

Verified clinical evidence:
{_clinical_input(request)}
""".strip()
    return [{"role": "user", "content": instruction}]


def build_repair_messages(request: ReportAnalysisRequest, reason: str) -> list[dict[str, object]]:
    instruction = f"""
The previous Clinora AI candidate response could not be parsed safely ({reason}). Return the candidate JSON contract exactly once, with no markdown and no text outside JSON.

{_candidate_contract()}

Use only these verified observations:
{_clinical_input(request)}
""".strip()
    return [{"role": "user", "content": instruction}]


def parse_candidate_output(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < start:
        raise CandidateOutputError("MODEL_CANDIDATE_JSON_MISSING")
    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise CandidateOutputError("MODEL_CANDIDATE_JSON_INVALID") from exc
    if not isinstance(parsed, dict):
        raise CandidateOutputError("MODEL_CANDIDATE_ROOT_INVALID")
    return parsed


def _clean_string(value: object, *, max_length: int) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value).strip()[:max_length]


def _clean_string_list(value: object, *, max_items: int = _MAX_LIST_ITEMS, max_length: int = 220) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        text = _clean_string(item, max_length=max_length)
        if text and text not in result:
            result.append(text)
        if len(result) >= max_items:
            break
    return result


def _clean_ids(value: object, allowed: set[str]) -> tuple[list[str], int]:
    if not isinstance(value, list):
        return [], 0
    result: list[str] = []
    invalid_count = 0
    for item in value:
        candidate = str(item).strip()
        if not candidate:
            continue
        if candidate not in allowed:
            invalid_count += 1
            continue
        if candidate not in result:
            result.append(candidate)
        if len(result) >= _MAX_EVIDENCE_IDS:
            break
    return result, invalid_count


def _support_level(request: ReportAnalysisRequest, ids: list[str]) -> tuple[str | None, int]:
    by_id = {str(item.observationId): item for item in request.observations}
    strong_count = sum(
        1
        for observation_id in ids
        if observation_id in by_id and is_strong_evidence(by_id[observation_id])
    )
    if strong_count <= 0:
        return None, 0
    if strong_count >= 3:
        return "STRONG", strong_count
    if strong_count == 2:
        return "MODERATE", strong_count
    return "LIMITED", strong_count


def _fact_safe_rationale(request: ReportAnalysisRequest, rationale: str, support_count: int) -> str:
    """Preserve MedGemma's clinical interpretation while keeping report facts authoritative.

    Exact numeric values and internal observation IDs are not trusted in model-authored
    prose. Lab names and correct directional language are intentionally allowed here so
    the downstream Clinora grounding pass can fact-check them instead of replacing useful
    medical reasoning with a generic OCR-style sentence.
    """

    numeric_tokens = {
        format(item.numericValue, "f")
        for item in request.observations
        if item.numericValue is not None
    }
    copied_numeric_fact = any(
        token and re.search(rf"(?<![0-9.]){re.escape(token)}(?![0-9.])", rationale)
        for token in numeric_tokens
    )
    if rationale and not copied_numeric_fact and not _UUID_PATTERN.search(rationale):
        return rationale[:700]
    if support_count >= 3:
        return "Multiple verified laboratory findings form a clinically coherent pattern that can be compatible with this possibility, although clinical context is still required."
    if support_count == 2:
        return "More than one verified laboratory finding supports a clinically coherent pattern that can be compatible with this possibility, although clinical context is still required."
    return "A verified laboratory finding provides limited support for this possibility, and additional clinical context is needed before drawing a conclusion."


def _candidate_source(parsed: dict[str, Any]) -> list[object]:
    candidates = parsed.get("candidates")
    if isinstance(candidates, list):
        return candidates
    # Backward-compatible acceptance of existing test/runtime fixtures while the
    # production v4 prompt asks only for the compact candidate contract.
    patterns = parsed.get("clinicalPatterns")
    return patterns if isinstance(patterns, list) else []


def _notable_findings(request: ReportAnalysisRequest) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for observation in request.observations:
        state = range_state(observation)
        category = evidence_class(observation)
        interpretation: str | None = None
        if state == "LOW":
            interpretation = "This verified result is lower than the supplied reference range."
        elif state == "HIGH":
            interpretation = "This verified result is higher than the supplied reference range."
        elif category == "QUALITATIVE_POSITIVE" and observation.textValue:
            interpretation = f"This verified result was reported as {observation.textValue}."
        if interpretation:
            findings.append(
                {
                    "observationId": str(observation.observationId),
                    "title": observation.label,
                    "interpretation": interpretation,
                }
            )
        if len(findings) >= 8:
            break
    return findings


def model_payload_from_candidate_output(
    request: ReportAnalysisRequest,
    raw_or_parsed: str | dict[str, Any],
) -> tuple[dict[str, object], dict[str, int | str]]:
    parsed = parse_candidate_output(raw_or_parsed) if isinstance(raw_or_parsed, str) else raw_or_parsed
    allowed = {str(item.observationId) for item in request.observations}
    raw_candidates = _candidate_source(parsed)
    grounded_candidates: list[dict[str, object]] = []
    rejected = 0
    discarded_evidence = 0

    for raw_candidate in raw_candidates[:_MAX_CANDIDATES]:
        if not isinstance(raw_candidate, dict):
            rejected += 1
            continue
        name = _clean_string(raw_candidate.get("name"), max_length=140)
        supporting_raw, invalid_support_count = _clean_ids(
            raw_candidate.get("supportingObservationIds"), allowed
        )
        contradictory, invalid_contradiction_count = _clean_ids(
            raw_candidate.get("contradictoryObservationIds"), allowed
        )

        by_id = {str(item.observationId): item for item in request.observations}
        # Evidence-level pruning is deliberate: one neutral/in-range observation or one
        # hallucinated ID must not erase an otherwise well-grounded MedGemma candidate.
        supporting = [
            observation_id
            for observation_id in supporting_raw
            if observation_id in by_id and is_strong_evidence(by_id[observation_id])
        ]
        contradictory = [
            observation_id
            for observation_id in contradictory
            if observation_id not in supporting
        ]
        discarded_evidence += (
            invalid_support_count
            + invalid_contradiction_count
            + (len(supporting_raw) - len(supporting))
        )

        support_level, support_count = _support_level(request, supporting)
        if not name or not supporting or support_level is None:
            rejected += 1
            continue
        rationale = _clean_string(
            raw_candidate.get("rationale", raw_candidate.get("reasoning")),
            max_length=700,
        )
        missing = _clean_string_list(raw_candidate.get("missingEvidence"))
        alternatives = _clean_string_list(
            raw_candidate.get("alternatives", raw_candidate.get("possibleCauses")),
            max_items=6,
        )
        grounded_candidates.append(
            {
                "name": name,
                "supportLevel": support_level,
                "reasoning": _fact_safe_rationale(request, rationale, support_count),
                "supportingObservationIds": supporting,
                "contradictoryObservationIds": contradictory,
                "missingEvidence": missing,
                "possibleCauses": alternatives,
            }
        )

    notable = _notable_findings(request)
    if grounded_candidates:
        names = [str(item["name"]) for item in grounded_candidates]
        if len(names) == 1:
            summary = f"The verified laboratory pattern may be compatible with {names[0]}."
            explanation = (
                f"Clinora AI identified a laboratory pattern that may be compatible with {names[0]}. "
                "This is a possible interpretation, not a diagnosis; symptoms, timing, medical history, examination, and additional testing can change the interpretation."
            )
            question_title = f"Ask whether the possible {names[0]} pattern fits your clinical picture"
        else:
            summary = f"The verified laboratory pattern supports more than one possible clinical interpretation, including {names[0]} and {names[1]}."
            explanation = (
                "Clinora AI identified more than one medically plausible interpretation of the verified laboratory pattern. "
                "A clinician can weigh these possibilities using symptoms, timing, history, examination, and additional testing."
            )
            question_title = "Ask which possible interpretation best fits your clinical picture"
        status = "POSSIBLE_CLINICAL_PATTERN"
    elif notable:
        summary = "Some verified findings are outside their supplied reference ranges, but the available laboratory pattern does not support a responsible condition-level possibility yet."
        explanation = (
            "The verified findings can have more than one explanation, and the laboratory pattern alone is not specific enough to name one condition responsibly. "
            "Symptoms, timing, medical history, examination, and other tests may still change the interpretation."
        )
        question_title = "Ask how these verified findings fit your overall health"
        status = "INSUFFICIENT_EVIDENCE"
    else:
        summary = "The verified laboratory observations do not show a clear condition-level pattern for Clinora AI to interpret."
        explanation = (
            "No specific condition-level possibility is supported by the verified laboratory observations alone. "
            "Clinical context may still be important when discussing the report with a clinician."
        )
        question_title = "Ask whether any other clinical context changes how this report should be interpreted"
        status = "NO_CLEAR_ABNORMAL_PATTERN"

    payload: dict[str, object] = {
        "analysisStatus": status,
        "summary": summary,
        "notableFindings": notable,
        "clinicalPatterns": grounded_candidates,
        "discussionPoints": [
            {
                "type": "CLINICAL_QUESTION",
                "title": question_title,
                "reason": "A clinician can interpret the verified laboratory pattern together with symptoms, medical history, medications, examination findings, and other available tests.",
            }
        ],
        "patientExplanation": explanation,
        "limitations": ["Clinora will apply the standard patient-facing limitations."],
    }
    diagnostics: dict[str, int | str] = {
        "modelCandidates": len(raw_candidates),
        "acceptedCandidates": len(grounded_candidates),
        "rejectedCandidates": rejected,
        "discardedEvidenceIds": discarded_evidence,
        "noCandidateReason": _clean_string(parsed.get("noCandidateReason"), max_length=220),
    }
    return payload, diagnostics
