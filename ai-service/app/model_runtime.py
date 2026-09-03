from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import httpx

from app.schemas.report_analysis import ModelAnalysisPayload


class ModelUnavailableError(RuntimeError):
    pass


class ModelCapacityError(RuntimeError):
    pass


class MalformedModelResponseError(RuntimeError):
    def __init__(self, reason_code: str, diagnostics: str) -> None:
        super().__init__("llama.cpp returned a malformed chat completion.")
        self.reason_code = reason_code
        self.diagnostics = diagnostics


@dataclass(frozen=True)
class RuntimeMetadata:
    model_name: str
    model_revision: str
    quantization: str


@dataclass(frozen=True)
class ModelGeneration:
    content: str
    finish_reason: str | None
    completion_tokens: int | None


def _llama_response_schema() -> dict[str, object]:
    """Constrain generation to a concise subset of the unchanged Clinora response contract."""
    schema = ModelAnalysisPayload.model_json_schema()
    properties = schema["properties"]
    properties["summary"]["maxLength"] = 120
    properties["patientExplanation"]["maxLength"] = 180
    properties["notableFindings"]["maxItems"] = 2
    properties["clinicalPatterns"]["maxItems"] = 1
    properties["discussionPoints"]["maxItems"] = 1
    properties["limitations"]["maxItems"] = 2
    properties["limitations"]["items"]["maxLength"] = 80

    definitions = schema["$defs"]
    definitions["Finding"]["properties"]["title"]["maxLength"] = 60
    definitions["Finding"]["properties"]["interpretation"]["maxLength"] = 120
    definitions["ClinicalPattern"]["properties"]["name"]["maxLength"] = 80
    definitions["ClinicalPattern"]["properties"]["reasoning"]["maxLength"] = 150
    definitions["ClinicalPattern"]["properties"]["supportingObservationIds"]["maxItems"] = 3
    definitions["ClinicalPattern"]["properties"]["contradictoryObservationIds"]["maxItems"] = 2
    definitions["ClinicalPattern"]["properties"]["missingEvidence"]["maxItems"] = 2
    definitions["ClinicalPattern"]["properties"]["missingEvidence"]["items"]["maxLength"] = 80
    definitions["ClinicalPattern"]["properties"]["possibleCauses"]["maxItems"] = 2
    definitions["ClinicalPattern"]["properties"]["possibleCauses"]["items"]["maxLength"] = 60
    definitions["DiscussionPoint"]["properties"]["title"]["maxLength"] = 80
    definitions["DiscussionPoint"]["properties"]["reason"]["maxLength"] = 120
    return schema


class MedGemmaRuntime:
    """Private adapter from Clinora's validated prompt to a local llama.cpp server."""

    def __init__(self, client: httpx.Client | None = None) -> None:
        self._model_name = os.getenv("HF_MODEL", "").strip() or "google/medgemma-1.5-4b-it"
        self._model_revision = os.getenv("HF_MODEL_REVISION", "main").strip() or "main"
        self._quantization = os.getenv("AI_QUANTIZATION", "Q4_0").strip() or "Q4_0"
        self._server_url = (
            os.getenv("LLAMA_SERVER_URL", "").strip() or "http://127.0.0.1:8002"
        ).rstrip("/")
        parsed_server_url = urlparse(self._server_url)
        if (
            parsed_server_url.scheme != "http"
            or parsed_server_url.hostname not in {"127.0.0.1", "localhost", "::1"}
            or parsed_server_url.username is not None
            or parsed_server_url.password is not None
        ):
            raise ValueError("LLAMA_SERVER_URL must be an unauthenticated local HTTP loopback URL.")
        self._max_new_tokens = max(256, min(int(os.getenv("AI_MAX_NEW_TOKENS", "768")), 1200))
        self._seed = int(os.getenv("AI_GENERATION_SEED", "0"))
        connect_timeout = max(1.0, float(os.getenv("LLAMA_CONNECT_TIMEOUT_SECONDS", "5")))
        read_timeout = max(30.0, float(os.getenv("LLAMA_READ_TIMEOUT_SECONDS", "240")))
        self._client = client or httpx.Client(
            base_url=self._server_url,
            timeout=httpx.Timeout(read_timeout, connect=connect_timeout),
        )
        self._ready = False
        self._last_error: str | None = None

    @property
    def metadata(self) -> RuntimeMetadata:
        return RuntimeMetadata(self._model_name, self._model_revision, self._quantization)

    @property
    def loaded(self) -> bool:
        return self._ready

    @property
    def last_error(self) -> str | None:
        return self._last_error

    def ensure_loaded(self) -> None:
        """llama.cpp /health reports ok only after its model is loaded."""
        try:
            response = self._client.get("/health")
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict) or payload.get("status") != "ok":
                raise ValueError("llama.cpp health response did not report model readiness")
            self._ready = True
            self._last_error = None
        except (httpx.HTTPError, ValueError) as exc:
            self._ready = False
            self._last_error = exc.__class__.__name__
            raise ModelUnavailableError("MedGemma is not ready for inference.") from exc

    def generate(self, messages: list[dict[str, object]]) -> ModelGeneration:
        request_messages = [self._chat_message(message) for message in messages]
        try:
            response = self._client.post(
                "/v1/chat/completions",
                json={
                    "messages": request_messages,
                    "temperature": 0,
                    "top_p": 1,
                    "seed": self._seed,
                    "max_tokens": self._max_new_tokens,
                    "stream": False,
                    "response_format": {
                        "type": "json_object",
                        "schema": _llama_response_schema(),
                    },
                },
            )
            if response.status_code == 429:
                raise ModelCapacityError("The local MedGemma runtime is busy.")
            response.raise_for_status()
        except ModelCapacityError:
            raise
        except httpx.HTTPError as exc:
            self._ready = False
            self._last_error = exc.__class__.__name__
            raise ModelUnavailableError("MedGemma is not available for inference.") from exc

        try:
            payload = response.json()
            choice = payload["choices"][0]
            content = choice["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise ValueError("llama.cpp returned empty completion content")
            finish_reason = choice.get("finish_reason")
            if finish_reason is not None and not isinstance(finish_reason, str):
                raise TypeError("llama.cpp returned an invalid finish reason")
            usage = payload.get("usage", {})
            completion_tokens = usage.get("completion_tokens") if isinstance(usage, dict) else None
            if completion_tokens is not None and not isinstance(completion_tokens, int):
                completion_tokens = None
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            self._last_error = exc.__class__.__name__
            raise MalformedModelResponseError(
                "MALFORMED_LLAMA_ENVELOPE",
                f"error_type={exc.__class__.__name__}",
            ) from exc

        self._ready = True
        self._last_error = None
        return ModelGeneration(content.strip(), finish_reason, completion_tokens)

    @staticmethod
    def _chat_message(message: dict[str, object]) -> dict[str, str]:
        role = message.get("role")
        content: Any = message.get("content")
        if role not in {"system", "user", "assistant"}:
            raise ValueError("Unsupported chat message role.")
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            text = "\n".join(
                item["text"]
                for item in content
                if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str)
            )
        else:
            text = ""
        if not text.strip():
            raise ValueError("Chat message content must contain text.")
        return {"role": role, "content": text}
