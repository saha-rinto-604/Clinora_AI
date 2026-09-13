from __future__ import annotations

import importlib.metadata
import io
import math
import os
import re
import threading
from dataclasses import dataclass
from html.parser import HTMLParser
from statistics import mean

import numpy as np
import pytesseract
from pdf2image import convert_from_bytes, pdfinfo_from_bytes
from PIL import Image, ImageOps, UnidentifiedImageError
from pytesseract import Output

from .medgemma_document_assist import (
    MedGemmaAssistInvalidOutput,
    MedGemmaAssistTimeout,
    MedGemmaAssistUnavailable,
    enabled as medgemma_assist_enabled,
    extract_page as medgemma_extract_page,
    mode as medgemma_assist_mode,
)
from .parser_v3 import (
    NORMALIZER_VERSION,
    PARSER_VERSION,
    TextBlock,
    estimate_known_lab_label_mentions,
    estimate_lab_row_candidates,
    is_known_lab_label,
    observation_from_assisted_row,
    parse_observations,
    recognized_lab_labels,
)
from .schemas import ExtractionResponse, Observation

MAX_FILE_BYTES = int(os.getenv("OCR_MAX_FILE_SIZE_MB", "20")) * 1024 * 1024
MAX_PAGES = max(1, int(os.getenv("OCR_MAX_PAGES", "10")))
MAX_PAGE_PIXELS = max(1_000_000, int(os.getenv("OCR_MAX_PAGE_PIXELS", "30000000")))
NUMERIC_REVIEW_THRESHOLD = min(1.0, max(0.0, float(os.getenv("OCR_NUMERIC_REVIEW_THRESHOLD", "0.95"))))
OCR_ENGINE = os.getenv("OCR_ENGINE", "auto").strip().lower()
OCR_LANGUAGE = os.getenv("OCR_LANG", "en").strip() or "en"
PDF_DPI = min(300, max(150, int(os.getenv("OCR_PDF_DPI", "200"))))
TABLE_RECOGNITION_ENABLED = os.getenv("OCR_TABLE_RECOGNITION_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
REGION_DETECTION_ENABLED = os.getenv("OCR_REGION_DETECTION_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
ASSIST_CONFIDENCE_THRESHOLD = min(
    1.0,
    max(0.0, float(os.getenv("OCR_MEDGEMMA_TARGET_CONFIDENCE_THRESHOLD", "0.90"))),
)

_SUPPORTED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}
_PADDLE_LOCK = threading.Lock()
_PADDLE_PIPELINE = None
_PADDLE_BASIC_PIPELINE = None


class OcrInputError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class OcrProcessingError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class EnginePage:
    blocks: list[TextBlock]
    width: int
    height: int


@dataclass(frozen=True)
class EngineOutput:
    engine: str
    version: str
    pages: list[EnginePage]
    warnings: list[str]


@dataclass(frozen=True)
class AssistRegion:
    page_number: int
    image: Image.Image
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class ReconciliationStats:
    agreements: int = 0
    disagreements: int = 0
    assisted_only: int = 0


def extract_document(file_bytes: bytes, content_type: str | None, filename: str | None) -> ExtractionResponse:
    normalized_type = _validate_source(file_bytes, content_type, filename)
    images = _render_pages(file_bytes, normalized_type)
    if not images:
        raise OcrInputError("NO_READABLE_PAGES", "The document does not contain a readable page.")

    output = _run_ocr(images)
    pages = [page.blocks for page in output.pages]
    page_sizes = [(page.width, page.height) for page in output.pages]
    observations = parse_observations(pages, page_sizes, NUMERIC_REVIEW_THRESHOLD)
    candidate_rows = estimate_lab_row_candidates(pages)
    known_label_mentions = estimate_known_lab_label_mentions(pages)
    warnings = list(output.warnings)

    assist_regions = _targeted_assist_regions(images, pages, observations)
    malformed_count = sum(_is_malformed_multi_label(item) for item in observations)
    if malformed_count:
        warnings.append("MALFORMED_MULTI_LABEL_ROW_SUPPRESSED")
    primary_observations = [item for item in observations if not _is_malformed_multi_label(item)]
    reconciliation = ReconciliationStats()

    if medgemma_assist_enabled() and _should_use_medgemma_assist(
        primary_observations, pages, candidate_rows, known_label_mentions, assist_regions
    ):
        assisted: list[Observation] = []
        assist_failed = False
        for region in assist_regions:
            try:
                page = medgemma_extract_page(
                    region.image,
                    region.page_number,
                    region_description="; ".join(region.reasons),
                )
            except MedGemmaAssistTimeout:
                warnings.append("MEDGEMMA_DOCUMENT_ASSIST_TIMEOUT")
                assist_failed = True
                break
            except MedGemmaAssistUnavailable:
                warnings.append("MEDGEMMA_DOCUMENT_ASSIST_UNAVAILABLE")
                assist_failed = True
                break
            except MedGemmaAssistInvalidOutput:
                warnings.append("MEDGEMMA_DOCUMENT_ASSIST_INVALID")
                assist_failed = True
                break
            for row in page.rows:
                observation = observation_from_assisted_row(row, region.page_number)
                if observation is not None:
                    assisted.append(observation)
        if assisted:
            observations, reconciliation = _reconcile_with_stats(primary_observations, assisted)
            observations = _suppress_malformed_multi_label_rows(observations)
            warnings.append("MEDGEMMA_DOCUMENT_ASSIST_USED")
            if reconciliation.disagreements:
                warnings.append("MEDGEMMA_DOCUMENT_ASSIST_DISAGREEMENT")
        elif not assist_failed:
            observations = primary_observations
            warnings.append("MEDGEMMA_DOCUMENT_ASSIST_NO_ROWS")
        else:
            observations = primary_observations
    else:
        observations = primary_observations

    confidences = [block.confidence for page in output.pages for block in page.blocks if block.confidence >= 0]
    raw_text = "\n\n".join(
        "\n".join(block.text for block in page.blocks if block.text.strip()) for page in output.pages
    ).strip()

    if not raw_text:
        warnings.append("NO_TEXT_DETECTED")
    if raw_text and not observations:
        warnings.append("NO_STRUCTURED_LAB_VALUES_DETECTED")
    insufficient = _extraction_quality_insufficient(
        observations, candidate_rows, known_label_mentions, raw_text, output.engine
    ) or _excessive_disagreement(reconciliation)
    if insufficient:
        warnings.append("EXTRACTION_QUALITY_INSUFFICIENT")
    quality_state = (
        "INSUFFICIENT"
        if insufficient
        else "REVIEW_REQUIRED"
        if malformed_count or reconciliation.disagreements or any(item.reviewRequired for item in observations)
        else "HIGH_CONFIDENCE"
    )

    return ExtractionResponse(
        engine=output.engine,
        engineVersion=output.version,
        documentType="LAB_REPORT" if observations else "MEDICAL_REPORT",
        pageCount=len(images),
        overallConfidence=round(mean(confidences), 5) if confidences else None,
        parserVersion=PARSER_VERSION,
        normalizerVersion=NORMALIZER_VERSION,
        qualityState=quality_state,
        observations=observations,
        warnings=list(dict.fromkeys(warnings)),
    )


def _should_use_medgemma_assist(
    observations: list[Observation],
    pages: list[list[TextBlock]],
    candidate_rows: int,
    known_label_mentions: int,
    regions: list[AssistRegion],
) -> bool:
    if not regions:
        return False
    if medgemma_assist_mode() == "always":
        return True
    if any(reason != "evaluation mode" for region in regions for reason in region.reasons):
        return True
    return candidate_rows > len(observations) or known_label_mentions > len(observations)


def _targeted_assist_regions(
    images: list[Image.Image],
    pages: list[list[TextBlock]],
    observations: list[Observation],
) -> list[AssistRegion]:
    """Crop only table areas with deterministic structural uncertainty."""
    regions: list[AssistRegion] = []
    present = {item.normalizedLabel.casefold() for item in observations if not _is_malformed_multi_label(item)}

    for page_index, (image, blocks) in enumerate(zip(images, pages), start=1):
        target_boxes: list[tuple[float, float, float, float]] = []
        reasons: list[str] = []

        for item in observations:
            if item.pageNumber != page_index or item.boundingBox is None:
                continue
            if _is_malformed_multi_label(item):
                target_boxes.append(_absolute_box(item, image.width, image.height))
                reasons.append("malformed multi-label row")
            elif item.confidence is not None and item.confidence < ASSIST_CONFIDENCE_THRESHOLD:
                target_boxes.append(_absolute_box(item, image.width, image.height))
                reasons.append("low-confidence laboratory row")

        for block in blocks:
            labels = recognized_lab_labels(block.text)
            missing = [label for label in labels if label.casefold() not in present]
            if missing:
                target_boxes.append((block.x1, block.y1, block.x2, block.y2))
                reasons.append("recognized analyte text without a parsed row")

        if not target_boxes:
            continue

        min_y = min(box[1] for box in target_boxes)
        max_y = max(box[3] for box in target_boxes)
        typical_height = mean(max(1.0, block.y2 - block.y1) for block in blocks) if blocks else 20.0
        vertical_margin = max(24.0, typical_height * 2.5)
        min_y = max(0.0, min_y - vertical_margin)
        max_y = min(float(image.height), max_y + vertical_margin)

        contextual = [
            block for block in blocks
            if ((block.y1 + block.y2) / 2) >= min_y and ((block.y1 + block.y2) / 2) <= max_y
        ]
        if contextual:
            min_x = max(0.0, min(block.x1 for block in contextual) - 18.0)
            max_x = min(float(image.width), max(block.x2 for block in contextual) + 18.0)
        else:
            min_x, max_x = 0.0, float(image.width)

        crop_box = (
            max(0, int(min_x)),
            max(0, int(min_y)),
            min(image.width, max(1, math.ceil(max_x))),
            min(image.height, max(1, math.ceil(max_y))),
        )
        if crop_box[2] <= crop_box[0] or crop_box[3] <= crop_box[1]:
            continue
        regions.append(AssistRegion(
            page_number=page_index,
            image=image.crop(crop_box),
            reasons=tuple(dict.fromkeys(reasons)),
        ))
    return regions


def _absolute_box(item: Observation, width: int, height: int) -> tuple[float, float, float, float]:
    assert item.boundingBox is not None
    box = item.boundingBox
    return (
        box.x * width,
        box.y * height,
        (box.x + box.width) * width,
        (box.y + box.height) * height,
    )


def _is_malformed_multi_label(item: Observation) -> bool:
    return len(recognized_lab_labels(item.sourceLabel)) > 1


def _suppress_malformed_multi_label_rows(observations: list[Observation]) -> list[Observation]:
    return [item for item in observations if not _is_malformed_multi_label(item)]


def _reconcile_observations(
    primary: list[Observation], assisted: list[Observation],
) -> tuple[list[Observation], bool]:
    """Reconcile two readers without allowing the model to silently overwrite facts."""
    result, stats = _reconcile_with_stats(primary, assisted)
    return result, bool(stats.disagreements)


def _reconcile_with_stats(
    primary: list[Observation], assisted: list[Observation],
) -> tuple[list[Observation], ReconciliationStats]:
    result = list(primary)
    agreements = 0
    disagreements = 0
    assisted_only = 0

    for candidate in assisted:
        matches = [
            (index, existing)
            for index, existing in enumerate(result)
            if existing.normalizedLabel.casefold() == candidate.normalizedLabel.casefold()
        ]
        if not matches:
            if not any(_same_observation(candidate, item) for item in result):
                result.append(candidate.model_copy(update={"reviewRequired": True}))
                assisted_only += 1
            continue

        exact = next(((index, item) for index, item in matches if _same_value(candidate, item)), None)
        if exact is not None:
            index, existing = exact
            # The deterministic reader remains authoritative. If both readers
            # disagree on populated unit/reference metadata, force manual review.
            unit_conflict = bool(existing.unit and candidate.unit and _normal(existing.unit) != _normal(candidate.unit))
            reference_conflict = bool(
                existing.referenceRangeRaw
                and candidate.referenceRangeRaw
                and _normal(existing.referenceRangeRaw) != _normal(candidate.referenceRangeRaw)
            )
            if unit_conflict or reference_conflict:
                result[index] = existing.model_copy(update={"reviewRequired": True})
                disagreements += 1
            else:
                agreements += 1
            continue

        # Same analyte with a different result is never auto-resolved. Keep the
        # primary transcription but force Patient review against the source page.
        for index, existing in matches:
            result[index] = existing.model_copy(update={"reviewRequired": True})
        disagreements += 1

    return result, ReconciliationStats(agreements, disagreements, assisted_only)


def _excessive_disagreement(stats: ReconciliationStats) -> bool:
    compared = stats.agreements + stats.disagreements
    return compared >= 5 and stats.disagreements / compared >= 0.8


def _same_observation(left: Observation, right: Observation) -> bool:
    return left.normalizedLabel.casefold() == right.normalizedLabel.casefold() and _same_value(left, right)


def _same_value(left: Observation, right: Observation) -> bool:
    if left.valueType == "NUMERIC" and right.valueType == "NUMERIC":
        return left.numericValue is not None and right.numericValue is not None and abs(left.numericValue - right.numericValue) < 1e-9
    if left.valueType != "NUMERIC" and right.valueType != "NUMERIC":
        return _normal(left.textValue or "") == _normal(right.textValue or "")
    return False


def _normal(value: str) -> str:
    return " ".join(value.casefold().split())


def _extraction_quality_insufficient(
    observations: list[Observation],
    candidate_rows: int,
    known_label_mentions: int,
    raw_text: str,
    engine: str,
) -> bool:
    if raw_text and not observations:
        return True
    if candidate_rows >= 5:
        required = max(3, math.ceil(candidate_rows * 0.55))
        if len(observations) < required:
            return True
    # Row reconstruction can itself fail even when OCR clearly read many known
    # analyte names. Do not let a full report collapse to one or two plausible
    # rows merely because geometric row estimation was also incomplete.
    if known_label_mentions >= 5:
        required = max(3, math.ceil(known_label_mentions * 0.55))
        if len(observations) < required:
            return True

    # Tesseract is only a fallback for this table-centric pipeline. Word-level
    # grouping can create convincing but wrong rows from identifiers and adjacent
    # columns. Fail closed when most fallback rows are structurally uncertain and
    # do not even map to known laboratory labels; the source document is retained
    # for retry/review rather than sending corrupted facts to clinical reasoning.
    if (engine.startswith("TESSERACT") or engine.endswith("_BASIC")) and len(observations) >= 4:
        uncertain_unknown = sum(
            item.reviewRequired and not is_known_lab_label(item.normalizedLabel)
            for item in observations
        )
        if uncertain_unknown / len(observations) >= 0.5:
            return True
    return False


def ensure_primary_engine_ready() -> str:
    if OCR_ENGINE == "tesseract":
        _ensure_tesseract_ready()
        return "TESSERACT"
    try:
        _paddle_pipeline(structured=TABLE_RECOGNITION_ENABLED or REGION_DETECTION_ENABLED)
        return "PADDLE_PP_STRUCTURE_V3"
    except Exception:
        if TABLE_RECOGNITION_ENABLED or REGION_DETECTION_ENABLED:
            try:
                _paddle_pipeline(structured=False)
                return "PADDLE_PP_STRUCTURE_V3_BASIC"
            except Exception:
                pass
        if OCR_ENGINE == "paddle":
            raise
        _ensure_tesseract_ready()
        return "TESSERACT_FALLBACK"


def _validate_source(file_bytes: bytes, content_type: str | None, filename: str | None) -> str:
    if not file_bytes:
        raise OcrInputError("EMPTY_DOCUMENT", "The uploaded report is empty.")
    if len(file_bytes) > MAX_FILE_BYTES:
        raise OcrInputError("FILE_TOO_LARGE", f"Medical reports must be {MAX_FILE_BYTES // (1024 * 1024)} MB or smaller.")

    normalized = (content_type or "").split(";", 1)[0].strip().lower()
    inferred = _infer_type(file_bytes)
    if normalized and normalized not in _SUPPORTED_CONTENT_TYPES:
        raise OcrInputError("UNSUPPORTED_DOCUMENT", "Use a PDF, JPG, JPEG, or PNG medical report.")
    if inferred is None:
        raise OcrInputError("UNSUPPORTED_DOCUMENT", "The report content is not a supported PDF, JPEG, or PNG file.")
    if normalized and normalized != inferred and not ({normalized, inferred} <= {"image/jpeg"}):
        raise OcrInputError("DOCUMENT_TYPE_MISMATCH", "The report file type does not match its content.")

    lower_name = (filename or "").lower()
    if lower_name and not lower_name.endswith((".pdf", ".jpg", ".jpeg", ".png")):
        raise OcrInputError("UNSUPPORTED_DOCUMENT", "Use a PDF, JPG, JPEG, or PNG medical report.")
    return inferred


def _infer_type(file_bytes: bytes) -> str | None:
    if file_bytes.startswith(b"%PDF-"):
        return "application/pdf"
    if file_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    return None


def _render_pages(file_bytes: bytes, content_type: str) -> list[Image.Image]:
    if content_type == "application/pdf":
        try:
            info = pdfinfo_from_bytes(file_bytes)
            page_count = int(info.get("Pages", 0))
        except Exception as exc:
            raise OcrInputError("CORRUPT_DOCUMENT", "The PDF could not be read.") from exc
        if page_count <= 0:
            raise OcrInputError("CORRUPT_DOCUMENT", "The PDF does not contain a readable page.")
        if page_count > MAX_PAGES:
            raise OcrInputError("PAGE_LIMIT_EXCEEDED", f"Reports can contain up to {MAX_PAGES} pages for analysis.")
        try:
            images = convert_from_bytes(file_bytes, dpi=PDF_DPI, fmt="png", thread_count=1)
        except Exception as exc:
            raise OcrProcessingError("PDF_RENDER_FAILED", "The PDF pages could not be prepared for extraction.") from exc
        return [_prepare_image(image) for image in images]

    try:
        with Image.open(io.BytesIO(file_bytes)) as opened:
            opened.verify()
        with Image.open(io.BytesIO(file_bytes)) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise OcrInputError("CORRUPT_DOCUMENT", "The image could not be read.") from exc
    return [_prepare_image(image)]


def _prepare_image(image: Image.Image) -> Image.Image:
    width, height = image.size
    pixels = width * height
    if pixels > MAX_PAGE_PIXELS:
        scale = (MAX_PAGE_PIXELS / pixels) ** 0.5
        image = image.resize((max(1, int(width * scale)), max(1, int(height * scale))), Image.Resampling.LANCZOS)
    if image.mode != "RGB":
        image = image.convert("RGB")
    return image


def _run_ocr(images: list[Image.Image]) -> EngineOutput:
    if OCR_ENGINE == "tesseract":
        return _run_tesseract(images, fallback=False)
    try:
        return _run_paddle(images, structured=TABLE_RECOGNITION_ENABLED or REGION_DETECTION_ENABLED)
    except Exception as structured_exc:
        if TABLE_RECOGNITION_ENABLED or REGION_DETECTION_ENABLED:
            try:
                basic = _run_paddle(images, structured=False)
                return EngineOutput(
                    engine="PADDLE_PP_STRUCTURE_V3_BASIC",
                    version=basic.version,
                    pages=basic.pages,
                    warnings=["TABLE_RECOGNITION_FALLBACK_USED", *basic.warnings],
                )
            except Exception:
                pass
        if OCR_ENGINE == "paddle":
            raise OcrProcessingError("OCR_ENGINE_UNAVAILABLE", "The configured PaddleOCR engine is unavailable.") from structured_exc
        fallback = _run_tesseract(images, fallback=True)
        return EngineOutput(
            engine=fallback.engine,
            version=fallback.version,
            pages=fallback.pages,
            warnings=["PADDLE_FALLBACK_USED", *fallback.warnings],
        )


def _run_paddle(images: list[Image.Image], structured: bool = True) -> EngineOutput:
    pipeline = _paddle_pipeline(structured=structured)
    pages: list[EnginePage] = []
    warnings: list[str] = []
    table_structure_used = False
    for image in images:
        array = np.asarray(image)
        predictions = pipeline.predict(array)
        result = next(iter(predictions), None)
        if result is None:
            pages.append(EnginePage([], image.width, image.height))
            continue
        data = result.json
        if callable(data):
            data = data()
        if isinstance(data, dict) and "res" in data and isinstance(data["res"], dict):
            data = data["res"]
        if not isinstance(data, dict):
            pages.append(EnginePage([], image.width, image.height))
            continue

        overall_blocks = _blocks_from_ocr(data.get("overall_ocr_res", {}), image.width, image.height)
        table_blocks: list[TextBlock] = []
        if structured and TABLE_RECOGNITION_ENABLED:
            table_results = _as_list(data.get("table_res_list"))
            for table in table_results:
                if not isinstance(table, dict):
                    continue
                table_blocks.extend(_blocks_from_table(table, image.width, image.height))
        if len(table_blocks) >= 2:
            # Keep only explicit Sex/Gender/Age metadata rows from global OCR so
            # report-provided demographic reference ranges can be selected safely
            # without re-introducing duplicate table OCR boxes.
            blocks = [*table_blocks, *_reference_context_blocks(overall_blocks)]
            table_structure_used = True
        else:
            blocks = overall_blocks
        pages.append(EnginePage(blocks, image.width, image.height))

    if table_structure_used:
        warnings.append("TABLE_STRUCTURE_USED")
    return EngineOutput("PADDLE_PP_STRUCTURE_V3", _package_version("paddleocr"), pages, warnings)


def _reference_context_blocks(blocks: list[TextBlock]) -> list[TextBlock]:
    selected: list[TextBlock] = []
    seen: set[tuple[float, float, str]] = set()
    for anchor in blocks:
        if not re.search(r"\b(?:sex|gender|age)\b", anchor.text, re.IGNORECASE):
            continue
        center = (anchor.y1 + anchor.y2) / 2
        anchor_height = max(1.0, anchor.y2 - anchor.y1)
        for candidate in blocks:
            candidate_center = (candidate.y1 + candidate.y2) / 2
            candidate_height = max(1.0, candidate.y2 - candidate.y1)
            if abs(center - candidate_center) <= max(anchor_height, candidate_height) * 0.7:
                key = (candidate.x1, candidate.y1, candidate.text)
                if key not in seen:
                    seen.add(key)
                    selected.append(candidate)
    return selected


class _TableHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() == "tr":
            self._row = []
        elif tag.lower() in {"td", "th"} and self._row is not None:
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        if lowered in {"td", "th"} and self._cell is not None and self._row is not None:
            text = " ".join(" ".join(self._cell).split())
            self._row.append(text)
            self._cell = None
        elif lowered == "tr" and self._row is not None:
            if any(cell for cell in self._row):
                self.rows.append(self._row)
            self._row = None
            self._cell = None


def _blocks_from_table(table: dict[str, object], width: int, height: int) -> list[TextBlock]:
    table_ocr = table.get("table_ocr_pred", {})
    if isinstance(table_ocr, dict) and "res" in table_ocr and isinstance(table_ocr["res"], dict):
        table_ocr = table_ocr["res"]
    fallback = _blocks_from_ocr(table_ocr, width, height)

    html = table.get("pred_html")
    if not isinstance(html, str) or "<tr" not in html.lower():
        return fallback
    parser = _TableHTMLParser()
    try:
        parser.feed(html)
    except Exception:
        return fallback
    cells = [(row_index, column_index, text)
             for row_index, row in enumerate(parser.rows)
             for column_index, text in enumerate(row) if text]
    boxes = _as_list(table.get("cell_box_list"))
    if not cells or len(boxes) != len(cells):
        # Do not fabricate page coordinates when Paddle cannot map HTML cells to
        # source cells. The table-specific OCR still has real source boxes.
        return fallback

    rec_scores = _as_list(table_ocr.get("rec_scores")) if isinstance(table_ocr, dict) else []
    default_score = mean([_score(value) for value in rec_scores]) if rec_scores else 0.9
    blocks: list[TextBlock] = []
    for index, (_, _, text) in enumerate(cells):
        x1, y1, x2, y2 = _coerce_box(boxes[index], width, height)
        blocks.append(TextBlock(text=text, confidence=default_score, x1=x1, y1=y1, x2=x2, y2=y2))
    return blocks or fallback


def _blocks_from_ocr(raw: object, width: int, height: int) -> list[TextBlock]:
    if not isinstance(raw, dict):
        return []
    texts = _as_list(raw.get("rec_texts"))
    scores = _as_list(raw.get("rec_scores"))
    boxes = _as_list(raw.get("rec_boxes"))
    polygons = _as_list(raw.get("rec_polys"))
    blocks: list[TextBlock] = []
    for index, raw_text in enumerate(texts):
        text = str(raw_text).strip()
        if not text:
            continue
        score = _score(scores[index] if index < len(scores) else 0.0)
        raw_box = boxes[index] if index < len(boxes) else (polygons[index] if index < len(polygons) else None)
        x1, y1, x2, y2 = _coerce_box(raw_box, width, height)
        blocks.append(TextBlock(text=text, confidence=score, x1=x1, y1=y1, x2=x2, y2=y2))
    return blocks


def _paddle_pipeline(structured: bool = True):
    global _PADDLE_PIPELINE, _PADDLE_BASIC_PIPELINE
    existing = _PADDLE_PIPELINE if structured else _PADDLE_BASIC_PIPELINE
    if existing is not None:
        return existing
    with _PADDLE_LOCK:
        existing = _PADDLE_PIPELINE if structured else _PADDLE_BASIC_PIPELINE
        if existing is not None:
            return existing
        from paddleocr import PPStructureV3

        created = PPStructureV3(
            lang=OCR_LANGUAGE,
            device="cpu",
            enable_mkldnn=False,
            layout_detection_model_name="PP-DocLayout-S",
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="PP-OCRv5_mobile_rec",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            use_seal_recognition=False,
            use_table_recognition=structured and TABLE_RECOGNITION_ENABLED,
            use_formula_recognition=False,
            use_chart_recognition=False,
            use_region_detection=structured and REGION_DETECTION_ENABLED,
        )
        if structured:
            _PADDLE_PIPELINE = created
        else:
            _PADDLE_BASIC_PIPELINE = created
        return created


def _run_tesseract(images: list[Image.Image], fallback: bool) -> EngineOutput:
    _ensure_tesseract_ready()
    pages: list[EnginePage] = []
    for image in images:
        data = pytesseract.image_to_data(image, output_type=Output.DICT, config="--psm 6")
        blocks: list[TextBlock] = []
        count = len(data.get("text", []))
        for index in range(count):
            text = str(data["text"][index]).strip()
            if not text:
                continue
            try:
                confidence = max(0.0, min(1.0, float(data["conf"][index]) / 100.0))
            except (ValueError, TypeError):
                confidence = 0.0
            left = float(data["left"][index])
            top = float(data["top"][index])
            width = float(data["width"][index])
            height = float(data["height"][index])
            blocks.append(TextBlock(text, confidence, left, top, left + width, top + height))
        pages.append(EnginePage(blocks, image.width, image.height))
    name = "TESSERACT_FALLBACK" if fallback else "TESSERACT"
    return EngineOutput(name, _tesseract_version(), pages, [])


def _ensure_tesseract_ready() -> None:
    try:
        pytesseract.get_tesseract_version()
    except Exception as exc:
        raise OcrProcessingError("OCR_ENGINE_UNAVAILABLE", "No OCR engine is currently available.") from exc


def _tesseract_version() -> str:
    try:
        return str(pytesseract.get_tesseract_version()).splitlines()[0]
    except Exception:
        return "unknown"


def _package_version(package: str) -> str:
    try:
        return importlib.metadata.version(package)
    except importlib.metadata.PackageNotFoundError:
        return "unknown"


def _as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return []


def _score(value) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def _coerce_box(raw_box, width: int, height: int) -> tuple[float, float, float, float]:
    if raw_box is None:
        return 0.0, 0.0, float(width), float(height)
    values = np.asarray(raw_box, dtype=float)
    if values.ndim == 1 and values.size >= 4:
        return float(values[0]), float(values[1]), float(values[2]), float(values[3])
    if values.ndim >= 2 and values.shape[-1] >= 2:
        xs = values[..., 0].reshape(-1)
        ys = values[..., 1].reshape(-1)
        return float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())
    return 0.0, 0.0, float(width), float(height)
