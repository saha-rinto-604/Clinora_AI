"""Synthetic R5.1 regressions; no real patient data or production associations."""
from copy import deepcopy
from uuid import uuid4
from app.schemas.report_analysis import ReportAnalysisRequest
from v5_cases import cases, cluster, candidate, numeric, oid


def hematology():
    observations = [numeric(51, "PDW", 19, 9, 17, "fL")]
    for index, (label, value) in enumerate([
        ("Hemoglobin", 8.2), ("Platelets", 85), ("RBC", 3.1), ("WBC", 3.2),
        ("Hematocrit", 27), ("MCV", 74), ("MCH", 25), ("MCHC", 31),
        ("RDW", 18), ("MPV", 12), ("Neutrophils", 40), ("Lymphocytes", 45),
        ("Monocytes", 10), ("Eosinophils", 4), ("Basophils", 1),
        ("Reticulocytes", 1), ("Plateletcrit", 0.1),
    ], 52):
        observations.append(dict(observationId=oid(index), label=label, valueType="NUMERIC", numericValue=str(value)))
    return ReportAnalysisRequest.model_validate(dict(requestId=str(uuid4()), reportType="Hematology report", observations=observations))


def claim(text, premises, kind="RELATIONSHIP"):
    return dict(text=text, kind=kind, premises=[dict(observationId=oid(i), status=state) for i, state in premises])


def regression_output():
    c = cluster("Anemia and Thrombocytopenia", list(range(51, 69)),
        "Anemia and thrombocytopenia suggest severe iron deficiency. MDS is a strong possibility. "
        "These hematology findings warrant review together, but reference information is unavailable for several measurements.",
        [candidate("MDS", [51, 52, 53], "Low Hemoglobin and low Platelets may fit MDS. MDS is a strong possibility.")])
    c["evidence"][0]["clinicalRelevance"] = "The high PDW reflects variation in platelet size and warrants clinical correlation."
    for e in c["evidence"][1:]:
        e["clinicalRelevance"] = "This value is low and supports anemia and thrombocytopenia."
    c["alternatives"] = ["Severe iron deficiency", "Aplastic anemia"]
    return dict(clusters=[c], overallInterpretation="MDS is a strong possibility with anemia and thrombocytopenia.")


def runtime_cases():
    source = cases()
    infectious = deepcopy(source["A"])
    infectious.observations.append(hematology().observations[1])
    return {"A": infectious, "B": source["B"], "C": hematology(), "D": source["C"]}
