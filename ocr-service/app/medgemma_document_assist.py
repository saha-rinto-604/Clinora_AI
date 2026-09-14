from __future__ import annotations

import base64
import io
import json
import os
import re
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
from PIL import Image


class MedGemmaAssistUnavailable(RuntimeError):
    """Raised when the optional local multimodal MedGemma reader is unavailable."""


class MedGemmaAssistInvalidOutput(RuntimeError):
    """Raised when the optional reader returns data outside the transcription contract."""


class MedGemmaAssistTimeout(RuntimeError):
    """Raised when optional vision assistance exceeds its bounded deadline."""


@dataclass(frozen=True)
class AssistedPage:
    page_number: int
    rows: list[dict[str, str]]


def enabled() -> bool:
    return _bool_env("OCR_MEDGEMMA_ASSIST_ENABLED", False)


def mode() -> str:
    value = os.getenv("OCR_MEDGEMMA_ASSIST_MODE", "suspect").strip().lower()
    return value if value in {"suspect", "always"} else "suspect"


def extract_page(
    image: Image.Image,
    page_number: int,
    *,
    region_description: str | None = None,
) -> AssistedPage:
    """Transcribe visible lab rows with a local multimodal MedGemma runtime.

    This is deliberately a second reader, not a source of medical interpretation.
    Returned rows are review-only and must be reconciled with deterministic OCR.
    """
    try:
        server_url = _validated_server_url()
    except ValueError as exc:
        raise MedGemmaAssistUnavailable("The local MedGemma document reader is misconfigured.") from exc
    timeout = httpx.Timeout(
        max(5.0, min(float(os.getenv("OCR_MEDGEMMA_READ_TIMEOUT_SECONDS", "25")), 45.0)),
        connect=max(1.0, float(os.getenv("OCR_MEDGEMMA_CONNECT_TIMEOUT_SECONDS", "4"))),
    )
    try:
        with httpx.Client(base_url=server_url, timeout=timeout) as client:
            _ensure_vision_capability(client)
            response = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {"url": _image_data_uri(image)},
                                },
                                {
                                    "type": "text",
                                    "text": _prompt(region_description),
                                },
                            ],
                        }
                    ],
                    "temperature": 0,
                    "top_p": 1,
                    "seed": int(os.getenv("OCR_MEDGEMMA_SEED", "0")),
                    "max_tokens": max(512, min(int(os.getenv("OCR_MEDGEMMA_MAX_TOKENS", "1600")), 2400)),
                    "stream": False,
                    "response_format": {
                        "type": "json_object",
                        "schema": _response_schema(),
                    },
                },
            )
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise MedGemmaAssistTimeout("Local multimodal MedGemma document reading timed out.") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise MedGemmaAssistUnavailable("Local multimodal MedGemma document reading is unavailable.") from exc

    try:
        payload = response.json()
        content = payload["choices"][0]["message"]["content"]
        parsed = _parse_json_object(content)
        raw_rows = parsed.get("rows", [])
        if not isinstance(raw_rows, list):
            raise TypeError("rows is not a list")
        rows: list[dict[str, str]] = []
        for raw in raw_rows[:80]:
            if not isinstance(raw, dict):
                continue
            label = _string(raw.get("label"), 160)
            value = _string(raw.get("value"), 80)
            if not label or not value:
                continue
            rows.append(
                {
                    "label": label,
                    "value": value,
                    "unit": _string(raw.get("unit"), 80),
                    "referenceRange": _string(raw.get("referenceRange"), 160),
                    "section": _string(raw.get("section"), 120),
                }
            )
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise MedGemmaAssistInvalidOutput("MedGemma document transcription did not match the expected JSON contract.") from exc
    return AssistedPage(page_number=max(1, page_number), rows=rows)


def _validated_server_url() -> str:
    value = os.getenv("OCR_MEDGEMMA_URL", "http://host.docker.internal:8002").strip().rstrip("/")
    parsed = urlparse(value)
    allowed_hosts = {"127.0.0.1", "localhost", "::1", "host.docker.internal"}
    if parsed.scheme != "http" or parsed.hostname not in allowed_hosts or parsed.username or parsed.password:
        raise ValueError("OCR_MEDGEMMA_URL must target an unauthenticated local/host-only HTTP endpoint.")
    return value


