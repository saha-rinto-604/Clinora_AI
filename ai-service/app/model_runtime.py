from __future__ import annotations

import os
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse
from types import MappingProxyType

import httpx

from app.schemas.report_analysis import ClusterModelPayload
from app.clinical_evidence import is_strong_evidence, is_context_only, authoritative_states


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
    prompt_tokens: int | None = None


class VerifiedObservationIds(tuple):
    """Backward-compatible ID sequence carrying facts for generation constraints."""

    def __new__(cls, observations):
        facts = {str(item.observationId): item for item in observations}
        instance = super().__new__(cls, facts)
        instance.facts = MappingProxyType(facts)
        return instance


def _llama_response_schema(allowed_observation_ids: Iterable[str] | None = None) -> dict[str, object]:
    """Constrain generation to Clinora's concise response contract and supplied evidence IDs."""
    schema = ClusterModelPayload.model_json_schema()
    schema["required"] = ["clusters", "overallInterpretation"]
    schema["properties"] = {name: schema["properties"][name]
                            for name in ("overallInterpretation", "clusters")}
    schema["properties"]["overallInterpretation"]["maxLength"] = 600
    definitions = schema["$defs"]
    cluster = definitions["ModelClinicalCluster"]["properties"]
    candidate = definitions["ModelClusterCandidate"]["properties"]
    evidence = definitions["ModelClusterEvidence"]["properties"]
    # Group evidence before interpreting it and naming conditions. Keep live
    # generation concise; optional evidence-bound claim arrays are understood by
    # grounding but need not duplicate every authoritative fact during inference.
    definitions["ModelClinicalCluster"]["properties"] = {
        name: cluster[name] for name in (
            "interpretation", "evidence", "title", "candidates", "missingEvidence", "alternatives",
        )
    }
    candidate.pop("rationaleClaims")
    candidate["rationale"] = {"type": "string", "minLength": 1, "maxLength": 500}
    definitions["ModelClusterCandidate"]["properties"] = {
        name: candidate[name] for name in (
            "rationale", "name", "supportingObservationIds", "contradictoryObservationIds",
            "missingEvidence", "alternatives",
        )
    }
    definitions["ModelClinicalCluster"]["properties"]["interpretation"] = {
        "type": "string", "minLength": 1, "maxLength": 500,
    }
    # Defaulted Pydantic fields are optional unless explicitly required for
    # generation. Missing-context/alternative fields must not silently disappear.
    for name in ("ModelClinicalCluster", "ModelClusterCandidate", "ModelClusterEvidence", "ReasoningClaim", "ReasoningPremise"):
        definitions[name]["required"] = list(definitions[name]["properties"])
    cluster["title"]["maxLength"] = 100
    cluster["interpretation"]["maxLength"] = 500
    cluster["evidence"]["maxItems"] = 6
    candidate["name"]["maxLength"] = 100
    definitions["ReasoningClaim"]["properties"]["text"]["maxLength"] = 300
    definitions["ReasoningClaim"]["properties"]["premises"]["maxItems"] = 3
    cluster["interpretationClaims"]["maxItems"] = 1
    evidence["clinicalRelevance"]["maxLength"] = 180
    for properties in (cluster, candidate):
        for field in ("missingEvidence", "alternatives"):
            properties[field]["maxItems"] = 1
            properties[field]["items"]["maxLength"] = 160
    candidate["missingEvidence"]["minItems"] = 1
    candidate["alternatives"]["minItems"] = 1
    for field in ("supportingObservationIds", "contradictoryObservationIds"):
        candidate[field]["maxItems"] = 6

    if allowed_observation_ids is not None:
        allowed_ids = list(dict.fromkeys(item.strip() for item in allowed_observation_ids if item.strip()))
        if allowed_ids:
            evidence["observationId"]["enum"] = allowed_ids
            definitions["ReasoningPremise"]["properties"]["observationId"]["enum"] = allowed_ids
            for field in ("supportingObservationIds", "contradictoryObservationIds"):
                candidate[field]["items"]["enum"] = allowed_ids
        facts = getattr(allowed_observation_ids, "facts", allowed_observation_ids)
        if isinstance(facts, Mapping):
            # Choose a verified label first; the grammar then supplies its exact
            # UUID. The model cannot attach that label to a neighboring result.
            # This constrains identity/eligibility only, never medical meaning.
            branches = []
            for key, observation in facts.items():
                roles = ["CONTEXT"]
                if is_strong_evidence(observation):
                    roles.append("SUPPORTS")
                if not is_context_only(observation):
                    roles.append("CONTRADICTS")
                branches.append({
                    "type": "object", "additionalProperties": False,
                    "properties": {
                        "observationLabel": {"const": observation.label},
                        "observationId": {"const": key},
                        "authoritativeStatus": {"const": next(
                            (state for state in ("POSITIVE", "NEGATIVE", "HIGH", "LOW", "IN_RANGE")
                             if state in authoritative_states(observation)), "UNKNOWN")},
                        "role": {"type": "string", "enum": roles},
                        "clinicalRelevance": evidence["clinicalRelevance"],
                    },
                    "required": ["observationLabel", "observationId", "authoritativeStatus", "role", "clinicalRelevance"],
                })
            definitions["ModelClusterEvidence"] = {"oneOf": branches}
            supporting_ids = [key for key, observation in facts.items()
                              if is_strong_evidence(observation)]
            if supporting_ids:
                candidate["supportingObservationIds"]["items"]["enum"] = supporting_ids
            else:
                cluster["candidates"]["maxItems"] = 0
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
        self._max_new_tokens = max(256, min(int(os.getenv("AI_MAX_NEW_TOKENS", "3072")), 3072))
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

    def generate(
        self,
        messages: list[dict[str, object]],
        allowed_observation_ids: Iterable[str] | None = None,
    ) -> ModelGeneration:
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
                        "schema": _llama_response_schema(allowed_observation_ids),
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
            prompt_tokens = usage.get("prompt_tokens") if isinstance(usage, dict) else None
            if not isinstance(prompt_tokens, int):
                prompt_tokens = None
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            self._last_error = exc.__class__.__name__
            raise MalformedModelResponseError(
                "MALFORMED_LLAMA_ENVELOPE",
                f"error_type={exc.__class__.__name__}",
            ) from exc

        self._ready = True
        self._last_error = None
        return ModelGeneration(content.strip(), finish_reason, completion_tokens, prompt_tokens)

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
