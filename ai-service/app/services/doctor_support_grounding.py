from __future__ import annotations

import re

from app.knowledge.models import RetrievedChunk
from app.schemas.doctor_support_execution import EvidenceSnapshot, TaskResult


class UnsafeDoctorSupportOutputError(RuntimeError):
    def __init__(self, reason_code: str) -> None:
        super().__init__("Doctor support output did not pass grounding and safety validation.")
        self.reason_code = reason_code


_TREATMENT = re.compile(r"\b(prescribe|start|stop|increase|decrease|take|administer)\b.{0,40}\b(mg|mcg|tablet|dose|medication|drug|therapy)\b", re.I)
_CERTAINTY = re.compile(r"\b(definitely|certainly|proves?|confirmed diagnosis|diagnostic of|\d{1,3}% (?:likely|probability|confidence|chance))\b", re.I)
_RANKING = re.compile(r"\b(most likely|least likely|top diagnosis|ranked? differential|best explanation)\b", re.I)
_INVENTED_HISTORY = re.compile(r"\b(patient (?:reports|denies|presents with)|history of|symptoms? (?:include|of))\b", re.I)
_CAUSAL_FACT = re.compile(r"\b(caused by|is due to|proves that|demonstrates that)\b", re.I)
_DOCTOR_VERDICT = re.compile(r"\b(?:the )?doctor(?:'s assessment)? is (?:correct|wrong)\b", re.I)
_DIRECTION_VALUE_JUDGMENT = re.compile(r"\b(improving|worsening|recovering|deteriorating|treatment (?:is )?working|treatment failure)\b", re.I)
_DEFINITIVE_DIAGNOSIS = re.compile(r"\b(patient has|patient suffers from|diagnosis is|establishes? (?:a |the )?diagnosis)\b", re.I)
_IMPERATIVE_ORDER = re.compile(r"\b(must order|required test|order (?:a |an |the )?)\b", re.I)
_INVENTED_LINK = re.compile(r"https?://|www\.", re.I)
_REFERENCE_ATTRIBUTION = re.compile(r"\b(guidelines?|references?|published sources?|literature) (?:indicate|suggest|recommend|state|show)", re.I)


