from __future__ import annotations

import asyncio
import hmac
import os
import uuid

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

from .engine import OcrInputError, OcrProcessingError, ensure_primary_engine_ready, extract_document
from .schemas import ExtractionResponse

app = FastAPI(title="Clinora OCR Service", version="1.0.0")
_MAX_WORKERS = max(1, int(os.getenv("OCR_MAX_WORKERS", "2")))
_JOB_TIMEOUT = max(10, int(os.getenv("OCR_JOB_TIMEOUT_SECONDS", "60")))
_WORKER_SLOTS = asyncio.Semaphore(_MAX_WORKERS)
_INTERNAL_TOKEN = os.getenv("OCR_INTERNAL_TOKEN", "dev-only-clinora-ocr-token-change-me")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "UP", "service": "ocr-service"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    try:
        engine = await asyncio.to_thread(ensure_primary_engine_ready)
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"code": "OCR_NOT_READY", "message": "OCR models are not ready."}) from exc
    return {"status": "READY", "service": "ocr-service", "engine": engine}


@app.post("/internal/v1/extract", response_model=ExtractionResponse)
async def extract(
    file: UploadFile = File(...),
    requestId: str = Form(...),
    internal_token: str | None = Header(default=None, alias="X-Clinora-Internal-Token"),
) -> ExtractionResponse:
    if not internal_token or not hmac.compare_digest(internal_token, _INTERNAL_TOKEN):
        raise HTTPException(status_code=401, detail={"code": "INTERNAL_AUTH_REQUIRED", "message": "Internal service authentication is required."})
    try:
        uuid.UUID(requestId)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "INVALID_REQUEST_ID", "message": "A valid request identifier is required."}) from exc

    content = await file.read()
    try:
        async with _WORKER_SLOTS:
            return await asyncio.wait_for(
                asyncio.to_thread(extract_document, content, file.content_type, file.filename),
                timeout=_JOB_TIMEOUT,
            )
    except asyncio.TimeoutError as exc:
        raise HTTPException(status_code=504, detail={"code": "OCR_TIMEOUT", "message": "Report extraction exceeded the processing time limit."}) from exc
    except OcrInputError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": exc.message}) from exc
    except OcrProcessingError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc
    except Exception as exc:
        # Deliberately avoid logging filenames, OCR text, or other report content here.
        raise HTTPException(status_code=500, detail={"code": "PROCESSING_FAILED", "message": "The report could not be processed."}) from exc
    finally:
        await file.close()
