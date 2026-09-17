from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RoutingStatus(StrEnum):
    ROUTED = "ROUTED"
    CLARIFICATION_REQUIRED = "CLARIFICATION_REQUIRED"
    UNSUPPORTED = "UNSUPPORTED"


class TaskCatalogEntry(StrictModel):
    taskId: Annotated[str, Field(min_length=1, max_length=80, pattern=r"^[A-Z][A-Z0-9_]*$")]
    purpose: Annotated[str, Field(min_length=1, max_length=600)]
    routingDescription: Annotated[str, Field(min_length=1, max_length=600)]
    exampleUtterances: Annotated[list[str], Field(min_length=1, max_length=12)]


class MinimalRoutingContext(StrictModel):
    contextType: Annotated[str, Field(min_length=1, max_length=80)]
    currentScreen: Annotated[str, Field(min_length=1, max_length=80)]
    currentReportType: Annotated[str | None, Field(max_length=80)] = None
    selectedReportCount: Annotated[int, Field(ge=0, le=20)] = 0
    selectedObservationCount: Annotated[int, Field(ge=0, le=250)] = 0
    doctorAssessmentPresent: bool = False
    doctorNotesPresent: bool = False
    comparableAuthorizedReportsAvailable: bool = False
    selectionType: Literal["NONE", "REPORT", "REPORTS", "OBSERVATIONS", "MIXED"] = "NONE"


class DoctorSupportRoutingRequest(StrictModel):
    requestId: UUID
    doctorMessage: Annotated[str, Field(min_length=1, max_length=4000)]
    context: MinimalRoutingContext
    taskCatalog: Annotated[list[TaskCatalogEntry], Field(min_length=1, max_length=8)]

    @model_validator(mode="after")
    def unique_catalog(self) -> "DoctorSupportRoutingRequest":
        task_ids = [item.taskId for item in self.taskCatalog]
        if len(task_ids) != len(set(task_ids)):
            raise ValueError("taskCatalog contains duplicate task IDs")
        return self


class DoctorSupportRoutingDecision(StrictModel):
    status: RoutingStatus
    taskIds: Annotated[list[str], Field(max_length=8)] = Field(default_factory=list)
    clarificationOptionTaskIds: Annotated[list[str], Field(max_length=8)] = Field(default_factory=list)
    promptVersion: Literal["doctor-request-router-v1"] = "doctor-request-router-v1"
    schemaVersion: Literal["1.0"] = "1.0"

    @model_validator(mode="after")
    def validate_shape(self) -> "DoctorSupportRoutingDecision":
        if len(self.taskIds) != len(set(self.taskIds)):
            raise ValueError("taskIds contains duplicates")
        if len(self.clarificationOptionTaskIds) != len(set(self.clarificationOptionTaskIds)):
            raise ValueError("clarificationOptionTaskIds contains duplicates")
        if self.status == RoutingStatus.ROUTED and not self.taskIds:
            raise ValueError("ROUTED requires at least one task ID")
        if self.status != RoutingStatus.ROUTED and self.taskIds:
            raise ValueError("Only ROUTED may contain task IDs")
        if self.status == RoutingStatus.CLARIFICATION_REQUIRED and not self.clarificationOptionTaskIds:
            raise ValueError("CLARIFICATION_REQUIRED requires options")
        if self.status != RoutingStatus.CLARIFICATION_REQUIRED and self.clarificationOptionTaskIds:
            raise ValueError("Only CLARIFICATION_REQUIRED may contain options")
        return self


class DoctorSupportModelDecision(StrictModel):
    status: RoutingStatus
    taskIds: Annotated[list[str], Field(max_length=8)]
    clarificationOptionTaskIds: Annotated[list[str], Field(max_length=8)]

    @model_validator(mode="after")
    def validate_shape(self) -> "DoctorSupportModelDecision":
        DoctorSupportRoutingDecision(
            status=self.status,
            taskIds=self.taskIds,
            clarificationOptionTaskIds=self.clarificationOptionTaskIds,
        )
        return self


def router_response_schema(allowed_task_ids: list[str]) -> dict[str, object]:
    task_array = {
        "type": "array",
        "items": {"type": "string", "enum": allowed_task_ids},
        "maxItems": len(allowed_task_ids),
        "uniqueItems": True,
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "status": {"type": "string", "enum": [item.value for item in RoutingStatus]},
            "taskIds": task_array,
            "clarificationOptionTaskIds": task_array,
        },
        "required": ["status", "taskIds", "clarificationOptionTaskIds"],
    }
