import json

import httpx
from PIL import Image

from app import medgemma_document_assist as assist


class FakeResponse:
    def __init__(self, payload, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("request failed")

    def json(self):
        return self._payload


class FakeClient:
    last_payload = None

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def get(self, path):
        assert path == "/props"
        return FakeResponse({"modalities": ["text", "vision"]})

    def post(self, path, json=None):
        assert path == "/v1/chat/completions"
        FakeClient.last_payload = json
        content = json_module.dumps({
            "rows": [{
                "label": "Basophils",
                "value": "0 %",
                "unit": "%",
                "referenceRange": "<1.0 %",
                "section": "Differential Count",
            }]
        })
        return FakeResponse({"choices": [{"message": {"content": content}}]})


json_module = json


def test_multimodal_assist_uses_image_message_and_transcription_contract(monkeypatch):
    monkeypatch.setenv("OCR_MEDGEMMA_URL", "http://127.0.0.1:8002")
    monkeypatch.setattr(assist.httpx, "Client", FakeClient)
    page = assist.extract_page(Image.new("RGB", (320, 480), "white"), 1)

    assert page.rows[0]["label"] == "Basophils"
    payload = FakeClient.last_payload
    assert payload["temperature"] == 0
    content = payload["messages"][0]["content"]
    assert content[0]["type"] == "image_url"
    assert content[0]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert "not medical interpretation" in content[1]["text"].lower()


def test_external_medgemma_endpoint_is_rejected(monkeypatch):
    monkeypatch.setenv("OCR_MEDGEMMA_URL", "https://example.com")
    try:
        assist.extract_page(Image.new("RGB", (50, 50), "white"), 1)
    except assist.MedGemmaAssistUnavailable:
        pass
    else:
        raise AssertionError("external endpoint must not be accepted")


def test_text_only_server_is_rejected_before_document_transcription(monkeypatch):
    class TextOnlyClient(FakeClient):
        def get(self, path):
            assert path == "/props"
            return FakeResponse({"modalities": ["text"]})

        def post(self, path, json=None):
            raise AssertionError("text-only server must never receive the report image")

    monkeypatch.setenv("OCR_MEDGEMMA_URL", "http://127.0.0.1:8002")
    monkeypatch.setattr(assist.httpx, "Client", TextOnlyClient)
    try:
        assist.extract_page(Image.new("RGB", (50, 50), "white"), 1)
    except assist.MedGemmaAssistUnavailable:
        pass
    else:
        raise AssertionError("a text-only runtime must not be used for document extraction")


def test_timeout_has_a_distinct_optional_assist_failure(monkeypatch):
    class TimeoutClient(FakeClient):
        def post(self, path, json=None):
            request = httpx.Request("POST", "http://127.0.0.1:8002" + path)
            raise httpx.ReadTimeout("bounded assist timeout", request=request)

    monkeypatch.setenv("OCR_MEDGEMMA_URL", "http://127.0.0.1:8002")
    monkeypatch.setattr(assist.httpx, "Client", TimeoutClient)

    try:
        assist.extract_page(Image.new("RGB", (50, 50), "white"), 1)
    except assist.MedGemmaAssistTimeout:
        pass
    else:
        raise AssertionError("assist timeout must have a distinct failure type")


def test_targeted_region_prompt_stays_transcription_only(monkeypatch):
    monkeypatch.setenv("OCR_MEDGEMMA_URL", "http://127.0.0.1:8002")
    monkeypatch.setattr(assist.httpx, "Client", FakeClient)

    assist.extract_page(
        Image.new("RGB", (220, 100), "white"),
        1,
        region_description="low-confidence laboratory row",
    )

    prompt = FakeClient.last_payload["messages"][0]["content"][1]["text"].lower()
    assert "cropped laboratory-table region" in prompt
    assert "copy exactly" in prompt
    assert "do not diagnose" in prompt
    assert "low-confidence laboratory row" in prompt
