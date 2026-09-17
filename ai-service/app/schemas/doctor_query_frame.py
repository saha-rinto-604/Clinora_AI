from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.doctor_support import MinimalRoutingContext, StrictModel


class QueryFrameStatus(StrEnum):
    INTERPRETED = "INTERPRETED"
    CLARIFICATION_REQUIRED = "CLARIFICATION_REQUIRED"
    UNSUPPORTED = "UNSUPPORTED"


class InformationNeed(StrEnum):
    SUMMARIZE = "SUMMARIZE"
    INTERPRET_FINDING = "INTERPRET_FINDING"
    RELATE_FINDINGS = "RELATE_FINDINGS"
    EXPLAIN_POSSIBILITIES = "EXPLAIN_POSSIBILITIES"
    COMPARE = "COMPARE"
    TRACE_CHANGE = "TRACE_CHANGE"
    CHECK_ASSESSMENT = "CHECK_ASSESSMENT"
    CHALLENGE_HYPOTHESIS = "CHALLENGE_HYPOTHESIS"
    DIFFERENTIATE = "DIFFERENTIATE"
    IDENTIFY_GAPS = "IDENTIFY_GAPS"
    ORGANIZE_NOTES = "ORGANIZE_NOTES"


class ConceptType(StrEnum):
    LAB_OBSERVATION = "LAB_OBSERVATION"
    CLINICAL_FINDING = "CLINICAL_FINDING"
    CONDITION_OR_HYPOTHESIS = "CONDITION_OR_HYPOTHESIS"
    SYMPTOM_OR_HISTORY = "SYMPTOM_OR_HISTORY"
    REPORT_OR_PANEL = "REPORT_OR_PANEL"
    OTHER = "OTHER"


class DoctorStance(StrEnum):
    AFFIRMED = "AFFIRMED"
    SUSPECTED = "SUSPECTED"
    QUESTIONED = "QUESTIONED"
    DOUBTFUL = "DOUBTFUL"
    NEGATED = "NEGATED"
    RULE_OUT = "RULE_OUT"
    DIFFERENTIAL_CONSIDERATION = "DIFFERENTIAL_CONSIDERATION"
    HISTORICAL = "HISTORICAL"
    UNKNOWN = "UNKNOWN"


class RelationshipMode(StrEnum):
    NONE = "NONE"
    SINGLE_FINDING = "SINGLE_FINDING"
    MULTI_FINDING_PATTERN = "MULTI_FINDING_PATTERN"
    DISCORDANT_FINDINGS = "DISCORDANT_FINDINGS"
    TEMPORAL_PATTERN = "TEMPORAL_PATTERN"
    PERSISTENT_PATTERN = "PERSISTENT_PATTERN"
    HYPOTHESIS_EVIDENCE_FIT = "HYPOTHESIS_EVIDENCE_FIT"
    COMPETING_EXPLANATIONS = "COMPETING_EXPLANATIONS"


class TemporalIntent(StrEnum):
    NONE = "NONE"
    CURRENT = "CURRENT"
    PREVIOUS = "PREVIOUS"
    BASELINE = "BASELINE"
    LONGITUDINAL = "LONGITUDINAL"
    PERSISTENCE = "PERSISTENCE"
    CHANGE = "CHANGE"
    UNKNOWN = "UNKNOWN"


class EvidenceScope(StrEnum):
    CURRENT_REPORT = "CURRENT_REPORT"
    SELECTED_OBSERVATIONS = "SELECTED_OBSERVATIONS"
    COMPARABLE_REPORTS = "COMPARABLE_REPORTS"
    APPOINTMENT_CONTEXT = "APPOINTMENT_CONTEXT"
    DOCTOR_NOTES = "DOCTOR_NOTES"
    UNSPECIFIED = "UNSPECIFIED"


