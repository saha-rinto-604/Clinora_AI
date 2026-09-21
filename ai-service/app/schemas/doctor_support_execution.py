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


class SnapshotPattern(StrictModel):
    concept: str = Field(min_length=1, max_length=160)
    support: list[UUID] = Field(default_factory=list, max_length=8)
    against: list[UUID] = Field(default_factory=list, max_length=8)


class SnapshotPossibility(StrictModel):
    concept: str = Field(min_length=1, max_length=160)
    support: list[UUID] = Field(default_factory=list, max_length=8)
    against: list[UUID] = Field(default_factory=list, max_length=8)
    missing: list[str] = Field(default_factory=list, max_length=6)


class ClinicalReasoningSnapshot(StrictModel):
    snapshotId: UUID
    reportId: UUID
    evidenceVersion: str = Field(pattern=r"^[0-9a-f]{64}$")
    modelVersion: str = Field(min_length=1, max_length=240)
    promptVersion: str = Field(min_length=1, max_length=120)
    schemaVersion: str = Field(min_length=1, max_length=80)
    status: Literal["READY"]
    patterns: list[SnapshotPattern] = Field(default_factory=list, max_length=6)
    possibilities: list[SnapshotPossibility] = Field(default_factory=list, max_length=6)
    gaps: list[str] = Field(default_factory=list, max_length=12)
    generatedAt: str


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
    reasoningSnapshots: list[ClinicalReasoningSnapshot] = Field(default_factory=list, max_length=20)
    tasks: list[TaskRequest] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def unique_tasks(self) -> "DoctorSupportExecutionRequest":
        ids = [task.taskId for task in self.tasks]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate task IDs are not allowed.")
        report_ids = {report.reportId for report in self.evidenceSnapshot.reports}
        observation_report = {
            observation.observationId: observation.reportId
            for observation in self.evidenceSnapshot.observations
        }
        snapshot_reports: set[UUID] = set()
        for snapshot in self.reasoningSnapshots:
            if snapshot.reportId not in report_ids or snapshot.reportId in snapshot_reports:
                raise ValueError("Reasoning snapshots must map one-to-one to authorized reports.")
            snapshot_reports.add(snapshot.reportId)
            referenced = {
                observation_id
                for item in [*snapshot.patterns, *snapshot.possibilities]
                for observation_id in [*item.support, *item.against]
            }
            if any(observation_report.get(item) != snapshot.reportId for item in referenced):
                raise ValueError("Reasoning snapshots may reference only authorized evidence from their report.")
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
    relation: Literal["SUPPORTS", "CONTRADICTS", "UNCERTAIN", "UNRELATED"]
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
    missingInformation: list[str] = Field(max_length=8)
    alternativeConsiderations: list[AlternativeConsideration] = Field(max_length=2)
    limitations: list[str] = Field(max_length=6)
    summaryReferenceChunkIds: list[str] = Field(default_factory=list, max_length=4)

    @model_validator(mode="after")
    def require_meaningful_evidence_fit(self) -> "CrossCheckAssessmentResult":
        relations = {item.relation for item in self.points}
        if not self.points and not self.missingInformation and not self.alternativeConsiderations:
            raise ValueError("A cross-check result must explain the evidence fit.")
        if self.evidenceFit == "CONSISTENT_WITH_AVAILABLE_EVIDENCE" and "SUPPORTS" not in relations:
            raise ValueError("A consistent evidence fit requires supporting evidence.")
        if self.evidenceFit == "MIXED_OR_LIMITED_EVIDENCE":
            limiting = relations.intersection({"CONTRADICTS", "UNCERTAIN", "UNRELATED"})
            if not self.points or (not limiting and not self.missingInformation):
                raise ValueError("A mixed evidence fit must identify a limitation.")
        if self.evidenceFit == "NOT_SUPPORTED_BY_AVAILABLE_EVIDENCE" and not relations.intersection(
            {"CONTRADICTS", "UNCERTAIN"}
        ):
            raise ValueError("A not-supported evidence fit requires an explanatory point.")
        if self.evidenceFit == "INSUFFICIENT_EVIDENCE" and not self.missingInformation:
            raise ValueError("An insufficient evidence fit must identify missing information.")
        return self


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


