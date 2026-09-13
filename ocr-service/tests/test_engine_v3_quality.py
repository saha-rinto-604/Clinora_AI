from PIL import Image

from app import engine_v3
from app.engine_v3 import (
    EngineOutput,
    EnginePage,
    _extraction_quality_insufficient,
    _reconcile_observations,
    _suppress_malformed_multi_label_rows,
    _targeted_assist_regions,
)
from app.medgemma_document_assist import AssistedPage, MedGemmaAssistTimeout, MedGemmaAssistUnavailable
from app.parser_v3 import TextBlock
from app.schemas import BoundingBox, Observation


def observation(
    label: str,
    value: float,
    *,
    source_label: str | None = None,
    confidence: float | None = None,
    review_required: bool = False,
) -> Observation:
    return Observation(
        sourceLabel=source_label or label,
        normalizedLabel=label,
        valueType="NUMERIC",
        rawValue=str(value),
        numericValue=value,
        pageNumber=1,
        boundingBox=BoundingBox(x=0.1, y=0.4, width=0.8, height=0.05) if confidence is not None else None,
        confidence=confidence,
        reviewRequired=review_required,
    )


def test_incomplete_structured_extraction_is_blocked() -> None:
    extracted = [observation("Hemoglobin", 10.4), observation("Platelets", 160000)]

    assert _extraction_quality_insufficient(
        extracted,
        candidate_rows=6,
        known_label_mentions=6,
        raw_text="Hemoglobin Platelets WBC RBC MCV MCH",
        engine="PADDLE_PP_STRUCTURE_V3",
    )


def test_clean_complete_extraction_passes_quality_gate() -> None:
    extracted = [
        observation("Hemoglobin", 10.4),
        observation("Platelets", 160000),
        observation("White blood cell count", 8200),
        observation("Red blood cell count", 4.6),
    ]

    assert not _extraction_quality_insufficient(
        extracted,
        candidate_rows=5,
        known_label_mentions=5,
        raw_text="Hemoglobin Platelets WBC RBC MCV",
        engine="PADDLE_PP_STRUCTURE_V3",
    )


def test_secondary_reader_disagreement_keeps_primary_value_and_requires_review() -> None:
    primary = [observation("Hemoglobin", 10.4)]
    assisted = [observation("Hemoglobin", 14.0, review_required=True)]

    reconciled, disagreed = _reconcile_observations(primary, assisted)

    assert disagreed is True
    assert len(reconciled) == 1
    assert reconciled[0].numericValue == 10.4
    assert reconciled[0].reviewRequired is True


def test_secondary_reader_only_row_is_retained_as_review_required() -> None:
    assisted = [observation("Platelets", 160000, review_required=True)]

    reconciled, disagreed = _reconcile_observations([], assisted)

    assert disagreed is False
    assert reconciled == assisted
    assert reconciled[0].reviewRequired is True


def _stub_document(monkeypatch, primary: list[Observation]) -> None:
    image = Image.new("RGB", (1000, 1000), "white")
    blocks = [TextBlock("Hemoglobin", 0.99, 100, 400, 300, 430)]
    monkeypatch.setattr(engine_v3, "_validate_source", lambda *_: "image/jpeg")
    monkeypatch.setattr(engine_v3, "_render_pages", lambda *_: [image])
    monkeypatch.setattr(
        engine_v3,
        "_run_ocr",
        lambda *_: EngineOutput("PADDLE_PP_STRUCTURE_V3", "3.5.0", [EnginePage(blocks, 1000, 1000)], []),
    )
    monkeypatch.setattr(engine_v3, "parse_observations", lambda *_: primary)
    monkeypatch.setattr(engine_v3, "estimate_lab_row_candidates", lambda *_: len(primary))
    monkeypatch.setattr(engine_v3, "estimate_known_lab_label_mentions", lambda *_: len(primary))
    monkeypatch.setattr(engine_v3, "medgemma_assist_enabled", lambda: True)


def test_medgemma_timeout_returns_primary_ocr_result(monkeypatch) -> None:
    primary = [observation("Hemoglobin", 10.4, confidence=0.80, review_required=True)]
    _stub_document(monkeypatch, primary)
    monkeypatch.setattr(engine_v3, "medgemma_extract_page", lambda *_args, **_kwargs: (_ for _ in ()).throw(MedGemmaAssistTimeout()))

    result = engine_v3.extract_document(b"jpeg", "image/jpeg", "report.jpeg")

    assert result.observations == primary
    assert "MEDGEMMA_DOCUMENT_ASSIST_TIMEOUT" in result.warnings
    assert result.qualityState == "REVIEW_REQUIRED"


def test_medgemma_unavailable_returns_primary_ocr_result(monkeypatch) -> None:
    primary = [observation("Hemoglobin", 10.4, confidence=0.80, review_required=True)]
    _stub_document(monkeypatch, primary)
    monkeypatch.setattr(engine_v3, "medgemma_extract_page", lambda *_args, **_kwargs: (_ for _ in ()).throw(MedGemmaAssistUnavailable()))

    result = engine_v3.extract_document(b"jpeg", "image/jpeg", "report.jpeg")

    assert result.observations == primary
    assert "MEDGEMMA_DOCUMENT_ASSIST_UNAVAILABLE" in result.warnings


def test_clean_ocr_does_not_invoke_vision_assist(monkeypatch) -> None:
    primary = [observation("Hemoglobin", 10.4, confidence=0.99)]
    _stub_document(monkeypatch, primary)
    monkeypatch.setattr(
        engine_v3,
        "medgemma_extract_page",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("clean OCR invoked vision")),
    )

    result = engine_v3.extract_document(b"jpeg", "image/jpeg", "report.jpeg")

    assert result.observations == primary
    assert result.warnings == []
    assert result.qualityState == "HIGH_CONFIDENCE"


def test_suspicious_row_creates_a_targeted_crop() -> None:
    image = Image.new("RGB", (1000, 1000), "white")
    primary = [observation("MCHC", 36.5, confidence=0.80, review_required=True)]
    blocks = [TextBlock("MCHC", 0.80, 100, 400, 250, 430)]

    regions = _targeted_assist_regions([image], [blocks], primary)

    assert len(regions) == 1
    assert regions[0].image.width < image.width
    assert regions[0].image.height < image.height
    assert "low-confidence laboratory row" in regions[0].reasons


def test_recovered_rows_suppress_malformed_multi_label_primary() -> None:
    primary = [observation("PCT MPV", 9.3, source_label="PCT MPV", review_required=True)]
    assisted = [
        observation("MPV", 9.3, review_required=True),
        observation("Plateletcrit", 0.14, source_label="PCT", review_required=True),
    ]

    reconciled, _ = _reconcile_observations(primary, assisted)
    reconciled = _suppress_malformed_multi_label_rows(reconciled)

    assert [item.normalizedLabel for item in reconciled] == ["MPV", "Plateletcrit"]
    assert all(item.reviewRequired for item in reconciled)
