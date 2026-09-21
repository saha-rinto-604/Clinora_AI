from __future__ import annotations

import json
from copy import deepcopy
from uuid import NAMESPACE_URL, uuid5

import pytest

from app.model_runtime import ModelGeneration, RuntimeMetadata
from app.schemas.doctor_support_execution import DoctorSupportExecutionRequest
from app.services.doctor_support_execution_service import DoctorSupportExecutionService


def uid(name: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"clinora-handle-grounding:{name}"))


def request() -> DoctorSupportExecutionRequest:
    report = uid("report")
    facts = [
        ("rbc", "RBC", 4.8, "10^12/L", 4.2, 5.8, "IN_RANGE"),
        ("mcv", "MCV", 68, "fL", 80, 100, "LOW"),
        ("mch", "MCH", 35, "pg", 27, 33, "HIGH"),
    ]
    observations = [{
        "observationId": uid(key), "reportId": report, "label": label, "canonicalCode": label,
        "valueType": "NUMERIC", "numericValue": value, "textValue": None, "comparator": None,
        "unit": unit, "referenceLow": low, "referenceHigh": high,
        "referenceRangeRaw": f"{low}-{high}", "authoritativeStatus": status,
        "verificationStatus": "DOCTOR_VERIFIED", "normalizedNumericValue": value,
        "normalizedUnit": unit.lower(), "comparisonKey": unit.lower(),
    } for key, label, value, unit, low, high, status in facts]
    return DoctorSupportExecutionRequest.model_validate({
        "executionId": uid("execution"),
        "originalQuestion": "Do these findings fit together?",
        "doctorAssessment": None,
        "doctorNotes": None,
        "appointmentContext": {},
        "evidenceSnapshot": {
            "snapshotHash": "a" * 64,
            "reports": [{
                "reportId": report, "reportType": "CBC", "clinicalDate": "2026-09-20",
                "dateReliability": "REPORT_DATE",
            }],
            "observations": observations,
            "comparisonFacts": [],
        },
        "tasks": [{
            "taskId": "CONNECT_EVIDENCE", "promptVersion": "doctor_connect_evidence_v2",
            "schemaVersion": "doctor-support-connect-v2", "ragPolicy": "DISABLED",
        }],
    })


class Runtime:
    metadata = RuntimeMetadata("medgemma", "test", "Q4_0")

    def __init__(self, output):
        self.output = output
        self.calls = 0

    def generate(self, *args, **kwargs):
        self.calls += 1
        return ModelGeneration(json.dumps(self.output), "stop", 50, 900)


def connect(reason="The referenced findings may be reviewed together.", limit="Cause is not established.", support=("E1", "E2")):
    return {
        "patterns": [{
            "pattern": "Red-cell pattern", "reason": reason,
            "support": list(support), "limit": limit, "refs": [],
        }],
    }


@pytest.mark.parametrize("output", [
    connect("The relationship should be interpreted against the normal reference range."),
    connect(limit="Normal interval wording does not reclassify either finding."),
    {
        "patterns": [
            {"pattern": "First", "reason": "Review MCV.", "support": ["E1", "E2"], "limit": "Cause is uncertain.", "refs": []},
            {"pattern": "Second", "reason": "HIGH context may warrant review.", "support": ["E2", "E3"], "limit": "Context is limited.", "refs": []},
        ],
    },
])
def test_valid_normal_or_neighboring_status_wording_passes_without_proximity_association(output):
    result = DoctorSupportExecutionService(Runtime(output)).execute(request()).taskResults[0]
    assert result.status == "SUCCEEDED"
    assert result.groundingStatus == "PASSED"


@pytest.mark.parametrize(("reason", "support", "code"), [
    ("E2 is HIGH.", ("E1", "E2"), "OBSERVATION_STATUS_CHANGED"),
    ("E2 is 91 fL.", ("E1", "E2"), "OBSERVATION_VALUE_CHANGED"),
    ("E1 is LOW.", ("E1", "E2"), "NORMAL_AS_ABNORMAL"),
])
def test_true_same_item_handle_fact_mutations_fail_safe(reason, support, code):
    runtime = Runtime(connect(reason, support=support))
    result = DoctorSupportExecutionService(runtime).execute(request()).taskResults[0]
    assert result.status == "FAILED_SAFE"
    assert result.safeFailureCode == code
    assert runtime.calls == 1