class BriefClinicalPattern(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    supportingEvidence: list[EvidenceReference] = Field(min_length=1, max_length=8)
    limitingEvidence: list[EvidenceReference] = Field(max_length=8)


class BriefPatientResult(StrictModel):
    taskId: Literal["BRIEF_PATIENT"]
    summary: str = Field(min_length=1, max_length=700)
    reportCount: int = Field(default=0, ge=0)
    evidenceCount: int = Field(default=0, ge=0)
    abnormalCount: int = Field(default=0, ge=0)
    appointmentReason: str | None = Field(default=None, max_length=500)
    evidenceHighlights: list[EvidenceReference] = Field(max_length=12)
    chronology: list[BriefChronology] = Field(max_length=8)
    clinicalPatterns: list[BriefClinicalPattern] = Field(default_factory=list, max_length=8)
    openQuestions: list[str] = Field(max_length=8)
    limitations: list[str] = Field(max_length=6)


class PossibleExplanation(StrictModel):
    clinicalCluster: str = Field(default="Clinical pattern", min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    whyItMayFit: str = Field(min_length=1, max_length=600)
    supportingEvidence: list[EvidenceReference] = Field(min_length=1, max_length=8)
    limitingEvidence: list[EvidenceReference] = Field(max_length=8)
    missingInformation: list[str] = Field(max_length=6)
    referenceChunkIds: list[str] = Field(default_factory=list, max_length=4)


class ExploreExplanationsResult(StrictModel):
    taskId: Literal["EXPLORE_EXPLANATIONS"]
    summary: str = Field(min_length=1, max_length=700)
    explanations: list[PossibleExplanation] = Field(max_length=4)
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
    failureStage: str | None = None
    invalidHandle: str | None = None
    invalidType: str | None = None
    invalidField: str | None = None
    modelName: str
    modelRevision: str
    quantization: str
    promptVersion: str
    schemaVersion: str
    executionProvider: Literal["GEMINI"] = "GEMINI"
    groundingStatus: Literal["PASSED", "REJECTED"]
    inferenceDurationMs: int = Field(default=0, ge=0)
    repairDurationMs: int = Field(default=0, ge=0)
    groundingDurationMs: int = Field(default=0, ge=0)
    generationCallCount: int = Field(default=0, ge=0, le=2)
    providerAttempts: int = Field(default=0, ge=0, le=4)
    successfulGenerations: int = Field(default=0, ge=0, le=2)
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
            if self.generationCallCount < 1:
                raise ValueError("Successful task response requires a generation call.")
            if self.result.taskId != self.taskId:
                raise ValueError("Outer and inner task IDs must match.")
        elif self.result is not None or not self.safeFailureCode or self.groundingStatus != "REJECTED":
            raise ValueError("Failed-safe task response is contradictory.")
        if self.successfulGenerations != self.generationCallCount:
            raise ValueError("Successful generation telemetry must match generation calls.")
        if self.providerAttempts < self.successfulGenerations:
            raise ValueError("Provider attempts cannot be lower than successful generations.")
        if self.ragUsed != (self.retrievalStatus == "USED"):
            raise ValueError("RAG usage and retrieval status are contradictory.")
        if self.retrievalStatus == "USED" and (not self.retrievedChunkIds or not self.knowledgeIndexVersion):
            raise ValueError("Used retrieval must identify its chunks and index version.")
        if self.retrievalStatus != "USED" and self.retrievedChunkIds:
            raise ValueError("Unused retrieval cannot expose retrieved chunks.")
        if self.ragPolicy == "DISABLED" and (self.ragUsed or self.retrievalStatus != "NOT_REQUIRED"):
            raise ValueError("Disabled RAG task cannot report retrieval.")
        if self.status == "SUCCEEDED" and self.retrievalStatus == "RETRIEVAL_FAILED_SAFE":
            raise ValueError("A retrieval failure cannot produce success.")
        if self.status == "SUCCEEDED" and self.ragPolicy == "REQUIRED_WHEN_AVAILABLE":
            if self.retrievalStatus == "NOT_REQUIRED":
                raise ValueError("Required-when-available retrieval must be attempted.")
            if not self.ragUsed and not any("independent verification" in item for item in self.result.limitations):
                raise ValueError("Unavailable references require an explicit verification limitation.")
        if len(self.retrievedChunkIds) != len(set(self.retrievedChunkIds)):
            raise ValueError("Duplicate retrieved chunk IDs are not allowed.")
        if len(self.citedChunkIds) != len(set(self.citedChunkIds)) or not set(self.citedChunkIds).issubset(self.retrievedChunkIds):
            raise ValueError("Cited chunk IDs must be unique retrieved chunks.")
        if [item.chunkId for item in self.references] != self.citedChunkIds:
            raise ValueError("Reference metadata must exactly match cited chunk order.")
        return self


class DoctorSupportExecutionResponse(StrictModel):
    taskResults: list[TaskExecutionResponse]
