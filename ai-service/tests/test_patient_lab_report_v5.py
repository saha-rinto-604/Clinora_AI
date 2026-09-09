from copy import deepcopy
import json

import pytest

from app.clinical_evidence import evidence_class, support_level
from app.model_runtime import ModelGeneration, RuntimeMetadata
from app.prompts.patient_lab_report_v5 import build_messages, build_repair_messages, model_payload_from_cluster_output
from app.schemas.report_analysis import ReportAnalysisRequest
from app.services.clinical_cluster_grounding import sanitize_reasoning
from app.services.report_analysis_service import ReportAnalysisService, InvalidModelOutputError, UnsafeModelOutputError
from v5_cases import cases, candidate, cluster, metabolic_output, numeric, oid


class Runtime:
    metadata = RuntimeMetadata("synthetic-runtime", "test", "test")

    def __init__(self, *outputs):
        self.outputs = list(outputs)
        self.calls = []

    def generate(self, messages, allowed_observation_ids=None):
        self.calls.append(messages)
        result = self.outputs.pop(0)
        return json.dumps(result) if isinstance(result, dict) else result


def analyze(request, output):
    return ReportAnalysisService(Runtime(output)).analyze(request)


def test_multi_cluster_evidence_stays_with_its_own_process():
    result = analyze(cases()["B"], metabolic_output())
    assert len(result.clinicalClusters) == 2
    assert [{str(e.observationId) for e in c.evidence} for c in result.clinicalClusters] == [{oid(11), oid(12)}, {oid(13), oid(14)}]
    assert len(result.clinicalPatterns) == 2
    assert result.promptVersion == "patient-lab-report-v5"
    assert result.schemaVersion == "1.1"


def test_up_to_two_candidates_in_one_cluster_without_global_limit():
    output = metabolic_output()
    output["clusters"][0]["candidates"].append(candidate("Stress-related hyperglycemia", [11, 12], "A physiological stress response is another possibility to review."))
    result = analyze(cases()["B"], output)
    assert [len(c.candidates) for c in result.clinicalClusters] == [2, 1]
    assert len(result.clinicalPatterns) == 3


def test_pattern_only_without_forced_candidate():
    output = metabolic_output()
    output["clusters"][0]["candidates"] = []
    result = analyze(cases()["B"], output)
    assert len(result.clinicalClusters) == 2
    assert result.clinicalClusters[0].candidates == []
    assert "glycemic dysregulation" in result.clinicalClusters[0].interpretation


@pytest.mark.parametrize("invalid_id", [oid(99), oid(4)])
def test_unknown_or_normal_support_is_pruned_without_erasing_candidate(invalid_id):
    request = cases()["A"]
    raw = dict(clusters=[cluster("Infectious hematology pattern", [1, 2], "The positive NS1 Antigen and low Platelets warrant clinical correlation.", [
        candidate("Possible acute infection", [1, 2], "The positive NS1 Antigen provides specific infectious evidence.")])], overallInterpretation="An infectious process is possible.")
    c = raw["clusters"][0]
    c["evidence"].append(dict(observationId=invalid_id, role="SUPPORTS", clinicalRelevance="Eosinophils are high."))
    c["candidates"][0]["supportingObservationIds"].append(invalid_id)
    result = analyze(request, raw)
    assert len(result.clinicalClusters[0].candidates) == 1
    assert [str(x) for x in result.clinicalClusters[0].candidates[0].supportingObservationIds] == [oid(1), oid(2)]
    assert "Eosinophils are high" not in result.model_dump_json()
    if invalid_id == oid(99): assert invalid_id not in result.model_dump_json()
    else: assert result.clinicalClusters[0].evidence[-1].role == "CONTEXT"


def test_unknown_only_candidate_becomes_pattern_only_with_valid_cluster():
    output = metabolic_output()
    output["clusters"][0]["candidates"][0]["supportingObservationIds"] = [oid(999)]
    result = analyze(cases()["B"], output)
    assert len(result.clinicalClusters) == 2
    assert result.clinicalClusters[0].candidates == []
    assert oid(999) not in result.model_dump_json()


def test_unknown_only_cluster_disappears():
    raw = dict(clusters=[cluster("Unsupported grouping", [999], "An unrelated process may be present.", [candidate("Unsupported possibility", [999], "A process may be present.")])], overallInterpretation="Unsupported possibility may explain the report.")
    result = analyze(cases()["B"], raw)
    assert result.clinicalClusters == []
    assert "Unsupported possibility" not in result.model_dump_json()


