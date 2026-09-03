from __future__ import annotations

from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


ShortText = Annotated[str, Field(min_length=1, max_length=400)]
LongText = Annotated[str, Field(min_length=1, max_length=2400)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ClinicalObservation(StrictModel):
    observationId: UUID
    label: Annotated[str, Field(min_length=1, max_length=160)]
    valueType: Literal["NUMERIC", "TEXT", "QUALITATIVE"]
    numericValue: Decimal | None = None
    textValue: Annotated[str | None, Field(max_length=400)] = None
    comparator: Annotated[str | None, Field(max_length=8)] = None
    unit: Annotated[str | None, Field(max_length=80)] = None
    referenceRangeRaw: Annotated[str | None, Field(max_length=160)] = None
    referenceLow: Decimal | None = None
    referenceHigh: Decimal | None = None
    rangeFlag: Annotated[str | None, Field(max_length=40)] = None

    @model_validator(mode="after")
    def validate_value(self) -> "ClinicalObservation":
        if self.valueType == "NUMERIC" and self.numericValue is None:
            raise ValueError("numericValue is required for NUMERIC observations")
        if self.valueType != "NUMERIC" and not self.textValue:
            raise ValueError("textValue is required for non-numeric observations")
        if self.referenceLow is not None and self.referenceHigh is not None:
            if self.referenceHigh < self.referenceLow:
                raise ValueError("referenceHigh must be greater than or equal to referenceLow")
        return self


class ReportAnalysisRequest(StrictModel):
    requestId: UUID
    reportType: Annotated[str, Field(min_length=1, max_length=60)]
    observations: Annotated[list[ClinicalObservation], Field(min_length=1, max_length=250)]


class AnalysisStatus(StrEnum):
    POSSIBLE_CLINICAL_PATTERN = "POSSIBLE_CLINICAL_PATTERN"
    NO_CLEAR_ABNORMAL_PATTERN = "NO_CLEAR_ABNORMAL_PATTERN"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class EvidenceSupport(StrEnum):
    LIMITED = "LIMITED"
    MODERATE = "MODERATE"
    STRONG = "STRONG"


class Finding(StrictModel):
    observationId: UUID
    title: Annotated[str, Field(min_length=1, max_length=180)]
    interpretation: LongText


class ClinicalPattern(StrictModel):
    name: Annotated[str, Field(min_length=1, max_length=180)]
    supportLevel: EvidenceSupport
    reasoning: LongText
    supportingObservationIds: Annotated[list[UUID], Field(min_length=1, max_length=20)]
    contradictoryObservationIds: Annotated[list[UUID], Field(max_length=20)] = Field(default_factory=list)
    missingEvidence: Annotated[list[ShortText], Field(max_length=12)] = Field(default_factory=list)
    possibleCauses: Annotated[list[ShortText], Field(max_length=8)] = Field(default_factory=list)


class DiscussionPoint(StrictModel):
    type: Literal["POSSIBLE_TEST", "CLINICAL_QUESTION", "FOLLOW_UP"]
    title: Annotated[str, Field(min_length=1, max_length=180)]
    reason: LongText


class ModelAnalysisPayload(StrictModel):
    analysisStatus: AnalysisStatus
    summary: LongText
    notableFindings: Annotated[list[Finding], Field(max_length=50)] = Field(default_factory=list)
    clinicalPatterns: Annotated[list[ClinicalPattern], Field(max_length=5)] = Field(default_factory=list)
    discussionPoints: Annotated[list[DiscussionPoint], Field(max_length=10)] = Field(default_factory=list)
    patientExplanation: LongText
    limitations: Annotated[list[ShortText], Field(min_length=1, max_length=12)]

    @model_validator(mode="after")
    def validate_status_shape(self) -> "ModelAnalysisPayload":
        if self.analysisStatus == AnalysisStatus.POSSIBLE_CLINICAL_PATTERN and not self.clinicalPatterns:
            raise ValueError("clinicalPatterns are required when a possible clinical pattern is reported")
        if self.analysisStatus != AnalysisStatus.POSSIBLE_CLINICAL_PATTERN and self.clinicalPatterns:
            raise ValueError("clinicalPatterns must be empty when no possible clinical pattern is reported")
        return self


class ReportAnalysisResponse(ModelAnalysisPayload):
    modelName: Annotated[str, Field(min_length=1, max_length=200)]
    modelRevision: Annotated[str, Field(min_length=1, max_length=120)]
    promptVersion: Literal["patient-lab-report-v1"]
    schemaVersion: Literal["1.0"]
