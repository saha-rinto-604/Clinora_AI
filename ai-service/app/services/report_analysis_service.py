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


_DIRECTION_MODIFIER = r"(?:(?:slightly|mildly|moderately|markedly|significantly|very|borderline|marginally|just)\s+)?"
_NON_RANGE_DIRECTION_NOUNS = r"(?:risk|probability|likelihood|confidence|support|priority|concern)"
_RANGE_HIGH_WORD = rf"{_DIRECTION_MODIFIER}(?:high|elevated|raised|increased)(?![-\s]+normal\b)(?!\s+{_NON_RANGE_DIRECTION_NOUNS}\b)"
_RANGE_LOW_WORD = rf"{_DIRECTION_MODIFIER}(?:low|decreased|reduced)(?![-\s]+normal\b)(?!\s+{_NON_RANGE_DIRECTION_NOUNS}\b)"
_RANGE_IN_RANGE_WORD = r"(?:high[- ]normal|low[- ]normal|normal|in[- ]range)"
_RANGE_HIGH_RELATION = (
    r"(?:above|over|higher\s+than)\s+(?:the\s+|its\s+)?"
    r"(?:(?:reported|reference|normal|expected|supplied|report)\s+){0,2}(?:range|interval|limit|upper\s+limit|normal)"
)
_RANGE_LOW_RELATION = (
    r"(?:below|under|lower\s+than)\s+(?:the\s+|its\s+)?"
    r"(?:(?:reported|reference|normal|expected|supplied|report)\s+){0,2}(?:range|interval|limit|lower\s+limit|normal)"
)
_RANGE_IN_RANGE_RELATION = (
    r"(?:within|inside)\s+(?:the\s+|its\s+)?"
    r"(?:(?:reported|reference|normal|expected|supplied|report)\s+){0,2}(?:range|interval|limits?|normal\s+limits?)"
)

_RANGE_HIGH_PATTERNS = (
    re.compile(rf"^\s*{_RANGE_HIGH_WORD}\b", re.IGNORECASE),
    re.compile(rf"\b(?:is|was|remains?|appears?|seems?)\s+{_RANGE_HIGH_WORD}\b", re.IGNORECASE),
    re.compile(rf"\b{_RANGE_HIGH_WORD}\s+(?:result|value|level|count|measurement)\b", re.IGNORECASE),
    re.compile(rf"\b{_RANGE_HIGH_RELATION}\b", re.IGNORECASE),
)
_RANGE_LOW_PATTERNS = (
    re.compile(rf"^\s*{_RANGE_LOW_WORD}\b", re.IGNORECASE),
    re.compile(rf"\b(?:is|was|remains?|appears?|seems?)\s+{_RANGE_LOW_WORD}\b", re.IGNORECASE),
    re.compile(rf"\b{_RANGE_LOW_WORD}\s+(?:result|value|level|count|measurement)\b", re.IGNORECASE),
    re.compile(rf"\b{_RANGE_LOW_RELATION}\b", re.IGNORECASE),
)
_RANGE_NORMAL_PATTERNS = (
    re.compile(rf"^\s*{_RANGE_IN_RANGE_WORD}\b", re.IGNORECASE),
    re.compile(rf"\b(?:is|was|remains?|appears?|seems?)\s+{_RANGE_IN_RANGE_WORD}\b", re.IGNORECASE),
    re.compile(rf"\b{_RANGE_IN_RANGE_RELATION}\b", re.IGNORECASE),
    re.compile(r"\bfalls?\s+within\s+(?:the\s+|its\s+)?(?:(?:reported|reference|normal|expected|supplied|report)\s+){0,2}(?:range|interval|limits?)\b", re.IGNORECASE),
)
_NEGATED_DIRECTION_PATTERN = re.compile(
    r"\b(?:not|no\s+longer|is\s+not|isn't|are\s+not|aren't|was\s+not|wasn't|were\s+not|weren't|"
    r"does\s+not\s+appear|doesn't\s+appear|no\s+evidence\s+of|without\s+evidence\s+of)\s+"
    r"(?:to\s+be\s+)?(?:slightly\s+|mildly\s+|moderately\s+|markedly\s+|significantly\s+|very\s+)?"
    r"(?:high|elevated|raised|increased|low|decreased|reduced|abnormal|above|below|within|outside)\b",
    re.IGNORECASE,
)


def _range_state(observation: object) -> str:
    value_type = getattr(observation, "valueType", None)
    numeric_value = getattr(observation, "numericValue", None)
    reference_low = getattr(observation, "referenceLow", None)
    reference_high = getattr(observation, "referenceHigh", None)
    if value_type == "NUMERIC" and numeric_value is not None:
        if reference_low is not None and numeric_value < reference_low:
            return "LOW"
        if reference_high is not None and numeric_value > reference_high:
            return "HIGH"
        if reference_low is not None or reference_high is not None:
            return "IN_RANGE"
    raw_flag = getattr(observation, "rangeFlag", "")
    flag = str(getattr(raw_flag, "value", raw_flag) or "").upper()
    if "ABOVE" in flag or flag in {"HIGH", "H"}:
        return "HIGH"
    if "BELOW" in flag or flag in {"LOW", "L"}:
        return "LOW"
    if "WITHIN" in flag or "NORMAL" in flag or "IN_RANGE" in flag:
        return "IN_RANGE"
    return "UNKNOWN"