def validate_grounding(
    result: TaskResult, evidence: EvidenceSnapshot, retrieved_chunks: tuple[RetrievedChunk, ...] = (),
    doctor_notes: str | None = None, appointment_context: dict | None = None,
) -> None:
    dumped = result.model_dump(mode="json")
    text = " ".join(_strings(dumped))
    claim_text = " ".join(_claim_strings(dumped))
    if _TREATMENT.search(text):
        raise UnsafeDoctorSupportOutputError("TREATMENT_OR_DOSE")
    if _CERTAINTY.search(text):
        raise UnsafeDoctorSupportOutputError("DEFINITIVE_CERTAINTY")
    if _RANKING.search(text):
        raise UnsafeDoctorSupportOutputError("RANKED_DIAGNOSIS")
    if _INVENTED_HISTORY.search(text):
        raise UnsafeDoctorSupportOutputError("INVENTED_HISTORY")
    if _CAUSAL_FACT.search(text):
        raise UnsafeDoctorSupportOutputError("HYPOTHESIS_AS_FACT")
    if _DOCTOR_VERDICT.search(text):
        raise UnsafeDoctorSupportOutputError("DOCTOR_CORRECTNESS_VERDICT")
    if _DEFINITIVE_DIAGNOSIS.search(text):
        raise UnsafeDoctorSupportOutputError("DEFINITIVE_DIAGNOSIS")
    if dumped.get("taskId") == "COMPARE_EVIDENCE" and _DIRECTION_VALUE_JUDGMENT.search(text):
        raise UnsafeDoctorSupportOutputError("UNSUPPORTED_IMPROVEMENT_JUDGMENT")
    if dumped.get("taskId") == "FIND_GAPS" and _IMPERATIVE_ORDER.search(text):
        raise UnsafeDoctorSupportOutputError("IMPERATIVE_TEST_ORDER")
    if any(value.strip().endswith(("...", "…")) for value in _strings(dumped)):
        raise UnsafeDoctorSupportOutputError("TRUNCATED_TEXT")

    if _INVENTED_LINK.search(text):
        raise UnsafeDoctorSupportOutputError("INVENTED_REFERENCE_LINK")
    allowed_chunk_ids = {item.chunk.chunk_id for item in retrieved_chunks}
    cited_chunk_ids = list(_reference_chunk_ids(dumped))
    if any(len(items) != len(set(items)) for items in _reference_lists(dumped)):
        raise UnsafeDoctorSupportOutputError("DUPLICATE_REFERENCE_CHUNK_ID")
    if not set(cited_chunk_ids).issubset(allowed_chunk_ids):
        raise UnsafeDoctorSupportOutputError("UNKNOWN_REFERENCE_CHUNK_ID")
    if _REFERENCE_ATTRIBUTION.search(text) and not cited_chunk_ids:
        raise UnsafeDoctorSupportOutputError("UNCITED_REFERENCE_CLAIM")

    observations = {str(item.observationId): item for item in evidence.observations}
    refs = list(_evidence_references(dumped))
    for evidence_list in _evidence_lists(dumped):
        ids = [str(item.get("observationId")) for item in evidence_list]
        if len(ids) != len(set(ids)):
            raise UnsafeDoctorSupportOutputError("DUPLICATE_EVIDENCE_ID")
    for observation_id, label in refs:
        observation = observations.get(observation_id)
        if observation is None:
            raise UnsafeDoctorSupportOutputError("UNKNOWN_OBSERVATION_ID")
        if observation.label != label:
            raise UnsafeDoctorSupportOutputError("OBSERVATION_LABEL_MISMATCH")
        _validate_observation_claims(claim_text, observation, observations.values())
        if observation.authoritativeStatus == "IN_RANGE":
            nearby = re.compile(re.escape(label) + r".{0,80}\b(abnormal|high|low|elevated|reduced)\b", re.I)
            if nearby.search(text):
                raise UnsafeDoctorSupportOutputError("NORMAL_AS_ABNORMAL")
        if dumped.get("taskId") == "CROSS_CHECK_ASSESSMENT":
            for point in dumped.get("points", []):
                if point.get("relation") == "SUPPORTS" and any(
                    str(ref.get("observationId")) == observation_id for ref in point.get("evidence", [])
                ) and observation.authoritativeStatus == "REPORTED":
                    raise UnsafeDoctorSupportOutputError("CONTEXT_ONLY_AS_SUPPORT")

    if dumped.get("taskId") == "COMPARE_EVIDENCE":
        facts = {item.canonicalCode: item for item in evidence.comparisonFacts}
        for comparison in dumped.get("comparisons", []):
            fact = facts.get(comparison.get("canonicalCode"))
            if fact is None:
                raise UnsafeDoctorSupportOutputError("UNKNOWN_COMPARISON")
            if fact.direction != comparison.get("direction"):
                raise UnsafeDoctorSupportOutputError("WRONG_COMPARISON_DIRECTION")
            ids = [item.get("observationId") for item in comparison.get("evidence", [])]
            if set(ids) != {str(fact.earlierObservationId), str(fact.laterObservationId)}:
                raise UnsafeDoctorSupportOutputError("WRONG_COMPARISON_EVIDENCE")

    if dumped.get("taskId") == "BRIEF_PATIENT":
        expected_reason = (appointment_context or {}).get("reason")
        if dumped.get("appointmentReason") != expected_reason:
            raise UnsafeDoctorSupportOutputError("APPOINTMENT_CONTEXT_MISMATCH")
        report_dates = {str(item.reportId): item.clinicalDate for item in evidence.reports if item.clinicalDate}
        observation_reports = {str(item.observationId): str(item.reportId) for item in evidence.observations}
        facts = {
            frozenset((str(item.earlierObservationId), str(item.laterObservationId))) for item in evidence.comparisonFacts
        }
        for chronology in dumped.get("chronology", []):
            ids = [str(item.get("observationId")) for item in chronology.get("evidence", [])]
            reports = {observation_reports.get(item) for item in ids}
            dated_reports = {item for item in reports if item in report_dates}
            if chronology.get("kind") == "CHANGE" and not any(fact.issubset(set(ids)) for fact in facts):
                raise UnsafeDoctorSupportOutputError("UNSUPPORTED_CHRONOLOGY")
            if chronology.get("kind") == "PERSISTENCE" and len(dated_reports) < 3:
                raise UnsafeDoctorSupportOutputError("UNSUPPORTED_PERSISTENCE")

    if dumped.get("taskId") == "STRUCTURE_NOTES":
        _validate_structured_notes(dumped, doctor_notes or "")


