from __future__ import annotations

import re
from dataclasses import dataclass
from statistics import mean

from .schemas import BoundingBox, Observation

PARSER_VERSION = "clinora-lab-parser-v1"
NORMALIZER_VERSION = "clinora-lab-normalizer-v1"

_NORMALIZED_LABELS = {
    "hb": "Hemoglobin",
    "hgb": "Hemoglobin",
    "haemoglobin": "Hemoglobin",
    "hemoglobin": "Hemoglobin",
    "wbc": "White blood cell count",
    "white blood cell count": "White blood cell count",
    "rbc": "Red blood cell count",
    "red blood cell count": "Red blood cell count",
    "platelet": "Platelets",
    "platelets": "Platelets",
    "plt": "Platelets",
    "glucose": "Glucose",
    "fasting glucose": "Fasting glucose",
    "blood glucose": "Glucose",
    "hba1c": "HbA1c",
    "a1c": "HbA1c",
    "creatinine": "Creatinine",
    "serum creatinine": "Creatinine",
    "egfr": "eGFR",
    "alt": "ALT",
    "sgpt": "ALT",
    "ast": "AST",
    "sgot": "AST",
    "bilirubin": "Bilirubin",
    "tsh": "TSH",
    "ft4": "Free T4",
    "free t4": "Free T4",
    "ldl": "LDL cholesterol",
    "hdl": "HDL cholesterol",
    "triglycerides": "Triglycerides",
    "sodium": "Sodium",
    "potassium": "Potassium",
    "urea": "Urea",
    "hematocrit": "Hematocrit",
    "hct": "Hematocrit",
    "mcv": "MCV",
    "mch": "MCH",
    "mchc": "MCHC",
    "neutrophils": "Neutrophils",
    "lymphocytes": "Lymphocytes",
    "crp": "C-reactive protein",
    "c-reactive protein": "C-reactive protein",
    "ferritin": "Ferritin",
    "iron": "Iron",
    "albumin": "Albumin",
    "total protein": "Total protein",
    "calcium": "Calcium",
}

