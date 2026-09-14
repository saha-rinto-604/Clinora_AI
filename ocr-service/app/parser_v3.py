from __future__ import annotations

import re
from dataclasses import dataclass
from statistics import mean
from typing import Any

from .schemas import BoundingBox, Observation

PARSER_VERSION = "clinora-lab-parser-v3.2"
NORMALIZER_VERSION = "clinora-lab-normalizer-v3.2"

_NORMALIZED_LABELS = {
    "hb": "Hemoglobin",
    "hgb": "Hemoglobin",
    "haemoglobin": "Hemoglobin",
    "hemoglobin": "Hemoglobin",
    "wbc": "White blood cell count",
    "wbc count": "White blood cell count",
    "total wbc": "White blood cell count",
    "total wbc count": "White blood cell count",
    "white blood cell count": "White blood cell count",
    "total leukocyte count": "White blood cell count",
    "total leucocyte count": "White blood cell count",
    "tlc": "White blood cell count",
    "rbc": "Red blood cell count",
    "rbc count": "Red blood cell count",
    "total rbc": "Red blood cell count",
    "total rbc count": "Red blood cell count",
    "red blood cell count": "Red blood cell count",
    "total red blood cell count": "Red blood cell count",
    "platelet": "Platelets",
    "platelet count": "Platelets",
    "total platelet count": "Platelets",
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
    "haematocrit": "Hematocrit",
    "hct": "Hematocrit",
    "pcv": "Hematocrit",
    "packed cell volume": "Hematocrit",
    "mcv": "MCV",
    "mch": "MCH",
    "mchc": "MCHC",
    "rdw": "RDW",
    "rdw-cv": "RDW-CV",
    "rdw cv": "RDW-CV",
    "rdw-sd": "RDW-SD",
    "rdw sd": "RDW-SD",
    "pct": "Plateletcrit",
    "plateletcrit": "Plateletcrit",
    "mpv": "MPV",
    "mean platelet volume": "MPV",
    "pdw": "PDW",
    "platelet distribution width": "PDW",
    "neutrophils": "Neutrophils",
    "neutrophil": "Neutrophils",
    "lymphocytes": "Lymphocytes",
    "lymphocyte": "Lymphocytes",
    "monocytes": "Monocytes",
    "monocyte": "Monocytes",
    "eosinophils": "Eosinophils",
    "eosinophil": "Eosinophils",
    "basophils": "Basophils",
    "basophil": "Basophils",
    "esr": "ESR",
    "erythrocyte sedimentation rate": "ESR",
    "crp": "C-reactive protein",
    "c-reactive protein": "C-reactive protein",
    "ferritin": "Ferritin",
    "iron": "Iron",
    "serum iron": "Iron",
    "tibc": "TIBC",
    "total iron binding capacity": "TIBC",
    "total iron-binding capacity": "TIBC",
    "hba": "HbA",
    "hb a": "HbA",
    "hemoglobin a": "HbA",
    "haemoglobin a": "HbA",
    "hba2": "HbA2",
    "hb a2": "HbA2",
    "hemoglobin a2": "HbA2",
    "haemoglobin a2": "HbA2",
    "hbf": "HbF",
    "hb f": "HbF",
    "hemoglobin f": "HbF",
    "haemoglobin f": "HbF",
    "albumin": "Albumin",
    "total protein": "Total protein",
    "calcium": "Calcium",
}

