"""Synthetic acceptance data only; clinical associations never enter production rules."""
from uuid import UUID

from app.schemas.report_analysis import ReportAnalysisRequest


def oid(index: int) -> str:
    return str(UUID(f"00000000-0000-4000-8000-{index:012d}"))


def numeric(index, label, value, low, high, unit=None):
    return dict(observationId=oid(index), label=label, valueType="NUMERIC",
                numericValue=str(value), referenceLow=str(low), referenceHigh=str(high), unit=unit)


def cases():
    infectious = ReportAnalysisRequest.model_validate(dict(requestId=oid(100), reportType="Dengue profile", observations=[
        dict(observationId=oid(1), label="NS1 Antigen", valueType="QUALITATIVE", textValue="Positive", referenceRangeRaw="Negative"),
        numeric(2, "Platelets", 90, 150, 400, "x10^9/L"),
        numeric(3, "White blood cell count", 3.2, 4, 11, "x10^9/L"),
        numeric(4, "Eosinophils", 2, 1, 6, "%"),
    ]))
    metabolic = ReportAnalysisRequest.model_validate(dict(requestId=oid(101), reportType="General laboratory report", observations=[
        numeric(11, "HbA1c", 8.2, 4, 5.6, "%"),
        numeric(12, "Estimated Average Glucose", 189, 70, 117, "mg/dL"),
        numeric(13, "TSH", 0.05, 0.4, 4, "mIU/L"),
        numeric(14, "Free T4", 2.4, 0.8, 1.8, "ng/dL"),
        numeric(15, "Urine Microalbumin", 60, 0, 30, "mg/L"),
    ]))
    normal = ReportAnalysisRequest.model_validate(dict(requestId=oid(102), reportType="General laboratory report", observations=[
        numeric(21, "Hemoglobin", 14, 12, 16, "g/dL"),
        numeric(22, "White blood cell count", 6, 4, 11, "x10^9/L"),
        numeric(23, "TSH", 2, 0.4, 4, "mIU/L"),
        numeric(24, "Glucose", 90, 70, 100, "mg/dL"),
    ]))
    return {"A": infectious, "B": metabolic, "C": normal}


def candidate(name, ids, rationale):
    return dict(name=name, rationale=rationale, supportingObservationIds=[oid(i) for i in ids],
                contradictoryObservationIds=[], missingEvidence=["Symptoms and timing"], alternatives=["A transient physiological change"])


def cluster(title, ids, interpretation, candidates=None):
    return dict(title=title, interpretation=interpretation,
                evidence=[dict(observationId=oid(i), role="SUPPORTS", clinicalRelevance="This finding contributes to the related clinical pattern.") for i in ids],
                candidates=candidates or [], missingEvidence=[], alternatives=[])


def metabolic_output():
    return dict(clusters=[
        cluster("Glycemic dysregulation", [11, 12], "The elevated HbA1c and elevated Estimated Average Glucose suggest sustained glycemic dysregulation.", [
            candidate("Persistent hyperglycemia", [11, 12], "The related glycemic findings may reflect sustained glucose exposure.")]),
        cluster("Thyroid hormone excess", [13, 14], "The reduced TSH and elevated Free T4 form a coherent thyroid-hormone-excess pattern.", [
            candidate("Possible hyperthyroidism", [13, 14], "The reduced TSH contributes to a thyroid-hormone-excess pattern.")]),
    ], overallInterpretation="The findings suggest independent glycemic and thyroid processes that need clinical correlation.")
