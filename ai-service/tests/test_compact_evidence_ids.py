import json

from app.model_runtime import VerifiedObservationIds, _llama_response_schema
from app.prompts.patient_lab_report_v5 import build_messages, build_repair_messages
from app.services.report_analysis_service import _expand_evidence_ids
from tests.v5_cases import cases


def test_short_references_preserve_all_facts_and_grammar_constraints():
    request = cases()["B"]
    references = VerifiedObservationIds(request.observations, compact=True)
    mapping = {str(item.observationId): key for key, item in references.facts.items()}
    original = build_messages(request)[0]["content"]
    compact = build_messages(request, mapping)[0]["content"]
    for item in request.observations:
        assert item.label in compact
        assert str(item.observationId) not in compact
        assert str(item.observationId) in original
    assert len(compact) < len(original)
    assert "v1" in build_repair_messages(request, "INVALID", mapping)[0]["content"]
    schema = _llama_response_schema(references)
    branches = schema["$defs"]["ModelClusterEvidence"]["oneOf"]
    assert branches[0]["properties"]["observationId"]["const"] == "v1"
    assert branches[0]["properties"]["observationLabel"]["const"] == request.observations[0].label
    supporting = schema["$defs"]["ModelClusterCandidate"]["properties"]["supportingObservationIds"]["items"]
    assert "format" not in supporting
    assert supporting["enum"] == list(references)


def test_expansion_preserves_prose_and_leaves_unknown_ids_for_validation():
    original_id = str(cases()["B"].observations[0].observationId)
    value = {"clusters": [{"evidence": [{"observationId": "v1", "clinicalRelevance": "v1"}],
                           "candidates": [{"supportingObservationIds": ["v1", "v999"],
                                           "contradictoryObservationIds": ["v1"], "rationale": "v1"}]}]}
    expanded = _expand_evidence_ids(value, {"v1": original_id})
    cluster = expanded["clusters"][0]
    assert cluster["evidence"][0] == {"observationId": original_id, "clinicalRelevance": "v1"}
    assert cluster["candidates"][0]["supportingObservationIds"] == [original_id, "v999"]
    assert cluster["candidates"][0]["contradictoryObservationIds"] == [original_id]
    assert cluster["candidates"][0]["rationale"] == "v1"
    assert value["clusters"][0]["evidence"][0]["observationId"] == "v1"