def _direction_claims(text: str) -> set[str]:
    candidate = _NEGATED_DIRECTION_PATTERN.sub("", text)
    claims: set[str] = set()
    if any(pattern.search(candidate) for pattern in _RANGE_HIGH_PATTERNS):
        claims.add("HIGH")
    if any(pattern.search(candidate) for pattern in _RANGE_LOW_PATTERNS):
        claims.add("LOW")
    if any(pattern.search(candidate) for pattern in _RANGE_NORMAL_PATTERNS):
        claims.add("IN_RANGE")
    return claims


def _normalized_phrase(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", value.lower())).strip()


_DIRECTION_NAME_WORDS = {
    "abnormal",
    "above",
    "below",
    "decreased",
    "elevated",
    "high",
    "increased",
    "low",
    "raised",
    "reduced",
}
_LAB_NAME_NOISE_WORDS = {"count", "finding", "level", "measurement", "pattern", "result", "value"}
_SUPPORT_MINIMUM_KNOWN_ABNORMAL = {"LIMITED": 1, "MODERATE": 2, "STRONG": 3}
_INTERNAL_PATIENT_TOKEN_PATTERN = re.compile(
    r"\b(?:IN_RANGE|UNKNOWN|POSSIBLE_CLINICAL_PATTERN|NO_CLEAR_ABNORMAL_PATTERN|INSUFFICIENT_EVIDENCE|clinoraRangeStatus|observationId)\b"
)
_UUID_TEXT_PATTERN = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b"
)
_INCOMPLETE_NARRATIVE_END_PATTERN = re.compile(
    r"\b(?:and|or|but|which|that|because|can|could|may|might|to|with|including|of|for)\s*[,:;.!?\-–—]?\s*$",
    re.IGNORECASE,
)
_MODEL_FACT_DIRECTION_PATTERN = re.compile(
    r"\b(?:high|low|elevated|raised|increased|decreased|reduced|above|below|higher\s+than|lower\s+than|"
    r"outside|normal|in[- ]range|within\s+(?:the\s+)?(?:reference|reported|expected|normal)?\s*"
    r"(?:range|interval))\b",
    re.IGNORECASE,
)
_ASSOCIATION_BOUNDARY_WORDS = {
    "and",
    "although",
    "but",
    "except",
    "however",
    "versus",
    "vs",
    "whereas",
    "while",
}
_ASSOCIATION_BRIDGE_WORDS = {
    "a",
    "about",
    "an",
    "appears",
    "appear",
    "approximately",
    "around",
    "as",
    "at",
    "count",
    "fall",
    "falls",
    "is",
    "its",
    "level",
    "lies",
    "lie",
    "measured",
    "measurement",
    "measures",
    "of",
    "reading",
    "reads",
    "remain",
    "remains",
    "reported",
    "result",
    "seem",
    "seems",
    "sit",
    "sits",
    "that",
    "the",
    "this",
    "value",
    "was",
    "which",
}


def _observation_aliases(observation: object) -> set[str]:
    label = str(getattr(observation, "label", "") or "")
    label_without_parenthetical = re.sub(r"\s*\([^()]+\)\s*", " ", label)
    aliases = {_normalized_phrase(label), _normalized_phrase(label_without_parenthetical)}
    aliases.update(_normalized_phrase(item) for item in re.findall(r"\(([^()]{1,16})\)", label))
    return {
        alias
        for alias in aliases
        if alias and len(re.sub(r"[^a-z0-9]", "", alias)) >= 2
    }


def _compact_lab_name(value: str) -> str:
    return " ".join(
        token
        for token in _normalized_phrase(value).split()
        if token not in _DIRECTION_NAME_WORDS and token not in _LAB_NAME_NOISE_WORDS
    )


def _pattern_name_is_single_lab_finding(name: str, observations: Iterable[object]) -> bool:
    compact_name = _compact_lab_name(name)
    if not compact_name:
        return True
    for observation in observations:
        for alias in _observation_aliases(observation):
            if compact_name == _compact_lab_name(alias):
                return True
    return False


def _alias_regex(alias: str) -> str:
    return rf"(?<![a-z0-9]){re.escape(alias).replace(r'\ ', r'\s+')}(?![a-z0-9])"


def _normalized_direction_text(text: str) -> str:
    candidate = _NEGATED_DIRECTION_PATTERN.sub(" ", text.lower())
    # Keep common relative clauses together, but make punctuation and conjunctions hard
    # association boundaries so a direction for one test cannot bleed into another.
    candidate = re.sub(r",\s*(?=(?:which|that)\b)", " ", candidate, flags=re.IGNORECASE)
    candidate = re.sub(r"[.;,\n]+", " | ", candidate)
    for word in _ASSOCIATION_BOUNDARY_WORDS:
        candidate = re.sub(rf"\b{re.escape(word)}\b", " | ", candidate, flags=re.IGNORECASE)
    candidate = re.sub(r"[^a-z0-9|]+", " ", candidate)
    candidate = re.sub(r"\s+", " ", candidate).strip()
    return candidate


