from __future__ import annotations

import logging
import os
import re
import threading
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Callable
from urllib.parse import quote, urlparse
from uuid import uuid4

import httpx

from app.model_runtime import (
    MalformedModelResponseError,
    ModelCapacityError,
    ModelGeneration,
    ModelTimeoutError,
    ModelUnavailableError,
    RuntimeMetadata,
)


LOGGER = logging.getLogger(__name__)
_DEFAULT_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
_SAFE_MODEL = re.compile(r"^[A-Za-z0-9._-]{1,100}$")
_SUPPORTED_JSON_SCHEMA_KEYS = {
    "$id", "$defs", "$ref", "$anchor", "type", "format", "title", "description", "enum",
    "items", "prefixItems", "minItems", "maxItems", "minimum", "maximum", "anyOf", "oneOf",
    "properties", "additionalProperties", "required",
}


class GeminiRuntime:
    """Hosted structured-generation adapter used only for live Doctor inference."""

    def __init__(
        self,
        client: httpx.Client | None = None,
        *,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self._api_key = os.getenv("GEMINI_API_KEY", "").strip()
        requested_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
        self._model = requested_model if _SAFE_MODEL.fullmatch(requested_model) else "gemini-2.5-flash"
        requested_base = os.getenv("GEMINI_API_BASE_URL", _DEFAULT_API_BASE).strip().rstrip("/")
        parsed = urlparse(requested_base)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("GEMINI_API_BASE_URL must be an unauthenticated HTTPS URL.")
        self._api_base = requested_base
        connect_timeout = max(1.0, float(os.getenv("GEMINI_CONNECT_TIMEOUT_SECONDS", "5")))
        read_timeout = max(1.0, float(os.getenv("GEMINI_READ_TIMEOUT_SECONDS", "12")))
        self._max_attempts = max(1, min(int(os.getenv("GEMINI_MAX_ATTEMPTS", "2")), 2))
        self._retry_base_seconds = max(
            0.05, min(float(os.getenv("GEMINI_RETRY_BASE_SECONDS", "0.2")), 0.5)
        )
        self._max_retry_delay_seconds = max(
            self._retry_base_seconds,
            min(float(os.getenv("GEMINI_MAX_RETRY_DELAY_SECONDS", "1.0")), 2.0),
        )
        self._rate_limit_cooldown_seconds = max(
            5.0, min(float(os.getenv("GEMINI_RATE_LIMIT_COOLDOWN_SECONDS", "20")), 60.0)
        )
        self._sleep = sleep
        self._monotonic = monotonic
        self._circuit_lock = threading.Lock()
        self._rate_limited_until = 0.0
        self._client = client or httpx.Client(
            timeout=httpx.Timeout(read_timeout, connect=connect_timeout),
        )
        self._last_error: str | None = None

    @property
    def metadata(self) -> RuntimeMetadata:
        return RuntimeMetadata(self._model, "api", "HOSTED")

    @property
    def loaded(self) -> bool:
        return bool(self._api_key)

    @property
    def last_error(self) -> str | None:
        return self._last_error

    def ensure_loaded(self) -> None:
        if not self._api_key:
            self._last_error = "GEMINI_NOT_CONFIGURED"
            raise ModelUnavailableError("Gemini Doctor reasoning is not configured.")

    def generate(
        self,
        messages: list[dict[str, object]],
        allowed_observation_ids=None,
        response_schema: dict[str, object] | None = None,
        max_tokens: int | None = None,
    ) -> ModelGeneration:
        del allowed_observation_ids
        self.ensure_loaded()
        provider_request_id = str(uuid4())
        started = time.perf_counter()
        remaining_cooldown = self._remaining_rate_limit_cooldown()
        if remaining_cooldown > 0:
            self._last_error = "RATE_LIMIT_CIRCUIT_OPEN"
            self._log(
                provider_request_id, 0, 429, started, None, None,
                "RATE_LIMIT_CIRCUIT_OPEN", successful_generations=0,
                retry_delay_seconds=remaining_cooldown, rate_limit_category="CIRCUIT_OPEN",
            )
            raise ModelCapacityError(
                "Gemini Doctor reasoning is temporarily paused after provider rate limiting.",
                provider_attempts=0,
                retry_after_seconds=remaining_cooldown,
                rate_limit_category="CIRCUIT_OPEN",
            )
        body = self._request_body(messages, response_schema, max_tokens)
        endpoint = f"{self._api_base}/models/{quote(self._model, safe='')}:generateContent"
        response: httpx.Response | None = None

        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._client.post(
                    endpoint,
                    headers={
                        "Content-Type": "application/json",
                        "x-goog-api-key": self._api_key,
                        "X-Request-ID": provider_request_id,
                    },
                    json=body,
                )
            except httpx.TimeoutException as exc:
                self._last_error = "TIMEOUT"
                self._log(
                    provider_request_id, attempt, 0, started, None, None,
                    "TIMEOUT", successful_generations=0,
                )
                raise ModelTimeoutError("Gemini Doctor reasoning timed out.") from exc
            except httpx.TransportError as exc:
                self._last_error = "NETWORK_ERROR"
                if attempt < self._max_attempts:
                    delay = self._exponential_delay(attempt)
                    self._log(
                        provider_request_id, attempt, 0, started, None, None,
                        "NETWORK_RETRY", successful_generations=0, retry_delay_seconds=delay,
                    )
                    self._sleep(delay)
                    continue
                self._log(
                    provider_request_id, attempt, 0, started, None, None,
                    "NETWORK_ERROR", successful_generations=0,
                )
                raise ModelUnavailableError("Gemini Doctor reasoning is unavailable.") from exc

            if response.status_code == 429:
                category = _rate_limit_category(response)
                if attempt < self._max_attempts:
                    delay = self._rate_limit_delay(response, attempt)
                    if delay is not None:
                        self._log(
                            provider_request_id, attempt, 429, started, None, None,
                            "RATE_LIMIT_RETRY", successful_generations=0, retry_delay_seconds=delay,
                            rate_limit_category=category,
                            provider_retry_after_seconds=_retry_after_seconds(response),
                        )
                        self._sleep(delay)
                        continue
                self._last_error = "RATE_LIMITED"
                retry_after = _retry_after_seconds(response)
                cooldown = self._open_rate_limit_circuit(retry_after)
                self._log(
                    provider_request_id, attempt, 429, started, None, None,
                    "RATE_LIMITED", successful_generations=0,
                    retry_delay_seconds=cooldown, rate_limit_category=category,
                    provider_retry_after_seconds=retry_after,
                )
                raise ModelCapacityError(
                    "Gemini Doctor reasoning is rate limited.",
                    provider_attempts=attempt,
                    retry_after_seconds=retry_after,
                    rate_limit_category=category,
                )
            if response.status_code in {408, 504}:
                self._last_error = "TIMEOUT"
                self._log(
                    provider_request_id, attempt, response.status_code, started, None, None,
                    "TIMEOUT", successful_generations=0,
                )
                raise ModelTimeoutError("Gemini Doctor reasoning timed out.")
            if response.status_code >= 500:
                if attempt < self._max_attempts:
                    delay = self._exponential_delay(attempt)
                    self._log(
                        provider_request_id, attempt, response.status_code, started, None, None,
                        "PROVIDER_RETRY", successful_generations=0, retry_delay_seconds=delay,
                    )
                    self._sleep(delay)
                    continue
                self._last_error = "PROVIDER_UNAVAILABLE"
                self._log(
                    provider_request_id, attempt, response.status_code, started, None, None,
                    "PROVIDER_UNAVAILABLE", successful_generations=0,
                )
                raise ModelUnavailableError("Gemini Doctor reasoning is unavailable.")
            if response.status_code < 200 or response.status_code >= 300:
                self._last_error = "REQUEST_REJECTED"
                self._log(
                    provider_request_id, attempt, response.status_code, started, None, None,
                    "REQUEST_REJECTED", successful_generations=0,
                )
                raise ModelUnavailableError("Gemini Doctor reasoning rejected the request.")
            break

        if response is None:
            raise ModelUnavailableError("Gemini Doctor reasoning is unavailable.")

        try:
            payload = response.json()
            if not isinstance(payload, dict) or payload.get("error"):
                raise ValueError("provider error envelope")
            candidates = payload.get("candidates")
            if not isinstance(candidates, list) or not candidates:
                raise ValueError("missing candidate")
            candidate = candidates[0]
            parts = candidate["content"]["parts"]
            content = "".join(
                part.get("text", "")
                for part in parts
                if isinstance(part, dict) and not part.get("thought") and isinstance(part.get("text"), str)
            ).strip()
            if not content:
                raise ValueError("empty completion")
            finish = str(candidate.get("finishReason") or "").upper()
            finish_reason = "length" if finish == "MAX_TOKENS" else "stop" if finish in {"", "STOP"} else finish.lower()
            usage = payload.get("usageMetadata") if isinstance(payload.get("usageMetadata"), dict) else {}
            prompt_tokens = _optional_int(usage.get("promptTokenCount"))
            completion_tokens = _optional_int(usage.get("candidatesTokenCount"))
        except (TypeError, KeyError, IndexError, ValueError) as exc:
            self._last_error = "INVALID_RESPONSE"
            self._log(
                provider_request_id, attempt, response.status_code, started, None, None,
                "INVALID_RESPONSE", successful_generations=0,
            )
            raise MalformedModelResponseError("MALFORMED_GEMINI_ENVELOPE", f"error_type={exc.__class__.__name__}") from exc

        self._last_error = None
        self._close_rate_limit_circuit()
        self._log(
            provider_request_id,
            min(self._max_attempts, max(1, attempt)),
            response.status_code,
            started,
            prompt_tokens,
            completion_tokens,
            finish_reason,
            successful_generations=1,
        )
        return ModelGeneration(content, finish_reason, completion_tokens, prompt_tokens, attempt)

    def _exponential_delay(self, attempt: int) -> float:
        return min(self._max_retry_delay_seconds, self._retry_base_seconds * (2 ** (attempt - 1)))

    def _rate_limit_delay(self, response: httpx.Response, attempt: int) -> float | None:
        retry_after = _retry_after_seconds(response)
        if retry_after is None:
            # A blind millisecond retry is ineffective for persistent quota
            # exhaustion and only adds latency/provider traffic. Retry a 429
            # only when Gemini supplies a short interactive Retry-After.
            return None
        # Never retry before the provider's requested time. If that wait would
        # exceed the interactive budget, return the 429 without a long pause.
        if retry_after > self._max_retry_delay_seconds:
            return None
        return max(0.0, retry_after)

    def _remaining_rate_limit_cooldown(self) -> float:
        with self._circuit_lock:
            return max(0.0, self._rate_limited_until - self._monotonic())

    def _open_rate_limit_circuit(self, retry_after: float | None) -> float:
        requested = retry_after if retry_after is not None else 0.0
        cooldown = min(60.0, max(self._rate_limit_cooldown_seconds, requested))
        with self._circuit_lock:
            self._rate_limited_until = max(self._rate_limited_until, self._monotonic() + cooldown)
        return cooldown

    def _close_rate_limit_circuit(self) -> None:
        with self._circuit_lock:
            self._rate_limited_until = 0.0

    def _request_body(
        self,
        messages: list[dict[str, object]],
        response_schema: dict[str, object] | None,
        max_tokens: int | None,
    ) -> dict[str, Any]:
        system_parts: list[dict[str, str]] = []
        contents: list[dict[str, object]] = []
        for message in messages:
            role = message.get("role")
            text = _message_text(message.get("content"))
            if role not in {"system", "user", "assistant"} or not text:
                raise ValueError("Gemini messages require a supported role and non-empty text.")
            if role == "system":
                system_parts.append({"text": text})
            else:
                contents.append({"role": "model" if role == "assistant" else "user", "parts": [{"text": text}]})
        if not contents:
            raise ValueError("Gemini generation requires at least one non-system message.")
        generation: dict[str, Any] = {
            "temperature": 0,
            "topP": 1,
            "maxOutputTokens": max(64, min(int(max_tokens or 512), 2048)),
            "responseMimeType": "application/json",
        }
        if response_schema is not None:
            # The REST API's responseSchema field accepts only the older OpenAPI
            # subset. responseJsonSchema is the supported field for Pydantic-style
            # JSON Schema; unsupported validation-only constraints are enforced
            # again by Clinora after generation.
            generation["responseJsonSchema"] = _gemini_json_schema(response_schema)
        if self._model.startswith("gemini-2.5-"):
            generation["thinkingConfig"] = {"thinkingBudget": 0}
        body: dict[str, Any] = {"contents": contents, "generationConfig": generation}
        if system_parts:
            body["systemInstruction"] = {"parts": system_parts}
        return body

    def _log(
        self,
        request_id: str,
        attempt: int,
        status: int,
        started: float,
        prompt_tokens: int | None,
        completion_tokens: int | None,
        outcome: str,
        *,
        successful_generations: int,
        retry_delay_seconds: float | None = None,
        rate_limit_category: str | None = None,
        provider_retry_after_seconds: float | None = None,
    ) -> None:
        LOGGER.info(
            "gemini_doctor_generation request_id=%s model=%s attempt=%d status=%d latency_ms=%d "
            "prompt_tokens=%s completion_tokens=%s outcome=%s provider_attempts=%d "
            "successful_generations=%d retry_delay_ms=%d provider_retry_after_ms=%d rate_limit_category=%s",
            request_id,
            self._model,
            attempt,
            status,
            round((time.perf_counter() - started) * 1000),
            prompt_tokens,
            completion_tokens,
            outcome,
            attempt,
            successful_generations,
            round((retry_delay_seconds or 0) * 1000),
            round((provider_retry_after_seconds or 0) * 1000),
            rate_limit_category or "NONE",
        )


def _message_text(value: object) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return "\n".join(
            item["text"]
            for item in value
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str)
        ).strip()
    return ""


