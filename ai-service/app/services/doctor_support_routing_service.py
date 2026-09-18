from __future__ import annotations

import json
import logging
import os
import time

from pydantic import ValidationError

from app.model_runtime import MedGemmaRuntime
from app.prompts.doctor_request_router_v1 import PROMPT_VERSION, SCHEMA_VERSION, build_messages
from app.schemas.doctor_support import (
    DoctorSupportModelDecision,
    DoctorSupportModelObject,
    DoctorSupportRoutingDecision,
    DoctorSupportRoutingRequest,
    router_response_schema,
    RoutingStatus,
)

LOGGER = logging.getLogger(__name__)


class InvalidRouterOutputError(RuntimeError):
    def __init__(self, reason_code: str) -> None:
        super().__init__("Doctor support router output was rejected.")
        self.reason_code = reason_code


class DoctorSupportRoutingService:
    def __init__(self, runtime: MedGemmaRuntime) -> None:
        self._runtime = runtime
        self._max_tokens = max(128, min(int(os.getenv("DOCTOR_SUPPORT_ROUTER_MAX_TOKENS", "256")), 256))

    def route(self, request: DoctorSupportRoutingRequest) -> DoctorSupportRoutingDecision:
        allowed = [item.taskId for item in request.taskCatalog]
        started = time.perf_counter()
        generation = self._runtime.generate(
            build_messages(request),
            response_schema=router_response_schema(allowed),
            max_tokens=self._max_tokens,
        )
        LOGGER.info(
            "doctor_router_generation request_id=%s endpoint=/internal/v1/doctor-support/route "
            "duration_ms=%d prompt_tokens=%s completion_tokens=%s finish_reason=%s",
            request.requestId, round((time.perf_counter() - started) * 1000),
            generation.prompt_tokens, generation.completion_tokens,
            generation.finish_reason if generation.finish_reason in {"stop", "length"} else "other",
        )
        if generation.finish_reason == "length":
            raise InvalidRouterOutputError("ROUTER_TRUNCATED")
        try:
            raw = json.loads(generation.content)
        except json.JSONDecodeError as exc:
            raise InvalidRouterOutputError("MALFORMED_ROUTER_JSON") from exc
        try:
            candidate = DoctorSupportModelObject.model_validate(raw)
        except ValidationError as exc:
            raise InvalidRouterOutputError("INVALID_ROUTER_CONTRACT") from exc

        allowed_set = set(allowed)
        returned = candidate.taskIds + candidate.clarificationOptionTaskIds
        if any(item not in allowed_set for item in returned):
            raise InvalidRouterOutputError("UNKNOWN_ROUTER_TASK")

        # Every normalization can only remove execution authority. Unknown IDs,
        # malformed JSON and invalid structure have already been rejected.
        normalized = False
        if candidate.status == RoutingStatus.CLARIFICATION_REQUIRED:
            choices = list(dict.fromkeys(candidate.clarificationOptionTaskIds + candidate.taskIds))
            normalized = bool(candidate.taskIds) or choices != candidate.clarificationOptionTaskIds
            candidate.taskIds = []
            candidate.clarificationOptionTaskIds = choices
        elif candidate.status == RoutingStatus.UNSUPPORTED:
            normalized = bool(returned)
            candidate.taskIds = []
            candidate.clarificationOptionTaskIds = []
        elif candidate.clarificationOptionTaskIds:
            normalized = True
            candidate.status = RoutingStatus.CLARIFICATION_REQUIRED
            candidate.clarificationOptionTaskIds = list(dict.fromkeys(returned))
            candidate.taskIds = []
        try:
            model_decision = DoctorSupportModelDecision.model_validate(candidate.model_dump())
        except ValidationError as exc:
            raise InvalidRouterOutputError("INVALID_ROUTER_CONTRACT") from exc
        if normalized:
            LOGGER.info("doctor_router_normalized request_id=%s category=ROUTER_CONTRACT_NORMALIZED", request.requestId)

        return DoctorSupportRoutingDecision(
            status=model_decision.status,
            taskIds=model_decision.taskIds,
            clarificationOptionTaskIds=model_decision.clarificationOptionTaskIds,
            promptVersion=PROMPT_VERSION,
            schemaVersion=SCHEMA_VERSION,
        )
