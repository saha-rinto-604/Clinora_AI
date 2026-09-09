from __future__ import annotations

import json
from uuid import uuid4

from app.prompts.patient_lab_report_v3 import (
    PROMPT_VERSION,
    build_messages,
    build_reasoning_retry_messages,
    evidence_class,
    has_reasoning_signal,
    reasoning_signal_summary,
    should_retry_reasoning,
)
from app.schemas.report_analysis import ReportAnalysisRequest


def _request(observations: list[dict[str, object]]) -> ReportAnalysisRequest:
    return ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "LAB",
            "observations": observations,
        }
    )


def _numeric(label: str, value: str, low: str, high: str) -> dict[str, object]:
    return {
        "observationId": str(uuid4()),
        "label": label,
        "valueType": "NUMERIC",
        "numericValue": value,
        "unit": "unit",
        "referenceLow": low,
        "referenceHigh": high,
    }


def test_v3_prioritizes_clinical_correlation_without_hardcoded_disease_rules() -> None:
    request = _request(
        [
            _numeric("Marker A", "2", "4", "10"),
            _numeric("Marker B", "7", "4", "10"),
        ]
    )

    content = str(build_messages(request)[0]["content"])
    rules = content.split("Verified clinical evidence:", 1)[0].lower()

    assert PROMPT_VERSION == "patient-lab-report-v3"
    assert "do real clinical correlation" in rules
    assert "condition name does not need to appear" in rules
    assert "missing symptoms" in rules
    assert "dengue" not in rules
    assert "diabetes" not in rules
    assert "hypothy" not in rules


def test_v3_sorts_outside_range_evidence_before_in_range_context() -> None:
    normal = _numeric("Normal marker", "7", "4", "10")
    abnormal = _numeric("Abnormal marker", "2", "4", "10")
    request = _request([normal, abnormal])

    content = str(build_messages(request)[0]["content"])
    payload = json.loads(content.split("Verified clinical evidence:\n", 1)[1])

    assert payload["observations"][0]["label"] == "Abnormal marker"
    assert payload["observations"][0]["clinoraRangeStatus"] == "LOW"
    assert payload["observations"][0]["clinoraEvidenceClass"] == "OUTSIDE_RANGE"
    assert payload["observations"][1]["clinoraEvidenceClass"] == "IN_RANGE"


def test_v3_treats_verified_qualitative_results_as_reasoning_context_without_calling_them_numeric() -> None:
    request = _request(
        [
            {
                "observationId": str(uuid4()),
                "label": "Qualitative assay",
                "valueType": "QUALITATIVE",
                "textValue": "Reactive",
            }
        ]
    )

    observation = request.observations[0]
    assert evidence_class(observation) == "QUALITATIVE_POSITIVE"
    assert has_reasoning_signal(request) is True
    assert should_retry_reasoning(request) is True
    assert reasoning_signal_summary(request)["qualitativePositive"] == 1


def test_v3_does_not_retry_an_all_in_range_numeric_report() -> None:
    request = _request([_numeric("Marker", "7", "4", "10")])
    assert has_reasoning_signal(request) is False
    assert should_retry_reasoning(request) is False


def test_v3_does_not_retry_one_isolated_nonspecific_numeric_abnormality() -> None:
    request = _request([_numeric("Marker", "2", "4", "10")])
    assert has_reasoning_signal(request) is True
    assert should_retry_reasoning(request) is False


def test_v3_retries_two_coherent_numeric_signals() -> None:
    request = _request([_numeric("Marker A", "2", "4", "10"), _numeric("Marker B", "12", "4", "10")])
    assert should_retry_reasoning(request) is True


def test_v3_reasoning_retry_remains_bounded_and_explicitly_allows_empty_when_nonspecific() -> None:
    request = _request([_numeric("Marker", "2", "4", "10")])
    content = str(build_reasoning_retry_messages(request)[0]["content"])

    assert "previous pass returned no condition-level pattern" in content.lower()
    assert "do not force a disease label" in content.lower()
    assert "clinicalPatterns=[] is correct" in content
    assert "at most 2 clinicalPatterns" in content
