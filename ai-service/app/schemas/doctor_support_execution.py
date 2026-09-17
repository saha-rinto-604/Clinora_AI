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
    taskId: Literal[
        "BRIEF_PATIENT", "CONNECT_EVIDENCE", "COMPARE_EVIDENCE", "CROSS_CHECK_ASSESSMENT",
        "FIND_GAPS", "EXPLORE_EXPLANATIONS", "STRUCTURE_NOTES", "FOCUSED_EVIDENCE_QUESTION",
    ]
    promptVersion: str
    schemaVersion: str
    ragPolicy: Literal["DISABLED", "OPTIONAL", "REQUIRED_WHEN_AVAILABLE"] = "DISABLED"


class DoctorSupportExecutionRequest(StrictModel):
    executionId: UUID
    originalQuestion: str = Field(min_length=1, max_length=4000)
    doctorAssessment: str | None = Field(default=None, max_length=4000)
    doctorNotes: str | None = Field(default=None, max_length=8000)
    appointmentContext: dict[str, str | None] = Field(default_factory=dict)
    evidenceSnapshot: EvidenceSnapshot
    tasks: list[TaskRequest] = Field(min_length=1, max_length=8)

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
    referenceChunkIds: list[str] = Field(default_factory=list, max_length=4)


class ConnectEvidenceResult(StrictModel):
    taskId: Literal["CONNECT_EVIDENCE"]
    summary: str = Field(min_length=1, max_length=700)
    patterns: list[ConnectedPattern] = Field(max_length=6)
    limitations: list[str] = Field(max_length=6)
    summaryReferenceChunkIds: list[str] = Field(default_factory=list, max_length=4)


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
    referenceChunkIds: list[str] = Field(default_factory=list, max_length=4)


