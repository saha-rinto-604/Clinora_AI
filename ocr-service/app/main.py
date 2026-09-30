from __future__ import annotations

import asyncio
import hmac
import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from contextvars import copy_context

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

from .engine_v3 import OcrInputError, OcrProcessingError, warm_primary_engine, extract_document
from .performance import OcrTimings, stage
from .schemas import ExtractionResponse

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.ocr_engine = None
    metrics = OcrTimings()
    outcome = "startup_failed"
    try:
        with metrics.activate():
            application.state.ocr_engine = await _on_engine_thread(warm_primary_engine)
        outcome = "startup_ready"
    finally:
        metrics.emit(outcome)
    try:
        yield
    finally:
        application.state.ocr_engine = None


app = FastAPI(title="Clinora OCR Service", version="1.0.0", lifespan=lifespan)
_MAX_WORKERS = int(os.getenv("OCR_MAX_WORKERS", "1"))
if _MAX_WORKERS != 1:
    raise ValueError("OCR_MAX_WORKERS must be 1: the shared CPU Paddle pipeline is thread-confined.")
_JOB_TIMEOUT = max(10, int(os.getenv("OCR_JOB_TIMEOUT_SECONDS", "60")))
_WORKER_SLOTS = asyncio.Semaphore(_MAX_WORKERS)
# Paddle/oneDNN predictors must initialize and execute on the same native thread.
# The process owns this executor for the same lifetime as the global pipelines.
_ENGINE_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="clinora-ocr")
_IN_FLIGHT: dict[str, asyncio.Task] = {}
_INTERNAL_TOKEN = os.getenv("OCR_INTERNAL_TOKEN", "dev-only-clinora-ocr-token-change-me")


async def _on_engine_thread(function, *args):
    context = copy_context()
    return await asyncio.get_running_loop().run_in_executor(
        _ENGINE_EXECUTOR, context.run, function, *args
    )


async def _bounded_extraction(content, content_type, filename, metrics):
    # This task, not the HTTP waiter, owns capacity until the native thread exits.
    with metrics.activate():
        with stage("queue_wait_ms"):
            await _WORKER_SLOTS.acquire()
        try:
            return await _on_engine_thread(extract_document, content, content_type, filename)
        finally:
            _WORKER_SLOTS.release()


def _finished(request_id: str, task: asyncio.Task) -> None:
    _IN_FLIGHT.pop(request_id, None)
    # Retrieve late exceptions without logging their potentially private message.
    if not task.cancelled():
        task.exception()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "UP", "service": "ocr-service"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    engine = getattr(app.state, "ocr_engine", None)
    if engine is None:
        raise HTTPException(status_code=503, detail={"code": "OCR_NOT_READY", "message": "OCR models are not ready."})
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
        requestId = str(uuid.UUID(requestId))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "INVALID_REQUEST_ID", "message": "A valid request identifier is required."}) from exc

    metrics = OcrTimings(request_id=requestId)
    outcome = "failed"
    try:
        with metrics.activate():
            with stage("source_load_ms"):
                content = await file.read()
            task = _IN_FLIGHT.get(requestId)
            if task is None:
                task = asyncio.create_task(_bounded_extraction(content, file.content_type, file.filename, metrics))
                _IN_FLIGHT[requestId] = task
                task.add_done_callback(lambda completed: _finished(requestId, completed))
            result = await asyncio.wait_for(asyncio.shield(task), timeout=_JOB_TIMEOUT)
            outcome = "completed"
            return result
    except asyncio.TimeoutError as exc:
        outcome = "timed_out"
        raise HTTPException(status_code=504, detail={"code": "OCR_TIMEOUT", "message": "Report extraction exceeded the processing time limit."}) from exc
    except OcrInputError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": exc.message}) from exc
    except OcrProcessingError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc
    except Exception as exc:
        # Deliberately avoid logging filenames, OCR text, or other report content here.
        raise HTTPException(status_code=500, detail={"code": "PROCESSING_FAILED", "message": "The report could not be processed."}) from exc
    finally:
        metrics.emit(outcome)
        await file.close()