def _ensure_vision_capability(client: httpx.Client) -> None:
    """Reject an explicitly text-only llama.cpp server; tolerate older /props shapes."""
    try:
        response = client.get("/props")
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        # Clinora must positively verify vision support before sending a medical
        # document to a local model. A text-only server can otherwise ignore the
        # image and fabricate a plausible transcription.
        raise MedGemmaAssistUnavailable(
            "The local model server did not expose verifiable vision capabilities."
        ) from exc
    if not isinstance(payload, dict):
        raise MedGemmaAssistUnavailable("The local model server did not expose multimodal capabilities.")
    modalities = payload.get("modalities")
    if isinstance(modalities, list):
        supported = {str(item).strip().lower() for item in modalities}
        if "vision" not in supported:
            raise MedGemmaAssistUnavailable("The configured local model server is text-only.")
        return
    if isinstance(modalities, dict):
        if modalities.get("vision") is not True:
            raise MedGemmaAssistUnavailable("The configured local model server is text-only.")
        return
    # Never ask a server to interpret a report image unless vision capability is
    # positively advertised. This prevents a text-only runtime from hallucinating
    # a transcription when it silently ignores image content.
    raise MedGemmaAssistUnavailable("The local model server does not advertise vision support.")


def _image_data_uri(image: Image.Image) -> str:
    prepared = image.convert("RGB")
    max_side = max(1024, min(int(os.getenv("OCR_MEDGEMMA_IMAGE_MAX_SIDE", "1800")), 2400))
    if max(prepared.size) > max_side:
        ratio = max_side / max(prepared.size)
        prepared = prepared.resize(
            (max(1, round(prepared.width * ratio)), max(1, round(prepared.height * ratio))),
            Image.Resampling.LANCZOS,
        )
    buffer = io.BytesIO()
    prepared.save(buffer, format="JPEG", quality=92, optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return "data:image/jpeg;base64," + encoded


def _parse_json_object(content: object) -> dict[str, object]:
    if not isinstance(content, str) or not content.strip():
        raise ValueError("empty completion")
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("missing JSON object")
    value = json.loads(text[start : end + 1])
    if not isinstance(value, dict):
        raise ValueError("root is not an object")
    return value


def _response_schema() -> dict[str, object]:
    optional_string = {"type": ["string", "null"], "maxLength": 160}
    row = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "label": {"type": "string", "minLength": 1, "maxLength": 160},
            "value": {"type": ["string", "null"], "maxLength": 80},
            "unit": {"type": ["string", "null"], "maxLength": 80},
            "referenceRange": optional_string,
            "section": {"type": ["string", "null"], "maxLength": 120},
        },
        "required": ["label", "value", "unit", "referenceRange", "section"],
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {"rows": {"type": "array", "maxItems": 80, "items": row}},
        "required": ["rows"],
    }


def _string(value: object, limit: int) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()[:limit]


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _prompt(region_description: str | None) -> str:
    if not region_description:
        return _TRANSCRIPTION_PROMPT
    return f"{_TRANSCRIPTION_PROMPT}\n\nRegion context: {region_description}"


_TRANSCRIPTION_PROMPT = """
You are the document-reading stage of Clinora AI. Read ONLY the supplied cropped laboratory-table region.
Transcribe laboratory-result rows into JSON. This task is transcription, not medical interpretation.

For every clearly visible laboratory result row return:
- label: test/analyte name exactly enough to identify the row
- value: the reported result, including a comparator only when visibly printed
- unit: the visibly printed result unit, or an empty string
- referenceRange: the complete visibly printed reference/cutoff text for that row, or an empty string
- section: the visible panel/section heading when available, or an empty string

Rules:
1. Copy exactly what is visibly printed. Do not diagnose, explain, normalize, calculate, infer, or repair a missing value.
2. Do not turn patient identifiers, Lab ID, Medical ID, names, dates, doctors, addresses, barcodes, comments, or interpretation paragraphs into result rows.
3. Keep result and reference columns separate. A reference limit such as <1.0 is not the patient's result.
4. Preserve sex/age-specific reference text rather than selecting a subgroup yourself.
5. Return null fields or omit an illegible or uncertain row instead of guessing.
6. Return only {"rows":[...]} matching the supplied JSON schema.
""".strip()