def _optional_int(value: object) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _retry_after_seconds(response: httpx.Response) -> float | None:
    value = response.headers.get("Retry-After")
    if value is None or not value.strip():
        return None
    try:
        return max(0.0, float(value.strip()))
    except ValueError:
        try:
            target = parsedate_to_datetime(value)
            if target.tzinfo is None:
                target = target.replace(tzinfo=timezone.utc)
            return max(0.0, (target - datetime.now(timezone.utc)).total_seconds())
        except (TypeError, ValueError, OverflowError):
            return None


def _rate_limit_category(response: httpx.Response) -> str | None:
    """Extract only provider classification tokens; never retain the response message/body."""
    try:
        payload = response.json()
    except ValueError:
        return None
    error = payload.get("error") if isinstance(payload, dict) else None
    if not isinstance(error, dict):
        return None
    tokens: list[str] = []

    def add(value: object) -> None:
        if not isinstance(value, str):
            return
        candidate = value.rsplit("/", 1)[-1].rsplit(".", 1)[-1]
        if re.fullmatch(r"[A-Za-z0-9_:-]{1,80}", candidate) and candidate not in tokens:
            tokens.append(candidate)

    add(error.get("status"))
    details = error.get("details")
    if isinstance(details, list):
        for detail in details:
            if not isinstance(detail, dict):
                continue
            add(detail.get("reason"))
            violations = detail.get("violations")
            if isinstance(violations, list):
                for violation in violations:
                    if isinstance(violation, dict):
                        add(violation.get("quotaId"))
            if len(tokens) >= 3:
                break
    return ":".join(tokens[:3]) or None


def _gemini_json_schema(value: object) -> object:
    if isinstance(value, list):
        return [_gemini_json_schema(item) for item in value]
    if not isinstance(value, dict):
        return value

    output: dict[str, object] = {}
    if "const" in value:
        output["enum"] = [value["const"]]
    for key, item in value.items():
        if key == "const" or key not in _SUPPORTED_JSON_SCHEMA_KEYS:
            continue
        if key in {"properties", "$defs"} and isinstance(item, dict):
            output[key] = {str(name): _gemini_json_schema(schema) for name, schema in item.items()}
        else:
            output[key] = _gemini_json_schema(item)
    return output
