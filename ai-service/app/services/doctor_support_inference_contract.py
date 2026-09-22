"""Private compact Doctor inference contract with trusted server-side expansion."""
from __future__ import annotations

import json
from dataclasses import dataclass
from types import MappingProxyType
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from app.schemas.doctor_support_execution import (
    DoctorSupportExecutionRequest,
    EvidenceSnapshot,
    ObservationEvidence,
)


COMPACT_TASKS = frozenset({
    "CONNECT_EVIDENCE",
    "FOCUSED_EVIDENCE_QUESTION",
    "EXPLORE_EXPLANATIONS",
    "FIND_GAPS",
    "CROSS_CHECK_ASSESSMENT",
})


@dataclass(frozen=True)
class AuthorizedEvidenceSet:
    """Everything the caller authorized for this fresh execution."""

    snapshot: EvidenceSnapshot


@dataclass(frozen=True)
class AuthoritativeGroundingSnapshot:
    """Complete trusted evidence retained by Clinora and never compacted away."""

    snapshot: EvidenceSnapshot
    observations_by_handle: MappingProxyType
    reports_by_handle: MappingProxyType


@dataclass(frozen=True)
class ModelEvidencePack:
    """Authorized-only, reversible, snapshot-local facts sent to live Doctor inference."""

    reports: tuple[tuple[object, ...], ...]
    evidence: tuple[tuple[object, ...], ...]
    advisory_snapshots: tuple[object, ...]

    def render(self) -> str:
        # Field order is defined once in the prompt rather than repeated for every fact.
        return json.dumps(
            {
                "reports": self.reports,
                "evidence": self.evidence,
                "advisorySnapshots": self.advisory_snapshots,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )


class _InternalModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _ConnectItem(_InternalModel):
    pattern: str = Field(min_length=1, max_length=96)
    reason: str = Field(min_length=1, max_length=240)
    support: list[str] = Field(min_length=2, max_length=8)
    limit: str = Field(min_length=1, max_length=160)
    refs: list[str] = Field(default_factory=list, max_length=2)


class _ConnectOutput(_InternalModel):
    patterns: list[_ConnectItem] = Field(max_length=2)


class _FocusedOutput(_InternalModel):
    answer: str = Field(min_length=1, max_length=240)
    support: list[str] = Field(min_length=1, max_length=4)
    refs: list[str] = Field(default_factory=list, max_length=4)
    limits: list[str] = Field(default_factory=list, max_length=2)


class _ExplanationItem(_InternalModel):
    cluster: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    reason: str = Field(min_length=1, max_length=180)
    support: list[str] = Field(min_length=1, max_length=4)
    limiting: list[str] = Field(default_factory=list, max_length=3)
    missing: list[str] = Field(default_factory=list, max_length=3)
    refs: list[str] = Field(default_factory=list, max_length=4)


class _ExploreOutput(_InternalModel):
    explanations: list[_ExplanationItem] = Field(max_length=4)
    limits: list[str] = Field(default_factory=list, max_length=2)


class _GapItem(_InternalModel):
    gap: str = Field(min_length=1, max_length=80)
    reason: str = Field(min_length=1, max_length=180)
    related: list[str] = Field(min_length=1, max_length=3)
    refs: list[str] = Field(default_factory=list, max_length=4)


class _GapsOutput(_InternalModel):
    gaps: list[_GapItem] = Field(max_length=2)
    limits: list[str] = Field(default_factory=list, max_length=2)


class _AssessmentPoint(_InternalModel):
    reason: str = Field(min_length=1, max_length=180)
    relation: Literal["SUPPORTS", "CONTRADICTS", "UNCERTAIN", "UNRELATED"]
    evidence: list[str] = Field(max_length=4)
    refs: list[str] = Field(default_factory=list, max_length=4)


class _Alternative(_InternalModel):
    name: str = Field(min_length=1, max_length=80)
    reason: str = Field(min_length=1, max_length=180)
    evidence: list[str] = Field(max_length=4)
    missing: list[str] = Field(default_factory=list, max_length=2)
    refs: list[str] = Field(default_factory=list, max_length=4)


class _CrossCheckOutput(_InternalModel):
    fit: Literal[
        "CONSISTENT_WITH_AVAILABLE_EVIDENCE",
        "MIXED_OR_LIMITED_EVIDENCE",
        "NOT_SUPPORTED_BY_AVAILABLE_EVIDENCE",
        "INSUFFICIENT_EVIDENCE",
    ]
    points: list[_AssessmentPoint] = Field(max_length=3)
    missing: list[str] = Field(max_length=4)
    alternatives: list[_Alternative] = Field(default_factory=list, max_length=2)
    limits: list[str] = Field(default_factory=list, max_length=2)


_INTERNAL_MODELS = {
    "CONNECT_EVIDENCE": _ConnectOutput,
    "FOCUSED_EVIDENCE_QUESTION": _FocusedOutput,
    "EXPLORE_EXPLANATIONS": _ExploreOutput,
    "FIND_GAPS": _GapsOutput,
    "CROSS_CHECK_ASSESSMENT": _CrossCheckOutput,
}

_HANDLE_FIELDS = frozenset({"support", "limiting", "related", "evidence"})


class DoctorSupportInferenceContract:
    """Separates authorization, authoritative grounding, and model-visible evidence."""

    def __init__(self, request: DoctorSupportExecutionRequest, task_id: str) -> None:
        self.task_id = task_id
        self.compact = task_id in COMPACT_TASKS
        self.authorized_evidence_set = AuthorizedEvidenceSet(request.evidenceSnapshot)
        self._authorized_observations_by_id = MappingProxyType({
            str(observation.observationId): observation
            for observation in request.evidenceSnapshot.observations
        })

        report_handles = {
            str(report.reportId): f"R{index}"
            for index, report in enumerate(request.evidenceSnapshot.reports, start=1)
        }
        observations = {
            f"E{index}": observation
            for index, observation in enumerate(request.evidenceSnapshot.observations, start=1)
        } if self.compact else {}
        reports = {
            report_handles[str(report.reportId)]: report
            for report in request.evidenceSnapshot.reports
        } if self.compact else {}
        self.authoritative_grounding_snapshot = AuthoritativeGroundingSnapshot(
            request.evidenceSnapshot,
            MappingProxyType(observations),
            MappingProxyType(reports),
        )
        # Kept as an ID-to-handle view for callers/tests that inspect the mapping.
        self.observation_ids = {
            str(observation.observationId): handle for handle, observation in observations.items()
        }

        if self.compact:
            unknown_reports = {
                str(item.reportId) for item in observations.values()
                if str(item.reportId) not in report_handles
            }
            if unknown_reports:
                raise ValueError("Every model-pack observation must belong to an authorized report.")
            self.model_evidence_pack = ModelEvidencePack(
                reports=tuple(
                    (
                        report_handles[str(report.reportId)],
                        report.reportType,
                        report.clinicalDate,
                        report.dateReliability,
                    )
                    for report in request.evidenceSnapshot.reports
                ),
                evidence=tuple(
                    (
                        handle,
                        report_handles[str(observation.reportId)],
                        observation.label,
                        _display_value(observation),
                        observation.unit,
                        _display_range(observation),
                        observation.authoritativeStatus,
                    )
                    for handle, observation in observations.items()
                ),
                advisory_snapshots=tuple(
                    {
                        "report": report_handles[str(snapshot.reportId)],
                        "patterns": [
                            {
                                "concept": item.concept,
                                "support": [self.observation_ids[str(value)] for value in item.support],
                                "against": [self.observation_ids[str(value)] for value in item.against],
                            }
                            for item in snapshot.patterns
                        ],
                        "possibilities": [
                            {
                                "concept": item.concept,
                                "support": [self.observation_ids[str(value)] for value in item.support],
                                "against": [self.observation_ids[str(value)] for value in item.against],
                                "missing": item.missing,
                            }
                            for item in snapshot.possibilities
                        ],
                        "gaps": snapshot.gaps,
                    }
                    for snapshot in request.reasoningSnapshots
                ),
            )
            self._adapter = TypeAdapter(_INTERNAL_MODELS[task_id])
        else:
            self.model_evidence_pack = ModelEvidencePack((), (), ())
            self._adapter = None

    def response_schema(self, public_schema: dict, reference_ids: list[str]) -> dict:
        if not self.compact:
            return public_schema
        schema = self._adapter.json_schema()
        _constrain_string_arrays(schema, _HANDLE_FIELDS, list(self.authoritative_grounding_snapshot.observations_by_handle))
        _constrain_string_arrays(
            schema,
            {"refs"},
            reference_ids,
            empty_means_forbidden=True,
            require_one=bool(reference_ids) and self.task_id in {"EXPLORE_EXPLANATIONS", "FIND_GAPS"},
        )
        return schema

    def parse_and_expand(self, payload: object) -> tuple[dict, dict | None]:
        """Validate compact output and expand handles into the unchanged public contract."""
        if not self.compact or not isinstance(payload, dict):
            return payload, None
        # Controlled-rollout compatibility for an established public-shaped
        # completion. It is immediately converted back to item-owned handles for
        # grounding; production generation is constrained to the compact schema.
        if payload.get("taskId") == self.task_id:
            expanded = self._expand_legacy_public_shape(payload)
            return expanded, self._legacy_handle_payload(expanded)
        internal = self._adapter.validate_python(payload).model_dump(mode="json")
        return self._expand_internal(internal), internal

    def _expand_legacy_public_shape(self, payload: dict) -> dict:
        expanded = self._expand_legacy_node(payload)
        if "summary" not in expanded and self.task_id in {
            "CONNECT_EVIDENCE", "EXPLORE_EXPLANATIONS", "FIND_GAPS", "CROSS_CHECK_ASSESSMENT",
        }:
            expanded["summary"] = {
                "CONNECT_EVIDENCE": "The authorized findings can be reviewed together.",
                "EXPLORE_EXPLANATIONS": "Possible explanations are not diagnoses and require independent verification.",
                "FIND_GAPS": "Review missing information alongside the authorized evidence.",
                "CROSS_CHECK_ASSESSMENT": "The Doctor assessment was checked against the authorized evidence.",
            }[self.task_id]
        return expanded

    def _expand_legacy_node(self, payload: dict) -> dict:
        expanded = {}
        evidence_fields = {"evidence", "supportingEvidence", "limitingEvidence", "relatedEvidence"}
        for key, value in payload.items():
            if key in evidence_fields and isinstance(value, list):
                expanded[key] = [self._legacy_reference(item) for item in value]
            elif isinstance(value, list):
                expanded[key] = [
                    self._expand_legacy_node(item) if isinstance(item, dict) else item
                    for item in value
                ]
            elif isinstance(value, dict):
                expanded[key] = self._expand_legacy_node(value)
            else:
                expanded[key] = value
        return expanded

    def _legacy_reference(self, value):
        if isinstance(value, dict):
            supplied_id = str(value.get("observationId"))
            canonical = self.observation_ids.get(supplied_id)
        elif isinstance(value, str):
            supplied_id = None
            canonical = value.upper()
        else:
            supplied_id = None
            canonical = None
        reference = self._reference(canonical) if canonical is not None else None
        if reference is None:
            from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError
            raise UnsafeDoctorSupportOutputError(
                "UNAUTHORIZED_EVIDENCE_HANDLE", invalid_handle=canonical, invalid_field="evidence"
            )
        if supplied_id is not None and reference["observationId"] != supplied_id:
            from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError
            raise UnsafeDoctorSupportOutputError(
                "EVIDENCE_HANDLE_MAPPING_MISMATCH", invalid_handle=canonical, invalid_field="observationId"
            )
        return reference

    def _legacy_handle_payload(self, value):
        """Convert compatibility-shaped output back to item-owned handles for grounding."""
        evidence_fields = {
            "evidence": "evidence",
            "supportingEvidence": "support",
            "limitingEvidence": "limiting",
            "relatedEvidence": "related",
        }
        if isinstance(value, dict):
            converted = {}
            for key, item in value.items():
                if key in evidence_fields and isinstance(item, list):
                    converted[evidence_fields[key]] = [self._handle_for_reference(ref) for ref in item]
                elif key in {"referenceChunkIds", "summaryReferenceChunkIds"}:
                    converted["refs"] = item
                else:
                    converted[key] = self._legacy_handle_payload(item)
            return converted
        if isinstance(value, list):
            return [self._legacy_handle_payload(item) for item in value]
        return value

    def _handle_for_reference(self, reference):
        if isinstance(reference, str):
            return reference.upper()
        if isinstance(reference, dict):
            return self.observation_ids.get(str(reference.get("observationId")), str(reference.get("observationId")))
        return str(reference)

    def _expand_internal(self, payload: dict) -> dict:
        summaries = {
            "CONNECT_EVIDENCE": "The authorized findings can be reviewed together.",
            "EXPLORE_EXPLANATIONS": "Possible explanations are not diagnoses and require independent verification.",
            "FIND_GAPS": "Review missing information alongside the authorized evidence.",
            "CROSS_CHECK_ASSESSMENT": "The Doctor assessment was checked against the authorized evidence.",
        }
        if self.task_id == "CONNECT_EVIDENCE":
            return {
                "taskId": self.task_id,
                "summary": summaries[self.task_id],
                "patterns": [{
                    "title": item["pattern"],
                    "relationship": item["reason"],
                    "evidence": self._references(item["support"]),
                    "limitations": [item["limit"]],
                    "referenceChunkIds": item["refs"],
                } for item in payload["patterns"]],
                "limitations": [],
                "summaryReferenceChunkIds": [],
            }
        if self.task_id == "FOCUSED_EVIDENCE_QUESTION":
            return {
                "taskId": self.task_id,
                "answer": payload["answer"],
                "supportingEvidence": self._references(payload["support"]),
                "referenceChunkIds": payload["refs"],
                "limitations": payload["limits"],
            }
        if self.task_id == "EXPLORE_EXPLANATIONS":
            return {
                "taskId": self.task_id,
                "summary": summaries[self.task_id],
                "explanations": [{
                    "clinicalCluster": item["cluster"],
                    "name": item["name"],
                    "whyItMayFit": item["reason"],
                    "supportingEvidence": self._references(item["support"]),
                    "limitingEvidence": self._references(item["limiting"]),
                    "missingInformation": item["missing"],
                    "referenceChunkIds": item["refs"],
                } for item in payload["explanations"]],
                "limitations": payload["limits"],
                "summaryReferenceChunkIds": [],
            }
        if self.task_id == "FIND_GAPS":
            return {
                "taskId": self.task_id,
                "summary": summaries[self.task_id],
                "gaps": [{
                    "category": item["gap"],
                    "whyRelevant": item["reason"],
                    "availability": "NOT_PRESENT_IN_AUTHORIZED_EVIDENCE",
                    "relatedEvidence": self._references(item["related"]),
                    "referenceChunkIds": item["refs"],
                } for item in payload["gaps"]],
                "limitations": payload["limits"],
                "summaryReferenceChunkIds": [],
            }
        return {
            "taskId": self.task_id,
            "evidenceFit": payload["fit"],
            "summary": summaries[self.task_id],
            "points": [{
                "statement": item["reason"],
                "relation": item["relation"],
                "evidence": self._references(item["evidence"]),
                "referenceChunkIds": item["refs"],
            } for item in payload["points"]],
            "missingInformation": payload["missing"],
            "alternativeConsiderations": [{
                "name": item["name"],
                "rationale": item["reason"],
                "evidence": self._references(item["evidence"]),
                "missingInformation": item["missing"],
                "referenceChunkIds": item["refs"],
            } for item in payload["alternatives"]],
            "limitations": payload["limits"],
            "summaryReferenceChunkIds": [],
        }

    def _references(self, handles: list[str]) -> list[dict[str, str]]:
        if len(handles) != len(set(handles)):
            from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError
            raise UnsafeDoctorSupportOutputError("DUPLICATE_EVIDENCE_ID")
        return [self._reference(handle) for handle in handles]

    def _reference(self, handle: str) -> dict[str, str]:
        observation = self.authoritative_grounding_snapshot.observations_by_handle.get(handle)
        if observation is None:
            from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError
            code = "UNKNOWN_EVIDENCE_HANDLE" if _looks_like_handle(handle) else "UNAUTHORIZED_EVIDENCE_HANDLE"
            raise UnsafeDoctorSupportOutputError(code, invalid_handle=handle, invalid_field="evidence")
        authoritative = self._authorized_observations_by_id.get(str(observation.observationId))
        if authoritative is None:
            from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError
            raise UnsafeDoctorSupportOutputError(
                "UNAUTHORIZED_EVIDENCE_HANDLE", invalid_handle=handle, invalid_field="evidence"
            )
        if authoritative is not observation:
            from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError
            raise UnsafeDoctorSupportOutputError(
                "EVIDENCE_HANDLE_MAPPING_MISMATCH", invalid_handle=handle, invalid_field="observationId"
            )
        return {"observationId": str(authoritative.observationId), "label": authoritative.label}


def _display_value(observation: ObservationEvidence) -> object:
    if observation.numericValue is not None:
        value: object = observation.numericValue
        if observation.comparator and observation.comparator != "=":
            value = f"{observation.comparator}{_number(observation.numericValue)}"
        return value
    return observation.textValue


def _display_range(observation: ObservationEvidence) -> str | None:
    if observation.referenceLow is not None or observation.referenceHigh is not None:
        low = "" if observation.referenceLow is None else _number(observation.referenceLow)
        high = "" if observation.referenceHigh is None else _number(observation.referenceHigh)
        return f"{low}..{high}"
    return observation.referenceRangeRaw


def _number(value: float) -> str:
    return format(value, ".15g")


def _looks_like_handle(value: object) -> bool:
    return isinstance(value, str) and len(value) > 1 and value[0] == "E" and value[1:].isdigit()


def _constrain_string_arrays(
    schema: object,
    fields: set[str] | frozenset[str],
    allowed: list[str],
    empty_means_forbidden: bool = False,
    require_one: bool = False,
) -> None:
    if isinstance(schema, dict):
        properties = schema.get("properties")
        if isinstance(properties, dict):
            for name, child in properties.items():
                if name in fields and isinstance(child, dict):
                    child["items"] = {"type": "string", "enum": allowed} if allowed else {"type": "string"}
                    child["uniqueItems"] = True
                    if empty_means_forbidden and not allowed:
                        child["maxItems"] = 0
                    elif require_one:
                        child["minItems"] = 1
                _constrain_string_arrays(child, fields, allowed, empty_means_forbidden, require_one)
        for key, child in schema.items():
            if key != "properties":
                _constrain_string_arrays(child, fields, allowed, empty_means_forbidden, require_one)
    elif isinstance(schema, list):
        for child in schema:
            _constrain_string_arrays(child, fields, allowed, empty_means_forbidden, require_one)
