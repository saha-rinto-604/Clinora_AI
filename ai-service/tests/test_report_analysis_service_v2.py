from __future__ import annotations

import json
import unittest
from uuid import uuid4

from app.model_runtime import RuntimeMetadata
from app.schemas.report_analysis import ReportAnalysisRequest
from app.services.report_analysis_service import ReportAnalysisService


class FakeRuntime:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload
        self.metadata = RuntimeMetadata("google/medgemma-1.5-4b-it", "main", "Q4_0")

    def generate(self, messages, allowed_observation_ids=None):  # noqa: ANN001
        return json.dumps(self._payload)


class ReportAnalysisServiceV2Tests(unittest.TestCase):
    def test_preserves_grounded_condition_from_disease_specific_assay_evidence(self) -> None:
        ns1_id = uuid4()
        wbc_id = uuid4()
        request = ReportAnalysisRequest.model_validate(
            {
                "requestId": str(uuid4()),
                "reportType": "Dengue and hematology profile",
                "observations": [
                    {
                        "observationId": str(ns1_id),
                        "label": "Dengue NS1 Antigen (ELISA)",
                        "valueType": "NUMERIC",
                        "numericValue": "2.95",
                        "unit": "OD Ratio",
                        "referenceRangeRaw": "< 1.00 Ratio",
                    },
                    {
                        "observationId": str(wbc_id),
                        "label": "WBC (Total)",
                        "valueType": "NUMERIC",
                        "numericValue": "3700",
                        "unit": "/cmm",
                        "referenceLow": "4000",
                        "referenceHigh": "11000",
                    },
                ],
            }
        )
        payload = {
            "analysisStatus": "POSSIBLE_CLINICAL_PATTERN",
            "summary": "The verified pattern supports a cautious condition-level possibility.",
            "notableFindings": [],
            "clinicalPatterns": [
                {
                    "name": "Dengue infection",
                    "supportLevel": "MODERATE",
                    "reasoning": "The combination can fit an acute infectious process with a disease-specific laboratory signal.",
                    "supportingObservationIds": [str(ns1_id), str(wbc_id)],
                    "contradictoryObservationIds": [],
                    "missingEvidence": ["Symptoms and illness timing", "Clinical examination"],
                    "possibleCauses": ["Other acute viral infections"],
                }
            ],
            "discussionPoints": [],
            "patientExplanation": (
                "A disease-specific laboratory signal occurs alongside a compatible blood-count pattern. "
                "Clinical context and illness timing are still needed before drawing a conclusion."
            ),
            "limitations": ["Clinora will apply the standard patient-facing limitations."],
        }

        result = ReportAnalysisService(FakeRuntime(payload)).analyze(request)  # type: ignore[arg-type]

        self.assertEqual(result.promptVersion, "patient-lab-report-v5")
        self.assertEqual(str(result.analysisStatus), "POSSIBLE_CLINICAL_PATTERN")
        self.assertEqual(result.clinicalPatterns[0].name, "Dengue infection")
        self.assertIn(ns1_id, result.clinicalPatterns[0].supportingObservationIds)
        self.assertNotRegex(result.patientExplanation, r"\b\d{1,3}%\b")


if __name__ == "__main__":
    unittest.main()
