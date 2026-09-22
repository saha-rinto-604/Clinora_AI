from __future__ import annotations

import json
import os
import re
import logging
import time

from pydantic import TypeAdapter, ValidationError

from app.knowledge.models import RetrievalResult, RetrievalStatus
from app.knowledge.query import ClinicalKnowledgeQueryBuilder
from app.knowledge.retrieval import ClinicalKnowledgeRetriever
from app.model_runtime import (
    MalformedModelResponseError, ModelCapacityError, ModelTimeoutError, ModelUnavailableError,
)
from app.prompts import (
    doctor_brief_patient_v1,
    doctor_compare_evidence_v1,
    doctor_connect_evidence_v2,
    doctor_cross_check_assessment_v2,
    doctor_explore_explanations_v1,
    doctor_find_gaps_v2,
    doctor_focused_evidence_question_v1,
    doctor_structure_notes_v1,
)
from app.schemas.doctor_support_execution import (
    BriefPatientResult,
    CompareEvidenceResult,
    ConnectEvidenceResult,
    CrossCheckAssessmentResult,
    DoctorSupportExecutionRequest,
    DoctorSupportExecutionResponse,
    ExploreExplanationsResult,
    FindGapsResult,
    FocusedEvidenceQuestionResult,
    StructureNotesResult,
    TaskExecutionResponse,
)
from app.services.doctor_support_inference_contract import DoctorSupportInferenceContract
from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError, validate_grounding

LOGGER = logging.getLogger(__name__)

class InvalidDoctorSupportOutputError(RuntimeError):
    def __init__(
        self,
        reason_code: str,
        *,
        failure_stage: str = "schema",
        invalid_type: str | None = None,
        invalid_field: str | None = None,
    ) -> None:
        super().__init__("Doctor support model output was rejected.")
        self.reason_code = reason_code
        self.failure_stage = failure_stage
        self.invalid_handle = None
        self.invalid_type = invalid_type or "response_contract"
        self.invalid_field = invalid_field


TASKS = {
    "BRIEF_PATIENT": (BriefPatientResult, doctor_brief_patient_v1),
    "CONNECT_EVIDENCE": (ConnectEvidenceResult, doctor_connect_evidence_v2),
    "COMPARE_EVIDENCE": (CompareEvidenceResult, doctor_compare_evidence_v1),
    "CROSS_CHECK_ASSESSMENT": (CrossCheckAssessmentResult, doctor_cross_check_assessment_v2),
    "FIND_GAPS": (FindGapsResult, doctor_find_gaps_v2),
    "EXPLORE_EXPLANATIONS": (ExploreExplanationsResult, doctor_explore_explanations_v1),
    "STRUCTURE_NOTES": (StructureNotesResult, doctor_structure_notes_v1),
    "FOCUSED_EVIDENCE_QUESTION": (FocusedEvidenceQuestionResult, doctor_focused_evidence_question_v1),
}


DEFAULT_TASK_MAX_TOKENS = {
    "BRIEF_PATIENT": 256,  # Legacy internal API; production Brief is server deterministic.
    "CONNECT_EVIDENCE": 256,
    "COMPARE_EVIDENCE": 384,  # Legacy internal API; production Compare is server deterministic.
    "CROSS_CHECK_ASSESSMENT": 512,
    "FIND_GAPS": 448,
    "EXPLORE_EXPLANATIONS": 512,
    "STRUCTURE_NOTES": 384,
    "FOCUSED_EVIDENCE_QUESTION": 320,
}


