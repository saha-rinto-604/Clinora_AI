from __future__ import annotations

import logging
import os
import secrets
import time

from fastapi import APIRouter, Header, HTTPException, status

from app.model_runtime import MalformedModelResponseError, ModelCapacityError, ModelUnavailableError, ModelTimeoutError
from app.schemas.report_analysis import ReportAnalysisRequest, ReportAnalysisResponse
from app.services.report_analysis_service import InvalidModelOutputError, ReportAnalysisService, UnsafeModelOutputError
from app.schemas.doctor_support import DoctorSupportRoutingDecision, DoctorSupportRoutingRequest
from app.services.doctor_support_routing_service import DoctorSupportRoutingService, InvalidRouterOutputError
from app.schemas.doctor_support_execution import DoctorSupportExecutionRequest, DoctorSupportExecutionResponse
from app.services.doctor_support_execution_service import DoctorSupportExecutionService
from app.schemas.doctor_query_frame import DoctorQueryInterpretationRequest, DoctorQueryInterpretationResponse
from app.services.doctor_query_interpreter_service import (
    DoctorQueryInterpreterService,
    InvalidDoctorQueryInterpretationError,
)

LOGGER = logging.getLogger(__name__)


def _expected_internal_token() -> str:
    return os.getenv("AI_INTERNAL_TOKEN", "").strip() or "dev-only-clinora-ai-token-change-me"


def _authorize(token: str | None) -> None:
    expected = _expected_internal_token()
    if not token or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized internal request.")


def build_router(
    service: ReportAnalysisService,
    doctor_support_service: DoctorSupportRoutingService | None = None,
    doctor_support_execution_service: DoctorSupportExecutionService | None = None,
    doctor_query_interpreter_service: DoctorQueryInterpreterService | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/internal/v1", tags=["internal"])

    @router.post("/report-analysis", response_model=ReportAnalysisResponse)
    def analyze_report(
        request: ReportAnalysisRequest,
        x_clinora_internal_token: str | None = Header(default=None, alias="X-Clinora-Internal-Token"),
    ) -> ReportAnalysisResponse:
        _authorize(x_clinora_internal_token)
        try:
            return service.analyze(request)
        except ModelCapacityError as exc:
            LOGGER.warning("MedGemma capacity failure for request %s", request.requestId)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The local AI model does not currently have enough GPU capacity.",
            ) from exc
        except ModelUnavailableError as exc:
            LOGGER.warning("MedGemma unavailable for request %s", request.requestId)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The local AI model is unavailable.",
            ) from exc
        except (InvalidModelOutputError, MalformedModelResponseError, UnsafeModelOutputError) as exc:
            LOGGER.warning(
                "MedGemma output rejected for request %s: type=%s reason=%s diagnostics=%s",
                request.requestId,
                exc.__class__.__name__,
                getattr(exc, "reason_code", "UNKNOWN_REJECTION"),
                getattr(exc, "diagnostics", "none"),
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The AI response did not pass Clinora safety validation.",
            ) from exc

    if doctor_support_service is not None:
        @router.post("/doctor-support/route", response_model=DoctorSupportRoutingDecision)
        def route_doctor_support(
            request: DoctorSupportRoutingRequest,
            x_clinora_internal_token: str | None = Header(default=None, alias="X-Clinora-Internal-Token"),
        ) -> DoctorSupportRoutingDecision:
            started = time.perf_counter()

            def failure(http_status: int, category: str, reason: str) -> HTTPException:
                LOGGER.warning(
                    "doctor_router_failure request_id=%s category=%s downstream_status=%d "
                    "duration_ms=%d endpoint=/internal/v1/doctor-support/route reason=%s",
                    request.requestId, category, http_status, round((time.perf_counter() - started) * 1000), reason,
                )
                return HTTPException(status_code=http_status, detail={
                    "errorCode": category, "reasonCode": reason, "requestId": str(request.requestId),
                })

            try:
                _authorize(x_clinora_internal_token)
            except HTTPException as exc:
                raise failure(401, "ROUTER_AUTH_CONFIGURATION_ERROR", "INTERNAL_AUTH_FAILED") from exc
            try:
                return doctor_support_service.route(request)
            except ModelCapacityError as exc:
                raise failure(429, "ROUTER_MODEL_BUSY", "MODEL_CAPACITY") from exc
            except ModelTimeoutError as exc:
                raise failure(504, "ROUTER_TIMEOUT", "MODEL_TIMEOUT") from exc
            except ModelUnavailableError as exc:
                raise failure(503, "ROUTER_MODEL_UNAVAILABLE", "MODEL_UNAVAILABLE") from exc
            except InvalidRouterOutputError as exc:
                raise failure(502, "ROUTER_INVALID_RESPONSE", exc.reason_code) from exc
            except MalformedModelResponseError as exc:
                raise failure(502, "ROUTER_INVALID_RESPONSE", "MALFORMED_LLAMA_ENVELOPE") from exc

    if doctor_query_interpreter_service is not None:
        @router.post("/doctor-support/interpret", response_model=DoctorQueryInterpretationResponse)
        def interpret_doctor_query(
            request: DoctorQueryInterpretationRequest,
            x_clinora_internal_token: str | None = Header(default=None, alias="X-Clinora-Internal-Token"),
        ) -> DoctorQueryInterpretationResponse:
            _authorize(x_clinora_internal_token)
            try:
                return doctor_query_interpreter_service.interpret(request)
            except ModelCapacityError as exc:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The local AI model is busy.") from exc
            except ModelUnavailableError as exc:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The local AI model is unavailable.") from exc
            except (InvalidDoctorQueryInterpretationError, MalformedModelResponseError) as exc:
                LOGGER.warning(
                    "Doctor query interpretation rejected for request %s: type=%s reason=%s",
                    request.requestId,
                    exc.__class__.__name__,
                    getattr(exc, "reason_code", "UNKNOWN_REJECTION"),
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="The Doctor query could not be interpreted safely.",
                ) from exc

    if doctor_support_execution_service is not None:
        @router.post("/doctor-support/execute", response_model=DoctorSupportExecutionResponse)
        def execute_doctor_support(
            request: DoctorSupportExecutionRequest,
            x_clinora_internal_token: str | None = Header(default=None, alias="X-Clinora-Internal-Token"),
        ) -> DoctorSupportExecutionResponse:
            _authorize(x_clinora_internal_token)
            try:
                return doctor_support_execution_service.execute(request)
            except ModelCapacityError as exc:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The local AI model is busy.") from exc
            except ModelUnavailableError as exc:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The local AI model is unavailable.") from exc

    return router
