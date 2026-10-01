"""Request-local, allowlisted OCR timings. Never accept report data as labels."""
from __future__ import annotations

import json
import logging
import time
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from uuid import UUID

LOGGER = logging.getLogger(__name__)
# Paddle predictor initialization raises the root level to WARNING. Keep these
# fixed, PHI-safe records visible without enabling verbose third-party logging.
LOGGER.setLevel(logging.INFO)
STAGES = (
    "queue_wait_ms", "source_load_ms", "document_render_ms",
    "paddle_initialization_ms", "paddle_inference_ms", "parser_normalizer_ms",
)
_CURRENT: ContextVar[OcrTimings | None] = ContextVar("ocr_timings", default=None)


@dataclass
class OcrTimings:
    request_id: str | None = None
    stages: dict[str, float] = field(default_factory=lambda: dict.fromkeys(STAGES, 0.0))
    started: float = field(default_factory=time.perf_counter)

    @contextmanager
    def activate(self):
        token = _CURRENT.set(self)
        try:
            yield self
        finally:
            _CURRENT.reset(token)

    def emit(self, outcome: str) -> None:
        record = {key: round(self.stages[key], 3) for key in STAGES}
        record.update(event="ocr_performance", scope="ocr_service", outcome=outcome,
                      total_ms=round((time.perf_counter() - self.started) * 1000, 3))
        if self.request_id is not None:
            record["request_id"] = str(UUID(self.request_id))
        # Persistence and RabbitMQ waiting are measured by the backend worker.
        LOGGER.info("%s", json.dumps(record, separators=(",", ":")))


@contextmanager
def stage(name: str):
    if name not in STAGES:
        raise ValueError("Unknown OCR timing stage")
    started = time.perf_counter()
    try:
        yield
    finally:
        metrics = _CURRENT.get()
        if metrics is not None:
            metrics.stages[name] += (time.perf_counter() - started) * 1000


def current() -> OcrTimings | None:
    return _CURRENT.get()
