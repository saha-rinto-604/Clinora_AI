from __future__ import annotations

import json
import unittest
from uuid import UUID, uuid4

from app.model_runtime import ModelGeneration, RuntimeMetadata
from app.prompts.patient_lab_report_v1 import PROMPT_VERSION, _range_status, build_messages
from app.schemas.report_analysis import ReportAnalysisRequest
from app.services.report_analysis_service import InvalidModelOutputError, ReportAnalysisService, UnsafeModelOutputError


class FakeRuntime:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload
        self.allowed_observation_ids: tuple[str, ...] | None = None
        self.metadata = RuntimeMetadata("google/medgemma-1.5-4b-it", "main", "Q4_0")

    def generate(
        self,
        messages: list[dict[str, object]],
        allowed_observation_ids: tuple[str, ...] | None = None,
    ) -> str:
        if not messages:
            raise AssertionError("The approved prompt must be supplied to the model runtime.")
        self.allowed_observation_ids = allowed_observation_ids
        return json.dumps(self._payload)


class RawRuntime:
    def __init__(self, output: str | ModelGeneration) -> None:
        self._output = output
        self.metadata = RuntimeMetadata("google/medgemma-1.5-4b-it", "main", "Q4_0")

    def generate(
        self,
        messages: list[dict[str, object]],
        allowed_observation_ids: tuple[str, ...] | None = None,
    ) -> str | ModelGeneration:
        return self._output


class SequenceRuntime:
    def __init__(self, outputs: list[dict[str, object] | str | ModelGeneration]) -> None:
        self._outputs = outputs
        self.calls: list[list[dict[str, object]]] = []
        self.metadata = RuntimeMetadata("google/medgemma-1.5-4b-it", "main", "Q4_0")

    def generate(
        self,
        messages: list[dict[str, object]],
        allowed_observation_ids: tuple[str, ...] | None = None,
    ) -> str | ModelGeneration:
        self.calls.append(messages)
        index = len(self.calls) - 1
        if index >= len(self._outputs):
            raise AssertionError("ReportAnalysisService attempted more MedGemma generations than expected.")
        output = self._outputs[index]
        return json.dumps(output) if isinstance(output, dict) else output


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


def request_with_normal_observation() -> tuple[ReportAnalysisRequest, UUID]:
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
                    "numericValue": "13.5",
                    "unit": "g/dL",
                    "referenceLow": "12.0",
                    "referenceHigh": "15.5",
                    "rangeFlag": "WITHIN_REPORTED_RANGE",
                }
            ],
        }
    )
    return request, observation_id


def request_with_mixed_directions() -> tuple[ReportAnalysisRequest, UUID, UUID]:
    mcv_id = uuid4()
    rdw_id = uuid4()
    request = ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "CBC",
            "observations": [
                {
                    "observationId": str(mcv_id),
                    "label": "MCV",
                    "valueType": "NUMERIC",
                    "numericValue": "76",
                    "unit": "fL",
                    "referenceLow": "80",
                    "referenceHigh": "100",
                    "rangeFlag": "LOW",
                },
                {
                    "observationId": str(rdw_id),
                    "label": "RDW-CV",
                    "valueType": "NUMERIC",
                    "numericValue": "16.2",
                    "unit": "%",
                    "referenceLow": "11.5",
                    "referenceHigh": "14.5",
                    "rangeFlag": "HIGH",
                },
            ],
        }
    )
    return request, mcv_id, rdw_id


