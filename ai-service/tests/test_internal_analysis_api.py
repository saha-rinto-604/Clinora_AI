from __future__ import annotations

import os
import unittest
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.internal_analysis import build_router
from app.model_runtime import MalformedModelResponseError, ModelUnavailableError
from app.schemas.report_analysis import ReportAnalysisResponse


class FakeAnalysisService:
    def analyze(self, request):  # noqa: ANN001
        observation_id = request.observations[0].observationId
        return ReportAnalysisResponse.model_validate(
            {
                "analysisStatus": "POSSIBLE_CLINICAL_PATTERN",
                "summary": "One confirmed value is outside the supplied reference interval.",
                "notableFindings": [
                    {
                        "observationId": str(observation_id),
                        "title": "Confirmed abnormal value",
                        "interpretation": "This finding is based on the supplied confirmed observation.",
                    }
                ],
                "clinicalPatterns": [
                    {
                        "name": "Non-specific laboratory pattern",
                        "supportLevel": "LIMITED",
                        "reasoning": "The supplied observation is abnormal, but the available data are insufficient to identify a cause.",
                        "supportingObservationIds": [str(observation_id)],
                        "contradictoryObservationIds": [],
                        "missingEvidence": ["Additional clinical context"],
                        "possibleCauses": [],
                    }
                ],
                "discussionPoints": [],
                "patientExplanation": "A confirmed result is outside its reference interval and should be interpreted with clinical context.",
                "limitations": ["This is not a diagnosis."],
                "modelName": "google/medgemma-1.5-4b-it",
                "modelRevision": "main",
                "promptVersion": "patient-lab-report-v1",
                "schemaVersion": "1.0",
            }
        )


class FailingAnalysisService:
    def __init__(self, error: RuntimeError) -> None:
        self._error = error

    def analyze(self, request):  # noqa: ANN001
        raise self._error


class InternalAnalysisApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.previous_token = os.environ.get("AI_INTERNAL_TOKEN")
        os.environ["AI_INTERNAL_TOKEN"] = "unit-test-secret"
        app = FastAPI()
        app.include_router(build_router(FakeAnalysisService()))  # type: ignore[arg-type]
        self.client = TestClient(app)
        self.payload = {
            "requestId": str(uuid4()),
            "reportType": "CBC",
            "observations": [
                {
                    "observationId": str(uuid4()),
                    "label": "Hemoglobin",
                    "valueType": "NUMERIC",
                    "numericValue": "9.8",
                    "unit": "g/dL",
                    "referenceLow": "12.0",
                    "referenceHigh": "15.5",
                    "rangeFlag": "LOW",
                }
            ],
        }

    def tearDown(self) -> None:
        if self.previous_token is None:
            os.environ.pop("AI_INTERNAL_TOKEN", None)
        else:
            os.environ["AI_INTERNAL_TOKEN"] = self.previous_token

    def test_rejects_request_without_internal_token(self) -> None:
        response = self.client.post("/internal/v1/report-analysis", json=self.payload)
        self.assertEqual(response.status_code, 401)

    def test_accepts_authorized_structured_request(self) -> None:
        response = self.client.post(
            "/internal/v1/report-analysis",
            json=self.payload,
            headers={"X-Clinora-Internal-Token": "unit-test-secret"},
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["modelName"], "google/medgemma-1.5-4b-it")
        self.assertEqual(body["clinicalPatterns"][0]["supportLevel"], "LIMITED")

    def test_maps_malformed_llama_envelope_to_controlled_rejected_response(self) -> None:
        app = FastAPI()
        app.include_router(
            build_router(  # type: ignore[arg-type]
                FailingAnalysisService(MalformedModelResponseError("MALFORMED_LLAMA_ENVELOPE", "error_type=KeyError"))
            )
        )
        response = TestClient(app).post(
            "/internal/v1/report-analysis",
            json=self.payload,
            headers={"X-Clinora-Internal-Token": "unit-test-secret"},
        )

        self.assertEqual(response.status_code, 502)
        self.assertNotIn("malformed", response.text)

    def test_maps_llama_timeout_to_controlled_unavailable_response(self) -> None:
        app = FastAPI()
        app.include_router(build_router(FailingAnalysisService(ModelUnavailableError("timeout"))))  # type: ignore[arg-type]
        response = TestClient(app).post(
            "/internal/v1/report-analysis",
            json=self.payload,
            headers={"X-Clinora-Internal-Token": "unit-test-secret"},
        )

        self.assertEqual(response.status_code, 503)
        self.assertNotIn("timeout", response.text)


if __name__ == "__main__":
    unittest.main()
