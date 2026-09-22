from __future__ import annotations

import json
from copy import deepcopy
from types import MappingProxyType
from uuid import NAMESPACE_URL, uuid5

import pytest
from pydantic import ValidationError

from app.model_runtime import ModelGeneration, RuntimeMetadata
from app.schemas.doctor_support_execution import DoctorSupportExecutionRequest
from app.services.doctor_support_execution_service import DoctorSupportExecutionService
from app.services.doctor_support_inference_contract import DoctorSupportInferenceContract


def uid(name: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"clinora-23-observation-contract:{name}"))


def browser_request(task="CONNECT_EVIDENCE") -> DoctorSupportExecutionRequest:
    report_ids = [uid("report-1"), uid("report-2")]
    labels = [
        "Hemoglobin", "RBC", "Hematocrit", "MCV", "MCH", "MCHC", "RDW", "WBC",
        "Neutrophils", "Lymphocytes", "Monocytes", "Eosinophils", "Basophils",
        "Platelet Count", "MPV", "Creatinine", "Urea", "Sodium", "Potassium",
        "ALT", "AST", "Total Bilirubin", "Albumin",
    ]
    observations = []
    for index, label in enumerate(labels, start=1):
        value = round(6.5 + index * 0.7, 1)
        low, high = round(value - 1.0, 1), round(value + 1.0, 1)
        status = "LOW" if index in {4, 5} else "HIGH" if index in {2, 14} else "IN_RANGE"
        observations.append({
            "observationId": uid(f"observation-{index}"),
            "reportId": report_ids[0 if index <= 12 else 1],
            "label": label, "canonicalCode": label.upper().replace(" ", "_"),
            "valueType": "NUMERIC", "numericValue": value, "textValue": None,
            "comparator": None, "unit": "unit", "referenceLow": low, "referenceHigh": high,
            "referenceRangeRaw": f"{low}-{high}", "authoritativeStatus": status,
            "verificationStatus": "DOCTOR_VERIFIED", "normalizedNumericValue": value,
            "normalizedUnit": "unit", "comparisonKey": "unit",
        })
    versions = {
        "CONNECT_EVIDENCE": ("doctor_connect_evidence_v2", "doctor-support-connect-v2"),
        "FOCUSED_EVIDENCE_QUESTION": ("doctor_focused_evidence_question_v1", "doctor-support-focused-question-v1"),
        "EXPLORE_EXPLANATIONS": ("doctor_explore_explanations_v2", "doctor-support-explore-v2"),
        "FIND_GAPS": ("doctor_find_gaps_v2", "doctor-support-gaps-v2"),
        "CROSS_CHECK_ASSESSMENT": ("doctor_cross_check_assessment_v3", "doctor-support-cross-check-v3"),
    }
    prompt, schema = versions[task]
    return DoctorSupportExecutionRequest.model_validate({
        "executionId": uid(f"execution-{task}"),
        "originalQuestion": "Do these findings fit together?",
        "doctorAssessment": "A red-cell pattern is being considered." if task == "CROSS_CHECK_ASSESSMENT" else None,
        "doctorNotes": None,
        "appointmentContext": {},
        "evidenceSnapshot": {
            "snapshotHash": "b" * 64,
            "reports": [
                {"reportId": report_ids[0], "reportType": "CBC", "clinicalDate": "2026-09-01", "dateReliability": "REPORT_DATE"},
                {"reportId": report_ids[1], "reportType": "CHEMISTRY", "clinicalDate": "2026-09-20", "dateReliability": "REPORT_DATE"},
            ],
            "observations": observations,
            "comparisonFacts": [],
        },
        "tasks": [{"taskId": task, "promptVersion": prompt, "schemaVersion": schema, "ragPolicy": "DISABLED"}],
    })


class Runtime:
    metadata = RuntimeMetadata("medgemma", "test", "Q4_0")

    def __init__(self, output):
        self.output = output
        self.calls = []

    def generate(self, messages, allowed_observation_ids=None, response_schema=None, max_tokens=None):
        self.calls.append((messages, response_schema, max_tokens))
        return ModelGeneration(json.dumps(self.output), "stop", 55, 1200)


def output(task):
    if task == "CONNECT_EVIDENCE":
        return {"patterns": [{"pattern": "Red-cell pattern", "reason": "The referenced findings may fit together.", "support": ["E2", "E4", "E5"], "limit": "Cause is not established.", "refs": []}]}
    if task == "FOCUSED_EVIDENCE_QUESTION":
        return {"answer": "The referenced findings provide the narrow evidence requested.", "support": ["E4"], "refs": [], "limits": []}
    if task == "EXPLORE_EXPLANATIONS":
        return {"explanations": [{"cluster": "Red-cell pattern", "name": "Possible red-cell explanation", "reason": "The referenced pattern could fit this possibility.", "support": ["E4", "E5"], "limiting": ["E2"], "missing": ["Relevant clinical context"], "refs": []}], "limits": []}
    if task == "FIND_GAPS":
        return {"gaps": [{"gap": "Relevant clinical context", "reason": "This could help distinguish explanations.", "related": ["E4", "E5"], "refs": []}], "limits": []}
    return {"fit": "MIXED_OR_LIMITED_EVIDENCE", "points": [{"reason": "The referenced evidence provides limited support.", "relation": "SUPPORTS", "evidence": ["E4", "E5"], "refs": []}], "missing": ["Relevant clinical context"], "alternatives": [], "limits": []}