class DoctorSupportExecutionService:
    def __init__(self, runtime, retriever: ClinicalKnowledgeRetriever | None = None) -> None:
        self._runtime = runtime
        self._retriever = retriever
        self._query_builder = ClinicalKnowledgeQueryBuilder()
        self._task_max_tokens = {
            task: max(128, min(int(os.getenv(f"DOCTOR_SUPPORT_{task}_MAX_TOKENS", default)), 1024))
            for task, default in DEFAULT_TASK_MAX_TOKENS.items()
        }

    def execute(self, request: DoctorSupportExecutionRequest) -> DoctorSupportExecutionResponse:
        results = []
        for task in request.tasks:
            started = time.perf_counter()
            trace = {"stage": "request", "schema": "NOT_RUN", "grounding": "NOT_RUN",
                     "retrieval": "NOT_RUN", "references": 0, "attempt": "none",
                     "prompt_tokens": None, "completion_tokens": None, "finish_reason": "not_run",
                     "inference_ms": 0, "repair_ms": 0, "grounding_ms": 0, "generation_calls": 0,
                     "provider_attempts": 0, "successful_generations": 0,
                     "failure_stage": None, "invalid_handle": None, "invalid_type": None,
                     "invalid_field": None}
            result = None
            failure = "UNEXPECTED_INTERNAL_ERROR"
            try:
                result = self._execute_task(request, task, trace)
                results.append(result)
            except (ModelCapacityError, ModelTimeoutError, ModelUnavailableError) as exc:
                failure = ("PROVIDER_RATE_LIMITED" if isinstance(exc, ModelCapacityError) else
                           "MODEL_TIMEOUT" if isinstance(exc, ModelTimeoutError) else "MODEL_UNAVAILABLE")
                raise
            finally:
                # Never log model output, evidence, citation strings, exceptions, or Doctor text.
                LOGGER.info(
                    "doctor_execution_validation request_id=%s task_id=%s endpoint=/internal/v1/doctor-support/execute "
                    "stage=%s status=%s rejection_code=%s failure_stage=%s validation_code=%s "
                    "invalid_handle=%s invalid_type=%s invalid_field=%s duration_ms=%d retrieval_status=%s "
                    "reference_availability=%s reference_count=%d cited_reference_count=%d "
                    "schema_status=%s grounding_status=%s attempt=%s prompt_tokens=%s completion_tokens=%s "
                    "finish_reason=%s generation_calls=%d provider_attempts=%d successful_generations=%d repair_ms=%d",
                    request.executionId, task.taskId, trace["stage"], result.status if result else "ERROR",
                    (result.safeFailureCode or "NONE") if result else failure,
                    (result.failureStage or "NONE") if result else (trace["failure_stage"] or trace["stage"]),
                    (result.safeFailureCode or "NONE") if result else failure,
                    (result.invalidHandle or "NONE") if result else (trace["invalid_handle"] or "NONE"),
                    (result.invalidType or "NONE") if result else (trace["invalid_type"] or "NONE"),
                    (result.invalidField or "NONE") if result else (trace["invalid_field"] or "NONE"),
                    round((time.perf_counter() - started) * 1000), trace["retrieval"],
                    "AVAILABLE" if trace["references"] else "UNAVAILABLE", trace["references"],
                    len(result.citedChunkIds) if result else 0, trace["schema"], trace["grounding"],
                    trace["attempt"], trace["prompt_tokens"], trace["completion_tokens"], trace["finish_reason"],
                    trace["generation_calls"], trace["provider_attempts"], trace["successful_generations"],
                    trace["repair_ms"],
                )
        return DoctorSupportExecutionResponse(taskResults=results)

    def _execute_task(self, request: DoctorSupportExecutionRequest, task, trace) -> TaskExecutionResponse:
        task_id = task.taskId
        model, prompt = TASKS[task_id]
        if task.promptVersion != prompt.PROMPT_VERSION or task.schemaVersion != prompt.SCHEMA_VERSION:
            return self._failed(task_id, prompt, "TASK_VERSION_MISMATCH", task.ragPolicy, trace=trace)
        unsafe_request = self._unsupported_direct_request(task_id, request.originalQuestion)
        if unsafe_request:
            return self._failed(task_id, prompt, unsafe_request, task.ragPolicy, trace=trace)
        if task_id == "STRUCTURE_NOTES" and not (request.doctorNotes or "").strip():
            return self._failed(task_id, prompt, "DOCTOR_NOTES_REQUIRED", task.ragPolicy, trace=trace)
        retrieval = self._retrieve(task_id, task.ragPolicy, request)
        trace.update(stage="retrieval", retrieval=retrieval.status.value, references=len(retrieval.chunks))
        if retrieval.status == RetrievalStatus.RETRIEVAL_FAILED_SAFE:
            return self._failed(task_id, prompt, "CLINICAL_REFERENCE_RETRIEVAL_FAILED", task.ragPolicy, retrieval, trace)
        metadata = self._runtime.metadata
        try:
            result, handle_payload, handle_observations = self._generate_with_one_structural_repair(
                request, model, prompt, retrieval, task_id, trace,
            )
            trace["stage"] = "grounding"
            result = self._normalize_brief_patient(result, model, request)
            result = self._normalize_reference_availability(result, model, task.ragPolicy, retrieval)
            grounding_started = time.perf_counter()
            validate_grounding(
                result,
                request.evidenceSnapshot,
                retrieval.chunks,
                request.doctorNotes,
                request.appointmentContext,
                handle_payload=handle_payload,
                handle_observations=handle_observations,
            )
            trace["grounding_ms"] = round((time.perf_counter() - grounding_started) * 1000)
            trace.update(grounding="PASSED", stage="response_contract")
            cited_ids = self._cited_chunk_ids(result.model_dump(mode="json"))
            chunks_by_id = {item.chunk.chunk_id: item.chunk for item in retrieval.chunks}
            return TaskExecutionResponse(
                taskId=task_id, status="SUCCEEDED", result=result, safeFailureCode=None,
                failureStage=None, invalidHandle=None, invalidType=None, invalidField=None,
                modelName=metadata.model_name, modelRevision=metadata.model_revision,
                quantization=metadata.quantization, promptVersion=prompt.PROMPT_VERSION,
                schemaVersion=prompt.SCHEMA_VERSION, groundingStatus="PASSED",
                inferenceDurationMs=trace["inference_ms"], repairDurationMs=trace["repair_ms"],
                groundingDurationMs=trace["grounding_ms"], generationCallCount=trace["generation_calls"],
                providerAttempts=trace["provider_attempts"],
                successfulGenerations=trace["successful_generations"],
                ragUsed=retrieval.status == RetrievalStatus.USED, ragPolicy=task.ragPolicy,
                retrievalStatus=retrieval.status.value, knowledgeIndexVersion=retrieval.index_version,
                retrievedChunkIds=[item.chunk.chunk_id for item in retrieval.chunks], citedChunkIds=cited_ids,
                retrievalDurationMs=retrieval.duration_ms,
                references=[self._reference(chunks_by_id[item]) for item in cited_ids],
            )
        except UnsafeDoctorSupportOutputError as exc:
            trace["grounding"] = "REJECTED"
            trace.update(
                failure_stage=exc.failure_stage,
                invalid_handle=exc.invalid_handle,
                invalid_type=exc.invalid_type,
                invalid_field=exc.invalid_field,
            )
            return self._failed(task_id, prompt, exc.reason_code, task.ragPolicy, retrieval, trace)
        except (InvalidDoctorSupportOutputError, MalformedModelResponseError) as exc:
            trace.update(
                failure_stage=getattr(exc, "failure_stage", trace["stage"]),
                invalid_handle=getattr(exc, "invalid_handle", None),
                invalid_type=getattr(exc, "invalid_type", "malformed_model_response"),
                invalid_field=getattr(exc, "invalid_field", None),
            )
            return self._failed(
                task_id, prompt, getattr(exc, "reason_code", "INVALID_MODEL_OUTPUT"), task.ragPolicy, retrieval, trace
            )

    def _generate_with_one_structural_repair(self, request, model, prompt, retrieval, task_id, trace):
        adapter = TypeAdapter(model)
        inference = DoctorSupportInferenceContract(request, task_id)
        reference_ids = [item.chunk.chunk_id for item in retrieval.chunks]
        public_schema = adapter.json_schema()
        self._constrain_reference_ids(public_schema, reference_ids)
        schema = inference.response_schema(public_schema, reference_ids)
        messages = (prompt.build_messages(request, retrieval.chunks, inference=inference)
                    if inference.compact else prompt.build_messages(request, retrieval.chunks))
        generation = self._generate_measured(request, messages, schema, "initial", task_id, trace)
        if generation.finish_reason == "length":
            trace["schema"] = "NOT_CHECKED_TRUNCATED"
            raise InvalidDoctorSupportOutputError(
                "OUTPUT_TRUNCATED", failure_stage="generation",
                invalid_type="truncated_response", invalid_field="$",
            )
        try:
            expanded, handle_payload = inference.parse_and_expand(json.loads(generation.content))
            result = adapter.validate_python(expanded)
            trace.update(stage="schema", schema="PASSED")
            return result, handle_payload, inference.authoritative_grounding_snapshot.observations_by_handle
        except (json.JSONDecodeError, ValidationError):
            trace.update(stage="schema", schema="REJECTED")
            repair_messages = messages + [
                {"role": "assistant", "content": generation.content},
                {"role": "user", "content": "Repair only the JSON structure to match the schema. Do not add facts or change evidence or reference IDs."},
            ]
            repaired = self._generate_measured(request, repair_messages, schema, "structural_repair", task_id, trace)
            if repaired.finish_reason == "length":
                trace["schema"] = "NOT_CHECKED_TRUNCATED"
                raise InvalidDoctorSupportOutputError(
                    "OUTPUT_TRUNCATED", failure_stage="generation",
                    invalid_type="truncated_response", invalid_field="$",
                )
            try:
                expanded, handle_payload = inference.parse_and_expand(json.loads(repaired.content))
                result = adapter.validate_python(expanded)
                trace.update(stage="schema", schema="PASSED_AFTER_REPAIR")
                return result, handle_payload, inference.authoritative_grounding_snapshot.observations_by_handle
            except (json.JSONDecodeError, ValidationError) as exc:
                trace.update(stage="schema", schema="REJECTED_AFTER_REPAIR")
                invalid_type, invalid_field = self._schema_failure(exc)
                raise InvalidDoctorSupportOutputError(
                    "INVALID_CONTRACT_AFTER_REPAIR", invalid_type=invalid_type, invalid_field=invalid_field
                ) from exc

    def _generate_measured(self, request, messages, schema, attempt, task_id, trace):
        started = time.perf_counter()
        trace.update(stage="generation", attempt=attempt)
        max_tokens = self._task_max_tokens[task_id]
        try:
            generation = self._runtime.generate(messages, response_schema=schema, max_tokens=max_tokens)
        except ModelCapacityError as exc:
            trace["inference_ms"] += round((time.perf_counter() - started) * 1000)
            trace["provider_attempts"] += getattr(exc, "provider_attempts", 1)
            trace.update(failure_stage="generation", invalid_type="provider_rate_limit")
            raise
        duration_ms = round((time.perf_counter() - started) * 1000)
        trace["inference_ms"] += duration_ms
        trace["generation_calls"] += 1
        trace["provider_attempts"] += max(1, getattr(generation, "provider_attempts", 1))
        trace["successful_generations"] += 1
        if attempt == "structural_repair":
            trace["repair_ms"] += duration_ms
        trace.update(prompt_tokens=generation.prompt_tokens, completion_tokens=generation.completion_tokens,
                     finish_reason=generation.finish_reason if generation.finish_reason in {"stop", "length"} else "other")
        LOGGER.info(
            "doctor_execution_generation request_id=%s endpoint=/internal/v1/doctor-support/execute "
            "task_id=%s attempt=%s max_tokens=%d duration_ms=%d prompt_tokens=%s completion_tokens=%s "
            "finish_reason=%s provider_attempts=%d successful_generations=%d",
            request.executionId, task_id, attempt, max_tokens, duration_ms,
            generation.prompt_tokens, generation.completion_tokens,
            generation.finish_reason if generation.finish_reason in {"stop", "length"} else "other",
            trace["provider_attempts"], trace["successful_generations"],
        )
        return generation

    @staticmethod
    def _normalize_reference_availability(result, model, rag_policy, retrieval):
        if rag_policy != "REQUIRED_WHEN_AVAILABLE" or retrieval.status == RetrievalStatus.USED:
            return result
        payload = result.model_dump(mode="json")
        limitation = (
            "Approved clinical reference material was unavailable for this request; "
            "general clinical explanations require independent verification."
        )
        payload["limitations"] = list(payload.get("limitations") or [])[:5] + [limitation]
        return model.model_validate(payload)

    @staticmethod
    def _normalize_brief_patient(result, model, request):
        if result.taskId != "BRIEF_PATIENT":
            return result
        payload = result.model_dump(mode="json")
        payload["summary"] = "Authorized appointment context and verified evidence are available for review."
        payload["appointmentReason"] = request.appointmentContext.get("reason")
        authorized = {str(item.observationId): item for item in request.evidenceSnapshot.observations}
        highlights = []
        seen = set()
        for reference in payload["evidenceHighlights"]:
            observation_id = reference["observationId"]
            observation = authorized.get(observation_id)
            if observation is not None and observation.label == reference["label"] and observation_id not in seen:
                highlights.append(reference)
                seen.add(observation_id)
            else:
                LOGGER.info("doctor_execution_normalization category=discarded_invalid_brief_highlight")
        payload["evidenceHighlights"] = highlights
        grounded_chronology = []
        discarded_chronology = False
        for chronology in payload["chronology"]:
            candidate_payload = {
                **payload,
                "chronology": [chronology],
                "openQuestions": [],
                "limitations": [],
            }
            candidate = model.model_validate(candidate_payload)
            try:
                validate_grounding(
                    candidate, request.evidenceSnapshot, (),
                    request.doctorNotes, request.appointmentContext,
                )
                grounded_chronology.append(chronology)
            except UnsafeDoctorSupportOutputError as exc:
                discarded_chronology = True
                LOGGER.info(
                    "doctor_execution_normalization category=discarded_unsafe_brief_chronology reason=%s",
                    exc.reason_code,
                )
        payload["chronology"] = grounded_chronology
        payload["openQuestions"] = []
        payload["limitations"] = (
            ["Model-proposed chronology that was not supported by authorized evidence was omitted."]
            if discarded_chronology else []
        )
        LOGGER.info("doctor_execution_normalization category=brief_evidence_scoped_prose")
        return model.model_validate(payload)

    def _failed(self, task_id, prompt, code, rag_policy="DISABLED", retrieval=None, trace=None):
        metadata = self._runtime.metadata
        retrieval = retrieval or RetrievalResult(RetrievalStatus.NOT_REQUIRED)
        failure_stage = (trace or {}).get("failure_stage") or (trace or {}).get("stage") or "request"
        return TaskExecutionResponse(
            taskId=task_id, status="FAILED_SAFE", result=None, safeFailureCode=code,
            failureStage=failure_stage,
            invalidHandle=(trace or {}).get("invalid_handle"),
            invalidType=(trace or {}).get("invalid_type"),
            invalidField=(trace or {}).get("invalid_field"),
            modelName=metadata.model_name, modelRevision=metadata.model_revision,
            quantization=metadata.quantization, promptVersion=prompt.PROMPT_VERSION,
            schemaVersion=prompt.SCHEMA_VERSION, groundingStatus="REJECTED",
            inferenceDurationMs=(trace or {}).get("inference_ms", 0),
            repairDurationMs=(trace or {}).get("repair_ms", 0),
            groundingDurationMs=(trace or {}).get("grounding_ms", 0),
            generationCallCount=(trace or {}).get("generation_calls", 0),
            providerAttempts=(trace or {}).get("provider_attempts", 0),
            successfulGenerations=(trace or {}).get("successful_generations", 0),
            ragUsed=retrieval.status == RetrievalStatus.USED, ragPolicy=rag_policy,
            retrievalStatus=retrieval.status.value, knowledgeIndexVersion=retrieval.index_version,
            retrievedChunkIds=[item.chunk.chunk_id for item in retrieval.chunks], citedChunkIds=[],
            retrievalDurationMs=retrieval.duration_ms, references=[],
        )

    @staticmethod
    def _schema_failure(exc):
        if isinstance(exc, json.JSONDecodeError):
            return "json_decode", "$"
        errors = exc.errors(include_url=False, include_context=False, include_input=False)
        if not errors:
            return "schema_validation", "$"
        first = errors[0]
        location = ".".join(str(part) for part in first.get("loc", ())) or "$"
        return str(first.get("type") or "schema_validation"), location

    def _retrieve(self, task_id, rag_policy, request):
        if rag_policy == "DISABLED":
            return RetrievalResult(RetrievalStatus.NOT_REQUIRED)
        if self._retriever is None:
            return RetrievalResult(RetrievalStatus.KNOWLEDGE_UNAVAILABLE)
        query = self._query_builder.build(task_id, request)
        return self._retriever.retrieve(task_id, query.text, query.domains)

    @staticmethod
    def _constrain_reference_ids(value, allowed_ids):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in {"referenceChunkIds", "summaryReferenceChunkIds"} and isinstance(child, dict):
                    child["items"] = {"type": "string", "enum": allowed_ids} if allowed_ids else {"type": "string"}
                    if not allowed_ids:
                        child["maxItems"] = 0
                else:
                    DoctorSupportExecutionService._constrain_reference_ids(child, allowed_ids)
        elif isinstance(value, list):
            for child in value:
                DoctorSupportExecutionService._constrain_reference_ids(child, allowed_ids)

    @staticmethod
    def _cited_chunk_ids(value):
        ordered = []

        def visit(node):
            if isinstance(node, dict):
                for key, child in node.items():
                    if key in {"referenceChunkIds", "summaryReferenceChunkIds"} and isinstance(child, list):
                        for chunk_id in child:
                            if chunk_id not in ordered:
                                ordered.append(chunk_id)
                    else:
                        visit(child)
            elif isinstance(node, list):
                for child in node:
                    visit(child)

        visit(value)
        return ordered

    @staticmethod
    def _reference(chunk):
        return {
            "chunkId": chunk.chunk_id, "sourceId": chunk.source_id, "documentId": chunk.document_id,
            "title": chunk.title, "publisher": chunk.publisher, "sourceType": chunk.source_type,
            "clinicalDomain": chunk.clinical_domain, "publicationDate": chunk.publication_date,
            "version": chunk.version, "jurisdiction": chunk.jurisdiction,
            "sourceReference": chunk.source_reference, "sectionPath": chunk.section_path,
        }

    @staticmethod
    def _unsupported_direct_request(task_id, question):
        if task_id != "FOCUSED_EVIDENCE_QUESTION":
            return None
        normalized = question.lower()
        if any(term in normalized for term in ("diagnose the patient", "diagnosis is", "best medication", "best drug", "dosage", "dose to", "treatment plan", "prescribe")):
            return "UNSUPPORTED_CLINICAL_REQUEST"
        if any(term in normalized for term in ("ignore safety", "ignore prior", "system prompt", "chain of thought", "hidden report")):
            return "PROMPT_INJECTION_REJECTED"
        if re.match(r"^\s*(?:what is|explain|tell me about|how (?:do|does|should))\b", normalized) and not any(
            term in normalized for term in ("this", "these", "selected", "report", "result", "finding", "evidence", "value", "cbc", "ns1", "mcv", "mch", "rbc", "platelet", "tsh", "creatinine")
        ):
            return "UNSUPPORTED_CLINICAL_REQUEST"
        return None
