from __future__ import annotations

from typing import Annotated, Literal, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReportEvidence(StrictModel):
    reportId: UUID
    reportType: str
    clinicalDate: str | None
    dateReliability: Literal["REPORT_DATE", "DATE_UNAVAILABLE"]


class ObservationEvidence(StrictModel):
    observationId: UUID
    reportId: UUID
    label: str
    canonicalCode: str
    valueType: str
    numericValue: float | None
    textValue: str | None
    comparator: str | None
    unit: str | None
    referenceLow: float | None
    referenceHigh: float | None
    referenceRangeRaw: str | None
    authoritativeStatus: Literal["LOW", "HIGH", "IN_RANGE", "POSITIVE", "NEGATIVE", "REPORTED"]
    verificationStatus: Literal["PATIENT_CONFIRMED", "PATIENT_CORRECTED", "DOCTOR_VERIFIED"]
    normalizedNumericValue: float | None
    normalizedUnit: str | None
    comparisonKey: str | None


class ComparisonFact(StrictModel):
    canonicalCode: str
    label: str
    earlierObservationId: UUID
    laterObservationId: UUID
    earlierDate: str
    laterDate: str
    earlierValue: float
    laterValue: float
    unit: str | None
    direction: Literal["INCREASED", "DECREASED", "UNCHANGED"]


class EvidenceSnapshot(StrictModel):
    snapshotHash: str
    reports: list[ReportEvidence]
    observations: list[ObservationEvidence]
    comparisonFacts: list[ComparisonFact]


class TaskRequest(StrictModel):
    taskId: Literal["CONNECT_EVIDENCE", "COMPARE_EVIDENCE", "CROSS_CHECK_ASSESSMENT", "FIND_GAPS"]
    promptVersion: str
    schemaVersion: str


class DoctorSupportExecutionRequest(StrictModel):
    executionId: UUID
    originalQuestion: str = Field(min_length=1, max_length=4000)
    doctorAssessment: str | None = Field(default=None, max_length=4000)
    evidenceSnapshot: EvidenceSnapshot
    tasks: list[TaskRequest] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def unique_tasks(self) -> "DoctorSupportExecutionRequest":
        ids = [task.taskId for task in self.tasks]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate task IDs are not allowed.")
        return self


class EvidenceReference(StrictModel):
    observationId: UUID
    label: str = Field(min_length=1, max_length=160)


class ConnectedPattern(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    relationship: str = Field(min_length=1, max_length=700)
    evidence: list[EvidenceReference] = Field(min_length=2, max_length=8)
    limitations: list[str] = Field(default_factory=list, max_length=4)


class ConnectEvidenceResult(StrictModel):
    taskId: Literal["CONNECT_EVIDENCE"]
    summary: str = Field(min_length=1, max_length=700)
    patterns: list[ConnectedPattern] = Field(max_length=6)
    limitations: list[str] = Field(max_length=6)


class ExplainedComparison(StrictModel):
    canonicalCode: str
    direction: Literal["INCREASED", "DECREASED", "UNCHANGED"]
    explanation: str = Field(min_length=1, max_length=600)
    evidence: list[EvidenceReference] = Field(min_length=2, max_length=2)


class CompareEvidenceResult(StrictModel):
    taskId: Literal["COMPARE_EVIDENCE"]
    summary: str = Field(min_length=1, max_length=700)
    comparisons: list[ExplainedComparison] = Field(max_length=20)
    nonComparable: list[str] = Field(max_length=8)
    limitations: list[str] = Field(max_length=6)


class AssessmentPoint(StrictModel):
    statement: str = Field(min_length=1, max_length=500)
    relation: Literal["SUPPORTS", "CONTRADICTS", "UNCERTAIN"]
    evidence: list[EvidenceReference] = Field(max_length=8)


class AlternativeConsideration(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    rationale: str = Field(min_length=1, max_length=500)
    evidence: list[EvidenceReference] = Field(max_length=8)
    missingInformation: list[str] = Field(max_length=4)


class CrossCheckAssessmentResult(StrictModel):
    taskId: Literal["CROSS_CHECK_ASSESSMENT"]
    evidenceFit: Literal["FITS", "PARTIALLY_FITS", "DOES_NOT_FIT", "INSUFFICIENT_EVIDENCE"]
    summary: str = Field(min_length=1, max_length=700)
    points: list[AssessmentPoint] = Field(max_length=10)
    alternativeConsiderations: list[AlternativeConsideration] = Field(max_length=2)
    limitations: list[str] = Field(max_length=6)


class EvidenceGap(StrictModel):
    category: str = Field(min_length=1, max_length=120)
    whyRelevant: str = Field(min_length=1, max_length=500)
    availability: Literal["NOT_PRESENT_IN_AUTHORIZED_EVIDENCE", "UNCERTAIN"]
    relatedEvidence: list[EvidenceReference] = Field(min_length=1, max_length=6)


class FindGapsResult(StrictModel):
    taskId: Literal["FIND_GAPS"]
    summary: str = Field(min_length=1, max_length=700)
    gaps: list[EvidenceGap] = Field(max_length=10)
    limitations: list[str] = Field(max_length=6)


TaskResult = Annotated[
    Union[ConnectEvidenceResult, CompareEvidenceResult, CrossCheckAssessmentResult, FindGapsResult],
    Field(discriminator="taskId"),
]


class TaskExecutionResponse(StrictModel):
    taskId: Literal["CONNECT_EVIDENCE", "COMPARE_EVIDENCE", "CROSS_CHECK_ASSESSMENT", "FIND_GAPS"]
    status: Literal["SUCCEEDED", "FAILED_SAFE"]
    result: TaskResult | None
    safeFailureCode: str | None
    modelName: str
    modelRevision: str
    quantization: str
    promptVersion: str
    schemaVersion: str
    groundingStatus: Literal["PASSED", "REJECTED"]

    @model_validator(mode="after")
    def consistent_status(self) -> "TaskExecutionResponse":
        if self.status == "SUCCEEDED":
            if self.result is None or self.safeFailureCode is not None or self.groundingStatus != "PASSED":
                raise ValueError("Successful task response is contradictory.")
            if self.result.taskId != self.taskId:
                raise ValueError("Outer and inner task IDs must match.")
        elif self.result is not None or not self.safeFailureCode or self.groundingStatus != "REJECTED":
            raise ValueError("Failed-safe task response is contradictory.")
        return self


class DoctorSupportExecutionResponse(StrictModel):
    taskResults: list[TaskExecutionResponse]