def mixed_direction_payload(mcv_id: UUID, rdw_id: UUID) -> dict[str, object]:
    return {
        "analysisStatus": "POSSIBLE_CLINICAL_PATTERN",
        "summary": "MCV is low while RDW-CV is high; these red-cell findings may form a pattern worth discussing.",
        "notableFindings": [
            {
                "observationId": str(mcv_id),
                "title": "Low MCV",
                "interpretation": "This result is below the supplied reference range.",
            },
            {
                "observationId": str(rdw_id),
                "title": "High RDW-CV",
                "interpretation": "This result is above the supplied reference range.",
            },
        ],
        "clinicalPatterns": [
            {
                "name": "Microcytic red-cell pattern",
                "supportLevel": "MODERATE",
                "reasoning": "Low MCV together with high RDW-CV can form a red-cell pattern with several possible explanations.",
                "supportingObservationIds": [str(mcv_id), str(rdw_id)],
                "contradictoryObservationIds": [],
                "missingEvidence": ["Iron studies and clinical context"],
                "possibleCauses": ["Iron deficiency"],
            }
        ],
        "discussionPoints": [
            {
                "type": "CLINICAL_QUESTION",
                "title": "Discuss the red-cell pattern",
                "reason": "A clinician can compare these verified findings with symptoms, history, and additional laboratory data.",
            }
        ],
        "patientExplanation": "MCV is slightly low while RDW-CV is mildly high. These findings can occur for more than one reason.",
        "limitations": ["Only the supplied confirmed laboratory values were analyzed."],
    }


