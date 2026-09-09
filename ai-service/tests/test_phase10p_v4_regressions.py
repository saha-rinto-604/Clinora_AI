from __future__ import annotations

import json
from types import SimpleNamespace
from uuid import uuid4

from app.clinical_ranges import range_state
from app.prompts.patient_lab_report_v4 import model_payload_from_candidate_output
from app.schemas.report_analysis import ReportAnalysisRequest
from app.services.report_analysis_service import ReportAnalysisService


def _numeric_observation(
    observation_id: str,
    label: str,
    value: str,
    *,
    low: str | None = None,
    high: str | None = None,
    raw: str | None = None,
) -> dict[str, object]:
    result: dict[str, object] = {
        "observationId": observation_id,
        "label": label,
        "valueType": "NUMERIC",
        "numericValue": value,
    }
    if low is not None:
        result["referenceLow"] = low
    if high is not None:
        result["referenceHigh"] = high
    if raw is not None:
        result["referenceRangeRaw"] = raw
    return result


def test_raw_reference_parser_accepts_scientific_unit_suffix() -> None:
    observation = SimpleNamespace(
        valueType="NUMERIC",
        numericValue="90",
        referenceLow=None,
        referenceHigh=None,
        rangeFlag=None,
        referenceRangeRaw="150 - 400 x10^9/L",
    )
    assert range_state(observation) == "LOW"


def test_mixed_support_prunes_in_range_item_without_deleting_candidate() -> None:
    first = str(uuid4())
    second = str(uuid4())
    neutral = str(uuid4())
    request = ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "Laboratory results",
            "observations": [
                _numeric_observation(first, "Assay marker", "2.95", raw="< 1.00"),
                _numeric_observation(second, "White blood cells", "3.2", low="4.0", high="11.0"),
                _numeric_observation(neutral, "Eosinophils", "1.0", low="1.0", high="6.0"),
            ],
        }
    )
    payload, diagnostics = model_payload_from_candidate_output(
        request,
        json.dumps(
            {
                "candidates": [
                    {
                        "name": "Example acute viral syndrome",
                        "rationale": "The verified combination can be compatible with an acute viral process.",
                        "supportingObservationIds": [first, second, neutral],
                        "contradictoryObservationIds": [],
                        "missingEvidence": ["Symptoms and illness timing"],
                        "alternatives": ["Another acute viral process"],
                    }
                ],
                "noCandidateReason": "",
            }
        ),
    )
    pattern = payload["clinicalPatterns"][0]
    assert pattern["supportingObservationIds"] == [first, second]
    assert pattern["supportLevel"] == "MODERATE"
    assert diagnostics["acceptedCandidates"] == 1
    assert diagnostics["discardedEvidenceIds"] == 1


def test_unknown_evidence_id_is_pruned_without_deleting_valid_candidate() -> None:
    valid = str(uuid4())
    request = ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "Laboratory results",
            "observations": [
                _numeric_observation(valid, "Platelets", "90", low="150", high="400"),
            ],
        }
    )
    payload, diagnostics = model_payload_from_candidate_output(
        request,
        {
            "candidates": [
                {
                    "name": "Example thrombocytopenic process",
                    "rationale": "This verified finding can be compatible with this possibility.",
                    "supportingObservationIds": [valid, str(uuid4())],
                    "contradictoryObservationIds": [],
                    "missingEvidence": [],
                    "alternatives": [],
                }
            ],
            "noCandidateReason": "",
        },
    )
    assert payload["clinicalPatterns"][0]["supportingObservationIds"] == [valid]
    assert payload["clinicalPatterns"][0]["supportLevel"] == "LIMITED"
    assert diagnostics["acceptedCandidates"] == 1
    assert diagnostics["discardedEvidenceIds"] == 1