def _observation_mentions(text: str, observations: Iterable[object]) -> set[UUID]:
    candidate = _normalized_phrase(text)
    mentioned: set[UUID] = set()
    for observation in observations:
        if any(re.search(_alias_regex(alias), candidate) for alias in _observation_aliases(observation)):
            observation_id = getattr(observation, "observationId", None)
            if isinstance(observation_id, UUID):
                mentioned.add(observation_id)
    return mentioned


def _bridge_tokens(observation: object) -> set[str]:
    tokens = set(_ASSOCIATION_BRIDGE_WORDS)
    for value in (
        getattr(observation, "unit", None),
        getattr(observation, "comparator", None),
        getattr(observation, "numericValue", None),
        getattr(observation, "referenceLow", None),
        getattr(observation, "referenceHigh", None),
    ):
        if value is not None:
            tokens.update(_normalized_phrase(str(value)).split())
    return tokens



def _alias_owner_counts(observations: Iterable[object]) -> dict[str, int]:
    owners: dict[str, set[UUID]] = {}
    for observation in observations:
        observation_id = getattr(observation, "observationId", None)
        if not isinstance(observation_id, UUID):
            continue
        for alias in _observation_aliases(observation):
            owners.setdefault(alias, set()).add(observation_id)
    return {alias: len(ids) for alias, ids in owners.items()}

def _direction_claims_for_observation(
    text: str,
    observation: object,
    observations: Iterable[object],
    *,
    allow_ambiguous_aliases: bool = False,
) -> set[str]:
    observation_values = tuple(observations)
    target_aliases = _observation_aliases(observation)
    if not allow_ambiguous_aliases:
        owner_counts = _alias_owner_counts(observation_values)
        target_aliases = {alias for alias in target_aliases if owner_counts.get(alias, 0) == 1}
    if not target_aliases:
        return set()

    candidate = _normalized_direction_text(text)
    if not candidate:
        return set()

    # Replace every other explicitly named observation with a hard boundary. This is
    # the key protection against summaries such as "MCV is low and RDW is high"
    # incorrectly assigning HIGH to MCV.
    for other in observation_values:
        if other is observation:
            continue
        for alias in sorted(_observation_aliases(other) - target_aliases, key=len, reverse=True):
            candidate = re.sub(_alias_regex(alias), " | ", candidate)
    candidate = re.sub(r"\s+", " ", candidate)

    bridge_words = sorted(_bridge_tokens(observation), key=len, reverse=True)
    bridge = "|".join(re.escape(word) for word in bridge_words if word)
    bridge_pattern = rf"(?:\s+(?:{bridge})){{0,8}}" if bridge else ""

    state_patterns = {
        "HIGH": (rf"{_RANGE_HIGH_WORD}", rf"{_RANGE_HIGH_RELATION}"),
        "LOW": (rf"{_RANGE_LOW_WORD}", rf"{_RANGE_LOW_RELATION}"),
        "IN_RANGE": (rf"{_RANGE_IN_RANGE_WORD}", rf"{_RANGE_IN_RANGE_RELATION}"),
    }
    claims: set[str] = set()
    for alias in target_aliases:
        alias_pattern = _alias_regex(alias)
        for state, direction_patterns in state_patterns.items():
            for direction in direction_patterns:
                before = rf"(?:{direction})\s+{alias_pattern}"
                after = rf"{alias_pattern}{bridge_pattern}\s+(?:{direction})\b"
                if re.search(before, candidate, re.IGNORECASE) or re.search(
                    after, candidate, re.IGNORECASE
                ):
                    claims.add(state)
                    break
    return claims

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


def _narrative_text(payload: ModelAnalysisPayload) -> Iterable[tuple[str, str]]:
    yield "summary", payload.summary
    yield "patientExplanation", payload.patientExplanation
    for index, finding in enumerate(payload.notableFindings):
        yield f"notableFindings.{index}.interpretation", finding.interpretation
    for index, pattern in enumerate(payload.clinicalPatterns):
        yield f"clinicalPatterns.{index}.reasoning", pattern.reasoning
    for index, point in enumerate(payload.discussionPoints):
        yield f"discussionPoints.{index}.reason", point.reason


