from __future__ import annotations

import json
import logging
import re
import threading
from collections.abc import Iterable
from uuid import UUID

from pydantic import ValidationError

from app.model_runtime import MedGemmaRuntime, ModelGeneration
from app.prompts.patient_lab_report_v1 import PROMPT_VERSION, SCHEMA_VERSION, build_messages
from app.schemas.report_analysis import (
    AnalysisStatus,
    ModelAnalysisPayload,
    ReportAnalysisRequest,
    ReportAnalysisResponse,
)


LOGGER = logging.getLogger(__name__)


class InvalidModelOutputError(RuntimeError):
    def __init__(self, message: str, reason_code: str = "INVALID_MODEL_OUTPUT", diagnostics: str = "") -> None:
        super().__init__(message)
        self.reason_code = reason_code
        self.diagnostics = diagnostics


class UnsafeModelOutputError(RuntimeError):
    def __init__(self, message: str, reason_code: str, diagnostics: str) -> None:
        super().__init__(message)
        self.reason_code = reason_code
        self.diagnostics = diagnostics


_STANDARD_LIMITATIONS = (
    "This AI-generated interpretation is not a diagnosis and should not replace evaluation by a qualified clinician.",
    "The analysis is limited to the confirmed laboratory observations supplied to Clinora and does not include a physical examination or complete clinical history.",
)

_PROHIBITED_TREATMENT_PATTERNS = (
    re.compile(r"\bstart taking\b", re.IGNORECASE),
    re.compile(r"\bstop taking\b", re.IGNORECASE),
    re.compile(r"\bchange your dose\b", re.IGNORECASE),
    re.compile(r"\btake \d+(?:\.\d+)?\s*(?:mg|mcg|g|ml)\b", re.IGNORECASE),
    re.compile(r"\bi prescribe\b", re.IGNORECASE),
)

_PROHIBITED_CERTAINTY_PATTERNS = (
    re.compile(r"\bthe diagnosis is\b", re.IGNORECASE),
    re.compile(r"\bdiagnosed with\b", re.IGNORECASE),
    re.compile(r"\bconfirmed diagnosis\b", re.IGNORECASE),
    re.compile(r"\bthis proves\b", re.IGNORECASE),
    re.compile(r"\byou (?:definitely|certainly) have\b", re.IGNORECASE),
    re.compile(r"\b(?:confidence|probability|likelihood)\s*(?:is|of|:)??\s*\d{1,3}(?:\.\d+)?%", re.IGNORECASE),
    re.compile(r"\d{1,3}(?:\.\d+)?%\s*(?:chance|probability|confidence|likelihood)", re.IGNORECASE),
)


def _json_object(raw: str) -> dict[str, object]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise InvalidModelOutputError(
            "MedGemma did not return a JSON object.",
            "JSON_OBJECT_NOT_FOUND",
            f"content_chars={len(text)},has_open_brace={start >= 0},has_close_brace={end >= 0}",
        )
    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise InvalidModelOutputError(
            "MedGemma returned malformed structured output.",
            "MALFORMED_JSON",
            f"line={exc.lineno},column={exc.colno},position={exc.pos},content_chars={len(text)}",
        ) from exc
    if not isinstance(parsed, dict):
        raise InvalidModelOutputError(
            "MedGemma response must be a JSON object.",
            "JSON_ROOT_NOT_OBJECT",
            f"root_type={type(parsed).__name__}",
        )
    return parsed


def _all_text(payload: ModelAnalysisPayload) -> Iterable[tuple[str, str]]:
    yield "summary", payload.summary
    yield "patientExplanation", payload.patientExplanation
    for index, text in enumerate(payload.limitations):
        yield f"limitations.{index}", text
    for index, finding in enumerate(payload.notableFindings):
        yield f"notableFindings.{index}.title", finding.title
        yield f"notableFindings.{index}.interpretation", finding.interpretation
    for index, pattern in enumerate(payload.clinicalPatterns):
        yield f"clinicalPatterns.{index}.name", pattern.name
        yield f"clinicalPatterns.{index}.reasoning", pattern.reasoning
        for item_index, text in enumerate(pattern.missingEvidence):
            yield f"clinicalPatterns.{index}.missingEvidence.{item_index}", text
        for item_index, text in enumerate(pattern.possibleCauses):
            yield f"clinicalPatterns.{index}.possibleCauses.{item_index}", text
    for index, point in enumerate(payload.discussionPoints):
        yield f"discussionPoints.{index}.title", point.title
        yield f"discussionPoints.{index}.reason", point.reason


