from __future__ import annotations

import json
from uuid import uuid4

from app.prompts.patient_lab_report_v4 import (
    PROMPT_VERSION,
    build_messages,
    model_payload_from_candidate_output,
)
from app.schemas.report_analysis import ReportAnalysisRequest


def _request() -> tuple[ReportAnalysisRequest, str, str]:
    first = str(uuid4())
    second = str(uuid4())
    request = ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "General laboratory report",
            "observations": [
                {
                    "observationId": first,
                    "label": "Marker A",
                    "valueType": "NUMERIC",
                    "numericValue": "2.95",
                    "referenceRangeRaw": "< 1.00",
                },
                {
                    "observationId": second,
                    "label": "Marker B",
                    "valueType": "NUMERIC",
                    "numericValue": "3700",
                    "referenceLow": "4000",
                    "referenceHigh": "11000",
                },
            ],
        }
    )
    return request, first, second


def test_v4_prompt_is_candidate_first_and_generic() -> None:
    request, _, _ = _request()
    text = str(build_messages(request)[0]["content"])
    assert PROMPT_VERSION == "patient-lab-report-v4"
    assert '"candidates"' in text
    assert "Your ONLY job in this call" in text
    assert "dengue" not in text.lower()
    assert "diabetes" not in text.lower()
    assert "thyroid" not in text.lower()
    assert "treatment" in text.lower()


def test_v4_builds_grounded_patient_payload_from_compact_candidates() -> None:
    request, first, second = _request()
    raw = json.dumps(
        {
            "candidates": [
                {
                    "name": "Example clinical syndrome",
                    "rationale": "The combined verified findings form a coherent physiologic pattern.",
                    "supportingObservationIds": [first, second],
                    "contradictoryObservationIds": [],
                    "missingEvidence": ["Symptoms and clinical history"],
                    "alternatives": ["Another possible process"],
                }
            ],
            "noCandidateReason": "",
        }
    )
    payload, diagnostics = model_payload_from_candidate_output(request, raw)
    pattern = payload["clinicalPatterns"][0]
    assert payload["analysisStatus"] == "POSSIBLE_CLINICAL_PATTERN"
    assert pattern["name"] == "Example clinical syndrome"
    assert pattern["supportLevel"] == "MODERATE"
    assert pattern["supportingObservationIds"] == [first, second]
    assert diagnostics["acceptedCandidates"] == 1
    assert len(payload["notableFindings"]) == 2


def test_v4_drops_candidate_with_only_unknown_or_unusable_support() -> None:
    observation_id = str(uuid4())
    request = ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "General",
            "observations": [
                {
                    "observationId": observation_id,
                    "label": "Reported marker",
                    "valueType": "NUMERIC",
                    "numericValue": "5",
                }
            ],
        }
    )
    payload, diagnostics = model_payload_from_candidate_output(
        request,
        json.dumps(
            {
                "candidates": [
                    {
                        "name": "Unsupported disease",
                        "rationale": "A claim without grounded abnormal evidence.",
                        "supportingObservationIds": [observation_id],
                    }
                ],
                "noCandidateReason": "",
            }
        ),
    )
    assert payload["clinicalPatterns"] == []
    assert diagnostics["rejectedCandidates"] == 1


def test_v4_preserves_non_numeric_clinical_rationale_for_final_grounding() -> None:
    request, first, second = _request()
    raw = json.dumps(
        {
            "candidates": [
                {
                    "name": "Example clinical syndrome",
                    "rationale": "Marker A is high and Marker B is low.",
                    "supportingObservationIds": [first, second],
                    "missingEvidence": [],
                    "alternatives": [],
                }
            ],
            "noCandidateReason": "",
        }
    )
    payload, _ = model_payload_from_candidate_output(request, raw)
    reasoning = payload["clinicalPatterns"][0]["reasoning"]
    assert "Marker A" in reasoning
    assert "high" in reasoning.lower()
    assert payload["clinicalPatterns"][0]["name"] == "Example clinical syndrome"


def test_v4_accepts_legacy_clinical_patterns_shape_for_compatibility() -> None:
    request, first, second = _request()
    raw = json.dumps(
        {
            "clinicalPatterns": [
                {
                    "name": "Legacy-compatible syndrome",
                    "reasoning": "The combined verified pattern is clinically coherent.",
                    "supportingObservationIds": [first, second],
                    "contradictoryObservationIds": [],
                    "missingEvidence": [],
                    "possibleCauses": [],
                }
            ]
        }
    )
    payload, _ = model_payload_from_candidate_output(request, raw)
    assert payload["clinicalPatterns"][0]["name"] == "Legacy-compatible syndrome"