def test_false_fact_removed_independent_reasoning_preserved():
    request = cases()["B"]
    normal = numeric(16, "Eosinophils", 2, 1, 6)
    request = ReportAnalysisRequest.model_validate({**request.model_dump(), "observations": [*request.observations, normal]})
    output = metabolic_output()
    output["clusters"][0]["interpretation"] = "Eosinophils are high. The glycemic findings may reflect sustained glucose exposure."
    output["clusters"][0]["candidates"][0]["rationale"] = "Eosinophils are high. The glycemic findings may reflect sustained glucose exposure."
    result = analyze(request, output)
    assert "Eosinophils are high" not in result.model_dump_json()
    assert result.clinicalClusters[0].candidates[0].rationale == "The glycemic findings may reflect sustained glucose exposure."
    assert "reduced TSH" in result.clinicalClusters[1].interpretation


def test_report_title_never_enters_reasoning_but_assay_label_does():
    request = cases()["A"]
    prompt = str(build_messages(request))
    assert "Dengue" not in prompt
    assert "NS1 Antigen" in prompt
    assert "Dengue" not in str(build_repair_messages(request, "BROKEN_JSON"))
    normal = cases()["C"].model_copy(update={"reportType": "Dengue profile"})
    raw = dict(clusters=[cluster("Infectious profile", [21], "The report title suggests infection.", [candidate("Dengue Fever", [21], "The report title names this condition.")])], overallInterpretation="Dengue Fever is possible.")
    result = analyze(normal, raw)
    assert not result.clinicalClusters
    assert "Dengue" not in result.model_dump_json()


def test_specific_positive_assay_can_support_candidate_without_count_threshold():
    request = cases()["A"]
    raw = dict(clusters=[cluster("Infectious assay pattern", [1], "The positive NS1 Antigen is clinically relevant infectious evidence.", [candidate("Possible acute infection", [1], "The positive NS1 Antigen provides specific infectious evidence.")])], overallInterpretation="An infectious process is possible.")
    result = analyze(request, raw)
    assert len(result.clinicalClusters[0].candidates) == 1
    assert result.clinicalClusters[0].candidates[0].supportLevel == "LIMITED"
    assert evidence_class(request.observations[0]) == "QUALITATIVE_POSITIVE"
    assert support_level(request.observations[:1]) == support_level(request.observations[:3]) == "LIMITED"


def test_general_report_three_groups_including_pattern_only():
    output = metabolic_output()
    output["clusters"].append(cluster("Albuminuria finding", [15], "The elevated Urine Microalbumin merits separate clinical context."))
    result = analyze(cases()["B"], output)
    assert [len(c.candidates) for c in result.clinicalClusters] == [1, 1, 0]


def test_normal_report_has_no_forced_pattern():
    result = analyze(cases()["C"], dict(clusters=[], overallInterpretation="No clear abnormal pattern is apparent."))
    assert result.analysisStatus == "NO_CLEAR_ABNORMAL_PATTERN"
    assert result.clinicalClusters == result.clinicalPatterns == []


def test_three_different_reports_preserve_materially_different_interpretations():
    inputs = cases()
    a = dict(clusters=[cluster("Infectious hematology pattern", [1, 2, 3], "The positive NS1 Antigen with low Platelets suggests an infectious hematology process.", [candidate("Possible acute infection", [1, 2], "The verified assay supports an infectious possibility.")])], overallInterpretation="An infectious hematology process requires correlation.")
    results = [analyze(inputs[k], raw) for k, raw in [("A", a), ("B", metabolic_output()), ("C", dict(clusters=[], overallInterpretation="No clear abnormal pattern is apparent."))]]
    assert [len(r.clinicalClusters) for r in results] == [1, 2, 0]
    assert len({r.patientExplanation for r in results}) == 3


def test_candidate_cannot_steal_support_from_another_cluster():
    output = metabolic_output()
    output["clusters"][0]["candidates"][0]["supportingObservationIds"].append(oid(13))
    result = analyze(cases()["B"], output)
    assert oid(13) not in [str(i) for i in result.clinicalClusters[0].candidates[0].supportingObservationIds]
    assert len(result.clinicalClusters[1].candidates) == 1


def test_duplicate_candidates_pruned_and_context_not_falsely_contradiction():
    output = metabolic_output()
    c = output["clusters"][0]
    c["candidates"].append(deepcopy(c["candidates"][0]))
    c["candidates"][0]["contradictoryObservationIds"] = [oid(12)]
    result = analyze(cases()["B"], output)
    assert len(result.clinicalClusters[0].candidates) == 1
    assert not result.clinicalClusters[0].candidates[0].contradictoryObservationIds