_NUMBER = r"-?\d+(?:[.,]\d+)?"
_COMPARATOR = r"(?:<=|>=|<|>|≤|≥)?"
_RANGE = rf"(?P<range>{_NUMBER}\s*(?:-|–|—|to)\s*{_NUMBER}|(?:<|>|≤|≥)\s*{_NUMBER})"
_ROW = re.compile(
    rf"^\s*(?P<label>[A-Za-z0-9][A-Za-z0-9 .()/%+_\-]{{1,100}}?)\s+"
    rf"(?P<comparator>{_COMPARATOR})\s*(?P<value>{_NUMBER})"
    rf"(?:\s+(?P<unit>[A-Za-zµμ%/\^0-9⁰¹²³⁴⁵⁶⁷⁸⁹×x*·._\-]+))?"
    rf"(?:\s+{_RANGE})?"
    rf"(?:\s+(?P<flag>H|L|HIGH|LOW|ABNORMAL|NORMAL))?\s*$",
    re.IGNORECASE,
)
_QUALITATIVE = re.compile(
    r"^\s*(?P<label>[A-Za-z0-9][A-Za-z0-9 .()/%+_\-]{1,100}?)\s+"
    r"(?P<value>positive|negative|reactive|non-reactive|detected|not detected|trace)\s*$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class TextBlock:
    text: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float


def parse_observations(
    pages: list[list[TextBlock]],
    page_sizes: list[tuple[int, int]],
    numeric_review_threshold: float,
) -> list[Observation]:
    observations: list[Observation] = []
    for page_index, blocks in enumerate(pages):
        width, height = page_sizes[page_index]
        for row in _group_rows(blocks):
            parsed = _parse_row(row, page_index + 1, width, height, numeric_review_threshold)
            if parsed is not None:
                observations.append(parsed)
    return observations


def _group_rows(blocks: list[TextBlock]) -> list[list[TextBlock]]:
    ordered = sorted((b for b in blocks if b.text.strip()), key=lambda b: ((b.y1 + b.y2) / 2, b.x1))
    rows: list[list[TextBlock]] = []
    for block in ordered:
        center = (block.y1 + block.y2) / 2
        height = max(1.0, block.y2 - block.y1)
        best: list[TextBlock] | None = None
        best_distance: float | None = None
        for row in rows[-4:]:
            row_center = mean((item.y1 + item.y2) / 2 for item in row)
            row_height = mean(max(1.0, item.y2 - item.y1) for item in row)
            distance = abs(center - row_center)
            if distance <= max(height, row_height) * 0.65 and (best_distance is None or distance < best_distance):
                best = row
                best_distance = distance
        if best is None:
            rows.append([block])
        else:
            best.append(block)
    for row in rows:
        row.sort(key=lambda b: b.x1)
    return rows


def _parse_row(
    row: list[TextBlock],
    page_number: int,
    page_width: int,
    page_height: int,
    numeric_review_threshold: float,
) -> Observation | None:
    text = " ".join(block.text.strip() for block in row if block.text.strip())
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 3:
        return None

    qualitative = _QUALITATIVE.match(text)
    if qualitative:
        label = _clean_label(qualitative.group("label"))
        confidence = min(block.confidence for block in row)
        return Observation(
            sourceLabel=label,
            normalizedLabel=normalize_label(label),
            valueType="QUALITATIVE",
            textValue=qualitative.group("value").strip().title(),
            pageNumber=page_number,
            boundingBox=_bounding_box(row, page_width, page_height),
            confidence=confidence,
            reviewRequired=confidence < numeric_review_threshold,
        )

    match = _ROW.match(text)
    if not match:
        return None
    label = _clean_label(match.group("label"))
    if _looks_like_header(label):
        return None
    value = _number(match.group("value"))
    range_raw = match.group("range")
    reference_low, reference_high = _parse_range(range_raw)
    confidence = min(block.confidence for block in row)
    return Observation(
        sourceLabel=label,
        normalizedLabel=normalize_label(label),
        valueType="NUMERIC",
        numericValue=value,
        comparator=_normalize_comparator(match.group("comparator")),
        unit=_clean_optional(match.group("unit")),
        referenceRangeRaw=_clean_optional(range_raw),
        referenceLow=reference_low,
        referenceHigh=reference_high,
        sourceFlag=_clean_optional(match.group("flag")),
        derivedRangeFlag=_range_flag(value, reference_low, reference_high),
        pageNumber=page_number,
        boundingBox=_bounding_box(row, page_width, page_height),
        confidence=confidence,
        reviewRequired=confidence < numeric_review_threshold,
    )


def normalize_label(label: str) -> str:
    key = re.sub(r"\s+", " ", label.strip().lower().replace(":", ""))
    return _NORMALIZED_LABELS.get(key, label.strip())


def _clean_label(label: str) -> str:
    return re.sub(r"\s+", " ", label).strip(" :-")[:160]


def _looks_like_header(label: str) -> bool:
    lowered = label.lower()
    return lowered in {
        "test", "result", "reference", "reference range", "normal range", "parameter", "investigation"
    }


def _number(value: str | None) -> float | None:
    if value is None:
        return None
    normalized = value.strip()
    if "," in normalized and "." not in normalized:
        integer_part, fractional_part = normalized.split(",", 1)
        if len(fractional_part) == 3 and integer_part.lstrip("-") not in {"", "0"}:
            normalized = integer_part + fractional_part
        else:
            normalized = integer_part + "." + fractional_part
    return float(normalized)


def _parse_range(value: str | None) -> tuple[float | None, float | None]:
    if not value:
        return None, None
    normalized = value.replace("—", "-").replace("–", "-")
    interval = re.fullmatch(rf"\s*(?P<low>{_NUMBER})\s*(?:-|to)\s*(?P<high>{_NUMBER})\s*", normalized, re.IGNORECASE)
    if interval:
        return _number(interval.group("low")), _number(interval.group("high"))
    comparator = re.fullmatch(rf"\s*(?P<comparator><|>|≤|≥)\s*(?P<value>{_NUMBER})\s*", normalized)
    if comparator:
        single = _number(comparator.group("value"))
        if comparator.group("comparator") in {"<", "≤"}:
            return None, single
        return single, None
    return None, None


def _range_flag(value: float | None, low: float | None, high: float | None) -> str | None:
    if value is None or (low is None and high is None):
        return None
    if low is not None and value < low:
        return "BELOW_REPORTED_RANGE"
    if high is not None and value > high:
        return "ABOVE_REPORTED_RANGE"
    return "WITHIN_REPORTED_RANGE"


def _normalize_comparator(value: str | None) -> str | None:
    value = _clean_optional(value)
    if value == "≤":
        return "<="
    if value == "≥":
        return ">="
    return value


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _bounding_box(row: list[TextBlock], width: int, height: int) -> BoundingBox:
    x1 = min(block.x1 for block in row)
    y1 = min(block.y1 for block in row)
    x2 = max(block.x2 for block in row)
    y2 = max(block.y2 for block in row)
    safe_width = max(1, width)
    safe_height = max(1, height)
    return BoundingBox(
        x=max(0.0, min(1.0, x1 / safe_width)),
        y=max(0.0, min(1.0, y1 / safe_height)),
        width=max(0.0, min(1.0, (x2 - x1) / safe_width)),
        height=max(0.0, min(1.0, (y2 - y1) / safe_height)),
    )