def test_23_observation_pack_preserves_all_authorized_evidence_and_is_reversible():
    req = browser_request()
    before = deepcopy(req.evidenceSnapshot.model_dump(mode="json"))
    contract = DoctorSupportInferenceContract(req, "CONNECT_EVIDENCE")
    pack = json.loads(contract.model_evidence_pack.render())

    assert len(contract.authorized_evidence_set.snapshot.observations) == 23
    assert len(contract.authoritative_grounding_snapshot.snapshot.observations) == 23
    assert len(contract.authoritative_grounding_snapshot.observations_by_handle) == 23
    assert len(pack["evidence"]) == 23
    assert len(pack["reports"]) == 2
    assert [row[0] for row in pack["evidence"]] == [f"E{index}" for index in range(1, 24)]
    assert all(row[1] in {"R1", "R2"} for row in pack["evidence"])
    assert not any(str(item.observationId) in contract.model_evidence_pack.render() for item in req.evidenceSnapshot.observations)
    assert not any(str(item.reportId) in contract.model_evidence_pack.render() for item in req.evidenceSnapshot.reports)
    assert req.evidenceSnapshot.model_dump(mode="json") == before

    # The compact-all-evidence representation is materially smaller even before
    # chat-template tokenization; no relevance pruning is involved.
    legacy = json.dumps(before, separators=(",", ":"), sort_keys=True)
    assert len(contract.model_evidence_pack.render()) < len(legacy) * 0.35


def test_authorized_medgemma_snapshot_is_advisory_handle_only_context():
    request = browser_request("EXPLORE_EXPLANATIONS")
    payload = request.model_dump(mode="json")
    payload["reasoningSnapshots"] = [{
        "snapshotId": uid("snapshot-1"),
        "reportId": uid("report-1"),
        "evidenceVersion": "c" * 64,
        "modelVersion": "google/medgemma-1.5-4b-it@main",
        "promptVersion": "patient-lab-report-v5",
        "schemaVersion": "1.1",
        "status": "READY",
        "patterns": [{
            "concept": "microcytic red-cell pattern",
            "support": [uid("observation-4"), uid("observation-5")],
            "against": [],
        }],
        "possibilities": [{
            "concept": "possible trait pattern",
            "support": [uid("observation-4")],
            "against": [uid("observation-2")],
            "missing": ["iron studies"],
        }],
        "gaps": ["iron studies"],
        "generatedAt": "2026-09-21T00:00:00Z",
    }]
    validated = DoctorSupportExecutionRequest.model_validate(payload)
    rendered = DoctorSupportInferenceContract(validated, "EXPLORE_EXPLANATIONS").model_evidence_pack.render()
    pack = json.loads(rendered)

    assert pack["advisorySnapshots"] == [{
        "report": "R1",
        "patterns": [{"concept": "microcytic red-cell pattern", "support": ["E4", "E5"], "against": []}],
        "possibilities": [{
            "concept": "possible trait pattern", "support": ["E4"], "against": ["E2"],
            "missing": ["iron studies"],
        }],
        "gaps": ["iron studies"],
    }]
    assert uid("snapshot-1") not in rendered
    assert uid("report-1") not in rendered
    assert uid("observation-4") not in rendered


def test_snapshot_from_unshared_report_is_rejected_before_generation():
    payload = browser_request().model_dump(mode="json")
    payload["reasoningSnapshots"] = [{
        "snapshotId": uid("snapshot-hidden"),
        "reportId": uid("report-hidden"),
        "evidenceVersion": "d" * 64,
        "modelVersion": "medgemma@main",
        "promptVersion": "patient-lab-report-v5",
        "schemaVersion": "1.1",
        "status": "READY",
        "patterns": [], "possibilities": [], "gaps": [],
        "generatedAt": "2026-09-21T00:00:00Z",
    }]
    with pytest.raises(ValidationError):
        DoctorSupportExecutionRequest.model_validate(payload)


@pytest.mark.parametrize("task", [
    "CONNECT_EVIDENCE", "FOCUSED_EVIDENCE_QUESTION", "EXPLORE_EXPLANATIONS",
    "FIND_GAPS", "CROSS_CHECK_ASSESSMENT",
])
def test_five_reasoning_tasks_share_pack_and_expand_to_unchanged_public_contract(task):
    req = browser_request(task)
    runtime = Runtime(output(task))
    result = DoctorSupportExecutionService(runtime).execute(req).taskResults[0]

    assert result.status == "SUCCEEDED" and result.groundingStatus == "PASSED"
    assert result.result.taskId == task
    prompt = runtime.calls[0][0][1]["content"]
    assert prompt.count("<AUTHORIZED_EVIDENCE_PACK>") == 1
    assert '"E23"' in prompt and uid("observation-23") not in prompt
    assert "snapshotHash" not in prompt and "verificationStatus" not in prompt
    assert "<UNTRUSTED_DOCTOR_NOTES>" not in prompt
    if task != "CROSS_CHECK_ASSESSMENT":
        assert "<UNTRUSTED_DOCTOR_ASSESSMENT>" not in prompt
    if task == "EXPLORE_EXPLANATIONS":
        assert result.result.explanations[0].clinicalCluster == "Red-cell pattern"