@pytest.mark.parametrize(("support", "code"), [
    (("E1", "E999"), "UNKNOWN_EVIDENCE_HANDLE"),
    (("E1", "00000000-0000-0000-0000-000000000099"), "UNAUTHORIZED_EVIDENCE_HANDLE"),
    (("E1", "E1"), "DUPLICATE_EVIDENCE_ID"),
])
def test_unknown_unauthorized_and_duplicate_handles_fail_safe(support, code):
    runtime = Runtime(connect(support=support))
    result = DoctorSupportExecutionService(runtime).execute(request()).taskResults[0]
    assert result.status == "FAILED_SAFE"
    assert result.safeFailureCode == code
    assert runtime.calls == 1


def test_model_label_synonym_is_not_evidence_identity_or_public_label_override():
    req = request()
    req.evidenceSnapshot.observations[1].label = "Mean Corpuscular Volume"
    result = DoctorSupportExecutionService(
        Runtime(connect("MCV may be reviewed with the other cited finding.", support=("E1", "E2")))
    ).execute(req).taskResults[0]
    assert result.status == "SUCCEEDED"
    assert result.groundingStatus == "PASSED"
    assert result.result.patterns[0].evidence[1].model_dump(mode="json") == {
        "observationId": uid("mcv"),
        "label": "Mean Corpuscular Volume",
    }


def test_compact_compatibility_uuid_and_model_label_are_normalized_through_trusted_handle():
    req = request()
    req.evidenceSnapshot.observations[1].label = "Mean Corpuscular Volume"
    output = {
        "taskId": "CONNECT_EVIDENCE",
        "summary": "Review together.",
        "patterns": [{
            "title": "Red-cell pattern",
            "relationship": "The model calls this MCV.",
            "evidence": [
                {"observationId": uid("rbc"), "label": "Model-controlled RBC label"},
                {"observationId": uid("mcv"), "label": "MCV"},
            ],
            "limitations": ["Cause is not established."],
            "referenceChunkIds": [],
        }],
        "limitations": [],
        "summaryReferenceChunkIds": [],
    }
    result = DoctorSupportExecutionService(Runtime(output)).execute(req).taskResults[0]
    assert result.status == "SUCCEEDED"
    assert [item.model_dump(mode="json") for item in result.result.patterns[0].evidence] == [
        {"observationId": uid("rbc"), "label": "RBC"},
        {"observationId": uid("mcv"), "label": "Mean Corpuscular Volume"},
    ]


def test_expanded_public_reference_is_revalidated_against_authoritative_snapshot():
    req = request()
    valid = DoctorSupportExecutionService(Runtime(connect())).execute(req).taskResults[0]
    assert valid.status == "SUCCEEDED"
    public = valid.result.model_dump(mode="json")
    public["patterns"][0]["evidence"][0]["label"] = "Wrong label"

    from app.schemas.doctor_support_execution import ConnectEvidenceResult
    from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError, validate_grounding

    with pytest.raises(UnsafeDoctorSupportOutputError) as raised:
        validate_grounding(ConnectEvidenceResult.model_validate(public), req.evidenceSnapshot)
    assert raised.value.reason_code == "OBSERVATION_LABEL_MISMATCH"


def test_public_result_contains_only_server_expanded_authorized_references():
    req = request()
    before = deepcopy(req.evidenceSnapshot.model_dump(mode="json"))
    result = DoctorSupportExecutionService(Runtime(connect())).execute(req).taskResults[0]
    references = result.result.model_dump(mode="json")["patterns"][0]["evidence"]
    assert references == [
        {"observationId": uid("rbc"), "label": "RBC"},
        {"observationId": uid("mcv"), "label": "MCV"},
    ]
    assert req.evidenceSnapshot.model_dump(mode="json") == before
