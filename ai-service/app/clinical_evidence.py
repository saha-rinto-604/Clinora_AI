"""Clinora-owned evidence eligibility, shared by prompting and final grounding.

This module establishes facts and support eligibility, never disease associations.
An abnormal count cannot measure diagnostic specificity; a positive assay and a
numeric outlier both qualify for cautious consideration, not a confidence score.
"""
from __future__ import annotations

import re
from enum import StrEnum
from collections.abc import Iterable

from app.clinical_ranges import range_state

_POSITIVE = {"abnormal", "detected", "positive", "present", "reactive"}
_NEGATIVE = {"absent", "negative", "non reactive", "nonreactive", "not detected"}
SUPPORTING_EVIDENCE_CLASSES = frozenset({"OUTSIDE_RANGE", "QUALITATIVE_POSITIVE"})


class SupportEligibility(StrEnum):
    VERIFIED_ABNORMAL = "VERIFIED_ABNORMAL"
    VERIFIED_QUALITATIVE_POSITIVE = "VERIFIED_QUALITATIVE_POSITIVE"
    VERIFIED_NORMAL = "VERIFIED_NORMAL"
    VERIFIED_QUALITATIVE_NEGATIVE = "VERIFIED_QUALITATIVE_NEGATIVE"
    CONTEXT_ONLY = "CONTEXT_ONLY"
    UNKNOWN = "UNKNOWN"


def support_eligibility(observation: object) -> SupportEligibility:
    """One factual authority for all support decisions; never supplies a cutoff."""
    return {
        "OUTSIDE_RANGE": SupportEligibility.VERIFIED_ABNORMAL,
        "QUALITATIVE_POSITIVE": SupportEligibility.VERIFIED_QUALITATIVE_POSITIVE,
        "IN_RANGE": SupportEligibility.VERIFIED_NORMAL,
        "QUALITATIVE_NEGATIVE": SupportEligibility.VERIFIED_QUALITATIVE_NEGATIVE,
        "QUALITATIVE_REPORTED": SupportEligibility.CONTEXT_ONLY,
        "UNCLASSIFIED": SupportEligibility.UNKNOWN,
    }[evidence_class(observation)]


def is_context_only(observation: object) -> bool:
    return support_eligibility(observation) in {SupportEligibility.CONTEXT_ONLY, SupportEligibility.UNKNOWN}


def authoritative_states(observation: object) -> set[str]:
    """States a model premise may repeat, including coexisting qualitative facts."""
    states = {range_state(observation)}
    qualitative = qualitative_class(observation)
    if qualitative:
        states.add("POSITIVE" if qualitative == "QUALITATIVE_POSITIVE" else "NEGATIVE")
    return states


def evidence_class(observation: object) -> str:
    state = range_state(observation)
    if state in {"LOW", "HIGH"}:
        return "OUTSIDE_RANGE"
    qualitative = qualitative_class(observation)
    if qualitative:
        return qualitative
    if str(getattr(observation, "valueType", "")).upper() in {"TEXT", "QUALITATIVE"}:
        return "QUALITATIVE_REPORTED"
    return "IN_RANGE" if state == "IN_RANGE" else "UNCLASSIFIED"


def qualitative_class(observation: object) -> str | None:
    """Verified qualitative facts coexist with, and are not inferred from, ranges."""
    for value in (getattr(observation, "textValue", None), getattr(observation, "rangeFlag", None)):
        normalized = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
        if normalized in _POSITIVE:
            return "QUALITATIVE_POSITIVE"
        if normalized in _NEGATIVE:
            return "QUALITATIVE_NEGATIVE"
    return None


def is_strong_evidence(observation: object) -> bool:
    """Compatibility name: means eligible positive support, not diagnostic strength."""
    return support_eligibility(observation) in {
        SupportEligibility.VERIFIED_ABNORMAL, SupportEligibility.VERIFIED_QUALITATIVE_POSITIVE,
    }


def support_level(observations: Iterable[object]) -> str | None:
    """Use cautious compatibility metadata; never infer confidence from item counts."""
    return "LIMITED" if any(is_strong_evidence(item) for item in observations) else None