def test_23_observation_connect_expands_handles_to_exact_trusted_public_references():
    req = browser_request()
    result = DoctorSupportExecutionService(Runtime(output("CONNECT_EVIDENCE"))).execute(req).taskResults[0]
    refs = result.result.model_dump(mode="json")["patterns"][0]["evidence"]
    assert refs == [
        {"observationId": uid("observation-2"), "label": "RBC"},
        {"observationId": uid("observation-4"), "label": "MCV"},
        {"observationId": uid("observation-5"), "label": "MCH"},
    ]


@pytest.mark.parametrize("task", [
    "CONNECT_EVIDENCE", "FOCUSED_EVIDENCE_QUESTION", "EXPLORE_EXPLANATIONS",
    "FIND_GAPS", "CROSS_CHECK_ASSESSMENT",
])
def test_compact_schemas_contain_no_model_owned_evidence_labels(task):
    contract = DoctorSupportInferenceContract(browser_request(task), task)
    schema = json.dumps(contract.response_schema({}, []), separators=(",", ":"))
    for forbidden in ("observationLabel", "displayLabel", "evidenceLabel", '"label"'):
        assert forbidden not in schema


def test_connect_schema_is_bounded_for_small_completion():
    contract = DoctorSupportInferenceContract(browser_request(), "CONNECT_EVIDENCE")
    schema = json.dumps(contract.response_schema({}, []), separators=(",", ":"))
    assert '"maxItems":2' in schema
    assert '"maxItems":8' in schema
    assert '"maxLength":96' in schema
    assert '"maxLength":240' in schema
    assert '"maxLength":160' in schema


@pytest.mark.parametrize("task", ["EXPLORE_EXPLANATIONS", "FIND_GAPS"])
def test_reference_backed_explanations_and_gaps_require_a_citation_handle(task):
    contract = DoctorSupportInferenceContract(browser_request(task), task)
    schema = json.dumps(contract.response_schema({}, ["C1"]), separators=(",", ":"))
    assert '"enum":["C1"]' in schema
    assert '"minItems":1' in schema


def test_two_concise_connect_patterns_complete_with_256_token_budget():
    compact = {
        "patterns": [
            {
                "pattern": "Microcytic red-cell pattern",
                "reason": "Low red-cell indices occur together.",
                "support": ["E2", "E4", "E5"],
                "limit": "Cause is not established.",
                "refs": [],
            },
            {
                "pattern": "Platelet pattern",
                "reason": "The platelet findings occur together.",
                "support": ["E14", "E15"],
                "limit": "Clinical significance is not established.",
                "refs": [],
            },
        ],
    }
    runtime = Runtime(compact)
    result = DoctorSupportExecutionService(runtime).execute(browser_request()).taskResults[0]
    assert result.status == "SUCCEEDED"
    assert runtime.calls[0][2] == 256


def test_compact_compatibility_fails_safe_if_uuid_to_handle_map_is_corrupted():
    contract = DoctorSupportInferenceContract(browser_request(), "CONNECT_EVIDENCE")
    first_id = uid("observation-1")
    contract.observation_ids[first_id] = "E2"
    payload = {
        "taskId": "CONNECT_EVIDENCE",
        "summary": "Review together.",
        "patterns": [{
            "title": "Pattern",
            "relationship": "Review together.",
            "evidence": [{"observationId": first_id, "label": "arbitrary"}],
            "limitations": [],
            "referenceChunkIds": [],
        }],
        "limitations": [],
        "summaryReferenceChunkIds": [],
    }
    from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError

    with pytest.raises(UnsafeDoctorSupportOutputError) as raised:
        contract.parse_and_expand(payload)
    assert raised.value.reason_code == "EVIDENCE_HANDLE_MAPPING_MISMATCH"


def test_e2_mapped_to_observation_outside_authorized_snapshot_fails_safe():
    contract = DoctorSupportInferenceContract(browser_request(), "CONNECT_EVIDENCE")
    observations = dict(contract.authoritative_grounding_snapshot.observations_by_handle)
    observations["E2"] = observations["E2"].model_copy(update={"observationId": uid("unauthorized")})
    object.__setattr__(
        contract.authoritative_grounding_snapshot,
        "observations_by_handle",
        MappingProxyType(observations),
    )
    from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError

    with pytest.raises(UnsafeDoctorSupportOutputError) as raised:
        contract._reference("E2")
    assert raised.value.reason_code == "UNAUTHORIZED_EVIDENCE_HANDLE"
