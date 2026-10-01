import json
import logging
import sys
import threading
from uuid import uuid4
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import engine_v3, main
from app.performance import OcrTimings, current, stage
from app.schemas import ExtractionResponse


def test_lifespan_initializes_once_readiness_does_not_load_models(monkeypatch):
    warm = Mock(return_value="PADDLE_PP_STRUCTURE_V3")
    monkeypatch.setattr(main, "warm_primary_engine", warm)
    with TestClient(main.app) as client:
        assert client.get("/health").json()["status"] == "UP"
        for _ in range(3):
            assert client.get("/ready").json()["engine"] == "PADDLE_PP_STRUCTURE_V3"
        assert warm.call_count == 1
    assert TestClient(main.app).get("/ready").status_code == 503


def test_primary_startup_failure_is_not_hidden_by_fallback(monkeypatch):
    monkeypatch.setattr(engine_v3, "OCR_ENGINE", "auto")
    monkeypatch.setattr(engine_v3, "_paddle_pipeline", Mock(side_effect=RuntimeError("unavailable")))
    fallback = Mock()
    monkeypatch.setattr(engine_v3, "_ensure_tesseract_ready", fallback)
    with pytest.raises(RuntimeError):
        with TestClient(main.app):
            pass
    fallback.assert_not_called()
    client = TestClient(main.app)
    assert client.get("/ready").status_code == 503
    assert client.get("/health").status_code == 200


def test_startup_and_requests_share_one_native_thread_and_metrics_context(monkeypatch):
    threads = []
    contexts = []
    def warm():
        threads.append(threading.get_ident())
        return "PADDLE_PP_STRUCTURE_V3"
    def extract(*args):
        threads.append(threading.get_ident())
        contexts.append(current().request_id)
        return ExtractionResponse(engine="PADDLE_PP_STRUCTURE_V3", engineVersion="test",
                                  documentType="LAB_REPORT", pageCount=1, observations=[])
    monkeypatch.setattr(main, "warm_primary_engine", warm)
    monkeypatch.setattr(main, "extract_document", extract)
    ids = [str(uuid4()), str(uuid4())]
    with TestClient(main.app) as client:
        for request_id in ids:
            response = client.post("/internal/v1/extract",
                headers={"X-Clinora-Internal-Token": main._INTERNAL_TOKEN},
                data={"requestId": request_id}, files={"file": ("synthetic.png", b"synthetic", "image/png")})
            assert response.status_code == 200
    assert len(threads) == 3 and len(set(threads)) == 1
    assert threads[0] != threading.get_ident()
    assert contexts == ids


def test_warmup_reuses_one_pipeline_and_consumes_lazy_prediction(monkeypatch):
    calls = []
    def predict(image):
        calls.append(image.shape)
        yield SimpleNamespace(json={"overall_ocr_res": {}})
    constructor = Mock(return_value=SimpleNamespace(predict=predict))
    monkeypatch.setitem(sys.modules, "paddleocr", SimpleNamespace(PPStructureV3=constructor))
    monkeypatch.setattr(engine_v3, "_PADDLE_PIPELINE", None)
    monkeypatch.setattr(engine_v3, "_PADDLE_BASIC_PIPELINE", None)
    monkeypatch.setattr(engine_v3, "_PADDLE_BASIC_INITIALIZATION_FAILED", False)
    monkeypatch.setattr(engine_v3, "OCR_ENGINE", "paddle")
    monkeypatch.setattr(engine_v3, "TABLE_RECOGNITION_ENABLED", True)
    monkeypatch.setattr(engine_v3, "REGION_DETECTION_ENABLED", True)
    engine_v3.warm_primary_engine()
    engine_v3._run_paddle([Image.new("RGB", (40, 40))])
    # Primary and fallback are each constructed once during startup.
    assert constructor.call_count == 2
    assert calls == [(800, 1000, 3), (40, 40, 3)]
    assert constructor.call_args_list[0].kwargs["use_table_recognition"] is True
    assert constructor.call_args_list[1].kwargs["use_table_recognition"] is False
    assert constructor.call_args.kwargs["device"] == "cpu"


def test_metrics_are_request_local_and_never_log_input(caplog, monkeypatch):
    monkeypatch.setattr(engine_v3, "_render_pages", Mock(side_effect=RuntimeError("private report text 123")))
    with caplog.at_level(logging.INFO):
        with pytest.raises(RuntimeError):
            engine_v3.extract_document(b"\x89PNG\r\n\x1a\n", "image/png", "private patient.png")
    record = json.loads(next(item.message for item in caplog.records if 'ocr_performance' in item.message))
    assert record["outcome"] == "failed"
    assert record["document_render_ms"] >= 0
    assert "private" not in caplog.text
    assert "123" not in record.values()
    assert current() is None
    second = OcrTimings()
    assert all(value == 0 for value in second.stages.values())
    with pytest.raises(ValueError):
        with stage("patient_name"):
            pass


def test_metrics_survive_paddle_raising_the_root_log_level(caplog):
    root = logging.getLogger()
    previous = root.level
    try:
        root.setLevel(logging.WARNING)
        OcrTimings().emit("startup_ready")
        assert any('"outcome":"startup_ready"' in record.message for record in caplog.records)
    finally:
        root.setLevel(previous)


def test_failed_optional_fallback_is_not_reconstructed_by_patient_request(monkeypatch):
    primary = SimpleNamespace(predict=lambda _: iter([SimpleNamespace(json={})]))
    constructor = Mock(side_effect=RuntimeError("unavailable"))
    monkeypatch.setitem(sys.modules, "paddleocr", SimpleNamespace(PPStructureV3=constructor))
    monkeypatch.setattr(engine_v3, "_PADDLE_PIPELINE", primary)
    monkeypatch.setattr(engine_v3, "_PADDLE_BASIC_PIPELINE", None)
    monkeypatch.setattr(engine_v3, "_PADDLE_BASIC_INITIALIZATION_FAILED", False)
    monkeypatch.setattr(engine_v3, "OCR_ENGINE", "auto")
    monkeypatch.setattr(engine_v3, "TABLE_RECOGNITION_ENABLED", True)
    assert engine_v3.warm_primary_engine() == "PADDLE_PP_STRUCTURE_V3"
    for _ in range(2):
        with pytest.raises(engine_v3.OcrProcessingError):
            engine_v3._paddle_pipeline(structured=False)
    assert constructor.call_count == 1