class DiscourseReferent(StrEnum):
    CURRENT_REPORT = "CURRENT_REPORT"
    SELECTED_EVIDENCE = "SELECTED_EVIDENCE"
    PREVIOUS_COMPARABLE_EVIDENCE = "PREVIOUS_COMPARABLE_EVIDENCE"
    DOCTOR_ASSESSMENT = "DOCTOR_ASSESSMENT"
    DOCTOR_NOTES = "DOCTOR_NOTES"
    ACTIVE_PATTERN = "ACTIVE_PATTERN"
    UNSPECIFIED = "UNSPECIFIED"


class QueryAmbiguity(StrEnum):
    UNRESOLVED_REFERENT = "UNRESOLVED_REFERENT"
    MISSING_CONTEXT = "MISSING_CONTEXT"
    MULTIPLE_PLAUSIBLE_NEEDS = "MULTIPLE_PLAUSIBLE_NEEDS"
    AMBIGUOUS_ABBREVIATION = "AMBIGUOUS_ABBREVIATION"
    AMBIGUOUS_SCOPE = "AMBIGUOUS_SCOPE"


class ClinicalFocus(StrictModel):
    text: Annotated[str, Field(min_length=1, max_length=120)]
    normalizedConcept: Annotated[str | None, Field(max_length=160)] = None
    conceptType: ConceptType


class DoctorAssertion(StrictModel):
    concept: Annotated[str, Field(min_length=1, max_length=160)]
    stance: DoctorStance


class DoctorClinicalQueryFrame(StrictModel):
    frameStatus: QueryFrameStatus
    informationNeeds: Annotated[list[InformationNeed], Field(max_length=6)]
    clinicalFocus: Annotated[list[ClinicalFocus], Field(max_length=12)]
    doctorAssertions: Annotated[list[DoctorAssertion], Field(max_length=8)]
    relationshipMode: RelationshipMode
    temporalIntent: TemporalIntent
    evidenceScope: EvidenceScope
    referents: Annotated[list[DiscourseReferent], Field(max_length=8)]
    ambiguities: Annotated[list[QueryAmbiguity], Field(max_length=6)]

    @model_validator(mode="after")
    def validate_frame(self) -> "DoctorClinicalQueryFrame":
        for values, field_name in (
            (self.informationNeeds, "informationNeeds"),
            (self.referents, "referents"),
            (self.ambiguities, "ambiguities"),
        ):
            if len(values) != len(set(values)):
                raise ValueError(f"{field_name} contains duplicates")
        if self.frameStatus == QueryFrameStatus.INTERPRETED:
            if not self.informationNeeds:
                raise ValueError("INTERPRETED requires at least one information need")
            if self.ambiguities:
                raise ValueError("INTERPRETED cannot contain unresolved ambiguities")
            if InformationNeed.TRACE_CHANGE in self.informationNeeds and self.temporalIntent in {
                TemporalIntent.NONE,
                TemporalIntent.UNKNOWN,
            }:
                raise ValueError("TRACE_CHANGE requires a resolved temporal intent")
        elif self.frameStatus == QueryFrameStatus.CLARIFICATION_REQUIRED:
            if not self.ambiguities:
                raise ValueError("CLARIFICATION_REQUIRED requires at least one ambiguity")
        elif self.informationNeeds:
            raise ValueError("UNSUPPORTED cannot contain information needs")
        return self


class DoctorQueryInterpretationRequest(StrictModel):
    requestId: UUID
    doctorMessage: Annotated[str, Field(min_length=1, max_length=4000)]
    context: MinimalRoutingContext


class DoctorQueryInterpretationResponse(StrictModel):
    frame: DoctorClinicalQueryFrame
    promptVersion: Literal["doctor-query-interpreter-v1"] = "doctor-query-interpreter-v1"
    schemaVersion: Literal["doctor-query-frame-v1"] = "doctor-query-frame-v1"
    finishReason: Annotated[str | None, Field(max_length=40)] = None
    promptTokens: Annotated[int | None, Field(ge=0)] = None
    completionTokens: Annotated[int | None, Field(ge=0)] = None
    durationMs: Annotated[int, Field(ge=0)]


def query_frame_response_schema() -> dict[str, object]:
    return DoctorClinicalQueryFrame.model_json_schema()
