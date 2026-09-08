from copy import deepcopy
import json
import pytest
from app.clinical_evidence import support_eligibility, is_strong_evidence, authoritative_states
from app.prompts.patient_lab_report_v5 import _clinical_input, model_payload_from_cluster_output
from app.services.clinical_cluster_grounding import sanitize_reasoning
from test_patient_lab_report_v5 import analyze
from v5_cases import cases, candidate, cluster, metabolic_output, oid
from v51_cases import hematology, regression_output, claim


def test_exact_18_observation_runtime_regression():
    request = hematology()
    result = analyze(request, regression_output())
    assert len(result.clinicalClusters) == 1
    c = result.clinicalClusters[0]
    assert c.candidates == []
    assert c.title == c.displayTitle == "PDW + Hemoglobin + Platelets pattern"
    assert c.evidence[0].role == "SUPPORTS"
    assert c.evidence[0].supportEligibility == "VERIFIED_ABNORMAL"
    assert len(c.evidence) == 18
    assert all(e.role == "CONTEXT" and e.supportEligibility == "UNKNOWN" for e in c.evidence[1:])
    text = result.model_dump_json().lower()
    for wrong in ("anemia", "thrombocytopenia", "mds", "iron deficiency", "strong possibility"):
        assert wrong not in text
    assert "hematology findings warrant review together" in c.interpretation
    assert "variation in platelet size" in text
    _, diagnostics = model_payload_from_cluster_output(request, regression_output())
    assert diagnostics["unknown_context_count"] == 17
    assert diagnostics["support_to_context_reclassification_count"] == 17
    assert diagnostics["unknown_support_pruned_count"] == 17
    assert diagnostics["downgraded_candidate_count"] == 1


def test_complete_unknown_context_is_retained_in_prompt_without_invented_ranges():
    source = json.loads(_clinical_input(hematology()))
    assert len(source["observations"]) == 18
    context = next(o for o in source["observations"] if o["observationId"] == oid(52))
    assert context["numericValue"] == "8.2"
    assert context["supportEligibility"] == "UNKNOWN"
    assert "referenceLow" not in context


def test_candidate_recomputed_from_independent_surviving_reasoning_claim():
    request = hematology()
    raw = regression_output()
    c = raw["clusters"][0]
    c["candidates"] = [candidate("Possible platelet size variation", [51, 52], "unused")]
    c["candidates"][0]["rationaleClaims"] = [
        claim("The low Hemoglobin may fit a marrow process.", [(52, "LOW")]),
        claim("The high PDW may reflect variation in platelet size.", [(51, "HIGH")]),
    ]
    result = analyze(request, raw)
    accepted = result.clinicalClusters[0].candidates[0]
    assert [str(i) for i in accepted.supportingObservationIds] == [oid(51)]
    assert accepted.rationale == "The high PDW may reflect variation in platelet size."


def test_unknown_premise_cannot_be_laundered_by_one_valid_support_id():
    raw = regression_output()
    raw["clusters"][0]["candidates"][0]["rationaleClaims"] = [
        claim("A marrow disorder may fit this pattern.", [(51, "HIGH"), (52, "UNKNOWN")])]
    result = analyze(hematology(), raw)
    assert result.clinicalClusters[0].candidates == []


def test_unknown_only_cluster_can_retain_useful_context_without_candidate():
    raw = regression_output()
    c = raw["clusters"][0]
    c["evidence"] = c["evidence"][1:]
    c["candidates"][0]["supportingObservationIds"] = [oid(52), oid(53)]
    c["interpretationClaims"] = [claim(
        "These hematology measurements need review together because report-specific range status is unavailable.",
        [(52, "UNKNOWN"), (53, "UNKNOWN")], "LIMITATION")]
    result = analyze(hematology(), raw)
    assert len(result.clinicalClusters) == 1
    assert not result.clinicalClusters[0].candidates
    assert "hematology measurements need review together" in result.clinicalClusters[0].interpretation


@pytest.mark.parametrize("false_text", ["Hemoglobin is low.", "The low Hemoglobin suggests a process.", "Platelets are normal.", "Platelets are abnormal."])
def test_unknown_factual_claim_removed_locally(false_text):
    valid = "The high PDW reflects platelet size variation."
    assert sanitize_reasoning(hematology(), false_text + " " + valid) == valid


