import json
from unittest.mock import Mock

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.internal_analysis import build_router
from app.model_runtime import MedGemmaRuntime, ModelUnavailableError
from app.schemas.research_evaluation import AbnormalityEvaluationRequest
from app.services.research_evaluation_service import ResearchEvaluationService


def request(count=24):
    return AbnormalityEvaluationRequest(samples=[dict(
        sampleKey=f"S{i+1}", test="HGB", value=13, unit="g/dL", referenceLow=12, referenceHigh=16,
    ) for i in range(count)])


def service(handler):
    return ResearchEvaluationService(MedGemmaRuntime(client=httpx.Client(
        base_url="http://127.0.0.1:8002", transport=httpx.MockTransport(handler))))


@pytest.mark.parametrize("count,expected_calls", [(24, 1), (65, 3)])
def test_real_runtime_adapter_all_observations_and_no_reference_label_leak(count, expected_calls):
    calls = []
    def handler(req):
        if req.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        assert req.url.path == "/v1/chat/completions"
        payload = json.loads(req.content)
        calls.append(payload)
        samples = json.loads(payload["messages"][1]["content"])
        assert all(set(s) == {"sampleKey", "test", "value", "unit", "referenceLow", "referenceHigh"} for s in samples)
        # Intentionally wrong labels: the service must preserve model answers, never correct from ranges.
        result = {"predictions": [{"sampleKey": s["sampleKey"], "label": "ABNORMAL"} for s in samples]}
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(result)}}]})
    result = service(handler).evaluate_abnormality(request(count))
    assert len(result.predictions) == count
    assert all(p.label == "ABNORMAL" for p in result.predictions)
    assert len(calls) == result.generationCallCount == expected_calls
    assert result.executionProvider == "LLAMA_CPP_MEDGEMMA"


@pytest.mark.parametrize("content", [
    "not json", "[]", '{}', '{"predictions":[]}',
    '{"predictions":[{"sampleKey":"S1","label":"MAYBE"}]}',
    '{"predictions":[{"sampleKey":"S2","label":"NORMAL"}]}',
    '{"predictions":[{"sampleKey":"S1","label":"NORMAL"},{"sampleKey":"S1","label":"NORMAL"}]}',
    '{"predictions":[{"sampleKey":"S1","label":"NORMAL","explanation":"x"}]}',
])
def test_invalid_responses_fail_after_one_retry(content):
    calls = []
    def handler(req):
        if req.url.path == "/health": return httpx.Response(200, json={"status": "ok"})
        calls.append(req)
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})
    with pytest.raises(ValueError): service(handler).evaluate_abnormality(request(1))
    assert len(calls) == 2


def test_strict_retry_can_recover_normal_prediction():
    calls = []
    def handler(req):
        if req.url.path == "/health": return httpx.Response(200, json={"status": "ok"})
        calls.append(req)
        content = 'bad' if len(calls) == 1 else '{"predictions":[{"sampleKey":"S1","label":"NORMAL"}]}'
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})
    result = service(handler).evaluate_abnormality(request(1))
    assert result.predictions[0].label == "NORMAL"
    assert result.generationCallCount == 2


@pytest.mark.parametrize("mode", ["loading", "timeout", "connection", "health_only"])
def test_runtime_unavailable_never_generates_fallback(mode):
    paths = []
    def handler(req):
        paths.append(req.url.path)
        if mode == "timeout": raise httpx.ReadTimeout("timeout", request=req)
        if mode == "connection": raise httpx.ConnectError("offline", request=req)
        return httpx.Response(503 if mode == "loading" else 200, json={"status": "UP"})
    with pytest.raises(ModelUnavailableError): service(handler).evaluate_abnormality(request())
    assert paths == ["/health"]


def test_ground_truth_field_is_rejected():
    payload = request(1).model_dump()
    payload["samples"][0]["groundTruth"] = "NORMAL"
    with pytest.raises(ValueError): AbnormalityEvaluationRequest.model_validate(payload)


def test_internal_endpoint_requires_token_and_maps_invalid_response(monkeypatch):
    monkeypatch.setenv("AI_INTERNAL_TOKEN", "research-test-token")
    runtime_service = Mock()
    runtime_service.evaluate_abnormality.side_effect = ValueError("bad response")
    app = FastAPI()
    app.include_router(build_router(Mock(), research_evaluation_service=runtime_service))
    client = TestClient(app)
    path = "/internal/v1/research/evaluate-abnormality"
    assert client.post(path, json=request(1).model_dump()).status_code in (401, 403)
    assert client.post(path, json=request(1).model_dump(), headers={"X-Clinora-Internal-Token": "research-test-token"}).status_code == 502
    runtime_service.evaluate_abnormality.side_effect = ModelUnavailableError("offline")
    assert client.post(path, json=request(1).model_dump(), headers={"X-Clinora-Internal-Token": "research-test-token"}).status_code == 503
