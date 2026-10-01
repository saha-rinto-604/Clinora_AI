"""PHI-safe metrics for Patient analysis only; no model content is recorded."""
from __future__ import annotations

import json
import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from uuid import UUID

from app.model_runtime import safe_generation_timings

LOGGER = logging.getLogger(__name__)


@dataclass
class PatientAnalysisMetrics:
    request_id: UUID
    started: float = field(default_factory=time.perf_counter)
    queue_wait_ms: float = 0.0
    inference_duration_ms: float = 0.0
    repair_duration_ms: float = 0.0
    grounding_validation_ms: float = 0.0
    generation_call_count: int = 0
    repair_attempted: bool = False
    generations: list[dict] = field(default_factory=list)

    @contextmanager
    def stage(self, name: str):
        started = time.perf_counter()
        try:
            yield
        finally:
            setattr(self, name, getattr(self, name) + (time.perf_counter() - started) * 1000)

    @contextmanager
    def generation(self, repair: bool):
        self.generation_call_count += 1
        self.repair_attempted |= repair
        started = time.perf_counter()
        try:
            yield
        finally:
            elapsed = (time.perf_counter() - started) * 1000
            self.inference_duration_ms += elapsed
            if repair:
                self.repair_duration_ms += elapsed

    def record(self, generation) -> None:
        # Provider strings are untrusted: even finish_reason uses an allowlist.
        finish = getattr(generation, "finish_reason", None)
        row = {"finish_reason": finish if finish in {"stop", "length", "content_filter", "tool_calls"} else None}
        for key in ("prompt_tokens", "completion_tokens"):
            value = getattr(generation, key, None)
            row[key] = value if type(value) is int and value >= 0 else None
        row["timings"] = safe_generation_timings(getattr(generation, "timings", None))
        self.generations.append(row)

    def emit(self, outcome: str) -> None:
        record = {
            "event": "patient_ai_performance", "scope": "ai_service",
            "request_id": str(self.request_id), "outcome": outcome,
            "generation_call_count": self.generation_call_count,
            "repair_attempted": self.repair_attempted,
            "finish_reason": self.generations[-1]["finish_reason"] if self.generations else None,
            "generations": self.generations,
            "total_ms": round((time.perf_counter() - self.started) * 1000, 3),
        }
        for key in ("queue_wait_ms", "inference_duration_ms", "repair_duration_ms", "grounding_validation_ms"):
            record[key] = round(getattr(self, key), 3)
        for key in ("prompt_tokens", "completion_tokens"):
            values = [item[key] for item in self.generations]
            record[key] = sum(values) if values and all(value is not None for value in values) else None
        LOGGER.info("%s", json.dumps(record, separators=(",", ":")))