def request_with_high_sensitivity_crp() -> tuple[ReportAnalysisRequest, UUID]:
    observation_id = uuid4()
    request = ReportAnalysisRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "reportType": "Inflammation markers",
            "observations": [
                {
                    "observationId": str(observation_id),
                    "label": "High sensitivity CRP (hs-CRP)",
                    "valueType": "NUMERIC",
                    "numericValue": "1.0",
                    "unit": "mg/L",
                    "referenceLow": "0",
                    "referenceHigh": "3.0",
                    "rangeFlag": "WITHIN_REPORTED_RANGE",
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
    def test_prompt_supplies_authoritative_low_range_status(self) -> None:
        request, observation_id = request_with_observation()

        messages = build_messages(request)
        content = str(messages[0]["content"])

        self.assertEqual(PROMPT_VERSION, "patient-lab-report-v1")
        self.assertEqual(_range_status(request.observations[0]), "LOW")
        self.assertIn(f'"observationId":"{observation_id}"', content)
        self.assertIn('"clinoraRangeStatus":"LOW"', content)
        self.assertIn("source of truth", content)
        self.assertIn("clinicalPatterns is the primary condition-prediction section", content)
        self.assertIn("Do not require many abnormal findings", content)
        self.assertIn("patientExplanation should provide a short fact-free overall clinical interpretation", content)
        self.assertIn("at most 2 condition-level possibilities", content)
        self.assertIn("LOW MCV is microcytic", content)
        self.assertIn("Do not impersonate a doctor", content)
        self.assertIn("Clinora renders exact values", content)
        self.assertIn("clinical mechanism or relationship", content)
        self.assertIn("do not name any supplied analyte", content)
    def test_prompt_supplies_authoritative_in_range_status(self) -> None:
        request, observation_id = request_with_normal_observation()

        messages = build_messages(request)
        content = str(messages[0]["content"])

        self.assertEqual(_range_status(request.observations[0]), "IN_RANGE")
        self.assertIn(f'"observationId":"{observation_id}"', content)
        self.assertIn('"clinoraRangeStatus":"IN_RANGE"', content)

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

    def test_reports_schema_type_error_without_logging_model_values(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"] = "not-a-list"

        with self.assertRaises(InvalidModelOutputError) as raised:
            ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(raised.exception.reason_code, "SCHEMA_VALIDATION_FAILED")
        self.assertIn("clinicalPatterns:list_type", raised.exception.diagnostics)
        self.assertNotIn("not-a-list", raised.exception.diagnostics)
    def test_canonicalizes_status_from_clinical_patterns_without_repair(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)

        # Reproduce the real MedGemma inconsistency:
        # clinical patterns are present, but the model reports no clear pattern.
        payload["analysisStatus"] = "NO_CLEAR_ABNORMAL_PATTERN"

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(str(result.analysisStatus), "POSSIBLE_CLINICAL_PATTERN")
        self.assertGreater(len(result.clinicalPatterns), 0)
        self.assertEqual(len(runtime.calls), 1)

    def test_canonicalizes_empty_patterns_to_insufficient_evidence_without_repair(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["analysisStatus"] = "POSSIBLE_CLINICAL_PATTERN"
        payload["clinicalPatterns"] = []

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(str(result.analysisStatus), "INSUFFICIENT_EVIDENCE")
        self.assertEqual(result.clinicalPatterns, [])
        self.assertEqual(len(runtime.calls), 1)

    def test_canonicalizes_missing_patterns_to_insufficient_evidence_without_repair(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["analysisStatus"] = "POSSIBLE_CLINICAL_PATTERN"
        del payload["clinicalPatterns"]

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(str(result.analysisStatus), "INSUFFICIENT_EVIDENCE")
        self.assertEqual(result.clinicalPatterns, [])
        self.assertEqual(len(runtime.calls), 1)

    def test_discards_model_authored_wrong_lab_direction_without_retry(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"][0]["reasoning"] = (  # type: ignore[index]
            "Hemoglobin is high, which may fit the pattern."
        )

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(len(runtime.calls), 1)
        reasoning = result.clinicalPatterns[0].reasoning
        self.assertIn("Hemoglobin (lower than expected)", reasoning)
        self.assertNotIn("Hemoglobin is high", reasoning)
        self.assertIn("possible explanation", reasoning)

    def test_preserves_fact_free_medgemma_clinical_reasoning(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"][0]["reasoning"] = (  # type: ignore[index]
            "This pattern can occur when iron availability is insufficient for red-cell production, "
            "and additional context is needed to distinguish the cause."
        )

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(len(runtime.calls), 1)
        self.assertIn("iron availability is insufficient", result.clinicalPatterns[0].reasoning)
        self.assertIn("Hemoglobin (lower than expected)", result.clinicalPatterns[0].reasoning)

    def test_does_not_repair_unsafe_output(self) -> None:
        request, observation_id = request_with_observation()
        unsafe = safe_payload(observation_id)
        unsafe["clinicalPatterns"][0]["possibleCauses"] = [  # type: ignore[index]
            "Start taking 20 mg of medicine every day."
        ]
        runtime = SequenceRuntime([unsafe])

        with self.assertRaises(UnsafeModelOutputError) as raised:
            ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(raised.exception.reason_code, "PROHIBITED_TREATMENT_WORDING")
        self.assertEqual(len(runtime.calls), 1)
    def test_does_not_repair_truncated_output(self) -> None:
        request, _ = request_with_observation()
        generation = ModelGeneration(
            '{"analysisStatus":"INSUFFICIENT_EVIDENCE"',
            "length",
            1536,
        )
        runtime = SequenceRuntime([generation])

        with self.assertRaises(InvalidModelOutputError) as raised:
            ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(raised.exception.reason_code, "OUTPUT_TRUNCATED")
        self.assertEqual(len(runtime.calls), 1)

    def test_repair_is_bounded_to_one_retry(self) -> None:
        request, _ = request_with_observation()
        invalid_json = '{"analysisStatus":not-json}'
        runtime = SequenceRuntime([invalid_json, invalid_json])

        with self.assertRaises(InvalidModelOutputError) as raised:
            ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(raised.exception.reason_code, "MALFORMED_JSON")
        self.assertEqual(len(runtime.calls), 2)

    def test_preserves_medgemma_structured_inference_with_evidence_links(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"][0]["reasoning"] = (  # type: ignore[index]
            "This pattern can occur when red-cell production is affected by limited iron availability, "
            "but the available report cannot establish the cause."
        )
        runtime = FakeRuntime(payload)
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(result.modelName, "google/medgemma-1.5-4b-it")
        self.assertEqual(result.clinicalPatterns[0].supportingObservationIds, [observation_id])
        self.assertEqual(runtime.allowed_observation_ids, (str(observation_id),))
        self.assertIn("Hemoglobin (lower than expected)", result.clinicalPatterns[0].reasoning)
        self.assertIn("limited iron availability", result.clinicalPatterns[0].reasoning)
        self.assertIn("diagnosis", " ".join(result.limitations).lower())
    def test_drops_pattern_with_hallucinated_evidence_reference_fail_closed(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        pattern = payload["clinicalPatterns"][0]  # type: ignore[index]
        pattern["supportingObservationIds"] = [str(uuid4())]  # type: ignore[index]

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(len(runtime.calls), 1)
        self.assertEqual(result.clinicalPatterns, [])
        self.assertEqual(str(result.analysisStatus), "INSUFFICIENT_EVIDENCE")

    def test_drops_single_lab_abnormality_as_condition_prediction_fail_closed(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"][0]["name"] = "Low hemoglobin"  # type: ignore[index]

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(len(runtime.calls), 1)
        self.assertEqual(result.clinicalPatterns, [])
        self.assertEqual(str(result.analysisStatus), "INSUFFICIENT_EVIDENCE")

    def test_canonicalizes_support_level_from_verified_abnormal_evidence(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"][0]["name"] = "Iron-deficiency anemia"  # type: ignore[index]
        payload["clinicalPatterns"][0]["supportLevel"] = "STRONG"  # type: ignore[index]

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(str(result.clinicalPatterns[0].supportLevel), "LIMITED")
    def test_allows_limited_condition_level_prediction_with_grounded_evidence(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"][0]["name"] = "Possible anemia"  # type: ignore[index]

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(result.clinicalPatterns[0].name, "Possible anemia")
        self.assertEqual(str(result.clinicalPatterns[0].supportLevel), "LIMITED")

    def test_replaces_wrong_direction_in_model_finding_with_verified_fact(self) -> None:
        request, observation_id = request_with_normal_observation()
        payload = safe_payload(observation_id)
        payload["analysisStatus"] = "NO_CLEAR_ABNORMAL_PATTERN"
        payload["clinicalPatterns"] = []
        payload["summary"] = "Hemoglobin is high."
        payload["notableFindings"] = [
            {
                "observationId": str(observation_id),
                "title": "Elevated hemoglobin",
                "interpretation": "This result is above the reference range.",
            }
        ]
        payload["patientExplanation"] = "Hemoglobin is high."

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(len(runtime.calls), 1)
        self.assertNotIn("Hemoglobin is high", result.summary)
        self.assertEqual(result.notableFindings[0].observationId, observation_id)
        self.assertIn("within the supplied reference range", result.notableFindings[0].interpretation)
    def test_drops_pattern_supported_only_by_in_range_observations_fail_closed(self) -> None:
        request, observation_id = request_with_normal_observation()
        payload = safe_payload(observation_id)
        payload["summary"] = "The verified hemoglobin value is within the supplied reference interval."
        payload["notableFindings"] = [
            {
                "observationId": str(observation_id),
                "title": "Hemoglobin",
                "interpretation": "This result is within the reference range.",
            }
        ]
        payload["clinicalPatterns"] = [
            {
                "name": "Anemia pattern",
                "supportLevel": "LIMITED",
                "reasoning": "The supplied value is being considered as the only supporting evidence.",
                "supportingObservationIds": [str(observation_id)],
                "contradictoryObservationIds": [],
                "missingEvidence": ["Additional clinical context"],
                "possibleCauses": [],
            }
        ]
        payload["patientExplanation"] = "The supplied hemoglobin value is within its reference interval."
        payload["discussionPoints"] = [
            {
                "type": "CLINICAL_QUESTION",
                "title": "Discuss this hemoglobin result",
                "reason": "A clinician can interpret this in-range result together with symptoms, history, and other blood-count values.",
            }
        ]

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(len(runtime.calls), 1)
        self.assertEqual(result.clinicalPatterns, [])
        self.assertIn("does not show a clear condition-level pattern", result.summary)

    def test_allows_patient_friendly_description_of_in_range_observation(self) -> None:
        request, observation_id = request_with_normal_observation()
        payload = safe_payload(observation_id)
        payload["analysisStatus"] = "NO_CLEAR_ABNORMAL_PATTERN"
        payload["summary"] = "The verified hemoglobin value is within the supplied reference interval."
        payload["notableFindings"] = [
            {
                "observationId": str(observation_id),
                "title": "Hemoglobin",
                "interpretation": "This result is within the reference range.",
            }
        ]
        payload["clinicalPatterns"] = []
        payload["patientExplanation"] = "The supplied hemoglobin value is within its reference interval."
        payload["discussionPoints"] = [
            {
                "type": "CLINICAL_QUESTION",
                "title": "Discuss this hemoglobin result",
                "reason": "A clinician can interpret this in-range result together with symptoms, history, and other blood-count values.",
            }
        ]

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(str(result.analysisStatus), "NO_CLEAR_ABNORMAL_PATTERN")

    def test_allows_mixed_low_and_high_observations_in_same_summary(self) -> None:
        request, mcv_id, rdw_id = request_with_mixed_directions()
        payload = mixed_direction_payload(mcv_id, rdw_id)

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(str(result.analysisStatus), "POSSIBLE_CLINICAL_PATTERN")
        self.assertEqual(result.clinicalPatterns[0].name, "Microcytic red-cell pattern")

    def test_replaces_wrong_direction_in_model_summary_before_validation(self) -> None:
        request, mcv_id, rdw_id = request_with_mixed_directions()
        payload = mixed_direction_payload(mcv_id, rdw_id)
        payload["summary"] = "MCV is high while RDW-CV is high."

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(len(runtime.calls), 1)
        self.assertNotIn("MCV is high", result.summary)
        self.assertEqual(str(result.analysisStatus), "POSSIBLE_CLINICAL_PATTERN")
    def test_grounded_id_linked_finding_uses_verified_status(self) -> None:
        request, observation_id = request_with_normal_observation()
        payload = safe_payload(observation_id)
        payload["analysisStatus"] = "NO_CLEAR_ABNORMAL_PATTERN"
        payload["clinicalPatterns"] = []
        payload["notableFindings"] = [
            {
                "observationId": str(observation_id),
                "title": "Hemoglobin",
                "interpretation": "This result is above the supplied reference range.",
            }
        ]

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(len(runtime.calls), 1)
        self.assertIn("within the supplied reference range", result.notableFindings[0].interpretation)
    def test_does_not_confuse_mch_with_mchc_in_mixed_direction_prose(self) -> None:
        mch_id = uuid4()
        mchc_id = uuid4()
        request = ReportAnalysisRequest.model_validate(
            {
                "requestId": str(uuid4()),
                "reportType": "CBC",
                "observations": [
                    {
                        "observationId": str(mch_id),
                        "label": "MCH",
                        "valueType": "NUMERIC",
                        "numericValue": "24",
                        "unit": "pg",
                        "referenceLow": "27",
                        "referenceHigh": "33",
                        "rangeFlag": "LOW",
                    },
                    {
                        "observationId": str(mchc_id),
                        "label": "MCHC",
                        "valueType": "NUMERIC",
                        "numericValue": "37",
                        "unit": "g/dL",
                        "referenceLow": "32",
                        "referenceHigh": "36",
                        "rangeFlag": "HIGH",
                    },
                ],
            }
        )
        payload = mixed_direction_payload(mch_id, mchc_id)
        payload["summary"] = "MCH is low while MCHC is high; the two directions should remain distinct."
        payload["notableFindings"][0].update({"title": "Low MCH", "interpretation": "This result is below range."})  # type: ignore[index,union-attr]
        payload["notableFindings"][1].update({"title": "High MCHC", "interpretation": "This result is above range."})  # type: ignore[index,union-attr]
        payload["clinicalPatterns"][0]["reasoning"] = "Low MCH together with high MCHC produces a mixed red-cell pattern that needs clinical context."  # type: ignore[index]
        payload["patientExplanation"] = "MCH is slightly low while MCHC is mildly high. These findings need clinical context."

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(str(result.analysisStatus), "POSSIBLE_CLINICAL_PATTERN")

    def test_skips_ambiguous_unlinked_direction_for_duplicate_labels_but_keeps_id_linked_checks(self) -> None:
        low_id = uuid4()
        high_id = uuid4()
        request = ReportAnalysisRequest.model_validate(
            {
                "requestId": str(uuid4()),
                "reportType": "Repeated analyte example",
                "observations": [
                    {
                        "observationId": str(low_id),
                        "label": "Hemoglobin",
                        "valueType": "NUMERIC",
                        "numericValue": "9.8",
                        "unit": "g/dL",
                        "referenceLow": "12.0",
                        "referenceHigh": "15.5",
                        "rangeFlag": "LOW",
                    },
                    {
                        "observationId": str(high_id),
                        "label": "Hemoglobin",
                        "valueType": "NUMERIC",
                        "numericValue": "17.0",
                        "unit": "g/dL",
                        "referenceLow": "12.0",
                        "referenceHigh": "15.5",
                        "rangeFlag": "HIGH",
                    },
                ],
            }
        )
        payload = mixed_direction_payload(low_id, high_id)
        payload["summary"] = "Hemoglobin is high in one supplied observation, while the repeated label makes an unlinked summary ambiguous."
        payload["notableFindings"][0].update({"title": "Low hemoglobin", "interpretation": "This result is below range."})  # type: ignore[index,union-attr]
        payload["notableFindings"][1].update({"title": "High hemoglobin", "interpretation": "This result is above range."})  # type: ignore[index,union-attr]
        payload["clinicalPatterns"][0]["reasoning"] = "The two ID-linked hemoglobin observations point in different directions and require clinical context."  # type: ignore[index]
        payload["patientExplanation"] = "The repeated test name refers to separate verified observations, so the values need clinical context."

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(str(result.analysisStatus), "POSSIBLE_CLINICAL_PATTERN")

    def test_allows_direction_word_that_is_part_of_analyte_name(self) -> None:
        request, observation_id = request_with_high_sensitivity_crp()
        payload = safe_payload(observation_id)
        payload["analysisStatus"] = "NO_CLEAR_ABNORMAL_PATTERN"
        payload["summary"] = "High sensitivity CRP is within the supplied reference range."
        payload["notableFindings"] = [
            {
                "observationId": str(observation_id),
                "title": "High sensitivity CRP",
                "interpretation": "This result is within the supplied reference range.",
            }
        ]
        payload["clinicalPatterns"] = []
        payload["discussionPoints"] = []
        payload["patientExplanation"] = "The high sensitivity CRP result is within the report range."

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(str(result.analysisStatus), "NO_CLEAR_ABNORMAL_PATTERN")

    def test_treats_high_normal_and_low_normal_as_in_range_language(self) -> None:
        request, observation_id = request_with_normal_observation()
        for phrase in ("Hemoglobin is high-normal within the report range.", "Hemoglobin is low-normal within the report range."):
            payload = safe_payload(observation_id)
            payload["analysisStatus"] = "NO_CLEAR_ABNORMAL_PATTERN"
            payload["summary"] = phrase
            payload["notableFindings"] = [
                {
                    "observationId": str(observation_id),
                    "title": "Hemoglobin",
                    "interpretation": phrase,
                }
            ]
            payload["clinicalPatterns"] = []
            payload["discussionPoints"] = []
            payload["patientExplanation"] = "The hemoglobin result remains within the report range."

            result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]
            self.assertEqual(str(result.analysisStatus), "NO_CLEAR_ABNORMAL_PATTERN")

    def test_ignores_negated_or_comparative_direction_language(self) -> None:
        request, observation_id = request_with_normal_observation()
        payload = safe_payload(observation_id)
        payload["analysisStatus"] = "NO_CLEAR_ABNORMAL_PATTERN"
        payload["summary"] = "Hemoglobin is higher than the previous result but remains within the current report range."
        payload["notableFindings"] = [
            {
                "observationId": str(observation_id),
                "title": "Hemoglobin",
                "interpretation": "This result is not high and remains within the supplied reference range.",
            }
        ]
        payload["clinicalPatterns"] = []
        payload["discussionPoints"] = []
        payload["patientExplanation"] = "The current hemoglobin result is within the report range."

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(str(result.analysisStatus), "NO_CLEAR_ABNORMAL_PATTERN")

    def test_drops_internal_status_tokens_from_optional_model_inference_list(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"][0]["possibleCauses"] = ["IN_RANGE"]  # type: ignore[index]

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(len(runtime.calls), 1)
        self.assertEqual(result.clinicalPatterns[0].possibleCauses, [])
    def test_replaces_incomplete_model_reasoning_with_grounded_reasoning(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"][0]["reasoning"] = "The low hemoglobin result can"  # type: ignore[index]

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(len(runtime.calls), 1)
        self.assertIn("Hemoglobin", result.clinicalPatterns[0].reasoning)
        self.assertFalse(result.clinicalPatterns[0].reasoning.rstrip().endswith("can"))
    def test_rejects_direct_treatment_instruction_in_model_owned_inference(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"][0]["possibleCauses"] = [  # type: ignore[index]
            "Start taking 20 mg of medicine every day."
        ]

        with self.assertRaises(UnsafeModelOutputError) as raised:
            ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(raised.exception.reason_code, "PROHIBITED_TREATMENT_WORDING")
    def test_rejects_numeric_disease_confidence_in_model_owned_inference(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"][0]["possibleCauses"] = [  # type: ignore[index]
            "The probability is 92% for iron deficiency anemia."
        ]

        with self.assertRaises(UnsafeModelOutputError):
            ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]
    def test_rejects_definitive_diagnosis_language_in_model_owned_inference(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"][0]["name"] = "The diagnosis is iron deficiency anemia"  # type: ignore[index]

        with self.assertRaises(UnsafeModelOutputError):
            ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]
    def test_no_pattern_explanation_uses_verified_abnormal_facts(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["clinicalPatterns"] = []
        payload["analysisStatus"] = "NO_CLEAR_ABNORMAL_PATTERN"

        runtime = SequenceRuntime([payload])
        result = ReportAnalysisService(runtime).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(len(runtime.calls), 1)
        self.assertIn("Hemoglobin (lower than expected)", result.patientExplanation)
        self.assertIn("more than one explanation", result.patientExplanation)
        self.assertEqual(result.clinicalPatterns, [])

    def test_preserves_fact_free_pattern_level_reasoning_when_no_condition_is_named(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["analysisStatus"] = "NO_CLEAR_ABNORMAL_PATTERN"
        payload["clinicalPatterns"] = []
        payload["patientExplanation"] = (
            "This combination can reflect more than one red-cell production process, and the pattern is not "
            "specific enough by itself to identify one underlying cause."
        )

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(result.clinicalPatterns, [])
        self.assertIn("more than one red-cell production process", result.patientExplanation)
        self.assertIn("Hemoglobin (lower than expected)", result.patientExplanation)

    def test_discards_fact_claims_from_no_condition_pattern_reasoning(self) -> None:
        request, observation_id = request_with_observation()
        payload = safe_payload(observation_id)
        payload["analysisStatus"] = "NO_CLEAR_ABNORMAL_PATTERN"
        payload["clinicalPatterns"] = []
        payload["patientExplanation"] = "Hemoglobin is high and therefore confirms the pattern."

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(result.clinicalPatterns, [])
        self.assertNotIn("Hemoglobin is high", result.patientExplanation)
        self.assertIn("Hemoglobin (lower than expected)", result.patientExplanation)

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