def test_rejected_hypothesis_removed_from_all_non_candidate_channels():
    raw = metabolic_output()
    c = raw["clusters"][0]
    c["title"] = "Unverified condition Z"
    c["candidates"][0]["name"] = "Unverified condition Z"
    c["candidates"][0]["supportingObservationIds"] = [oid(999)]
    c["interpretation"] = "Unverified condition Z could fit. The elevated HbA1c reflects sustained glucose exposure."
    c["evidence"][0]["clinicalRelevance"] = "Unverified condition Z is possible."
    c["alternatives"] = ["Unverified condition Z"]
    result = analyze(cases()["B"], raw)
    assert "Unverified condition Z" not in result.model_dump_json()
    assert "sustained glucose exposure" in result.clinicalClusters[0].interpretation
    assert len(result.clinicalClusters[1].candidates) == 1


@pytest.mark.parametrize("certainty", ["strong possibility", "highly likely", "very likely", "most likely"])
def test_qualitative_certainty_is_bounded_without_erasing_reasoning(certainty):
    raw = metabolic_output()
    raw["clusters"][0]["candidates"][0]["rationale"] = f"This is a {certainty} given sustained glucose exposure."
    result = analyze(cases()["B"], raw)
    assert certainty not in result.model_dump_json()
    assert "sustained glucose exposure" in result.clinicalClusters[0].candidates[0].rationale


def test_two_structured_independent_clusters_and_two_candidates_survive():
    raw = metabolic_output()
    for c, premises in zip(raw["clusters"], [[(11, "HIGH"), (12, "HIGH")], [(13, "LOW"), (14, "HIGH")]]):
        c["interpretationClaims"] = [claim(c["interpretation"], premises)]
        c["candidates"][0]["rationaleClaims"] = [claim(c["candidates"][0]["rationale"], premises)]
    other = deepcopy(raw["clusters"][0]["candidates"][0])
    other["name"] = "Possible sustained glucose exposure"
    raw["clusters"][0]["candidates"].append(other)
    result = analyze(cases()["B"], raw)
    assert [len(c.candidates) for c in result.clinicalClusters] == [2, 1]
    assert "reduced TSH" in result.clinicalClusters[1].interpretation


def test_qualitative_assay_and_unknown_context_preserve_specific_reasoning():
    request = cases()["A"].model_copy(update={"observations": [cases()["A"].observations[0], hematology().observations[1]]})
    c = cluster("Infectious assay findings", [1, 52], "The positive NS1 Antigen merits infectious clinical correlation.", [candidate("Possible dengue infection", [1, 52], "The positive NS1 Antigen may fit this infectious possibility.")])
    result = analyze(request, dict(clusters=[c], overallInterpretation="An infectious process may fit."))
    assert len(result.clinicalClusters[0].candidates) == 1
    assert result.clinicalClusters[0].evidence[0].supportEligibility == "VERIFIED_QUALITATIVE_POSITIVE"
    assert result.clinicalClusters[0].evidence[1].role == "CONTEXT"


def test_unnamed_hypothesis_cannot_bypass_candidate_channel():
    raw = metabolic_output()
    c = raw["clusters"][0]
    c["candidates"] = []
    c["interpretationClaims"] = [claim("The elevated HbA1c may indicate a process, potentially Unnamed condition Z.", [(11, "HIGH")])]
    result = analyze(cases()["B"], raw)
    assert "Unnamed condition Z" not in result.model_dump_json()
    assert len(result.clinicalClusters) == 2
    assert len(result.clinicalClusters[1].candidates) == 1


def test_unclassified_abbreviation_spelled_out_cannot_be_an_abnormal_premise():
    assert sanitize_reasoning(hematology(), "High PDW suggests increased red blood cell variability.") == ""


def test_verified_test_initials_preserve_valid_direction_and_reject_wrong_direction():
    request = cases()["A"]
    valid = "Low WBC count may fit an infectious process."
    assert sanitize_reasoning(request, valid) == valid
    assert sanitize_reasoning(request, "High WBC count may fit an infectious process.") == ""


def test_omitted_unknown_ids_are_recovered_as_context_without_inventing_support():
    raw = regression_output()
    c = raw["clusters"][0]
    c["evidence"] = c["evidence"][:1]
    c["interpretation"] = "Low Hemoglobin and low Platelets suggest a marrow disorder."
    c["candidates"][0]["supportingObservationIds"] = [oid(51)]
    c["evidence"][0]["clinicalRelevance"] = "High PDW suggests increased red blood cell variability."
    result = analyze(hematology(), raw)
    assert len(result.clinicalClusters) == 1
    group = result.clinicalClusters[0]
    assert not group.candidates
    assert {str(e.observationId) for e in group.evidence if e.role == "CONTEXT"} == {oid(52), oid(53)}
    assert "reference information limits" in group.interpretation
    assert "marrow disorder" not in result.model_dump_json()