class AlternativeConsideration(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    rationale: str = Field(min_length=1, max_length=500)
    evidence: list[EvidenceReference] = Field(max_length=8)
    missingInformation: list[str] = Field(max_length=4)
    referenceChunkIds: list[str] = Field(default_factory=list, max_length=4)


class CrossCheckAssessmentResult(StrictModel):
    taskId: Literal["CROSS_CHECK_ASSESSMENT"]
    evidenceFit: Literal[
        "CONSISTENT_WITH_AVAILABLE_EVIDENCE", "MIXED_OR_LIMITED_EVIDENCE",
        "NOT_SUPPORTED_BY_AVAILABLE_EVIDENCE", "INSUFFICIENT_EVIDENCE",
    ]
    summary: str = Field(min_length=1, max_length=700)
    points: list[AssessmentPoint] = Field(max_length=10)
    alternativeConsiderations: list[AlternativeConsideration] = Field(max_length=2)
    limitations: list[str] = Field(max_length=6)
    summaryReferenceChunkIds: list[str] = Field(default_factory=list, max_length=4)


class EvidenceGap(StrictModel):
    category: str = Field(min_length=1, max_length=120)
    whyRelevant: str = Field(min_length=1, max_length=500)
    availability: Literal["NOT_PRESENT_IN_AUTHORIZED_EVIDENCE", "UNCERTAIN"]
    relatedEvidence: list[EvidenceReference] = Field(min_length=1, max_length=6)
    referenceChunkIds: list[str] = Field(default_factory=list, max_length=4)


class FindGapsResult(StrictModel):
    taskId: Literal["FIND_GAPS"]
    summary: str = Field(min_length=1, max_length=700)
    gaps: list[EvidenceGap] = Field(max_length=10)
    limitations: list[str] = Field(max_length=6)
    summaryReferenceChunkIds: list[str] = Field(default_factory=list, max_length=4)


class BriefChronology(StrictModel):
    kind: Literal["CHANGE", "PERSISTENCE"]
    statement: str = Field(min_length=1, max_length=500)
    evidence: list[EvidenceReference] = Field(min_length=2, max_length=8)


class BriefPatientResult(StrictModel):
    taskId: Literal["BRIEF_PATIENT"]
    summary: str = Field(min_length=1, max_length=700)
    appointmentReason: str | None = Field(default=None, max_length=500)
    evidenceHighlights: list[EvidenceReference] = Field(max_length=12)
    chronology: list[BriefChronology] = Field(max_length=8)
    openQuestions: list[str] = Field(max_length=8)
    limitations: list[str] = Field(max_length=6)


class PossibleExplanation(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    whyItMayFit: str = Field(min_length=1, max_length=600)
    supportingEvidence: list[EvidenceReference] = Field(min_length=1, max_length=8)
    limitingEvidence: list[EvidenceReference] = Field(max_length=8)
    missingInformation: list[str] = Field(max_length=6)
    referenceChunkIds: list[str] = Field(min_length=1, max_length=4)


class ExploreExplanationsResult(StrictModel):
    taskId: Literal["EXPLORE_EXPLANATIONS"]
    summary: str = Field(min_length=1, max_length=700)
    explanations: list[PossibleExplanation] = Field(min_length=1, max_length=3)
    limitations: list[str] = Field(max_length=6)
    summaryReferenceChunkIds: list[str] = Field(default_factory=list, max_length=4)


class StructuredNoteSection(StrictModel):
    section: Literal["REASON_CONTEXT", "SYMPTOMS_HISTORY", "FINDINGS", "ASSESSMENT", "PLAN", "OTHER"]
    items: list[str] = Field(min_length=1, max_length=12)


class StructureNotesResult(StrictModel):
    taskId: Literal["STRUCTURE_NOTES"]
    sections: list[StructuredNoteSection] = Field(min_length=1, max_length=6)
    limitations: list[str] = Field(max_length=4)


class FocusedEvidenceQuestionResult(StrictModel):
    taskId: Literal["FOCUSED_EVIDENCE_QUESTION"]
    answer: str = Field(min_length=1, max_length=900)
    supportingEvidence: list[EvidenceReference] = Field(min_length=1, max_length=10)
    referenceChunkIds: list[str] = Field(default_factory=list, max_length=4)
    limitations: list[str] = Field(max_length=6)


TaskResult = Annotated[
    Union[
        BriefPatientResult, ConnectEvidenceResult, CompareEvidenceResult, CrossCheckAssessmentResult,
        FindGapsResult, ExploreExplanationsResult, StructureNotesResult, FocusedEvidenceQuestionResult,
    ],
    Field(discriminator="taskId"),
]


class ClinicalReference(StrictModel):
    chunkId: str
    sourceId: str
    documentId: str
    title: str
    publisher: str
    sourceType: str
    clinicalDomain: str
    publicationDate: str | None
    version: str | None
    jurisdiction: str | None
    sourceReference: str | None
    sectionPath: str


class TaskExecutionResponse(StrictModel):
    taskId: Literal[
        "BRIEF_PATIENT", "CONNECT_EVIDENCE", "COMPARE_EVIDENCE", "CROSS_CHECK_ASSESSMENT",
        "FIND_GAPS", "EXPLORE_EXPLANATIONS", "STRUCTURE_NOTES", "FOCUSED_EVIDENCE_QUESTION",
    ]
    status: Literal["SUCCEEDED", "FAILED_SAFE"]
    result: TaskResult | None
    safeFailureCode: str | None
    modelName: str
    modelRevision: str
    quantization: str
    promptVersion: str
    schemaVersion: str
    groundingStatus: Literal["PASSED", "REJECTED"]
    ragUsed: bool
    ragPolicy: Literal["DISABLED", "OPTIONAL", "REQUIRED_WHEN_AVAILABLE"]
    retrievalStatus: Literal[
        "NOT_REQUIRED", "USED", "NO_RELEVANT_REFERENCE", "KNOWLEDGE_UNAVAILABLE", "RETRIEVAL_FAILED_SAFE"
    ]
    knowledgeIndexVersion: str | None
    retrievedChunkIds: list[str]
    citedChunkIds: list[str]
    retrievalDurationMs: int = Field(ge=0)
    references: list[ClinicalReference]

    @model_validator(mode="after")
    def consistent_status(self) -> "TaskExecutionResponse":
        if self.status == "SUCCEEDED":
            if self.result is None or self.safeFailureCode is not None or self.groundingStatus != "PASSED":
                raise ValueError("Successful task response is contradictory.")
            if self.result.taskId != self.taskId:
                raise ValueError("Outer and inner task IDs must match.")
        elif self.result is not None or not self.safeFailureCode or self.groundingStatus != "REJECTED":
            raise ValueError("Failed-safe task response is contradictory.")
        if self.ragUsed != (self.retrievalStatus == "USED"):
            raise ValueError("RAG usage and retrieval status are contradictory.")
        if self.retrievalStatus == "USED" and (not self.retrievedChunkIds or not self.knowledgeIndexVersion):
            raise ValueError("Used retrieval must identify its chunks and index version.")
        if self.retrievalStatus != "USED" and self.retrievedChunkIds:
            raise ValueError("Unused retrieval cannot expose retrieved chunks.")
        if self.ragPolicy == "DISABLED" and (self.ragUsed or self.retrievalStatus != "NOT_REQUIRED"):
            raise ValueError("Disabled RAG task cannot report retrieval.")
        if self.status == "SUCCEEDED" and self.ragPolicy == "REQUIRED_WHEN_AVAILABLE" and not self.ragUsed:
            raise ValueError("Required-reference task cannot succeed without retrieval.")
        if len(self.retrievedChunkIds) != len(set(self.retrievedChunkIds)):
            raise ValueError("Duplicate retrieved chunk IDs are not allowed.")
        if len(self.citedChunkIds) != len(set(self.citedChunkIds)) or not set(self.citedChunkIds).issubset(self.retrievedChunkIds):
            raise ValueError("Cited chunk IDs must be unique retrieved chunks.")
        if [item.chunkId for item in self.references] != self.citedChunkIds:
            raise ValueError("Reference metadata must exactly match cited chunk order.")
        return self


class DoctorSupportExecutionResponse(StrictModel):
    taskResults: list[TaskExecutionResponse]
