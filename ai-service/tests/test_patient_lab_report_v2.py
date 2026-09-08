from __future__ import annotations

import unittest
from uuid import uuid4

from app.prompts.patient_lab_report_v2 import PROMPT_VERSION, build_messages
from app.schemas.report_analysis import ReportAnalysisRequest


class PatientLabReportV2PromptTests(unittest.TestCase):
    def test_one_sided_assay_ranges_are_normalized_before_reasoning(self) -> None:
        high_id = uuid4()
        in_range_id = uuid4()
        request = ReportAnalysisRequest.model_validate(
            {
                "requestId": str(uuid4()),
                "reportType": "Laboratory results",
                "observations": [
                    {
                        "observationId": str(high_id),
                        "label": "Dengue NS1 Antigen (ELISA)",
                        "valueType": "NUMERIC",
                        "numericValue": "2.95",
                        "unit": "OD Ratio",
                        "referenceRangeRaw": "< 1.00 Ratio",
                    },
                    {
                        "observationId": str(in_range_id),
                        "label": "Dengue IgG Antibody (ELISA)",
                        "valueType": "NUMERIC",
                        "numericValue": "0.15",
                        "unit": "OD Ratio",
                        "referenceRangeRaw": "< 1.00 Ratio",
                    },
                ],
            }
        )

        content = str(build_messages(request)[0]["content"])

        self.assertEqual(PROMPT_VERSION, "patient-lab-report-v2")
        self.assertIn(f'"observationId":"{high_id}"', content)
        self.assertIn('"clinoraRangeStatus":"HIGH"', content)
        self.assertIn(f'"observationId":"{in_range_id}"', content)
        self.assertIn('"clinoraRangeStatus":"IN_RANGE"', content)

    def test_prompt_enables_grounded_condition_reasoning_without_hard_coding_a_disease(self) -> None:
        request = ReportAnalysisRequest.model_validate(
            {
                "requestId": str(uuid4()),
                "reportType": "CBC",
                "observations": [
                    {
                        "observationId": str(uuid4()),
                        "label": "Platelets",
                        "valueType": "NUMERIC",
                        "numericValue": "98000",
                        "unit": "/cmm",
                        "referenceLow": "150000",
                        "referenceHigh": "400000",
                    }
                ],
            }
        )

        content = str(build_messages(request)[0]["content"])
        rules = content.split("Confirmed clinical input:", 1)[0]

        self.assertIn("Disease-, pathogen-, or organ-specific assay labels", rules)
        self.assertIn("Missing symptoms, illness timing, history", rules)
        self.assertIn("should not force clinicalPatterns=[]", rules)
        self.assertIn("Never output a disease probability", rules)
        self.assertNotIn("dengue", rules.lower())


if __name__ == "__main__":
    unittest.main()