def test_repeated_identical_groups_merge_without_collapsing_independent_clusters():
    raw = metabolic_output()
    repeated = deepcopy(raw["clusters"][0])
    repeated["candidates"][0]["name"] = "Another glycemic process"
    raw["clusters"].insert(1, repeated)
    result = analyze(cases()["B"], raw)
    assert [len(c.candidates) for c in result.clinicalClusters] == [2, 1]


def test_rejected_candidate_declared_abbreviation_cannot_leak_into_pattern():
    raw = metabolic_output()
    c = raw["clusters"][0]
    c["candidates"][0]["name"] = "Unverified process (UPX)"
    c["candidates"][0]["supportingObservationIds"] = [oid(999)]
    c["interpretation"] = "UPX warrants consideration. The elevated HbA1c reflects sustained glucose exposure."
    result = analyze(cases()["B"], raw)
    assert "UPX" not in result.model_dump_json()
    assert "sustained glucose exposure" in result.clinicalClusters[0].interpretation


def test_rationale_cannot_borrow_uncited_support_from_another_cluster():
    raw = metabolic_output()
    raw["clusters"][0]["candidates"][0]["rationale"] = "The reduced TSH supports this possibility. The elevated HbA1c reflects sustained glucose exposure."
    result = analyze(cases()["B"], raw)
    assert result.clinicalClusters[0].candidates[0].rationale == "The elevated HbA1c reflects sustained glucose exposure."
    assert len(result.clinicalClusters[1].candidates) == 1


def test_candidate_with_unusable_missing_context_downgrades_but_valid_size_reasoning_survives():
    raw = regression_output()
    c = raw["clusters"][0]
    c["title"] = "Cell morphology and Size"
    c["evidence"][0]["clinicalRelevance"] = "The high PDW indicates variation in platelet size."
    c["candidates"] = [candidate("Unverified marrow process", [51], "Elevated PDW may fit this marrow process.")]
    c["candidates"][0]["missingEvidence"] = ["Clinical context is needed to confirm or refute this"]
    result = analyze(hematology(), raw)
    assert not result.clinicalClusters[0].candidates
    assert "variation in platelet size" in result.model_dump_json()


def test_missing_context_can_mention_an_unclassified_test_without_asserting_abnormality():
    text = "Clinical history and repeat Hemoglobin assessment"
    assert sanitize_reasoning(hematology(), text, missing_context=True) == text


def test_grounded_assay_candidate_survives_rejected_pattern_prose():
    c = cluster("Possible infection", [1], "Possible infection may fit.", [
        candidate("Possible infection", [1], "The positive NS1 Antigen may fit an infectious process.")])
    c["evidence"][0]["clinicalRelevance"] = "Possible infection may fit."
    result = analyze(cases()["A"], dict(clusters=[c], overallInterpretation="Possible infection."))
    assert len(result.clinicalClusters) == 1
    assert len(result.clinicalClusters[0].candidates) == 1
    assert "positive NS1 Antigen" in result.clinicalClusters[0].candidates[0].rationale
    assert "Possible infection" not in result.clinicalClusters[0].interpretation


def test_wrong_label_id_pair_pruned_locally_without_rebinding():
    raw = metabolic_output()
    raw["clusters"][0]["evidence"][0]["observationLabel"] = "TSH"
    result = analyze(cases()["B"], raw)
    assert len(result.clinicalClusters) == 2
    group = result.clinicalClusters[0]
    assert oid(11) not in {str(e.observationId) for e in group.evidence}
    assert [str(i) for i in group.candidates[0].supportingObservationIds] == [oid(12)]
    assert len(result.clinicalClusters[1].candidates) == 1


def test_generation_binds_verified_labels_ids_and_support_roles():
    from app.model_runtime import _llama_response_schema
    request = cases()["A"].model_copy(update={"observations": cases()["A"].observations + [hematology().observations[1]]})
    facts = {str(o.observationId): o for o in request.observations}
    schema = _llama_response_schema(facts)
    branches = schema["$defs"]["ModelClusterEvidence"]["oneOf"]
    for branch in branches:
        props = branch["properties"]
        observation = facts[props["observationId"]["const"]]
        assert props["observationLabel"]["const"] == observation.label
        assert ("SUPPORTS" in props["role"]["enum"]) == is_strong_evidence(observation)
    eligible = schema["$defs"]["ModelClusterCandidate"]["properties"]["supportingObservationIds"]["items"]["enum"]
    assert oid(1) in eligible
    assert oid(4) not in eligible and oid(52) not in eligible
    assert schema["$defs"]["ModelClinicalCluster"]["properties"]["evidence"]["maxItems"] == 6


