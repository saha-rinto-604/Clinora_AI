from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

_NUMBER = r"[+-]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)"
_ONE_SIDED = re.compile(rf"^\s*(<=|>=|<|>|\u2264|\u2265)\s*({_NUMBER})(.*)$", re.IGNORECASE)
_INTERVAL = re.compile(rf"^\s*({_NUMBER})\s*(?:-|\u2013|\u2014|to)\s*({_NUMBER})(.*)$", re.IGNORECASE)
_QUALITATIVE_TERMS = re.compile(
    r"\b(?:negative|positive|equivocal|borderline|reactive|non[- ]?reactive|indeterminate)\b",
    re.IGNORECASE,
)
_EXTRA_NUMBER = re.compile(r"(?<![A-Za-z])\d+(?:\.\d+)?(?![A-Za-z])")
# Reference ranges often repeat a laboratory unit after the range itself, e.g.
# ``150-400 x10^9/L`` or ``4.0-11.0 10^3/uL``. Those exponent digits are unit
# metadata, not an additional clinical bound. Strip only this narrow scientific
# notation form before applying the extra-number safety check.
_SCIENTIFIC_UNIT_POWER = re.compile(
    r"(?:(?:x|\u00d7|\*)\s*)?10\s*(?:\^\s*)?[+\-]?\d+",
    re.IGNORECASE,
)
_SUPERSCRIPT_TRANSLATION = str.maketrans(
    {
        "\u2070": "0",
        "\u00b9": "1",
        "\u00b2": "2",
        "\u00b3": "3",
        "\u2074": "4",
        "\u2075": "5",
        "\u2076": "6",
        "\u2077": "7",
        "\u2078": "8",
        "\u2079": "9",
        "\u207a": "+",
        "\u207b": "-",
    }
)


def _enum_text(value: object) -> str:
    raw = getattr(value, "value", value)
    return str(raw or "")


def _decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value).replace(",", ""))
    except (InvalidOperation, ValueError):
        return None


def _safe_trailing_reference(text: str) -> bool:
    candidate = text.strip()
    if not candidate:
        return True
    if any(symbol in candidate for symbol in ("<", ">", "\u2264", "\u2265", ";")):
        return False
    if _QUALITATIVE_TERMS.search(candidate):
        return False

    normalized_units = candidate.translate(_SUPERSCRIPT_TRANSLATION)
    normalized_units = _SCIENTIFIC_UNIT_POWER.sub(" ", normalized_units)
    if _EXTRA_NUMBER.search(normalized_units):
        return False
    return True


def _raw_reference_state(numeric_value: Decimal, reference_raw: object) -> str:
    text = _enum_text(reference_raw).strip()
    if not text:
        return "UNKNOWN"

    one_sided = _ONE_SIDED.fullmatch(text)
    if one_sided and _safe_trailing_reference(one_sided.group(3)):
        operator = one_sided.group(1)
        threshold = _decimal(one_sided.group(2))
        if threshold is None:
            return "UNKNOWN"
        if operator in {"<", "\u2264"}:
            in_range = numeric_value < threshold if operator == "<" else numeric_value <= threshold
            return "IN_RANGE" if in_range else "HIGH"
        in_range = numeric_value > threshold if operator == ">" else numeric_value >= threshold
        return "IN_RANGE" if in_range else "LOW"

    interval = _INTERVAL.fullmatch(text)
    if interval and _safe_trailing_reference(interval.group(3)):
        low = _decimal(interval.group(1))
        high = _decimal(interval.group(2))
        if low is None or high is None or high < low:
            return "UNKNOWN"
        if numeric_value < low:
            return "LOW"
        if numeric_value > high:
            return "HIGH"
        return "IN_RANGE"

    return "UNKNOWN"


def range_state(observation: object) -> str:
    """Return Clinora's deterministic range state for one verified observation.

    Structured bounds and explicit verified range flags take precedence. A conservative
    parser is used only as a final fallback for simple numeric reference expressions such
    as ``< 1.00`` or ``4,000 - 11,000``. Common trailing laboratory units such as
    ``x10^9/L`` are tolerated. Qualitative assay interpretation is deliberately outside
    this helper; it classifies only the numeric result against the supplied report
    reference expression.
    """

    value_type = _enum_text(getattr(observation, "valueType", None)).upper()
    numeric_value = _decimal(getattr(observation, "numericValue", None))
    reference_low = _decimal(getattr(observation, "referenceLow", None))
    reference_high = _decimal(getattr(observation, "referenceHigh", None))

    if value_type == "NUMERIC" and numeric_value is not None:
        if reference_low is not None and numeric_value < reference_low:
            return "LOW"
        if reference_high is not None and numeric_value > reference_high:
            return "HIGH"
        if reference_low is not None or reference_high is not None:
            return "IN_RANGE"

    flag = _enum_text(getattr(observation, "rangeFlag", None)).upper()
    if "ABOVE" in flag or flag in {"HIGH", "H"}:
        return "HIGH"
    if "BELOW" in flag or flag in {"LOW", "L"}:
        return "LOW"
    if "WITHIN" in flag or "NORMAL" in flag or "IN_RANGE" in flag:
        return "IN_RANGE"

    if value_type == "NUMERIC" and numeric_value is not None:
        return _raw_reference_state(numeric_value, getattr(observation, "referenceRangeRaw", None))

    return "UNKNOWN"
