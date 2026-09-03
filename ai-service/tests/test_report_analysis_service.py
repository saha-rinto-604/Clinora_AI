from __future__ import annotations

import json
import unittest
from uuid import UUID, uuid4

from app.model_runtime import ModelGeneration, RuntimeMetadata
from app.schemas.report_analysis import ReportAnalysisRequest
from app.services.report_analysis_service import InvalidModelOutputError, ReportAnalysisService, UnsafeModelOutputError


class FakeRuntime:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload
        self.metadata = RuntimeMetadata("google/medgemma-1.5-4b-it", "main", "Q4_0")

    def generate(self, messages: list[dict[str, object]]) -> str:
        if not messages:
            raise AssertionError("The approved prompt must be supplied to the model runtime.")
        return json.dumps(self._payload)


class RawRuntime:
    def __init__(self, output: str | ModelGeneration) -> None:
        self._output = output
        self.metadata = RuntimeMetadata("google/medgemma-1.5-4b-it", "main", "Q4_0")

    def generate(self, messages: list[dict[str, object]]) -> str | ModelGeneration:
        return self._output


def request_with_observation() -> tuple[ReportAnalysisRequest, UUID]:
    observation_id = uuid4()
    request = ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "CBC",
            "observations": [
                {
                    "observationId": str(observation_id),
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
    )
    return request, observation_id


def safe_payload(observation_id: UUID) -> dict[str, object]:
    return {
        "analysisStatus": "POSSIBLE_CLINICAL_PATTERN",
        "summary": "The confirmed result contains a low hemoglobin value.",
        "notableFindings": [
            {
                "observationId": str(observation_id),
                "title": "Low hemoglobin",
                "interpretation": "This result is below the supplied reference interval and can be compatible with anemia.",
            }
        ],
        "clinicalPatterns": [
            {
                "name": "Anemia pattern",
                "supportLevel": "LIMITED",
                "reasoning": "The supplied hemoglobin value is below its reference interval. The available data are not sufficient to determine the cause.",
                "supportingObservationIds": [str(observation_id)],
                "contradictoryObservationIds": [],
                "missingEvidence": ["Additional red-cell indices and clinical context"],
                "possibleCauses": [],
            }
        ],
        "discussionPoints": [
            {
                "type": "CLINICAL_QUESTION",
                "title": "Discuss the low hemoglobin result",
                "reason": "A clinician can interpret this result together with symptoms, history, and other blood-count values.",
            }
        ],
        "patientExplanation": "One confirmed blood result is lower than the reference range. This can have several causes and does not establish a diagnosis by itself.",
        "limitations": ["Only the supplied confirmed laboratory value was analyzed."],
    }


class ReportAnalysisServiceTests(unittest.TestCase):
    def test_rejects_malformed_json_with_specific_diagnostic(self) -> None:
        request, _ = request_with_observation()

        with self.assertRaises(InvalidModelOutputError) as raised:
            ReportAnalysisService(RawRuntime('{"analysisStatus":not-json}')).analyze(  # type: ignore[arg-type]
                request
            )

        self.assertEqual(raised.exception.reason_code, "MALFORMED_JSON")
        self.assertIn("line=1", raised.exception.diagnostics)

    def test_rejects_token_limit_truncation_before_parsing(self) -> None:
        request, _ = request_with_observation()
        generation = ModelGeneration(
            '{"analysisStatus":"INSUFFICIENT_EVIDENCE"',
            "length",
            256,
        )

        with self.assertRaises(InvalidModelOutputError) as raised:
            ReportAnalysisService(RawRuntime(generation)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(raised.exception.reason_code, "OUTPUT_TRUNCATED")
        self.assertIn("completion_tokens=256", raised.exception.diagnostics)

    def test_reports_missing_schema_field_without_logging_its_value(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        del payload["summary"]

        with self.assertRaises(InvalidModelOutputError) as raised:
            ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(raised.exception.reason_code, "SCHEMA_VALIDATION_FAILED")
        self.assertIn("summary:missing", raised.exception.diagnostics)

    def test_preserves_medgemma_reasoning_with_evidence_links(self) -> None:
        request, observation_id = request_with_observation()
        result = ReportAnalysisService(FakeRuntime(safe_payload(observation_id))).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(result.modelName, "google/medgemma-1.5-4b-it")
        self.assertEqual(result.clinicalPatterns[0].supportingObservationIds, [observation_id])
        self.assertIn("diagnosis", " ".join(result.limitations).lower())

    def test_rejects_hallucinated_evidence_reference(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        pattern = payload["clinicalPatterns"][0]  # type: ignore[index]
        pattern["supportingObservationIds"] = [str(uuid4())]  # type: ignore[index]

        with self.assertRaises(InvalidModelOutputError) as raised:
            ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(raised.exception.reason_code, "EVIDENCE_ID_MISMATCH")

    def test_rejects_direct_treatment_instruction(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["patientExplanation"] = "Start taking 20 mg of medicine every day."

        with self.assertRaises(UnsafeModelOutputError) as raised:
            ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(raised.exception.reason_code, "PROHIBITED_TREATMENT_WORDING")

    def test_rejects_numeric_disease_confidence(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["summary"] = "The probability is 92% for iron deficiency anemia."

        with self.assertRaises(UnsafeModelOutputError):
            ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

    def test_rejects_definitive_diagnosis_language(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["summary"] = "The diagnosis is iron deficiency anemia."

        with self.assertRaises(UnsafeModelOutputError):
            ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

    def test_allows_no_clear_pattern_without_forcing_conditions(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["analysisStatus"] = "NO_CLEAR_ABNORMAL_PATTERN"
        payload["clinicalPatterns"] = []

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(str(result.analysisStatus), "NO_CLEAR_ABNORMAL_PATTERN")
        self.assertEqual(result.clinicalPatterns, [])


if __name__ == "__main__":
    unittest.main()