def test_model_withdrawn_candidate_does_not_suppress_independent_candidate():
    raw = metabolic_output()
    withdrawn = deepcopy(raw["clusters"][1]["candidates"][0])
    withdrawn["name"] = "Proposed process X"
    withdrawn["rationale"] = "The elevated Free T4 contradicts this, suggesting another process instead."
    raw["clusters"][1]["candidates"].insert(0, withdrawn)
    result = analyze(cases()["B"], raw)
    assert [len(c.candidates) for c in result.clinicalClusters] == [1, 1]
    assert "Proposed process X" not in result.model_dump_json()


def test_combined_hypothesis_object_pruned_without_hiding_independent_process():
    raw = metabolic_output()
    c = raw["clusters"][0]
    c["candidates"][0]["name"] = "Proposed process X / Proposed process Y"
    c["interpretation"] = "Proposed process Y could fit. The elevated HbA1c reflects sustained glucose exposure."
    result = analyze(cases()["B"], raw)
    assert not result.clinicalClusters[0].candidates
    assert "Proposed process" not in result.model_dump_json()
    assert len(result.clinicalClusters[1].candidates) == 1


def test_test_label_is_not_a_condition_candidate():
    raw = metabolic_output()
    raw["clusters"][0]["candidates"][0]["name"] = "HbA1c"
    result = analyze(cases()["B"], raw)
    assert not result.clinicalClusters[0].candidates
    assert len(result.clinicalClusters[1].candidates) == 1


def test_role_only_relevance_cannot_become_patient_interpretation():
    raw = regression_output()
    raw["clusters"][0]["interpretation"] = "Low Hemoglobin suggests an unverified process."
    for e in raw["clusters"][0]["evidence"]:
        e["clinicalRelevance"] = "Context"
    result = analyze(hematology(), raw)
    assert result.clinicalClusters[0].candidates == []
    assert "reference information limits" in result.patientExplanation
    assert result.patientExplanation != "Context Context"
    assert len(result.clinicalClusters[0].evidence) == 18


@pytest.mark.parametrize("prefix", ["high ", "high levels of "])
def test_shared_direction_list_cannot_hide_a_wrong_later_finding(prefix):
    wrong = "The report contains " + prefix + "Estimated Average Glucose, Free T4, HbA1c, TSH, and Urine Microalbumin."
    valid = "The reduced TSH and elevated Free T4 form a related pattern."
    assert sanitize_reasoning(cases()["B"], wrong + " " + valid) == valid


def test_explicit_mixed_directions_do_not_bleed_across_list():
    text = "High HbA1c and low TSH require separate clinical correlation."
    assert sanitize_reasoning(cases()["B"], text) == text


def test_verified_patient_test_assertion_preserves_actual_assay_reasoning():
    text = "The patient has a verified positive NS1 Antigen test, which may fit an infectious process."
    assert sanitize_reasoning(cases()["A"], text) == text
    assert sanitize_reasoning(cases()["A"], "The patient has verified fever.") == ""


def test_plural_count_alias_does_not_confuse_size_with_unclassified_count():
    assert sanitize_reasoning(hematology(), "The platelet count is low.") == ""
    text = "The high PDW reflects variation in platelet size."
    assert sanitize_reasoning(hematology(), text) == text


def test_or_joined_candidates_and_their_pattern_alternatives_are_pruned_locally():
    raw = metabolic_output()
    c = raw["clusters"][0]
    c["candidates"][0]["name"] = "Proposed process X or Proposed process Y"
    c["interpretation"] = "Proposed process X may fit. The elevated HbA1c reflects sustained glucose exposure."
    c["alternatives"] = ["Unverified alternative Z"]
    result = analyze(cases()["B"], raw)
    assert not result.clinicalClusters[0].candidates
    assert not result.clinicalClusters[0].alternatives
    assert "Proposed process" not in result.model_dump_json()
    assert len(result.clinicalClusters[1].candidates) == 1


def test_internal_support_metadata_is_not_patient_reasoning():
    text = "This is supported by VERIFIED_ABNORMAL status. The high PDW reflects variation in platelet size."
    assert sanitize_reasoning(hematology(), text) == "The high PDW reflects variation in platelet size."


def test_verified_status_cannot_be_relabelled_unknown_to_rescue_candidate():
    raw = regression_output()
    c = raw["clusters"][0]
    c["candidates"] = [candidate("Unverified process", [51], "The elevated PDW may fit a platelet process.")]
    c["candidates"][0]["missingEvidence"] = ["PDW is unclassified"]
    result = analyze(hematology(), raw)
    assert not result.clinicalClusters[0].candidates
    assert "PDW is unclassified" not in result.model_dump_json()
    assert "variation in platelet size" in result.model_dump_json()


def test_incomplete_list_is_not_candidate_missing_information():
    assert sanitize_reasoning(cases()["B"], "The high levels of HbA1c,", missing_context=True) == ""
