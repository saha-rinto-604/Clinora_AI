from __future__ import annotations

import json
import os
import unittest
from unittest.mock import Mock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.internal_analysis import build_router
from app.clinical_language.normalization import normalize_doctor_message
from app.model_runtime import ModelGeneration
from app.prompts.doctor_query_interpreter_v1 import SYSTEM_PROMPT, build_messages
from app.schemas.doctor_query_frame import (
    DoctorClinicalQueryFrame,
    DoctorQueryInterpretationRequest,
    DoctorQueryInterpretationResponse,
    query_frame_response_schema,
)
from app.schemas.doctor_support import MinimalRoutingContext
from app.services.doctor_query_interpreter_service import (
    DoctorQueryInterpreterService,
    InvalidDoctorQueryInterpretationError,
)


def request(message: str = "Hb stable but indices still low; same picture as before?") -> DoctorQueryInterpretationRequest:
    return DoctorQueryInterpretationRequest(
        requestId=uuid4(),
        doctorMessage=message,
        context=MinimalRoutingContext(
            contextType="APPOINTMENT_CARE_CONTEXT",
            currentScreen="REPORT_REVIEW",
            currentReportType="CBC",
            selectedReportCount=1,
            selectedObservationCount=0,
            doctorAssessmentPresent=True,
            doctorNotesPresent=False,
            comparableAuthorizedReportsAvailable=True,
            selectionType="REPORT",
        ),
    )


def interpreted_frame() -> dict[str, object]:
    return {
        "frameStatus": "INTERPRETED",
        "informationNeeds": ["TRACE_CHANGE", "RELATE_FINDINGS"],
        "clinicalFocus": [
            {"text": "indices", "normalizedConcept": "red cell indices", "conceptType": "CLINICAL_FINDING"}
        ],
        "doctorAssertions": [],
        "relationshipMode": "PERSISTENT_PATTERN",
        "temporalIntent": "PERSISTENCE",
        "evidenceScope": "COMPARABLE_REPORTS",
        "referents": ["CURRENT_REPORT", "PREVIOUS_COMPARABLE_EVIDENCE"],
        "ambiguities": [],
    }


class DoctorLanguageNormalizationTests(unittest.TestCase):
    def test_normalization_is_conservative_and_preserves_clinical_abbreviations(self) -> None:
        normalized = normalize_doctor_message("Cmp w/ prev CBC; r/o thal, MCV still low")
        self.assertIn("compare", normalized.lower())
        self.assertIn("previous", normalized.lower())
        self.assertIn("rule out", normalized.lower())
        self.assertIn("thal", normalized)
        self.assertIn("MCV", normalized)


class DoctorQueryFrameTests(unittest.TestCase):
    def test_schema_is_strict_and_generalized(self) -> None:
        schema = query_frame_response_schema()
        self.assertFalse(schema["additionalProperties"])
        self.assertIn("informationNeeds", schema["properties"])
        self.assertIn("doctorAssertions", schema["properties"])
        self.assertIn("relationshipMode", schema["properties"])
        self.assertIn("temporalIntent", schema["properties"])
        self.assertEqual(set(schema["required"]), set(schema["properties"]))

    def test_interpreted_frame_requires_need_and_no_unresolved_ambiguity(self) -> None:
        invalid = interpreted_frame()
        invalid["informationNeeds"] = []
        with self.assertRaises(ValueError):
            DoctorClinicalQueryFrame.model_validate(invalid)

        invalid = interpreted_frame()
        invalid["ambiguities"] = ["UNRESOLVED_REFERENT"]
        with self.assertRaises(ValueError):
            DoctorClinicalQueryFrame.model_validate(invalid)

        invalid = interpreted_frame()
        invalid["temporalIntent"] = "NONE"
        with self.assertRaises(ValueError):
            DoctorClinicalQueryFrame.model_validate(invalid)


