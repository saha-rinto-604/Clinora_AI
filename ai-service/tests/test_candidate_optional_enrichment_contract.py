from app.model_runtime import _llama_response_schema


def test_candidate_optional_enrichment_arrays_may_be_empty_in_generation_schema():
    schema = _llama_response_schema()
    candidate = schema["$defs"]["ModelClusterCandidate"]["properties"]
    assert "minItems" not in candidate["missingEvidence"]
    assert "minItems" not in candidate["alternatives"]
    assert candidate["missingEvidence"]["maxItems"] == 2
    assert candidate["alternatives"]["maxItems"] == 2
