from __future__ import annotations

import json

import httpx
import pytest

from app.gemini_runtime import GeminiRuntime
from app.model_runtime import (
    MalformedModelResponseError,
    ModelCapacityError,
    ModelTimeoutError,
    ModelUnavailableError,
)


def configured(
    monkeypatch,
    handler,
    sleeps: list[float] | None = None,
    monotonic=None,
) -> tuple[GeminiRuntime, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    def capture(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return handler(request)

    monkeypatch.setenv("GEMINI_API_KEY", "test-secret-never-log")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    monkeypatch.setenv("GEMINI_API_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
    monkeypatch.setenv("GEMINI_MAX_ATTEMPTS", "2")
    client = httpx.Client(transport=httpx.MockTransport(capture))
    kwargs = {"sleep": (sleeps if sleeps is not None else []).append}
    if monotonic is not None:
        kwargs["monotonic"] = monotonic
    return GeminiRuntime(client, **kwargs), requests


def response(content: str = '{"patterns":[]}', status: int = 200) -> httpx.Response:
    return httpx.Response(status, json={
        "candidates": [{
            "finishReason": "STOP",
            "content": {"parts": [{"text": content}]},
        }],
        "usageMetadata": {"promptTokenCount": 120, "candidatesTokenCount": 18},
    })


def test_structured_success_uses_configured_model_timeout_contract_and_usage(monkeypatch):
    runtime, requests = configured(monkeypatch, lambda _: response())

    result = runtime.generate(
        [{"role": "system", "content": "policy"}, {"role": "user", "content": "minimum clinical facts"}],
        response_schema={
            "type": "object",
            "properties": {
                "taskId": {"type": "string", "const": "EXPLORE_EXPLANATIONS", "maxLength": 40},
                "patterns": {"type": "array"},
            },
        },
        max_tokens=128,
    )

    assert result.content == '{"patterns":[]}'
    assert result.prompt_tokens == 120 and result.completion_tokens == 18
    assert result.finish_reason == "stop"
    assert len(requests) == 1
    payload = json.loads(requests[0].content)
    assert requests[0].url.path.endswith("/models/gemini-2.5-flash:generateContent")
    assert payload["generationConfig"]["maxOutputTokens"] == 128
    assert payload["generationConfig"]["responseMimeType"] == "application/json"
    assert "responseSchema" not in payload["generationConfig"]
    provider_schema = payload["generationConfig"]["responseJsonSchema"]
    assert provider_schema["properties"]["taskId"]["enum"] == ["EXPLORE_EXPLANATIONS"]
    assert "const" not in provider_schema["properties"]["taskId"]
    assert "maxLength" not in provider_schema["properties"]["taskId"]
    assert payload["systemInstruction"]["parts"] == [{"text": "policy"}]
    assert "test-secret-never-log" not in requests[0].content.decode()
    assert requests[0].headers["x-request-id"]


@pytest.mark.parametrize("status,error", [
    (500, ModelUnavailableError),
    (503, ModelUnavailableError),
])
def test_transient_http_failures_retry_once_then_map_safely(monkeypatch, status, error):
    runtime, requests = configured(monkeypatch, lambda _: httpx.Response(status, json={"error": {"message": "private"}}))

    with pytest.raises(error):
        runtime.generate([{"role": "user", "content": "facts"}], response_schema={"type": "object"})

    assert len(requests) == 2


def test_429_first_attempt_respects_retry_after_then_recovers_with_telemetry(monkeypatch, caplog):
    responses = [
        httpx.Response(429, headers={"Retry-After": "1"}, json={"error": {"message": "private"}}),
        response(),
    ]
    sleeps: list[float] = []
    runtime, requests = configured(monkeypatch, lambda _: responses.pop(0), sleeps)

    with caplog.at_level("INFO"):
        result = runtime.generate([{"role": "user", "content": "facts"}], response_schema={"type": "object"})

    assert result.provider_attempts == 2
    assert len(requests) == 2
    assert sleeps == [1.0]
    assert "provider_attempts=2 successful_generations=1" in caplog.text
    assert "outcome=RATE_LIMIT_RETRY" in caplog.text


def test_429_without_retry_after_fails_immediately_and_reports_zero_successes(monkeypatch, caplog):
    sleeps: list[float] = []
    runtime, requests = configured(
        monkeypatch,
        lambda _: httpx.Response(429, json={"error": {"message": "private"}}),
        sleeps,
    )

    with caplog.at_level("INFO"), pytest.raises(ModelCapacityError) as raised:
        runtime.generate([{"role": "user", "content": "facts"}], response_schema={"type": "object"})

    assert raised.value.provider_attempts == 1
    assert len(requests) == 1
    assert sleeps == []
    assert "provider_attempts=1 successful_generations=0" in caplog.text


def test_repeated_429_opens_short_circuit_and_next_request_makes_zero_provider_calls(monkeypatch, caplog):
    now = [100.0]
    runtime, requests = configured(
        monkeypatch,
        lambda _: httpx.Response(429, json={
            "error": {
                "status": "RESOURCE_EXHAUSTED",
                "message": "private",
                "details": [{"reason": "RATE_LIMIT_EXCEEDED"}],
            },
        }),
        monotonic=lambda: now[0],
    )

    with pytest.raises(ModelCapacityError) as first:
        runtime.generate([{"role": "user", "content": "facts"}])
    with caplog.at_level("INFO"), pytest.raises(ModelCapacityError) as second:
        runtime.generate([{"role": "user", "content": "different facts"}])

    assert first.value.provider_attempts == 1
    assert first.value.rate_limit_category == "RESOURCE_EXHAUSTED:RATE_LIMIT_EXCEEDED"
    assert second.value.provider_attempts == 0
    assert second.value.rate_limit_category == "CIRCUIT_OPEN"
    assert len(requests) == 1
    assert "outcome=RATE_LIMIT_CIRCUIT_OPEN provider_attempts=0" in caplog.text


def test_long_retry_after_is_not_ignored_or_turned_into_an_interactive_wait(monkeypatch):
    sleeps: list[float] = []
    runtime, requests = configured(
        monkeypatch,
        lambda _: httpx.Response(429, headers={"Retry-After": "30"}, json={"error": {"message": "private"}}),
        sleeps,
    )

    with pytest.raises(ModelCapacityError) as raised:
        runtime.generate([{"role": "user", "content": "facts"}])

    assert raised.value.provider_attempts == 1
    assert raised.value.retry_after_seconds == 30
    assert len(requests) == 1
    assert sleeps == []


def test_timeout_fails_after_one_bounded_read_window(monkeypatch):
    def timeout(request: httpx.Request):
        raise httpx.ReadTimeout("private timeout detail", request=request)

    runtime, requests = configured(monkeypatch, timeout)
    with pytest.raises(ModelTimeoutError):
        runtime.generate([{"role": "user", "content": "facts"}])
    assert len(requests) == 1


@pytest.mark.parametrize("handler", [
    lambda _: httpx.Response(200, content=b"not-json"),
    lambda _: httpx.Response(200, json={"candidates": []}),
    lambda _: httpx.Response(200, json={"candidates": [{"content": {"parts": []}}]}),
])
def test_invalid_or_empty_provider_envelopes_fail_closed(monkeypatch, handler):
    runtime, _ = configured(monkeypatch, handler)
    with pytest.raises(MalformedModelResponseError):
        runtime.generate([{"role": "user", "content": "facts"}])


def test_missing_secret_fails_clearly_without_network(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    runtime = GeminiRuntime(httpx.Client(transport=httpx.MockTransport(lambda _: response())))
    with pytest.raises(ModelUnavailableError):
        runtime.generate([{"role": "user", "content": "facts"}])