class DoctorQueryPromptTests(unittest.TestCase):
    def test_prompt_interprets_semantics_without_answering_or_promoting_doctor_text_to_fact(self) -> None:
        messages = build_messages(request("Not convinced this is simple deficiency; anything I am overlooking?"))
        self.assertIn("do not answer", SYSTEM_PROMPT.lower())
        self.assertIn("never a Patient fact", SYSTEM_PROMPT)
        self.assertIn("compositionally", SYSTEM_PROMPT)
        self.assertIn("Map the requested operation, not its surface wording", SYSTEM_PROMPT)
        self.assertIn("Never combine INTERPRETED with an ambiguity", SYSTEM_PROMPT)
        self.assertIn("BEGIN_UNTRUSTED_DOCTOR_MESSAGE", messages[1]["content"])
        self.assertIn("MINIMAL_AUTHORIZED_UI_CONTEXT", messages[1]["content"])
        self.assertNotIn("Patient name", messages[1]["content"])


class DoctorQueryInterpreterServiceTests(unittest.TestCase):
    def test_uses_small_bounded_generation_and_returns_performance_metadata(self) -> None:
        runtime = Mock()
        runtime.generate.return_value = ModelGeneration(json.dumps(interpreted_frame()), "stop", 71, 155)

        response = DoctorQueryInterpreterService(runtime).interpret(request())

        self.assertEqual(response.frame.frameStatus, "INTERPRETED")
        self.assertEqual(response.promptTokens, 155)
        self.assertEqual(response.completionTokens, 71)
        kwargs = runtime.generate.call_args.kwargs
        self.assertLessEqual(kwargs["max_tokens"], 512)
        self.assertGreaterEqual(kwargs["max_tokens"], 128)
        self.assertIn("response_schema", kwargs)

    def test_rejects_truncation_instead_of_launching_an_expensive_repair(self) -> None:
        runtime = Mock()
        runtime.generate.return_value = ModelGeneration("{}", "length", 320, 180)

        with self.assertRaises(InvalidDoctorQueryInterpretationError) as captured:
            DoctorQueryInterpreterService(runtime).interpret(request())

        self.assertEqual("QUERY_INTERPRETER_TRUNCATED", captured.exception.reason_code)
        self.assertEqual(1, runtime.generate.call_count)

    def test_rejects_malformed_or_contradictory_frames(self) -> None:
        for content in (
            "not-json",
            json.dumps({**interpreted_frame(), "informationNeeds": []}),
            json.dumps({**interpreted_frame(), "frameStatus": "UNSUPPORTED"}),
        ):
            runtime = Mock()
            runtime.generate.return_value = ModelGeneration(content, "stop", 20, 100)
            with self.subTest(content=content), self.assertRaises(InvalidDoctorQueryInterpretationError):
                DoctorQueryInterpreterService(runtime).interpret(request())


class FakeReportAnalysisService:
    def analyze(self, request):  # noqa: ANN001
        raise AssertionError("Patient analysis must not be invoked by Doctor interpretation.")


class FakeDoctorQueryInterpreterService:
    def interpret(self, request):  # noqa: ANN001
        return DoctorQueryInterpretationResponse(
            frame=DoctorClinicalQueryFrame.model_validate(interpreted_frame()),
            durationMs=17,
            finishReason="stop",
            promptTokens=120,
            completionTokens=52,
        )


class DoctorQueryInternalApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.previous_token = os.environ.get("AI_INTERNAL_TOKEN")
        os.environ["AI_INTERNAL_TOKEN"] = "query-frame-test-secret"
        app = FastAPI()
        app.include_router(
            build_router(
                FakeReportAnalysisService(),
                doctor_query_interpreter_service=FakeDoctorQueryInterpreterService(),  # type: ignore[arg-type]
            )
        )
        self.client = TestClient(app)
        self.payload = request().model_dump(mode="json")

    def tearDown(self) -> None:
        if self.previous_token is None:
            os.environ.pop("AI_INTERNAL_TOKEN", None)
        else:
            os.environ["AI_INTERNAL_TOKEN"] = self.previous_token

    def test_interpreter_is_private_and_returns_no_clinical_answer_field(self) -> None:
        self.assertEqual(self.client.post("/internal/v1/doctor-support/interpret", json=self.payload).status_code, 401)
        response = self.client.post(
            "/internal/v1/doctor-support/interpret",
            json=self.payload,
            headers={"X-Clinora-Internal-Token": "query-frame-test-secret"},
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["frame"]["frameStatus"], "INTERPRETED")
        self.assertNotIn("answer", body["frame"])
        self.assertNotIn("diagnosis", body["frame"])


if __name__ == "__main__":
    unittest.main()
