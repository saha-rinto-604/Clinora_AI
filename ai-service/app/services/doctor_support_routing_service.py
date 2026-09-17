from __future__ import annotations

import json

from pydantic import ValidationError

from app.model_runtime import MedGemmaRuntime
from app.prompts.doctor_request_router_v1 import PROMPT_VERSION, SCHEMA_VERSION, build_messages
from app.schemas.doctor_support import (
    DoctorSupportModelDecision,
    DoctorSupportRoutingDecision,
    DoctorSupportRoutingRequest,
    router_response_schema,
)


class InvalidRouterOutputError(RuntimeError):
    def __init__(self, reason_code: str) -> None:
        super().__init__("Doctor support router output was rejected.")
        self.reason_code = reason_code


class DoctorSupportRoutingService:
    def __init__(self, runtime: MedGemmaRuntime) -> None:
        self._runtime = runtime

    def route(self, request: DoctorSupportRoutingRequest) -> DoctorSupportRoutingDecision:
        allowed = [item.taskId for item in request.taskCatalog]
        generation = self._runtime.generate(
            build_messages(request),
            response_schema=router_response_schema(allowed),
        )
        try:
            raw = json.loads(generation.content)
        except json.JSONDecodeError as exc:
            raise InvalidRouterOutputError("MALFORMED_ROUTER_JSON") from exc
        try:
            model_decision = DoctorSupportModelDecision.model_validate(raw)
        except ValidationError as exc:
            raise InvalidRouterOutputError("INVALID_ROUTER_CONTRACT") from exc

        allowed_set = set(allowed)
        returned = model_decision.taskIds + model_decision.clarificationOptionTaskIds
        if any(item not in allowed_set for item in returned):
            raise InvalidRouterOutputError("UNKNOWN_ROUTER_TASK")

        return DoctorSupportRoutingDecision(
            status=model_decision.status,
            taskIds=model_decision.taskIds,
            clarificationOptionTaskIds=model_decision.clarificationOptionTaskIds,
            promptVersion=PROMPT_VERSION,
            schemaVersion=SCHEMA_VERSION,
        )