@pytest.mark.parametrize("wrong", ["TSH is high.", "TSH is 999.", "The patient has fatigue.", "The patient has fatigue, which may indicate a process.", "TSH is 0.05 ng/dL.", "Your history of thyroid disease supports this."])
def test_factual_claim_pruning_is_local(wrong):
    safe = "The reduced TSH contributes to a thyroid-hormone-excess pattern."
    assert sanitize_reasoning(cases()["B"], wrong + " " + safe) == safe


@pytest.mark.parametrize("unsafe", ["Start taking this medication.", "Start metformin.", "Take aspirin.", "The diagnosis is established.", "There is a 90% probability."])
def test_safety_rejects_even_text_on_unknown_evidence(unsafe):
    output = metabolic_output()
    output["clusters"][0]["evidence"].append(dict(observationId=oid(999), role="CONTEXT", clinicalRelevance=unsafe))
    with pytest.raises(UnsafeModelOutputError): analyze(cases()["B"], output)


def test_no_repair_of_truncated_cluster_output():
    runtime = Runtime(ModelGeneration(json.dumps(metabolic_output()), "length", 2048))
    with pytest.raises(InvalidModelOutputError, match="truncated"):
        ReportAnalysisService(runtime).analyze(cases()["B"])
    assert len(runtime.calls) == 1


def test_one_bounded_json_repair_preserves_full_clinical_rules():
    runtime = Runtime("not json", metabolic_output())
    result = ReportAnalysisService(runtime).analyze(cases()["B"])
    assert len(runtime.calls) == 2
    assert len(result.clinicalClusters) == 2
    assert "STEP 1" in str(runtime.calls[1])


def test_diagnostics_are_counts_only():
    _, diagnostics = model_payload_from_cluster_output(cases()["B"], metabolic_output())
    assert diagnostics["modelClusters"] == diagnostics["acceptedClusters"] == 2
    assert diagnostics["modelCandidates"] == diagnostics["acceptedCandidates"] == 2
    assert all(isinstance(value, int) for value in diagnostics.values())


def test_candidate_specific_contradiction_can_use_local_context_without_reassigning_support():
    request = cases()["A"]
    c = cluster("Infectious hematology pattern", [1, 2], "The positive NS1 Antigen supports an infectious pattern.", [
        candidate("Possible infection", [1, 2], "The verified assay may fit an infectious process.")])
    c["evidence"].append(dict(observationId=oid(4), role="CONTEXT", clinicalRelevance="The Eosinophils are within the supplied reference range."))
    c["candidates"][0]["contradictoryObservationIds"] = [oid(4)]
    result = analyze(request, dict(clusters=[c], overallInterpretation="An infectious pattern merits clinical correlation."))
    assert [str(i) for i in result.clinicalClusters[0].candidates[0].contradictoryObservationIds] == [oid(4)]


def test_all_unknown_observations_are_not_reassuringly_classified_normal():
    request = cases()["C"].model_copy(update={"observations": [cases()["C"].observations[0].model_copy(update={"referenceLow": None, "referenceHigh": None})]})
    result = analyze(request, dict(clusters=[], overallInterpretation="The patient is healthy."))
    assert result.analysisStatus == "INSUFFICIENT_EVIDENCE"
    assert "healthy" not in result.model_dump_json()


def test_six_candidates_can_survive_three_clusters_with_legacy_projection_bounded_to_five():
    output = metabolic_output()
    output["clusters"].append(cluster("Albuminuria pattern", [15], "Elevated Urine Microalbumin merits separate assessment.", [candidate("Possible albumin leakage", [15], "The finding may reflect altered albumin handling.")]))
    for index, c in enumerate(output["clusters"]):
        c["candidates"].append(candidate(f"Alternative physiological process {chr(65+index)}", [11 if index == 0 else 13 if index == 1 else 15], "A transient physiological explanation is another possibility."))
    result = analyze(cases()["B"], output)
    assert [len(c.candidates) for c in result.clinicalClusters] == [2, 2, 2]
    assert len(result.clinicalPatterns) == 5


def test_numeric_and_qualitative_facts_can_coexist_without_erasing_valid_relevance():
    item = numeric(31, "Specific assay", 5, 0, 1)
    item["textValue"] = "Positive"
    request = ReportAnalysisRequest.model_validate(dict(requestId=oid(131), reportType="Laboratory report", observations=[item]))
    assert sanitize_reasoning(request, "The positive Specific assay supports an infectious process.") == "The positive Specific assay supports an infectious process."