class ReportAnalysisService:
    def __init__(self, runtime: MedGemmaRuntime) -> None:
        self._runtime = runtime
        self._semaphore = threading.BoundedSemaphore(1)

    def analyze(self, request: ReportAnalysisRequest) -> ReportAnalysisResponse:
        allowed_observation_ids = tuple(str(item.observationId) for item in request.observations)
        base_messages = build_messages(request)
        messages = base_messages
        repair_attempted = False

        while True:
            with self._semaphore:
                generation = self._runtime.generate(
                    messages,
                    allowed_observation_ids=allowed_observation_ids,
                )
            raw, truncated, generation_diagnostics = self._generation_details(generation)

            try:
                payload = self._validated_payload(
                    request,
                    raw,
                    truncated=truncated,
                    generation_diagnostics=generation_diagnostics,
                )
                break
            except UnsafeModelOutputError as exc:
                # Never ask the model to rewrite a response that crossed a patient-safety boundary.
                self._log_rejection(exc)
                raise
            except InvalidModelOutputError as exc:
                if repair_attempted or exc.reason_code == "OUTPUT_TRUNCATED":
                    self._log_rejection(exc)
                    raise

                repair_attempted = True
                LOGGER.info(
                    "MedGemma output failed contract validation; attempting one constrained repair: reason=%s",
                    exc.reason_code,
                )
                messages = self._repair_messages(base_messages, raw, exc)

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

    @staticmethod
    def _generation_details(generation: str | ModelGeneration) -> tuple[str, bool, str]:
        if isinstance(generation, ModelGeneration):
            raw = generation.content
            truncated = generation.finish_reason == "length"
            diagnostics = (
                f"finish_reason={generation.finish_reason},completion_tokens={generation.completion_tokens},"
                f"content_chars={len(raw)}"
            )
            return raw, truncated, diagnostics
        return generation, False, ""

    @staticmethod
    def _canonicalize_analysis_status(parsed: object) -> object:
        """Make Clinora own the analysis control status, not MedGemma.

        clinicalPatterns is substantive model output. analysisStatus is
        application-control metadata and must agree with that structure before
        Pydantic's cross-field validator runs.

        Clinora never invents or removes a clinical pattern here. It only makes
        the status flag consistent with the already-generated structure.
        """
        if not isinstance(parsed, dict):
            return parsed

        # Pydantic defines clinicalPatterns with default_factory=list, so a
        # model response that omits the field is semantically equivalent to [].
        # Canonicalize that case before the model-level cross-field validator
        # runs. Preserve genuinely invalid non-list values so schema validation
        # can still reject them normally.
        if "clinicalPatterns" not in parsed:
            clinical_patterns: list[object] = []
        else:
            clinical_patterns = parsed.get("clinicalPatterns")  # type: ignore[assignment]
            if not isinstance(clinical_patterns, list):
                return parsed

        normalized = dict(parsed)
        normalized["clinicalPatterns"] = clinical_patterns
        raw_status = normalized.get("analysisStatus")

        if clinical_patterns:
            canonical_status = AnalysisStatus.POSSIBLE_CLINICAL_PATTERN.value
        elif raw_status in {
            AnalysisStatus.NO_CLEAR_ABNORMAL_PATTERN.value,
            AnalysisStatus.INSUFFICIENT_EVIDENCE.value,
        }:
            canonical_status = raw_status
        else:
            canonical_status = AnalysisStatus.INSUFFICIENT_EVIDENCE.value

        if raw_status != canonical_status:
            LOGGER.info(
                "Canonicalized MedGemma analysis status: from=%s to=%s clinical_pattern_count=%d",
                raw_status,
                canonical_status,
                len(clinical_patterns),
            )

        normalized["analysisStatus"] = canonical_status
        return normalized

    @staticmethod
    def _ground_patient_facing_payload(
        request: ReportAnalysisRequest, parsed: object
    ) -> object:
        """Compose patient-facing content from verified facts plus bounded AI inference.

        Safety boundary:
        - Clinora owns values, units, reference ranges, range direction, evidence cards,
          support metadata, summary wording, and patient-facing factual statements.
        - MedGemma may contribute condition/pattern names, evidence IDs, missing evidence,
          alternative explanations, and *fact-free* clinical reasoning.
        - Model reasoning that names a supplied analyte or uses range-direction language is
          discarded before display. Clinora substitutes a grounded fallback instead.
        - Unsupported or malformed clinical patterns are dropped fail-closed rather than
          promoted to the patient UI.
        """
        if not isinstance(parsed, dict):
            return parsed

        grounded = dict(parsed)
        raw_summary = grounded.get("summary")
        raw_patient_explanation = grounded.get("patientExplanation")
        observation_by_id = {str(item.observationId): item for item in request.observations}
        observation_order = {
            str(item.observationId): index for index, item in enumerate(request.observations)
        }
        observation_values = tuple(request.observations)

        clinical_patterns = grounded.get("clinicalPatterns", [])
        if not isinstance(clinical_patterns, list):
            # Preserve the invalid type so Pydantic can report a genuine schema error.
            return grounded

        cited_ids: list[str] = []

        def clean_id_list(value: object) -> list[str]:
            if not isinstance(value, list):
                return []
            cleaned: list[str] = []
            for item in value:
                item_id = str(item)
                if item_id in observation_by_id and item_id not in cleaned:
                    cleaned.append(item_id)
            return cleaned

        def add_cited(ids: object) -> None:
            for item_id in clean_id_list(ids):
                if item_id not in cited_ids:
                    cited_ids.append(item_id)

        def state_phrase(observation: object) -> str:
            state = _range_state(observation)
            if state == "LOW":
                return "lower than expected"
            if state == "HIGH":
                return "higher than expected"
            if state == "IN_RANGE":
                return "within expected range"
            return "range status not determined"

        def evidence_phrase(ids: object, *, limit: int = 6) -> str:
            cleaned = clean_id_list(ids)
            phrases: list[str] = []
            for observation_id in cleaned[:limit]:
                observation = observation_by_id[observation_id]
                label = str(getattr(observation, "label", "") or "Verified finding").strip()
                phrases.append(f"{label} ({state_phrase(observation)})")
            if not phrases:
                return "the cited verified findings"
            if len(phrases) == 1:
                phrase = phrases[0]
            elif len(phrases) == 2:
                phrase = f"{phrases[0]} and {phrases[1]}"
            else:
                phrase = f"{', '.join(phrases[:-1])}, and {phrases[-1]}"
            remaining = len(cleaned) - min(len(cleaned), limit)
            if remaining > 0:
                phrase += f" and {remaining} additional verified finding{'s' if remaining != 1 else ''}"
            return phrase

        def mentions_supplied_analyte(text: str) -> bool:
            candidate = _normalized_phrase(text)
            if not candidate:
                return False
            for observation in observation_values:
                if any(
                    re.search(_alias_regex(alias), candidate)
                    for alias in _observation_aliases(observation)
                ):
                    return True
            return False

        def model_reasoning_is_fact_safe(text: object) -> bool:
            if not isinstance(text, str) or not text.strip():
                return False
            candidate = text.strip()
            if _INTERNAL_PATIENT_TOKEN_PATTERN.search(candidate) or _UUID_TEXT_PATTERN.search(candidate):
                return False
            if _MODEL_FACT_DIRECTION_PATTERN.search(candidate):
                return False
            if mentions_supplied_analyte(candidate):
                return False
            if _INCOMPLETE_NARRATIVE_END_PATTERN.search(candidate):
                return False
            return True

        def sanitize_model_list(value: object, *, max_items: int) -> list[str]:
            if not isinstance(value, list):
                return []
            cleaned: list[str] = []
            for item in value:
                if not isinstance(item, str):
                    continue
                text = item.strip()
                if not text:
                    continue
                if _INTERNAL_PATIENT_TOKEN_PATTERN.search(text) or _UUID_TEXT_PATTERN.search(text):
                    continue
                # These lists should describe absent information or alternative
                # explanations, not re-state facts about analytes already in the report.
                if mentions_supplied_analyte(text):
                    continue
                if text not in cleaned:
                    cleaned.append(text[:400])
                if len(cleaned) >= max_items:
                    break
            return cleaned

        safe_overall_reasoning = ""
        for candidate in (raw_patient_explanation, raw_summary):
            if model_reasoning_is_fact_safe(candidate):
                safe_overall_reasoning = str(candidate).strip()
                break

        grounded_patterns: list[dict[str, object]] = []
        seen_pattern_names: set[str] = set()

        for raw_pattern in clinical_patterns:
            if len(grounded_patterns) >= 2:
                break
            if not isinstance(raw_pattern, dict):
                LOGGER.info("Dropped non-object MedGemma clinical pattern before patient display")
                continue

            name = str(raw_pattern.get("name", "") or "").strip()
            if not name:
                LOGGER.info("Dropped MedGemma clinical pattern with no condition-level name")
                continue
            normalized_name = _normalized_phrase(name)
            if normalized_name in seen_pattern_names:
                LOGGER.info("Dropped duplicate MedGemma clinical pattern")
                continue
            if _pattern_name_is_single_lab_finding(name, observation_values):
                LOGGER.info("Dropped MedGemma clinical pattern that was only a laboratory finding")
                continue

            supporting_ids = clean_id_list(raw_pattern.get("supportingObservationIds"))
            if not supporting_ids:
                LOGGER.info("Dropped MedGemma clinical pattern with no verified supporting evidence")
                continue

            supporting_states = [
                _range_state(observation_by_id[observation_id])
                for observation_id in supporting_ids
            ]
            if supporting_states and all(state == "IN_RANGE" for state in supporting_states):
                LOGGER.info("Dropped MedGemma clinical pattern supported only by in-range findings")
                continue

            contradictory_ids = [
                item_id
                for item_id in clean_id_list(raw_pattern.get("contradictoryObservationIds"))
                if item_id not in supporting_ids
            ]
            add_cited(supporting_ids)
            add_cited(contradictory_ids)

            abnormal_count = sum(state in {"LOW", "HIGH"} for state in supporting_states)
            if abnormal_count >= 3:
                support_level = "STRONG"
            elif abnormal_count >= 2:
                support_level = "MODERATE"
            else:
                support_level = "LIMITED"

            factual_reason = (
                f"Clinora's verified evidence for this possibility includes "
                f"{evidence_phrase(supporting_ids)}."
            )
            raw_reasoning = raw_pattern.get("reasoning")
            if model_reasoning_is_fact_safe(raw_reasoning):
                clinical_reason = str(raw_reasoning).strip()
            else:
                if isinstance(raw_reasoning, str) and raw_reasoning.strip():
                    LOGGER.info(
                        "Discarded model-authored pattern reasoning that could restate laboratory facts"
                    )
                clinical_reason = (
                    f"This combination is why {name} was considered as a possible explanation, "
                    "but the report alone cannot establish that it is the cause."
                )

            reasoning_parts = [factual_reason, clinical_reason]
            if contradictory_ids:
                reasoning_parts.append(
                    "Verified findings that may not fully fit this possibility include "
                    f"{evidence_phrase(contradictory_ids)}."
                )
            reasoning_parts.append("This is a possible interpretation, not a diagnosis.")

            grounded_patterns.append(
                {
                    "name": name[:180],
                    "supportLevel": support_level,
                    "reasoning": " ".join(reasoning_parts)[:2400],
                    "supportingObservationIds": supporting_ids,
                    "contradictoryObservationIds": contradictory_ids,
                    "missingEvidence": sanitize_model_list(
                        raw_pattern.get("missingEvidence"), max_items=12
                    ),
                    "possibleCauses": sanitize_model_list(
                        raw_pattern.get("possibleCauses"), max_items=8
                    ),
                }
            )
            seen_pattern_names.add(normalized_name)

        grounded["clinicalPatterns"] = grounded_patterns

        # Use any valid model finding IDs only as pointers to verified observations;
        # never trust the model-written finding title or interpretation.
        model_findings = grounded.get("notableFindings")
        if isinstance(model_findings, list):
            for raw_finding in model_findings:
                if isinstance(raw_finding, dict):
                    raw_id = raw_finding.get("observationId")
                    if raw_id is not None:
                        add_cited([raw_id])

        abnormal_ids: list[str] = []
        for observation in request.observations:
            if _range_state(observation) in {"LOW", "HIGH"}:
                observation_id = str(observation.observationId)
                abnormal_ids.append(observation_id)
                add_cited([observation_id])

        cited_ids.sort(key=lambda value: observation_order.get(value, len(observation_order)))
        deterministic_findings: list[dict[str, object]] = []
        for observation_id in cited_ids[:50]:
            observation = observation_by_id[observation_id]
            state = _range_state(observation)
            if state == "LOW":
                interpretation = "This verified result is lower than the supplied reference range."
            elif state == "HIGH":
                interpretation = "This verified result is higher than the supplied reference range."
            elif state == "IN_RANGE":
                interpretation = "This verified result is within the supplied reference range."
            else:
                interpretation = (
                    "This result is part of the verified report. Clinora does not assign a range status "
                    "when the supplied reference information is not sufficient."
                )
            deterministic_findings.append(
                {
                    "observationId": observation_id,
                    "title": str(getattr(observation, "label", "") or "Verified report finding")[:180],
                    "interpretation": interpretation,
                }
            )
        grounded["notableFindings"] = deterministic_findings

        pattern_names = [str(item["name"]) for item in grounded_patterns]
        if pattern_names:
            if len(pattern_names) == 1:
                possibility_phrase = pattern_names[0]
            else:
                possibility_phrase = f"{pattern_names[0]} or {pattern_names[1]}"
            grounded["summary"] = (
                f"This verified report contains a pattern that may be compatible with {possibility_phrase}. "
                "This is a possible explanation, not a diagnosis."
            )
            explanation_parts = [
                f"Clinora considered {possibility_phrase} because of how the verified findings shown below fit together."
            ]
            if safe_overall_reasoning:
                explanation_parts.append(safe_overall_reasoning)
            explanation_parts.append(
                "The exact values and range labels come from the report you confirmed; the AI reasoning cannot "
                "change those facts. Missing information and alternative explanations should be considered before "
                "drawing conclusions."
            )
            grounded["patientExplanation"] = " ".join(explanation_parts)[:2400]
            grounded["discussionPoints"] = [
                {
                    "type": "CLINICAL_QUESTION",
                    "title": f"Ask whether {possibility_phrase} could fit this pattern"[:180],
                    "reason": (
                        "A clinician can compare these verified findings with symptoms, medical history, "
                        "medications, examination findings, and other tests to judge whether this possibility fits."
                    ),
                }
            ]
        else:
            if abnormal_ids:
                verified_phrase = evidence_phrase(abnormal_ids)
                grounded["summary"] = (
                    "Some verified findings are outside their supplied reference ranges, but this report does "
                    "not support a specific condition-level possibility yet."
                )
                explanation_parts = [f"The verified findings include {verified_phrase}."]
                if safe_overall_reasoning:
                    explanation_parts.append(safe_overall_reasoning)
                explanation_parts.append(
                    "These findings can have more than one explanation, and the available report does not contain "
                    "enough distinguishing evidence for Clinora to responsibly name one specific condition. Symptoms, "
                    "medical history, examination, and other tests may still change the interpretation."
                )
                grounded["patientExplanation"] = " ".join(explanation_parts)[:2400]
            else:
                grounded["summary"] = (
                    "This verified report does not show a clear condition-level pattern using the supplied "
                    "laboratory information."
                )
                explanation_parts = []
                if safe_overall_reasoning:
                    explanation_parts.append(safe_overall_reasoning)
                explanation_parts.append(
                    "The supplied verified findings do not provide enough evidence for Clinora to responsibly name "
                    "a possible condition from this report alone. Symptoms, medical history, examination, and other "
                    "tests may still matter."
                )
                grounded["patientExplanation"] = " ".join(explanation_parts)[:2400]
            grounded["discussionPoints"] = [
                {
                    "type": "CLINICAL_QUESTION",
                    "title": "Ask how these verified findings fit your overall health",
                    "reason": (
                        "A clinician can interpret the report together with your symptoms, medical history, "
                        "medications, examination findings, and other available tests."
                    ),
                }
            ]

        grounded["limitations"] = [
            "This analysis uses only the patient-confirmed laboratory observations supplied to Clinora."
        ]
        return grounded

    def _validated_payload(
        self,
        request: ReportAnalysisRequest,
        raw: str,
        *,
        truncated: bool,
        generation_diagnostics: str,
    ) -> ModelAnalysisPayload:
        try:
            parsed = _json_object(raw)
        except InvalidModelOutputError as exc:
            if truncated:
                raise InvalidModelOutputError(
                    "MedGemma output was truncated at the configured token limit.",
                    "OUTPUT_TRUNCATED",
                    f"{generation_diagnostics},parser_reason={exc.reason_code}",
                ) from exc
            raise

        # Safety-check the raw model text before any grounding can discard or
        # replace it. Unsafe treatment/certainty language is never silently hidden.
        self._validate_raw_safety_boundary(parsed)

        # Ground first because unsupported model patterns may be dropped fail-closed.
        # Then derive analysisStatus from the final grounded pattern structure.
        parsed = self._ground_patient_facing_payload(request, parsed)
        parsed = self._canonicalize_analysis_status(parsed)

        try:
            payload = ModelAnalysisPayload.model_validate(parsed)
        except ValidationError as exc:
            fields = [
                (
                    f"{'.'.join(str(part) for part in item['loc']) or '<root>'}:"
                    f"{item['type']}:{item['msg']}"
                )
                for item in exc.errors(include_url=False, include_context=False, include_input=False)[:12]
            ]
            raise InvalidModelOutputError(
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
            ) from exc

        self._validate_evidence(request, payload)
        self._validate_range_consistency(request, payload)
        self._validate_differential_quality(request, payload)
        self._validate_patient_prose(payload)
        self._validate_patient_safety_boundary(payload)
        return payload

    @staticmethod
    def _validate_raw_safety_boundary(parsed: object) -> None:
        """Reject unsafe model text even when later grounding would replace it."""

        def walk(value: object, path: str = "<root>") -> Iterable[tuple[str, str]]:
            if isinstance(value, str):
                yield path, value
                return
            if isinstance(value, dict):
                for key, child in value.items():
                    child_path = f"{path}.{key}" if path != "<root>" else str(key)
                    yield from walk(child, child_path)
                return
            if isinstance(value, list):
                for index, child in enumerate(value):
                    yield from walk(child, f"{path}.{index}")

        for field, text in walk(parsed):
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
    def _repair_messages(
        base_messages: list[dict[str, object]],
        raw: str,
        error: InvalidModelOutputError,
    ) -> list[dict[str, object]]:
        diagnostics = (error.diagnostics or "none")[:1200]
        repair_instruction = f"""
Your previous JSON response did not pass Clinora's deterministic output validation.
Correct it once and return one complete JSON object only. Do not explain the correction.

Validation reason: {error.reason_code}
Validation detail: {diagnostics}

Repair rules:
- Clinora, not MedGemma, owns every laboratory value, unit, reference range, and range direction.
- Treat each supplied clinoraRangeStatus as authoritative and never restate or reinterpret it in free-form reasoning.
- clinicalPatterns must contain at most 2 condition-level possibilities with supporting IDs copied only from the supplied observations.
- Pattern reasoning must explain the clinical mechanism or relationship without naming any supplied analyte, value, unit, or range direction.
- missingEvidence may name absent tests or clinical context; possibleCauses must be alternative conditions/explanations, not laboratory findings.
- If a condition-level possibility is not responsibly supported after correction, remove it rather than forcing a prediction.
- Preserve the patient-safety rules: no definitive diagnosis, medication instructions, dosage advice, or numeric disease probability.
- Keep compatibility fields minimal because Clinora composes the factual patient-facing summary and evidence cards.
- Return the entire corrected object, not a patch or partial fragment.
""".strip()
        return [
            *base_messages,
            {"role": "assistant", "content": raw[:12000]},
            {"role": "user", "content": repair_instruction},
        ]

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

    def _validate_range_consistency(self, request: ReportAnalysisRequest, payload: ModelAnalysisPayload) -> None:
        observations = {item.observationId: item for item in request.observations}
        observation_values = tuple(request.observations)

        def raise_direction_mismatch(field: str, observation: object, claims: set[str]) -> None:
            expected = _range_state(observation)
            conflicts = sorted(claim for claim in claims if claim != expected)
            if conflicts:
                raise InvalidModelOutputError(
                    "MedGemma described a verified result in a way that conflicts with its supplied reference range.",
                    "RANGE_DIRECTION_MISMATCH",
                    (
                        f"field={field},observation_id={getattr(observation, 'observationId', 'unknown')},"
                        f"expected={expected},claims={','.join(conflicts)}"
                    ),
                )

        def validate_linked_finding(index: int, finding: object, observation: object) -> None:
            expected = _range_state(observation)
            if expected == "UNKNOWN":
                return

            claims: set[str] = set()
            for part_name, text in (
                ("title", str(getattr(finding, "title", "") or "")),
                ("interpretation", str(getattr(finding, "interpretation", "") or "")),
            ):
                scoped = _direction_claims_for_observation(
                    text, observation, observation_values, allow_ambiguous_aliases=True
                )
                claims.update(scoped)

                # A finding is already linked to one observation by ID. If its title or
                # interpretation does not name any laboratory observation at all, phrases
                # such as "This result is above range" still unambiguously refer to that ID.
                # Do not use this fallback when another observation is named, because that
                # would recreate the cross-observation false positive we are avoiding.
                if not scoped and not _observation_mentions(text, observation_values):
                    claims.update(_direction_claims(text))

                if claims:
                    raise_direction_mismatch(
                        f"notableFindings.{index}.{part_name}", observation, claims
                    )

        for index, finding in enumerate(payload.notableFindings):
            observation = observations.get(finding.observationId)
            if observation is not None:
                validate_linked_finding(index, finding, observation)

        for field, text in _all_text(payload):
            # Findings are validated above using their explicit observationId. Re-running
            # broad prose association on them would be both redundant and less precise.
            if field.startswith("notableFindings."):
                continue
            for observation in observation_values:
                expected = _range_state(observation)
                if expected == "UNKNOWN":
                    continue
                claims = _direction_claims_for_observation(text, observation, observation_values)
                if any(claim != expected for claim in claims):
                    LOGGER.warning(
                        "Range-direction mismatch candidate: field=%s observation_id=%s expected=%s claims=%s",
                        field,
                        getattr(observation, "observationId", "unknown"),
                        expected,
                        ",".join(sorted(claims)),
                    )
                raise_direction_mismatch(field, observation, claims)

        for index, pattern in enumerate(payload.clinicalPatterns):
            supporting_states = [
                _range_state(observations[observation_id])
                for observation_id in pattern.supportingObservationIds
                if observation_id in observations
            ]
            if (
                len(supporting_states) == len(pattern.supportingObservationIds)
                and supporting_states
                and all(state == "IN_RANGE" for state in supporting_states)
            ):
                raise InvalidModelOutputError(
                    "MedGemma proposed a clinical pattern using only observations within their supplied reference ranges.",
                    "PATTERN_SUPPORTED_ONLY_BY_NORMAL_EVIDENCE",
                    f"pattern_index={index},supporting_count={len(supporting_states)}",
                )

    def _validate_differential_quality(
        self, request: ReportAnalysisRequest, payload: ModelAnalysisPayload
    ) -> None:
        if len(payload.clinicalPatterns) > 2:
            raise InvalidModelOutputError(
                "MedGemma returned more condition-level possibilities than the patient differential allows.",
                "TOO_MANY_DIFFERENTIAL_PREDICTIONS",
                f"pattern_count={len(payload.clinicalPatterns)}",
            )

        observations = {item.observationId: item for item in request.observations}
        seen_names: set[str] = set()
        for index, pattern in enumerate(payload.clinicalPatterns):
            normalized_name = _normalized_phrase(pattern.name)
            if normalized_name in seen_names:
                raise InvalidModelOutputError(
                    "MedGemma returned duplicate condition-level possibilities.",
                    "DUPLICATE_DIFFERENTIAL_PREDICTION",
                    f"pattern_index={index}",
                )
            seen_names.add(normalized_name)

            if _pattern_name_is_single_lab_finding(pattern.name, observations.values()):
                raise InvalidModelOutputError(
                    "MedGemma used a laboratory abnormality as a condition-level prediction.",
                    "PATTERN_NAME_NOT_CONDITION_LEVEL",
                    f"pattern_index={index}",
                )

            supporting_states = [
                _range_state(observations[observation_id])
                for observation_id in pattern.supportingObservationIds
                if observation_id in observations
            ]
            if supporting_states and all(state != "UNKNOWN" for state in supporting_states):
                abnormal_count = sum(state in {"LOW", "HIGH"} for state in supporting_states)
                support_name = str(getattr(pattern.supportLevel, "value", pattern.supportLevel))
                minimum = _SUPPORT_MINIMUM_KNOWN_ABNORMAL.get(support_name, 1)
                if abnormal_count < minimum:
                    raise InvalidModelOutputError(
                        "MedGemma overstated how strongly the supplied report supports a possible condition.",
                        "EVIDENCE_SUPPORT_OVERSTATED",
                        (
                            f"pattern_index={index},support={support_name},"
                            f"known_abnormal_support={abnormal_count},required={minimum}"
                        ),
                    )

    def _validate_patient_prose(self, payload: ModelAnalysisPayload) -> None:
        for field, text in _all_text(payload):
            if _INTERNAL_PATIENT_TOKEN_PATTERN.search(text) or _UUID_TEXT_PATTERN.search(text):
                raise InvalidModelOutputError(
                    "MedGemma exposed internal machine-oriented content in patient-facing prose.",
                    "PATIENT_PROSE_INTERNAL_TOKEN",
                    f"field={field}",
                )

        for field, text in _narrative_text(payload):
            if _INCOMPLETE_NARRATIVE_END_PATTERN.search(text.strip()):
                raise InvalidModelOutputError(
                    "MedGemma returned an incomplete patient-facing sentence.",
                    "PATIENT_PROSE_INCOMPLETE",
                    f"field={field}",
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
