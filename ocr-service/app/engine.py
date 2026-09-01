from __future__ import annotations

import importlib.metadata
import io
import os
import threading
from dataclasses import dataclass
from statistics import mean

import numpy as np
import pytesseract
from pdf2image import convert_from_bytes, pdfinfo_from_bytes
from PIL import Image, ImageOps, UnidentifiedImageError
from pytesseract import Output

from .parser import NORMALIZER_VERSION, PARSER_VERSION, TextBlock, parse_observations
from .schemas import ExtractionResponse

MAX_FILE_BYTES = int(os.getenv("OCR_MAX_FILE_SIZE_MB", "20")) * 1024 * 1024
MAX_PAGES = max(1, int(os.getenv("OCR_MAX_PAGES", "10")))
MAX_PAGE_PIXELS = max(1_000_000, int(os.getenv("OCR_MAX_PAGE_PIXELS", "30000000")))
NUMERIC_REVIEW_THRESHOLD = min(1.0, max(0.0, float(os.getenv("OCR_NUMERIC_REVIEW_THRESHOLD", "0.95"))))
OCR_ENGINE = os.getenv("OCR_ENGINE", "auto").strip().lower()
OCR_LANGUAGE = os.getenv("OCR_LANG", "en").strip() or "en"
PDF_DPI = min(300, max(150, int(os.getenv("OCR_PDF_DPI", "200"))))

_SUPPORTED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}
_PADDLE_LOCK = threading.Lock()
_PADDLE_PIPELINE = None


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


def extract_document(file_bytes: bytes, content_type: str | None, filename: str | None) -> ExtractionResponse:
    normalized_type = _validate_source(file_bytes, content_type, filename)
    images = _render_pages(file_bytes, normalized_type)
    if not images:
        raise OcrInputError("NO_READABLE_PAGES", "The document does not contain a readable page.")

    output = _run_ocr(images)
    pages = [page.blocks for page in output.pages]
    page_sizes = [(page.width, page.height) for page in output.pages]
    observations = parse_observations(pages, page_sizes, NUMERIC_REVIEW_THRESHOLD)
    confidences = [block.confidence for page in output.pages for block in page.blocks if block.confidence >= 0]
    raw_text = "\n\n".join(
        "\n".join(block.text for block in page.blocks if block.text.strip()) for page in output.pages
    ).strip()

    warnings = list(output.warnings)
    if not raw_text:
        warnings.append("NO_TEXT_DETECTED")
    if raw_text and not observations:
        warnings.append("NO_STRUCTURED_LAB_VALUES_DETECTED")

    return ExtractionResponse(
        engine=output.engine,
        engineVersion=output.version,
        documentType="LAB_REPORT" if observations else "MEDICAL_REPORT",
        pageCount=len(images),
        overallConfidence=round(mean(confidences), 5) if confidences else None,
        parserVersion=PARSER_VERSION,
        normalizerVersion=NORMALIZER_VERSION,
        observations=observations,
        warnings=warnings,
    )


def ensure_primary_engine_ready() -> str:
    if OCR_ENGINE == "tesseract":
        _ensure_tesseract_ready()
        return "TESSERACT"
    try:
        _paddle_pipeline()
        return "PADDLE_PP_STRUCTURE_V3"
    except Exception:
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
        return _run_paddle(images)
    except Exception as exc:
        if OCR_ENGINE == "paddle":
            raise OcrProcessingError("OCR_ENGINE_UNAVAILABLE", "The configured PaddleOCR engine is unavailable.") from exc
        fallback = _run_tesseract(images, fallback=True)
        return EngineOutput(
            engine=fallback.engine,
            version=fallback.version,
            pages=fallback.pages,
            warnings=["PADDLE_FALLBACK_USED", *fallback.warnings],
        )


def _run_paddle(images: list[Image.Image]) -> EngineOutput:
    pipeline = _paddle_pipeline()
    pages: list[EnginePage] = []
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
        ocr = data.get("overall_ocr_res", {}) if isinstance(data, dict) else {}
        texts = _as_list(ocr.get("rec_texts"))
        scores = _as_list(ocr.get("rec_scores"))
        boxes = _as_list(ocr.get("rec_boxes"))
        polygons = _as_list(ocr.get("rec_polys"))
        blocks: list[TextBlock] = []
        for index, raw_text in enumerate(texts):
            text = str(raw_text).strip()
            if not text:
                continue
            score = _score(scores[index] if index < len(scores) else 0.0)
            raw_box = boxes[index] if index < len(boxes) else (polygons[index] if index < len(polygons) else None)
            x1, y1, x2, y2 = _coerce_box(raw_box, image.width, image.height)
            blocks.append(TextBlock(text=text, confidence=score, x1=x1, y1=y1, x2=x2, y2=y2))
        pages.append(EnginePage(blocks, image.width, image.height))
    return EngineOutput("PADDLE_PP_STRUCTURE_V3", _package_version("paddleocr"), pages, [])


def _paddle_pipeline():
    global _PADDLE_PIPELINE
    if _PADDLE_PIPELINE is not None:
        return _PADDLE_PIPELINE
    with _PADDLE_LOCK:
        if _PADDLE_PIPELINE is not None:
            return _PADDLE_PIPELINE
        from paddleocr import PPStructureV3

        _PADDLE_PIPELINE = PPStructureV3(
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
            use_table_recognition=False,
            use_formula_recognition=False,
            use_chart_recognition=False,
            use_region_detection=False,
        )
        return _PADDLE_PIPELINE


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
