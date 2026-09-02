import uuid
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import ExtractionResponse


class OcrApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_internal_extract_requires_service_token(self):
        response = self.client.post(
            "/internal/v1/extract",
            data={"requestId": str(uuid.uuid4())},
            files={"file": ("report.pdf", b"%PDF-1.4", "application/pdf")},
        )
        self.assertEqual(401, response.status_code)
        self.assertEqual("INTERNAL_AUTH_REQUIRED", response.json()["detail"]["code"])

    @patch("app.main.extract_document")
    def test_internal_extract_returns_structured_contract(self, extract_document):
        extract_document.return_value = ExtractionResponse(
            engine="PADDLE_PP_STRUCTURE_V3",
            engineVersion="3.5.0",
            documentType="LAB_REPORT",
            pageCount=1,
            overallConfidence=0.98,
            observations=[],
            warnings=[],
        )
        response = self.client.post(
            "/internal/v1/extract",
            headers={"X-Clinora-Internal-Token": "dev-only-clinora-ocr-token-change-me"},
            data={"requestId": str(uuid.uuid4())},
            files={"file": ("report.pdf", b"%PDF-1.4", "application/pdf")},
        )
        self.assertEqual(200, response.status_code)
        self.assertEqual("LAB_REPORT", response.json()["documentType"])
        extract_document.assert_called_once()


if __name__ == "__main__":
    unittest.main()