def _validate_structured_notes(dumped, doctor_notes):
    source = doctor_notes.lower()
    if not source.strip():
        raise UnsafeDoctorSupportOutputError("DOCTOR_NOTES_REQUIRED")
    source_tokens = set(re.findall(r"[a-z0-9]+", source))
    output_text = " ".join(
        item for section in dumped.get("sections", []) for item in section.get("items", [])
    ).lower()
    output_tokens = set(re.findall(r"[a-z0-9]+", output_text))
    allowed_structure = {
        "possible", "reported", "stated", "consider", "reason", "context", "symptoms", "history",
        "finding", "findings", "assessment", "plan", "other", "for", "the", "a", "an", "of", "and",
    }
    if "tired" in source or "tiredness" in source:
        allowed_structure.add("fatigue")
    novel = {token for token in output_tokens - source_tokens - allowed_structure if len(token) > 2}
    if novel:
        raise UnsafeDoctorSupportOutputError("NOTES_FACT_ADDED")
    source_numbers = set(re.findall(r"\b\d+(?:\.\d+)?\b", source))
    output_numbers = set(re.findall(r"\b\d+(?:\.\d+)?\b", output_text))
    if not output_numbers.issubset(source_numbers):
        raise UnsafeDoctorSupportOutputError("NOTES_DOSE_OR_VALUE_CHANGED")
    uncertain = bool(re.search(r"(?:^|\s)\?|\b(possible|possibly|consider|query|suspect)\b", source))
    assessment = " ".join(
        item for section in dumped.get("sections", []) if section.get("section") == "ASSESSMENT"
        for item in section.get("items", [])
    ).lower()
    if uncertain and assessment and not re.search(r"\b(possible|possibly|consider|query|suspect|uncertain)\b", assessment):
        raise UnsafeDoctorSupportOutputError("NOTES_UNCERTAINTY_INCREASED")


def _validate_observation_claims(text, observation, all_observations):
    windows = re.findall(re.escape(observation.label) + r".{0,90}", text, re.I)
    if not windows:
        return
    status_conflicts = {
        "LOW": r"\b(high|elevated|in[- ]?range|normal|positive)\b",
        "HIGH": r"\b(low|in[- ]?range|normal|negative)\b",
        "IN_RANGE": r"\b(high|low|elevated|reduced|abnormal|positive|negative)\b",
        "POSITIVE": r"\bnegative|not detected|absent\b",
        "NEGATIVE": r"\bpositive|detected|present|reactive\b",
    }
    related = [item for item in all_observations if item.label == observation.label]
    statuses = {item.authoritativeStatus for item in related}
    conflict = status_conflicts.get(observation.authoritativeStatus) if len(statuses) == 1 else None
    if conflict and any(re.search(conflict, window, re.I) for window in windows):
        raise UnsafeDoctorSupportOutputError("OBSERVATION_STATUS_CHANGED")
    allowed_numbers = {
        float(value)
        for item in related
        for value in (item.numericValue, item.referenceLow, item.referenceHigh, item.normalizedNumericValue)
        if value is not None
    }
    for window in windows:
        for number in re.findall(r"(?<![a-z])\d+(?:\.\d+)?", window.lower()):
            if not any(abs(float(number) - allowed) < 1e-9 for allowed in allowed_numbers):
                raise UnsafeDoctorSupportOutputError("OBSERVATION_VALUE_CHANGED")
        known_units = {
            value.lower() for item in related for value in (item.unit, item.normalizedUnit) if value
        }
        mentioned_units = set(re.findall(r"\b(?:mg/dl|mmol/l|g/dl|fl|pg|iu/l|miu/l|10\^\d+/l|%)\b", window, re.I))
        if mentioned_units and not {unit.lower() for unit in mentioned_units}.issubset(known_units):
            raise UnsafeDoctorSupportOutputError("OBSERVATION_UNIT_CHANGED")


def _strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)


def _claim_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        if set(("observationId", "label")).issubset(value):
            return
        ignored = {
            "taskId", "observationId", "reportId", "canonicalCode", "referenceChunkIds",
            "summaryReferenceChunkIds", "sourceId", "documentId", "chunkId",
        }
        for key, item in value.items():
            if key not in ignored:
                yield from _claim_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _claim_strings(item)


def _evidence_references(value):
    if isinstance(value, dict):
        if set(("observationId", "label")).issubset(value):
            yield str(value["observationId"]), value["label"]
        for item in value.values():
            yield from _evidence_references(item)
    elif isinstance(value, list):
        for item in value:
            yield from _evidence_references(item)


def _evidence_lists(value):
    if isinstance(value, dict):
        for key in ("evidence", "supportingEvidence", "limitingEvidence", "evidenceHighlights"):
            evidence = value.get(key)
            if isinstance(evidence, list):
                yield evidence
        for item in value.values():
            yield from _evidence_lists(item)
    elif isinstance(value, list):
        for item in value:
            yield from _evidence_lists(item)


def _reference_chunk_ids(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"referenceChunkIds", "summaryReferenceChunkIds"} and isinstance(item, list):
                for chunk_id in item:
                    yield str(chunk_id)
            else:
                yield from _reference_chunk_ids(item)
    elif isinstance(value, list):
        for item in value:
            yield from _reference_chunk_ids(item)


def _reference_lists(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"referenceChunkIds", "summaryReferenceChunkIds"} and isinstance(item, list):
                yield [str(chunk_id) for chunk_id in item]
            else:
                yield from _reference_lists(item)
    elif isinstance(value, list):
        for item in value:
            yield from _reference_lists(item)
