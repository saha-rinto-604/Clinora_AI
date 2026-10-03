from __future__ import annotations

import json
from time import perf_counter

from app.model_runtime import MedGemmaRuntime, MalformedModelResponseError
from app.schemas.research_evaluation import (
    AbnormalityEvaluationRequest, AbnormalityEvaluationResponse, PredictionPayload,
)

PROMPT_VERSION = "abnormality-all-v1"
# Bounds output/context size; no sampling. The usual 20-30 observations use one call.
BATCH_SIZE = 32
SYSTEM_PROMPT = (
    "For each supplied laboratory observation, classify independently as NORMAL or ABNORMAL "
    "using the supplied value, unit, and laboratory reference interval. "
    "Return JSON only: {\"predictions\":[{\"sampleKey\":\"...\",\"label\":\"NORMAL\"}]}. "
    "Do not explain. Do not diagnose disease."
)


class ResearchEvaluationService:
    def __init__(self, runtime: MedGemmaRuntime) -> None:
        self._runtime = runtime

    def evaluate_abnormality(self, request: AbnormalityEvaluationRequest) -> AbnormalityEvaluationResponse:
        self._runtime.ensure_loaded()
        predictions = []
        calls = 0
        started = perf_counter()
        for offset in range(0, len(request.samples), BATCH_SIZE):
            batch = request.samples[offset:offset + BATCH_SIZE]
            expected = {sample.sampleKey for sample in batch}
            schema = PredictionPayload.model_json_schema()
            schema["properties"]["predictions"].update(minItems=len(batch), maxItems=len(batch))
            schema["$defs"]["AbnormalityPrediction"]["properties"]["sampleKey"]["enum"] = sorted(expected)
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(
                    [sample.model_dump() for sample in batch], separators=(",", ":"))},
            ]
            # One strict-format retry maximum; runtime failures propagate immediately.
            for attempt in range(2):
                calls += 1
                try:
                    generation = self._runtime.generate(messages=messages, response_schema=schema, max_tokens=2048)
                    payload = PredictionPayload.model_validate_json(generation.content)
                    keys = [p.sampleKey for p in payload.predictions]
                    if len(keys) != len(expected) or set(keys) != expected:
                        raise ValueError("Incomplete or duplicate predictions")
                    predictions.extend(payload.predictions)
                    break
                except (ValueError, MalformedModelResponseError) as exc:
                    if attempt == 1:
                        raise ValueError("Invalid AI evaluation response") from exc
                    messages[0] = {"role": "system", "content": SYSTEM_PROMPT +
                        " Exactly one prediction per supplied sampleKey, no extra keys or fields."}
        metadata = self._runtime.metadata
        return AbnormalityEvaluationResponse(
            predictions=predictions, executionProvider="LLAMA_CPP_MEDGEMMA",
            modelName=metadata.model_name, modelRevision=metadata.model_revision,
            promptVersion=PROMPT_VERSION, generationCallCount=calls,
            inferenceDurationMs=round((perf_counter() - started) * 1000),
        )