# Accept conventional decimals, decimal commas, western thousands and Indian
# thousands grouping. _number() normalizes the token after matching.
_NUMBER = r"-?\d+(?:[.,]\d+)*"
_COMPARATOR = r"(?:<=|>=|<|>|≤|≥)?"
_RANGE = rf"(?P<range>{_NUMBER}\s*(?:-|–|—|to)\s*{_NUMBER}|(?:<|>|≤|≥)\s*{_NUMBER})"
_UNIT_TOKEN = r"[A-Za-zµμ%/\^0-9⁰¹²³⁴⁵⁶⁷⁸⁹×x*·._\-]+"
_FIRST_ORDINAL = r"(?:1|i|l)st"
_INLINE_UNIT = rf"(?:{_UNIT_TOKEN}|mm\s+(?:in\s+)?{_FIRST_ORDINAL}\s*(?:hr|hrs|hour|hours))"
_ROW_UNIT_THEN_RANGE = re.compile(
    rf"^\s*(?P<label>[A-Za-z0-9][A-Za-z0-9 .()/%+_\-]{{1,100}}?)\s+"
    rf"(?P<comparator>{_COMPARATOR})\s*(?P<value>{_NUMBER})"
    rf"(?:\s+(?P<unit>{_INLINE_UNIT}))?"
    rf"(?:\s+{_RANGE})?"
    rf"(?:\s+(?P<flag>H|L|HIGH|LOW|ABNORMAL|NORMAL))?\s*$",
    re.IGNORECASE,
)
_ROW_RANGE_THEN_UNIT = re.compile(
    rf"^\s*(?P<label>[A-Za-z0-9][A-Za-z0-9 .()/%+_\-]{{1,100}}?)\s+"
    rf"(?P<comparator>{_COMPARATOR})\s*(?P<value>{_NUMBER})"
    rf"(?:\s+{_RANGE})"
    rf"(?:\s+(?P<unit>{_INLINE_UNIT}))?"
    rf"(?:\s+(?P<flag>H|L|HIGH|LOW|ABNORMAL|NORMAL))?\s*$",
    re.IGNORECASE,
)
_QUALITATIVE = re.compile(
    r"^\s*(?P<label>[A-Za-z0-9][A-Za-z0-9 .()/%+_\-]{1,100}?)\s+"
    r"(?P<value>positive|negative|reactive|non-reactive|detected|not detected|trace)\s*$",
    re.IGNORECASE,
)
_VALUE_CELL = re.compile(
    rf"^\s*(?P<comparator>{_COMPARATOR})\s*(?P<value>{_NUMBER})(?:\s*(?P<unit>{_INLINE_UNIT}))?\s*$",
    re.IGNORECASE,
)
_COLLAPSED_LABEL_VALUE = re.compile(
    rf"^\s*(?P<label>[A-Za-z][A-Za-z0-9 .()/%+_\-]{{1,120}}?)\s+"
    rf"(?P<comparator>{_COMPARATOR})\s*(?P<value>{_NUMBER})(?:\s*(?P<unit>{_INLINE_UNIT}))?\s*$",
    re.IGNORECASE,
)
_METADATA_PREFIXES = (
    "lab id",
    "lab no",
    "laboratory id",
    "medical id",
    "patient id",
    "patient no",
    "patient name",
    "name",
    "age",
    "sex",
    "gender",
    "date",
    "collection date",
    "collected",
    "received",
    "reported",
    "print date",
    "printed",
    "consulted by",
    "referred by",
    "ref by",
    "doctor",
    "physician",
    "specimen",
    "sample id",
    "registration",
    "invoice",
    "barcode",
    "phone",
    "mobile",
    "address",
    "ward",
    "bed",
    "department",
)
_DEMOGRAPHIC_REFERENCE = re.compile(
    r"\b(?:male|female|men|women|adult|child|children|newborn|infant|pregnan|age|years?|yrs?)\b|"
    r"(?:^|[\s,;|])(?:m|f)\s*:",
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


@dataclass(frozen=True)
class ReportReferenceContext:
    sex: str | None = None
    age_years: int | None = None


def parse_observations(
    pages: list[list[TextBlock]],
    page_sizes: list[tuple[int, int]],
    numeric_review_threshold: float,
) -> list[Observation]:
    observations: list[Observation] = []
    seen: set[tuple[int, str, str, str]] = set()
    for page_index, blocks in enumerate(pages):
        width, height = page_sizes[page_index]
        reference_context = _extract_report_reference_context(blocks)
        for row in _group_rows(blocks):
            parsed = _parse_row(row, page_index + 1, width, height, numeric_review_threshold)
            if parsed is None:
                continue
            parsed = _apply_report_specific_reference(parsed, reference_context)
            value_key = (
                str(parsed.numericValue)
                if parsed.numericValue is not None
                else (parsed.textValue or "").strip().lower()
            )
            key = (
                parsed.pageNumber,
                parsed.normalizedLabel.strip().lower(),
                parsed.valueType,
                value_key,
            )
            # PP-Structure can surface the same table OCR token in both general
            # OCR and table OCR. Never duplicate an identical clinical fact.
            if key in seen:
                continue
            seen.add(key)
            observations.append(parsed)
    return observations


def _extract_report_reference_context(blocks: list[TextBlock]) -> ReportReferenceContext:
    # Only explicit metadata labels can provide context. Words such as "Men" or
    # "Women" inside reference cells must never be mistaken for the patient sex.
    text = "\n".join(block.text.strip() for block in sorted(blocks, key=lambda b: (b.y1, b.x1)) if block.text.strip())
    sex: str | None = None
    age_years: int | None = None
    sex_match = re.search(r"(?im)\b(?:sex|gender)\s*[:\-]?\s*(male|female|m|f)\b", text)
    if sex_match:
        token = sex_match.group(1).lower()
        sex = "MALE" if token in {"male", "m"} else "FEMALE"
    age_match = re.search(r"(?im)\bage\s*[:\-]?\s*(\d{1,3})(?:\s*(?:years?|yrs?|y))?\b", text)
    if age_match:
        age = int(age_match.group(1))
        if 0 <= age <= 120:
            age_years = age
    return ReportReferenceContext(sex=sex, age_years=age_years)


def _apply_report_specific_reference(
    observation: Observation, context: ReportReferenceContext,
) -> Observation:
    if observation.valueType != "NUMERIC" or observation.numericValue is None:
        return observation
    if observation.referenceLow is not None or observation.referenceHigh is not None:
        return observation
    raw = observation.referenceRangeRaw
    if not raw:
        return observation
    selected = _select_contextual_range(raw, context)
    if selected is None:
        return observation
    low, high = _parse_range(selected)
    if low is None and high is None:
        return observation
    return observation.model_copy(update={
        "referenceLow": low,
        "referenceHigh": high,
        "derivedRangeFlag": _range_flag(observation.numericValue, low, high),
        # The range was selected from OCR-read demographic context. Keep a
        # mandatory human review boundary before this fact can reach reasoning.
        "reviewRequired": True,
    })


def _select_contextual_range(raw: str, context: ReportReferenceContext) -> str | None:
    if context.sex:
        labels = (r"(?:male|men)", r"m") if context.sex == "MALE" else (r"(?:female|women)", r"f")
        for label in labels:
            # Single-letter M/F is accepted only with an explicit colon to avoid
            # matching ordinary unit text. Full words may use a colon or spaces.
            separator = r"\s*:\s*" if label in {r"m", r"f"} else r"\s*:?[ \t]*"
            match = re.search(
                rf"(?i)(?<![A-Za-z]){label}(?![A-Za-z]){separator}((?:<|>|≤|≥)\s*{_NUMBER}|{_NUMBER}\s*(?:-|–|—|to)\s*{_NUMBER})",
                raw,
            )
            if match:
                return match.group(1)
    if context.age_years is not None:
        label = r"adult" if context.age_years >= 18 else r"(?:child|children|pediatric|paediatric)"
        match = re.search(
            rf"(?i)(?<![A-Za-z]){label}(?![A-Za-z])\s*:?[ \t]*((?:<|>|≤|≥)\s*{_NUMBER}|{_NUMBER}\s*(?:-|–|—|to)\s*{_NUMBER})",
            raw,
        )
        if match:
            return match.group(1)
    return None


def estimate_lab_row_candidates(pages: list[list[TextBlock]]) -> int:
    """Estimate visible lab rows without making a medical interpretation.

    The estimate is intentionally conservative and is used only as an extraction
    completeness guard. It never creates an observation or a disease rule.
    """
    count = 0
    for blocks in pages:
        for row in _group_rows(blocks):
            cells = [block.text.strip() for block in sorted(row, key=lambda block: block.x1) if block.text.strip()]
            if len(cells) < 2:
                continue
            joined = " ".join(cells)
            first = _clean_label(cells[0])
            if _looks_like_header(first) or _looks_like_metadata_label(first):
                continue
            has_label = bool(re.search(r"[A-Za-z]{2,}", first))
            has_result = any(_value_cell(value) is not None for value in cells[1:])
            if not has_result:
                has_result = _COLLAPSED_LABEL_VALUE.fullmatch(joined) is not None
            if has_label and has_result:
                count += 1
    return count


def observation_from_assisted_row(row: dict[str, Any], page_number: int) -> Observation | None:
    """Convert a MedGemma transcription row into a review-required observation.

    MedGemma is a secondary document reader only. Its rows are never considered
    authoritative and therefore always require Patient review before reasoning.
    """
    label = _clean_label(str(row.get("label") or row.get("test") or ""))
    if not label or not _valid_clinical_label(label):
        return None

    raw_value = str(row.get("value") or row.get("result") or "").strip()
    if not raw_value:
        return None
    unit = _clean_optional(str(row.get("unit") or ""))
    reference_raw = _clean_optional(str(row.get("referenceRange") or row.get("reference") or ""))
    if reference_raw:
        reference_raw = reference_raw[:160]

    # A secondary reader that copies a range into the result column is
    # uncertain, not evidence. Ignore it rather than accepting one endpoint as
    # the Patient's result.
    range_low, range_high = _parse_range(raw_value)
    if range_low is not None and range_high is not None:
        return None

    numeric = _value_cell(raw_value)
    if numeric:
        value = _number(numeric.group("value"))
        inline_unit = _clean_optional(numeric.group("unit"))
        low, high = _parse_range(reference_raw)
        return Observation(
            sourceLabel=label,
            normalizedLabel=normalize_label(label),
            valueType="NUMERIC",
            rawValue=_raw_numeric_value(numeric),
            numericValue=value,
            comparator=_normalize_comparator(numeric.group("comparator")),
            unit=unit or inline_unit,
            referenceRangeRaw=reference_raw,
            referenceLow=low,
            referenceHigh=high,
            derivedRangeFlag=_range_flag(value, low, high),
            pageNumber=max(1, page_number),
            confidence=None,
            reviewRequired=True,
        )

    qualitative = re.fullmatch(
        r"(?i)\s*(positive|negative|reactive|non-reactive|detected|not detected|trace)\s*",
        raw_value,
    )
    if qualitative:
        return Observation(
            sourceLabel=label,
            normalizedLabel=normalize_label(label),
            valueType="QUALITATIVE",
            rawValue=raw_value,
            textValue=qualitative.group(1).strip().title(),
            unit=unit,
            referenceRangeRaw=reference_raw,
            pageNumber=max(1, page_number),
            confidence=None,
            reviewRequired=True,
        )
    return None


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
            # Use the smaller text height so a tall token from the following
            # line cannot bridge two otherwise distinct table rows.
            if distance <= min(height, row_height) * 0.65 and (best_distance is None or distance < best_distance):
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
    collapsed = _parse_collapsed_numeric_row(row, page_number, page_width, page_height, numeric_review_threshold)
    if collapsed is not None:
        return collapsed

    structured = _parse_spatial_numeric_row(row, page_number, page_width, page_height, numeric_review_threshold)
    if structured is not None:
        return structured

    text = " ".join(block.text.strip() for block in row if block.text.strip())
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 3:
        return None

    qualitative = _QUALITATIVE.match(text)
    if qualitative:
        label = _clean_label(qualitative.group("label"))
        if not _valid_clinical_label(label):
            return None
        confidence = min(block.confidence for block in row)
        return Observation(
            sourceLabel=label,
            normalizedLabel=normalize_label(label),
            valueType="QUALITATIVE",
            rawValue=qualitative.group("value").strip(),
            textValue=qualitative.group("value").strip().title(),
            pageNumber=page_number,
            boundingBox=_bounding_box(row, page_width, page_height),
            confidence=confidence,
            reviewRequired=confidence < numeric_review_threshold,
        )

    match = _ROW_RANGE_THEN_UNIT.match(text) or _ROW_UNIT_THEN_RANGE.match(text)
    if not match:
        return None
    label = _clean_label(match.group("label"))
    if not _valid_clinical_label(label):
        return None
    value = _number(match.group("value"))
    range_raw = match.group("range")
    reference_low, reference_high = _parse_range(range_raw)
    confidence = min(block.confidence for block in row)
    semantic_review = _requires_semantic_review(label, value, reference_low, reference_high)
    original_unit = _clean_optional(match.group("unit"))
    recovered_unit, unit_supported = _recover_unit(original_unit, _clean_optional(range_raw))
    return Observation(
        sourceLabel=label,
        normalizedLabel=normalize_label(label),
        valueType="NUMERIC",
        rawValue=_raw_numeric_value(match),
        numericValue=value,
        comparator=_normalize_comparator(match.group("comparator")),
        unit=recovered_unit,
        referenceRangeRaw=_clean_optional(range_raw),
        referenceLow=reference_low,
        referenceHigh=reference_high,
        sourceFlag=_clean_optional(match.group("flag")),
        derivedRangeFlag=_range_flag(value, reference_low, reference_high),
        pageNumber=page_number,
        boundingBox=_bounding_box(row, page_width, page_height),
        confidence=confidence,
        reviewRequired=(
            confidence < numeric_review_threshold
            or semantic_review
            or _unsafe_unit_conflict(original_unit, range_raw, unit_supported)
        ),
    )


def _parse_spatial_numeric_row(
    row: list[TextBlock],
    page_number: int,
    page_width: int,
    page_height: int,
    numeric_review_threshold: float,
) -> Observation | None:
    """Parse laboratory rows using OCR/table column order."""
    cells = [block for block in sorted(row, key=lambda block: block.x1) if block.text.strip()]
    if len(cells) < 2:
        return None

    first_numeric = next((index for index, block in enumerate(cells) if _value_cell(block.text)), None)
    if first_numeric is None or first_numeric == 0:
        return None

    label = _clean_label(" ".join(block.text.strip() for block in cells[:first_numeric]))
    if not label or not _valid_clinical_label(label):
        return None

    value_match = _value_cell(cells[first_numeric].text)
    if not value_match:
        return None

    value = _number(value_match.group("value"))
    comparator = _normalize_comparator(value_match.group("comparator"))
    inline_unit = _clean_optional(value_match.group("unit"))
    trailing = [block.text.strip() for block in cells[first_numeric + 1:] if block.text.strip()]
    reference_raw, reference_low, reference_high, unit, source_flag, ambiguous = _parse_trailing_cells(trailing)
    confidence = min(block.confidence for block in cells)
    semantic_review = ambiguous or _requires_semantic_review(label, value, reference_low, reference_high)

    original_unit = inline_unit or unit
    recovered_unit, unit_supported = _recover_unit(original_unit, reference_raw)
    return Observation(
        sourceLabel=label,
        normalizedLabel=normalize_label(label),
        valueType="NUMERIC",
        rawValue=_raw_numeric_value(value_match),
        numericValue=value,
        comparator=comparator,
        unit=recovered_unit,
        referenceRangeRaw=reference_raw,
        referenceLow=reference_low,
        referenceHigh=reference_high,
        sourceFlag=source_flag,
        derivedRangeFlag=_range_flag(value, reference_low, reference_high),
        pageNumber=page_number,
        boundingBox=_bounding_box(cells, page_width, page_height),
        confidence=confidence,
        reviewRequired=(
            confidence < numeric_review_threshold
            or semantic_review
            or _unsafe_unit_conflict(original_unit, reference_raw, unit_supported)
        ),
    )


def _parse_collapsed_numeric_row(
    row: list[TextBlock],
    page_number: int,
    page_width: int,
    page_height: int,
    numeric_review_threshold: float,
) -> Observation | None:
    """Recover rows where OCR merged the test and result into one table cell."""
    cells = [block for block in sorted(row, key=lambda block: block.x1) if block.text.strip()]
    if not cells:
        return None
    for split_index in range(1, min(3, len(cells)) + 1):
        prefix = " ".join(block.text.strip() for block in cells[:split_index])
        match = _COLLAPSED_LABEL_VALUE.fullmatch(prefix)
        if not match:
            continue
        label = _clean_label(match.group("label"))
        if not label or not _valid_clinical_label(label):
            return None
        value = _number(match.group("value"))
        trailing = [block.text.strip() for block in cells[split_index:] if block.text.strip()]
        reference_raw, low, high, unit, source_flag, ambiguous = _parse_trailing_cells(trailing)
        # A collapsed label/result row without any trailing reference/unit is too
        # easy to confuse with an identifier such as "Sample 1234".
        if not trailing and not _clean_optional(match.group("unit")):
            continue
        confidence = min(block.confidence for block in cells)
        original_unit = _clean_optional(match.group("unit")) or unit
        recovered_unit, unit_supported = _recover_unit(original_unit, reference_raw)
        return Observation(
            sourceLabel=label,
            normalizedLabel=normalize_label(label),
            valueType="NUMERIC",
            rawValue=_raw_numeric_value(match),
            numericValue=value,
            comparator=_normalize_comparator(match.group("comparator")),
            unit=recovered_unit,
            referenceRangeRaw=reference_raw,
            referenceLow=low,
            referenceHigh=high,
            sourceFlag=source_flag,
            derivedRangeFlag=_range_flag(value, low, high),
            pageNumber=page_number,
            boundingBox=_bounding_box(cells, page_width, page_height),
            confidence=confidence,
            reviewRequired=(
                confidence < numeric_review_threshold
                or ambiguous
                or _requires_semantic_review(label, value, low, high)
                or _unsafe_unit_conflict(original_unit, reference_raw, unit_supported)
            ),
        )
    return None


def _value_cell(value: str) -> re.Match[str] | None:
    return _VALUE_CELL.fullmatch(value.strip())


def _numeric_cell(value: str) -> bool:
    return _value_cell(value) is not None


def _parse_trailing_cells(
    values: list[str],
) -> tuple[str | None, float | None, float | None, str | None, str | None, bool]:
    source_flag: str | None = None
    reference_raw: str | None = None

    remaining = [re.sub(r"\s+", " ", value).strip() for value in values if value.strip()]
    if remaining and remaining[-1].upper() in {"H", "L", "HIGH", "LOW", "ABNORMAL", "NORMAL"}:
        source_flag = remaining.pop().upper()

    # Prefer an explicit simple range. A range may carry its unit in the same cell.
    for width in (3, 2, 1):
        for start in range(0, max(0, len(remaining) - width + 1)):
            candidate = " ".join(remaining[start:start + width])
            low, high = _parse_range(candidate)
            if low is not None or high is not None:
                reference_raw = candidate[:160]
                outside_range = [*remaining[:start], *remaining[start + width:]]
                unit = _first_unit([*outside_range, candidate])
                ambiguous = any(_numeric_cell(value) or re.fullmatch(r"[-–—]", value) for value in outside_range)
                return reference_raw, low, high, unit, source_flag, ambiguous

    # Preserve complex report-specific ranges (sex/age groups, multiple cutoffs)
    # verbatim. Do not collapse them to one numeric range without verified context.
    complex_reference = _complex_reference(remaining)
    if complex_reference:
        unit = _first_unit(remaining)
        return complex_reference[:160], None, None, unit, source_flag, True

    unit = _first_unit(remaining)
    ambiguous = any(_numeric_cell(value) or re.fullmatch(r"[-–—]", value) for value in remaining)
    return None, None, None, unit, source_flag, ambiguous


def _complex_reference(values: list[str]) -> str | None:
    if not values:
        return None
    combined = " | ".join(value for value in values if value)
    numeric_count = len(re.findall(_NUMBER, combined))
    has_range_syntax = bool(re.search(r"(?:-|–|—|\bto\b|<|>|≤|≥)", combined, re.IGNORECASE))
    if numeric_count >= 2 and has_range_syntax and (_DEMOGRAPHIC_REFERENCE.search(combined) or numeric_count >= 3):
        return combined
    return None


def _first_unit(values: list[str]) -> str | None:
    for value in values:
        extracted = _extract_unit(value)
        if extracted:
            return extracted[:80]
    return None


def _extract_unit(value: str) -> str | None:
    cleaned = re.sub(r"\s+", " ", value.strip())
    if not cleaned or _looks_like_reference_text(cleaned):
        # A reference cell can still have a trailing unit; extract only that tail.
        match = re.search(
            r"(?:\d|%|\))\s*((?:x\s*)?10\^?\d+\s*/\s*[A-Za-z]+|million\s*/\s*[A-Za-z]+|"
            rf"[A-Za-zµμ]+\s*/\s*[A-Za-z]+|g/dl|mg/dl|ng/dl|pg|fl|%|mm/hr|mm\s+(?:in\s+)?{_FIRST_ORDINAL}\s*(?:hr|hrs|hour|hours))\s*$",
            cleaned,
            re.IGNORECASE,
        )
        return re.sub(r"\s+", "", match.group(1)) if match else None
    if len(cleaned) <= 40 and re.fullmatch(r"[A-Za-zµμ%/\^0-9⁰¹²³⁴⁵⁶⁷⁸⁹×x*·._\- ]+", cleaned):
        # Avoid treating ordinary prose as a unit.
        if len(re.findall(r"[A-Za-z]{3,}", cleaned)) <= 2:
            return cleaned
    return None


def _looks_like_reference_text(value: str) -> bool:
    numeric_count = len(re.findall(_NUMBER, value))
    return bool(numeric_count and re.search(r"(?:-|–|—|\bto\b|<|>|≤|≥|:)", value, re.IGNORECASE))


def _requires_semantic_review(
    label: str,
    value: float | None,
    low: float | None,
    high: float | None,
) -> bool:
    if value is None:
        return True
    if low is not None and high is not None and low > high:
        return True
    standalone_numbers = re.findall(r"(?<![A-Za-z])\d+(?:[.,]\d+)*(?![A-Za-z])", label)
    return len(standalone_numbers) > 1


def normalize_label(label: str) -> str:
    key = re.sub(r"\s+", " ", label.strip().lower().replace(":", ""))
    direct = _NORMALIZED_LABELS.get(key)
    if direct:
        return direct
    # Parenthetical suffixes commonly identify the laboratory method. Strip
    # them only when the remaining visible label is already known.
    without_method = re.sub(r"\s*\([^)]{1,60}\)\s*$", "", key).strip()
    return _NORMALIZED_LABELS.get(without_method, label.strip())


def is_known_lab_label(label: str) -> bool:
    key = re.sub(r"\s+", " ", label.strip().lower().replace(":", ""))
    return key in _NORMALIZED_LABELS or label.strip() in set(_NORMALIZED_LABELS.values())


def recognized_lab_labels(text: str) -> list[str]:
    """Return distinct known analytes explicitly present in visible text."""
    normalized_text = re.sub(r"[^a-z0-9%+._\-]+", " ", text.casefold())
    found: list[str] = []
    for alias, canonical in sorted(_NORMALIZED_LABELS.items(), key=lambda item: len(item[0]), reverse=True):
        if canonical in found:
            continue
        if re.search(rf"(?<![a-z0-9]){re.escape(alias.casefold())}(?![a-z0-9])", normalized_text):
            found.append(canonical)
    return found


def estimate_known_lab_label_mentions(pages: list[list[TextBlock]]) -> int:
    """Count distinct known analytes visible anywhere in OCR text.

    This is a completeness signal only. It does not create observations or
    classify results, and therefore cannot introduce disease-specific logic.
    """
    canonical: set[str] = set()
    aliases = sorted(_NORMALIZED_LABELS.items(), key=lambda item: len(item[0]), reverse=True)
    for blocks in pages:
        page_text = " ".join(block.text for block in blocks if block.text.strip()).casefold()
        page_text = re.sub(r"[^a-z0-9%+._\-]+", " ", page_text)
        for alias, normalized in aliases:
            token = alias.casefold()
            # Boundaries avoid matching short aliases such as Hb/RBC inside IDs
            # or unrelated words while still handling punctuation around labels.
            if re.search(rf"(?<![a-z0-9]){re.escape(token)}(?![a-z0-9])", page_text):
                canonical.add(normalized)
    return len(canonical)


def _valid_clinical_label(label: str) -> bool:
    letters = re.findall(r"[A-Za-z]", label)
    if len(letters) < 2 or len(label) > 90 or "|" in label:
        return False
    return not _looks_like_header(label) and not _looks_like_metadata_label(label)


def _clean_label(label: str) -> str:
    return re.sub(r"\s+", " ", label).strip(" :-")[:160]


def _looks_like_header(label: str) -> bool:
    lowered = re.sub(r"\s+", " ", label.lower().strip(" :"))
    return lowered in {
        "test",
        "test description",
        "result",
        "reference",
        "reference range",
        "ref. range",
        "ref range",
        "normal range",
        "parameter",
        "investigation",
        "unit",
        "hematology",
        "haematology",
        "complete blood count",
        "differential count",
        "red cell indices",
        "platelet indices",
        "platelet series",
        "iron studies",
        "hplc",
    }


def _looks_like_metadata_label(label: str) -> bool:
    normalized = re.sub(r"[^a-z0-9]+", " ", label.lower()).strip()
    if not normalized:
        return False
    compact = normalized.replace(" ", "")
    if compact in {"labid", "laboratoryid", "medicalid", "patientid", "sampleid", "registrationid"}:
        return True
    if re.fullmatch(r"[a-z]{1,12}id", compact) and compact not in {"lipid"}:
        return True
    return any(
        normalized == prefix or normalized.startswith(prefix + " ")
        for prefix in _METADATA_PREFIXES
    )


def _number(value: str | None) -> float | None:
    if value is None:
        return None
    normalized = value.strip().replace(" ", "")
    if normalized.count(",") > 1:
        normalized = normalized.replace(",", "")
    elif "," in normalized and "." not in normalized:
        integer_part, fractional_part = normalized.split(",", 1)
        if len(fractional_part) == 3 and integer_part.lstrip("-") not in {"", "0"}:
            normalized = integer_part + fractional_part
        else:
            normalized = integer_part + "." + fractional_part
    elif "," in normalized and "." in normalized:
        normalized = normalized.replace(",", "")
    return float(normalized)


def _raw_numeric_value(match: re.Match[str]) -> str:
    comparator = _normalize_comparator(match.groupdict().get("comparator")) or ""
    return f"{comparator}{match.group('value')}"


def _recover_unit(unit: str | None, reference_raw: str | None) -> tuple[str | None, bool]:
    """Repair a malformed unit only from an explicit same-row reference unit."""
    if not reference_raw:
        return unit, False
    reference_unit = _extract_unit(reference_raw)
    if not reference_unit:
        return unit, False
    if not unit:
        return reference_unit, True

    source_key = _unit_key(unit)
    reference_key = _unit_key(reference_unit)
    if source_key == reference_key:
        return unit, True
    if source_key.replace("1", "l") == reference_key:
        return reference_unit, True
    if abs(len(source_key) - len(reference_key)) == 1 and (
        source_key in reference_key or reference_key in source_key
    ):
        return reference_unit, True
    return unit, False


def _unit_key(value: str) -> str:
    # Compare only units printed on the same row. OCR commonly confuses the
    # digit one with I/l in ordinal unit phrases.
    normalized = re.sub(r"(?i)\b[il]st\b", "1st", value)
    return re.sub(r"[^a-z0-9%/]", "", normalized.casefold())


def _unsafe_unit_conflict(unit: str | None, reference_raw: str | None, supported: bool) -> bool:
    return bool(unit and reference_raw and _extract_unit(reference_raw) and not supported)


def _strip_trailing_unit(value: str) -> str:
    # Range parsing is intentionally conservative. Strip a trailing unit only
    # after the numeric/comparator expression has been preserved.
    return re.sub(
        r"\s*(?:%|/?[A-Za-zµμ]+(?:/[A-Za-z]+)?|(?:x\s*)?10\^?\d+\s*/\s*[A-Za-z]+|million\s*/\s*[A-Za-z]+)\s*$",
        "",
        value.strip(),
        flags=re.IGNORECASE,
    )


def _parse_range(value: str | None) -> tuple[float | None, float | None]:
    if not value:
        return None, None
    normalized = _strip_trailing_unit(value.replace("—", "-").replace("–", "-"))
    # Never choose one of several demographic/age-specific subranges.
    if _DEMOGRAPHIC_REFERENCE.search(normalized) or len(re.findall(_NUMBER, normalized)) > 2:
        return None, None
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
