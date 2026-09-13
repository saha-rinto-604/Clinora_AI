from test_patient_lab_report_v5 import analyze
from v5_cases import candidate, cases, cluster, metabolic_output


def test_grounded_candidate_survives_empty_optional_enrichment_arrays():
    request = cases()["B"]
    c = cluster(
        "Glycemic process",
        [11, 12],
        "The elevated HbA1c and elevated Estimated Average Glucose reflect a related glycemic pattern.",
        [candidate(
            "Persistent hyperglycemia",
            [11, 12],
            "The related glycemic findings may reflect sustained glucose exposure.",
        )],
    )
    c["candidates"][0]["missingEvidence"] = []
    c["candidates"][0]["alternatives"] = []
    result = analyze(request, {"clusters": [c], "overallInterpretation": "A related glycemic process may be present."})
    assert len(result.clinicalClusters) == 1
    assert len(result.clinicalClusters[0].candidates) == 1
    accepted = result.clinicalClusters[0].candidates[0]
    assert accepted.missingEvidence == []
    assert accepted.alternatives == []


def test_unsupported_complication_assertions_are_removed_without_losing_candidate():
    request = cases()["B"]
    raw = metabolic_output()
    item = raw["clusters"][0]["candidates"][0]
    item["rationale"] = (
        "The elevated HbA1c and Estimated Average Glucose may fit Persistent hyperglycemia, "
        "particularly nephropathy and retinopathy, although retinopathy is not directly assessed."
    )
    item["name"] = "Persistent hyperglycemia"
    raw["clusters"][0]["evidence"][0]["clinicalRelevance"] = (
        "This indicates kidney damage, a complication not directly measured by this observation."
    )

    result = analyze(request, raw)

    accepted = result.clinicalClusters[0].candidates[0]
    assert accepted.name == "Persistent hyperglycemia"
    assert "nephropathy" not in result.model_dump_json().lower()
    assert "retinopathy" not in result.model_dump_json().lower()
    assert "kidney damage" not in result.model_dump_json().lower()
