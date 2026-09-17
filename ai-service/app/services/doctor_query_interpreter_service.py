from __future__ import annotations

import json
import os
import time

from pydantic import ValidationError

from app.model_runtime import MalformedModelResponseError, MedGemmaRuntime
from app.prompts.doctor_query_interpreter_v1 import PROMPT_VERSION, SCHEMA_VERSION, build_messages
from app.schemas.doctor_query_frame import (
    DoctorClinicalQueryFrame,
    DoctorQueryInterpretationRequest,
    DoctorQueryInterpretationResponse,
    query_frame_response_schema,
)


class InvalidDoctorQueryInterpretationError(RuntimeError):
    def __init__(self, reason_code: str) -> None:
        super().__init__("Doctor query interpretation output was rejected.")
        self.reason_code = reason_code


class DoctorQueryInterpreterService:
    """Small local MedGemma call that extracts intent/stance/context but never answers clinically."""

    def __init__(self, runtime: MedGemmaRuntime) -> None:
        self._runtime = runtime
        configured = int(os.getenv("DOCTOR_QUERY_INTERPRETER_MAX_TOKENS", "320"))
        self._max_tokens = max(128, min(configured, 512))

    def interpret(self, request: DoctorQueryInterpretationRequest) -> DoctorQueryInterpretationResponse:
        started = time.perf_counter()
        generation = self._runtime.generate(
            build_messages(request),
            response_schema=query_frame_response_schema(),
            max_tokens=self._max_tokens,
        )
        duration_ms = max(0, round((time.perf_counter() - started) * 1000))
        if generation.finish_reason == "length":
            raise InvalidDoctorQueryInterpretationError("QUERY_INTERPRETER_TRUNCATED")
        try:
            raw = json.loads(generation.content)
        except json.JSONDecodeError as exc:
            raise InvalidDoctorQueryInterpretationError("MALFORMED_QUERY_FRAME_JSON") from exc
        try:
            frame = DoctorClinicalQueryFrame.model_validate(raw)
        except ValidationError as exc:
            raise InvalidDoctorQueryInterpretationError("INVALID_QUERY_FRAME_CONTRACT") from exc
        return DoctorQueryInterpretationResponse(
            frame=frame,
            promptVersion=PROMPT_VERSION,
            schemaVersion=SCHEMA_VERSION,
            finishReason=generation.finish_reason,
            promptTokens=generation.prompt_tokens,
            completionTokens=generation.completion_tokens,
            durationMs=duration_ms,
        )
