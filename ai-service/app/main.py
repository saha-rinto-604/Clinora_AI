from __future__ import annotations

from fastapi import FastAPI, HTTPException, status

from app.api.internal_analysis import build_router
from app.model_runtime import MedGemmaRuntime, ModelUnavailableError
from app.services.report_analysis_service import ReportAnalysisService

runtime = MedGemmaRuntime()
analysis_service = ReportAnalysisService(runtime)

app = FastAPI(title="Clinora AI Service", version="0.2.0")
app.include_router(build_router(analysis_service))


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "UP", "service": "ai-service"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    try:
        runtime.ensure_loaded()
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MedGemma is not ready.",
        ) from exc
    metadata = runtime.metadata
    return {
        "status": "READY",
        "service": "ai-service",
        "model": metadata.model_name,
        "revision": metadata.model_revision,
        "quantization": metadata.quantization,
    }