def test_qualitative_positive_and_numeric_low_share_same_support_scale() -> None:
    positive = str(uuid4())
    low = str(uuid4())
    request = ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "Laboratory results",
            "observations": [
                {
                    "observationId": positive,
                    "label": "Antigen assay",
                    "valueType": "TEXT",
                    "textValue": "Positive",
                },
                _numeric_observation(low, "Platelets", "90", low="150", high="400"),
            ],
        }
    )
    payload, _ = model_payload_from_candidate_output(
        request,
        {
            "candidates": [
                {
                    "name": "Example infection-compatible pattern",
                    "rationale": "The combination can be compatible with an acute infectious process.",
                    "supportingObservationIds": [positive, low],
                    "contradictoryObservationIds": [],
                    "missingEvidence": [],
                    "alternatives": [],
                }
            ],
            "noCandidateReason": "",
        },
    )
    pattern = payload["clinicalPatterns"][0]
    assert pattern["supportLevel"] == "MODERATE"
    assert pattern["supportingObservationIds"] == [positive, low]


def test_grounding_drops_only_wrong_fact_sentence_and_keeps_candidate_reasoning() -> None:
    platelet = str(uuid4())
    eosinophil = str(uuid4())
    request = ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "Laboratory results",
            "observations": [
                _numeric_observation(platelet, "Platelets", "90", low="150", high="400"),
                _numeric_observation(eosinophil, "Eosinophils", "1.0", low="1.0", high="6.0"),
            ],
        }
    )
    grounded = ReportAnalysisService._ground_patient_facing_payload(
        request,
        {
            "analysisStatus": "POSSIBLE_CLINICAL_PATTERN",
            "summary": "A possible clinical pattern was identified.",
            "patientExplanation": "The report may have a clinically meaningful relationship.",
            "notableFindings": [],
            "clinicalPatterns": [
                {
                    "name": "Example acute viral syndrome",
                    "supportLevel": "MODERATE",
                    "reasoning": (
                        "Platelets are low. Eosinophils are high. "
                        "This combination can occur in an acute viral syndrome."
                    ),
                    "supportingObservationIds": [platelet, eosinophil],
                    "contradictoryObservationIds": [],
                    "missingEvidence": [],
                    "possibleCauses": [],
                }
            ],
            "discussionPoints": [],
            "limitations": [],
        },
    )
    assert isinstance(grounded, dict)
    pattern = grounded["clinicalPatterns"][0]
    assert pattern["supportingObservationIds"] == [platelet]
    assert pattern["supportLevel"] == "LIMITED"
    assert "Platelets are low" in pattern["reasoning"]
    assert "Eosinophils are high" not in pattern["reasoning"]
    assert "acute viral syndrome" in pattern["reasoning"]


def test_dengue_like_candidate_survives_neutral_eosinophil_and_unit_suffixed_ranges() -> None:
    ns1 = str(uuid4())
    platelets = str(uuid4())
    wbc = str(uuid4())
    eosinophils = str(uuid4())
    request = ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "Dengue and hematology profile",
            "observations": [
                _numeric_observation(ns1, "NS1 Antigen (ELISA)", "2.95", raw="< 1.00"),
                _numeric_observation(
                    platelets,
                    "Platelets",
                    "90",
                    raw="150 - 400 x10^9/L",
                ),
                _numeric_observation(
                    wbc,
                    "WBC",
                    "3.2",
                    raw="4.0 - 11.0 x10^9/L",
                ),
                _numeric_observation(
                    eosinophils,
                    "Eosinophils",
                    "1.0",
                    low="1.0",
                    high="6.0",
                ),
            ],
        }
    )
    payload, diagnostics = model_payload_from_candidate_output(
        request,
        {
            "candidates": [
                {
                    "name": "Possible dengue infection",
                    "rationale": (
                        "The antigen finding together with thrombocytopenia and leukopenia "
                        "can form a pattern compatible with acute dengue infection."
                    ),
                    "supportingObservationIds": [ns1, platelets, wbc, eosinophils],
                    "contradictoryObservationIds": [],
                    "missingEvidence": ["Symptoms and illness duration"],
                    "alternatives": ["Another acute viral illness"],
                }
            ],
            "noCandidateReason": "",
        },
    )
    pattern = payload["clinicalPatterns"][0]
    assert pattern["name"] == "Possible dengue infection"
    assert pattern["supportLevel"] == "STRONG"
    assert pattern["supportingObservationIds"] == [ns1, platelets, wbc]
    assert eosinophils not in pattern["supportingObservationIds"]
    assert diagnostics["acceptedCandidates"] == 1
    assert diagnostics["discardedEvidenceIds"] == 1
