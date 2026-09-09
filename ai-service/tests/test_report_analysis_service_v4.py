from __future__ import annotations

import json
from uuid import UUID, uuid4

from app.model_runtime import RuntimeMetadata
from app.prompts.patient_lab_report_v5 import PROMPT_VERSION
from app.schemas.report_analysis import ReportAnalysisRequest
from app.services.report_analysis_service import ReportAnalysisService


class SequenceRuntime:
    def __init__(self, outputs: list[dict[str, object] | str]) -> None:
        self.outputs = outputs
        self.calls: list[list[dict[str, object]]] = []
        self.metadata = RuntimeMetadata("google/medgemma-1.5-4b-it", "main", "Q4_0")

    def generate(
        self,
        messages: list[dict[str, object]],
        allowed_observation_ids: tuple[str, ...] | None = None,
    ) -> str:
        self.calls.append(messages)
        index = len(self.calls) - 1
        if index >= len(self.outputs):
            raise AssertionError("ReportAnalysisService generated more model calls than expected.")
        output = self.outputs[index]
        return output if isinstance(output, str) else json.dumps(output)


def _request(*, normal: bool = False) -> tuple[ReportAnalysisRequest, UUID, UUID]:
    first = uuid4()
    second = uuid4()
    request = ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "General laboratory report",
            "observations": [
                {
                    "observationId": str(first),
                    "label": "Marker A",
                    "valueType": "NUMERIC",
                    "numericValue": "2.5" if not normal else "0.5",
                    "referenceRangeRaw": "< 1.0",
                },
                {
                    "observationId": str(second),
                    "label": "Marker B",
                    "valueType": "NUMERIC",
                    "numericValue": "3700" if not normal else "6000",
                    "referenceLow": "4000",
                    "referenceHigh": "11000",
                },
            ],
        }
    )
    return request, first, second


def _candidate(first: UUID, second: UUID, *, name: str = "Example clinical syndrome") -> dict[str, object]:
    return {
        "candidates": [
            {
                "name": name,
                "rationale": "The combined verified findings form a coherent clinical pattern.",
                "supportingObservationIds": [str(first), str(second)],
                "contradictoryObservationIds": [],
                "missingEvidence": ["Symptoms, timing, history, and examination"],
                "alternatives": ["Another possible clinical process"],
            }
        ],
        "noCandidateReason": "",
    }


def test_v4_uses_one_candidate_generation_and_builds_patient_payload() -> None:
    request, first, second = _request()
    runtime = SequenceRuntime([_candidate(first, second)])

    result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

    assert len(runtime.calls) == 1
    assert '"candidates"' in str(runtime.calls[0][0]["content"])
    assert result.clinicalPatterns[0].name == "Example clinical syndrome"
    assert str(result.analysisStatus) == "POSSIBLE_CLINICAL_PATTERN"
    assert result.promptVersion == PROMPT_VERSION


def test_v4_accepts_empty_candidate_result_without_semantic_double_generation() -> None:
    request, _, _ = _request()
    runtime = SequenceRuntime([{"candidates": [], "noCandidateReason": "The pattern is nonspecific."}])

    result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

    assert len(runtime.calls) == 1
    assert result.clinicalPatterns == []
    assert str(result.analysisStatus) == "INSUFFICIENT_EVIDENCE"


def test_v4_prunes_unverified_observation_id_and_keeps_grounded_candidate() -> None:
    request, first, _ = _request()
    invented_id = uuid4()
    invalid = {
        "candidates": [
            {
                "name": "Unsupported candidate",
                "rationale": "A candidate with an invented evidence identifier.",
                "supportingObservationIds": [str(invented_id), str(first)],
                "contradictoryObservationIds": [],
                "missingEvidence": [],
                "alternatives": [],
            }
        ],
        "noCandidateReason": "",
    }
    runtime = SequenceRuntime([invalid])

    result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

    assert len(runtime.calls) == 1
    assert str(result.analysisStatus) == "POSSIBLE_CLINICAL_PATTERN"
    assert len(result.clinicalPatterns) == 1
    pattern = result.clinicalPatterns[0]
    assert pattern.name == invalid["candidates"][0]["name"]
    assert pattern.supportingObservationIds == [first]
    assert pattern.contradictoryObservationIds == []
    assert str(pattern.supportLevel) == "LIMITED"
    supplied_ids = {observation.observationId for observation in request.observations}
    assert {finding.observationId for finding in result.notableFindings} <= supplied_ids
    # Check the entire response, including every evidence field and patient-facing
    # prose field, so the pruned UUID cannot leak through another output surface.
    assert str(invented_id) not in result.model_dump_json()


def test_v4_drops_candidate_with_only_unverified_observation_ids_fail_closed() -> None:
    request, _, _ = _request()
    invented_ids = (uuid4(), uuid4())
    runtime = SequenceRuntime([_candidate(*invented_ids)])

    result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

    assert len(runtime.calls) == 1
    assert result.clinicalPatterns == []
    assert str(result.analysisStatus) != "POSSIBLE_CLINICAL_PATTERN"
    for invented_id in invented_ids:
        assert str(invented_id) not in result.model_dump_json()


def test_v4_repairs_malformed_candidate_json_at_most_once() -> None:
    request, first, second = _request()
    runtime = SequenceRuntime(["not-json", _candidate(first, second)])

    result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

    assert len(runtime.calls) == 2
    assert "could not be parsed safely" in str(runtime.calls[1][0]["content"])
    assert result.clinicalPatterns[0].name == "Example clinical syndrome"


def test_v4_preserves_generic_reasoning_across_different_condition_names() -> None:
    request, first, second = _request()
    runtime = SequenceRuntime([_candidate(first, second, name="Renal dysfunction pattern")])

    result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

    assert result.clinicalPatterns[0].name == "Renal dysfunction pattern"
    assert "dengue" not in str(runtime.calls[0][0]["content"]).lower()
    assert "diabetes" not in str(runtime.calls[0][0]["content"]).lower()