class ReportAnalysisService:
    def __init__(self, runtime: MedGemmaRuntime) -> None:
        self._runtime = runtime
        self._semaphore = threading.BoundedSemaphore(1)

    def analyze(self, request: ReportAnalysisRequest) -> ReportAnalysisResponse:
        with self._semaphore:
            generation = self._runtime.generate(build_messages(request))
        truncated = False
        generation_diagnostics = ""
        if isinstance(generation, ModelGeneration):
            raw = generation.content
            truncated = generation.finish_reason == "length"
            generation_diagnostics = (
                f"finish_reason={generation.finish_reason},completion_tokens={generation.completion_tokens},"
                f"content_chars={len(raw)}"
            )
        else:
            raw = generation
        try:
            parsed = _json_object(raw)
        except InvalidModelOutputError as exc:
            if truncated:
                error = InvalidModelOutputError(
                    "MedGemma output was truncated at the configured token limit.",
                    "OUTPUT_TRUNCATED",
                    f"{generation_diagnostics},parser_reason={exc.reason_code}",
                )
                self._log_rejection(error)
                raise error from exc
            self._log_rejection(exc)
            raise
        try:
            payload = ModelAnalysisPayload.model_validate(parsed)
        except ValidationError as exc:
            fields = [
                f"{'.'.join(str(part) for part in item['loc'])}:{item['type']}"
                for item in exc.errors(include_url=False, include_context=False, include_input=False)[:12]
            ]
            error = InvalidModelOutputError(
                (
                    "MedGemma output was truncated at the configured token limit."
                    if truncated
                    else "MedGemma output did not match the approved clinical schema."
                ),
                "OUTPUT_TRUNCATED" if truncated else "SCHEMA_VALIDATION_FAILED",
                (
                    f"{generation_diagnostics},schema_error_count={exc.error_count()},fields={','.join(fields)}"
                    if truncated
                    else f"error_count={exc.error_count()},fields={','.join(fields)}"
                ),
            )
            self._log_rejection(error)
            raise error from exc

        try:
            self._validate_evidence(request, payload)
            self._validate_patient_safety_boundary(payload)
        except (InvalidModelOutputError, UnsafeModelOutputError) as exc:
            self._log_rejection(exc)
            raise
        limitations = list(dict.fromkeys([*payload.limitations, *_STANDARD_LIMITATIONS]))
        metadata = self._runtime.metadata
        return ReportAnalysisResponse(
            **payload.model_dump(exclude={"limitations"}),
            limitations=limitations[:12],
            modelName=metadata.model_name,
            modelRevision=metadata.model_revision,
            promptVersion=PROMPT_VERSION,
            schemaVersion=SCHEMA_VERSION,
        )

    def _validate_evidence(self, request: ReportAnalysisRequest, payload: ModelAnalysisPayload) -> None:
        allowed_ids: set[UUID] = {item.observationId for item in request.observations}
        referenced_ids: set[UUID] = {item.observationId for item in payload.notableFindings}
        for pattern in payload.clinicalPatterns:
            referenced_ids.update(pattern.supportingObservationIds)
            referenced_ids.update(pattern.contradictoryObservationIds)
        unknown = referenced_ids - allowed_ids
        if unknown:
            raise InvalidModelOutputError(
                "MedGemma referenced clinical evidence that was not supplied.",
                "EVIDENCE_ID_MISMATCH",
                (
                    f"unknown_count={len(unknown)},referenced_count={len(referenced_ids)},"
                    f"supplied_count={len(allowed_ids)}"
                ),
            )
        if payload.analysisStatus == AnalysisStatus.POSSIBLE_CLINICAL_PATTERN:
            if any(not pattern.supportingObservationIds for pattern in payload.clinicalPatterns):
                raise InvalidModelOutputError(
                    "Every proposed clinical pattern must cite supplied observations.",
                    "MISSING_SUPPORTING_EVIDENCE",
                    f"pattern_count={len(payload.clinicalPatterns)}",
                )

    def _validate_patient_safety_boundary(self, payload: ModelAnalysisPayload) -> None:
        for field, text in _all_text(payload):
            for rule_index, pattern in enumerate(_PROHIBITED_TREATMENT_PATTERNS):
                if pattern.search(text):
                    raise UnsafeModelOutputError(
                        "MedGemma output crossed the Phase 10P treatment boundary.",
                        "PROHIBITED_TREATMENT_WORDING",
                        f"field={field},rule={rule_index}",
                    )
            for rule_index, pattern in enumerate(_PROHIBITED_CERTAINTY_PATTERNS):
                if pattern.search(text):
                    raise UnsafeModelOutputError(
                        "MedGemma output overstated diagnostic certainty.",
                        "PROHIBITED_DIAGNOSTIC_CERTAINTY",
                        f"field={field},rule={rule_index}",
                    )

    @staticmethod
    def _log_rejection(error: InvalidModelOutputError | UnsafeModelOutputError) -> None:
        LOGGER.warning(
            "MedGemma validation rejected output: reason=%s diagnostics=%s",
            error.reason_code,
            error.diagnostics or "none",
        )
