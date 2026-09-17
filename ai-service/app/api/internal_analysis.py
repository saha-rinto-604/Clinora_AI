from __future__ import annotations

import logging
import os
import secrets

from fastapi import APIRouter, Header, HTTPException, status

from app.model_runtime import MalformedModelResponseError, ModelCapacityError, ModelUnavailableError
from app.schemas.report_analysis import ReportAnalysisRequest, ReportAnalysisResponse
from app.services.report_analysis_service import InvalidModelOutputError, ReportAnalysisService, UnsafeModelOutputError
from app.schemas.doctor_support import DoctorSupportRoutingDecision, DoctorSupportRoutingRequest
from app.services.doctor_support_routing_service import DoctorSupportRoutingService, InvalidRouterOutputError
from app.schemas.doctor_support_execution import DoctorSupportExecutionRequest, DoctorSupportExecutionResponse
from app.services.doctor_support_execution_service import DoctorSupportExecutionService

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
            _authorize(x_clinora_internal_token)
            try:
                return doctor_support_service.route(request)
            except ModelCapacityError as exc:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The local AI model is busy.") from exc
            except ModelUnavailableError as exc:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The local AI model is unavailable.") from exc
            except (InvalidRouterOutputError, MalformedModelResponseError) as exc:
                LOGGER.warning(
                    "Doctor support router output rejected for request %s: type=%s reason=%s",
                    request.requestId,
                    exc.__class__.__name__,
                    getattr(exc, "reason_code", "UNKNOWN_REJECTION"),
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="The routing response did not pass Clinora validation.",
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
