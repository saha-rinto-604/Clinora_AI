from __future__ import annotations

import logging
import os
import secrets

from fastapi import APIRouter, Header, HTTPException, status

from app.model_runtime import MalformedModelResponseError, ModelCapacityError, ModelUnavailableError
from app.schemas.report_analysis import ReportAnalysisRequest, ReportAnalysisResponse
from app.services.report_analysis_service import InvalidModelOutputError, ReportAnalysisService, UnsafeModelOutputError

LOGGER = logging.getLogger(__name__)


def _expected_internal_token() -> str:
    return os.getenv("AI_INTERNAL_TOKEN", "").strip() or "dev-only-clinora-ai-token-change-me"


def _authorize(token: str | None) -> None:
    expected = _expected_internal_token()
    if not token or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized internal request.")


def build_router(service: ReportAnalysisService) -> APIRouter:
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

    return router
