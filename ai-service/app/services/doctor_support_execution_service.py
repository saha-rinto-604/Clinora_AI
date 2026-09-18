from __future__ import annotations

import json
import re
import logging
import time

from pydantic import TypeAdapter, ValidationError

from app.knowledge.models import RetrievalResult, RetrievalStatus
from app.knowledge.query import ClinicalKnowledgeQueryBuilder
from app.knowledge.retrieval import ClinicalKnowledgeRetriever
from app.model_runtime import MalformedModelResponseError, MedGemmaRuntime
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
from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError, validate_grounding

LOGGER = logging.getLogger(__name__)

class InvalidDoctorSupportOutputError(RuntimeError):
    def __init__(self, reason_code: str) -> None:
        super().__init__("Doctor support model output was rejected.")
        self.reason_code = reason_code


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


class DoctorSupportExecutionService:
    def __init__(self, runtime: MedGemmaRuntime, retriever: ClinicalKnowledgeRetriever | None = None) -> None:
        self._runtime = runtime
        self._retriever = retriever
        self._query_builder = ClinicalKnowledgeQueryBuilder()

    def execute(self, request: DoctorSupportExecutionRequest) -> DoctorSupportExecutionResponse:
        return DoctorSupportExecutionResponse(taskResults=[self._execute_task(request, task) for task in request.tasks])

    def _execute_task(self, request: DoctorSupportExecutionRequest, task) -> TaskExecutionResponse:
        task_id = task.taskId
        model, prompt = TASKS[task_id]
        if task.promptVersion != prompt.PROMPT_VERSION or task.schemaVersion != prompt.SCHEMA_VERSION:
            return self._failed(task_id, prompt, "TASK_VERSION_MISMATCH", task.ragPolicy)
        unsafe_request = self._unsupported_direct_request(task_id, request.originalQuestion)
        if unsafe_request:
            return self._failed(task_id, prompt, unsafe_request, task.ragPolicy)
        if task_id == "STRUCTURE_NOTES" and not (request.doctorNotes or "").strip():
            return self._failed(task_id, prompt, "DOCTOR_NOTES_REQUIRED", task.ragPolicy)
        retrieval = self._retrieve(task_id, task.ragPolicy, request)
        if task.ragPolicy == "REQUIRED_WHEN_AVAILABLE" and retrieval.status != RetrievalStatus.USED:
            return self._failed(task_id, prompt, "CLINICAL_REFERENCE_REQUIRED", task.ragPolicy, retrieval)
        metadata = self._runtime.metadata
        try:
            result = self._generate_with_one_structural_repair(request, model, prompt, retrieval)
            result = self._normalize_connect_evidence(result, model, request, retrieval)
            result = self._normalize_brief_patient(result, model, request)
            validate_grounding(result, request.evidenceSnapshot, retrieval.chunks, request.doctorNotes, request.appointmentContext)
            cited_ids = self._cited_chunk_ids(result.model_dump(mode="json"))
            chunks_by_id = {item.chunk.chunk_id: item.chunk for item in retrieval.chunks}
            return TaskExecutionResponse(
                taskId=task_id, status="SUCCEEDED", result=result, safeFailureCode=None,
                modelName=metadata.model_name, modelRevision=metadata.model_revision,
                quantization=metadata.quantization, promptVersion=prompt.PROMPT_VERSION,
                schemaVersion=prompt.SCHEMA_VERSION, groundingStatus="PASSED",
                ragUsed=retrieval.status == RetrievalStatus.USED, ragPolicy=task.ragPolicy,
                retrievalStatus=retrieval.status.value, knowledgeIndexVersion=retrieval.index_version,
                retrievedChunkIds=[item.chunk.chunk_id for item in retrieval.chunks], citedChunkIds=cited_ids,
                retrievalDurationMs=retrieval.duration_ms,
                references=[self._reference(chunks_by_id[item]) for item in cited_ids],
            )
        except UnsafeDoctorSupportOutputError as exc:
            return self._failed(task_id, prompt, exc.reason_code, task.ragPolicy, retrieval)
        except (InvalidDoctorSupportOutputError, MalformedModelResponseError) as exc:
            return self._failed(
                task_id, prompt, getattr(exc, "reason_code", "INVALID_MODEL_OUTPUT"), task.ragPolicy, retrieval
            )

    def _generate_with_one_structural_repair(self, request, model, prompt, retrieval):
        adapter = TypeAdapter(model)
        schema = adapter.json_schema()
        self._constrain_reference_ids(schema, [item.chunk.chunk_id for item in retrieval.chunks])
        messages = prompt.build_messages(request, retrieval.chunks)
        generation = self._generate_measured(request, messages, schema, "initial")
        try:
            return adapter.validate_python(json.loads(generation.content))
        except (json.JSONDecodeError, ValidationError):
            repair_messages = messages + [
                {"role": "assistant", "content": generation.content},
                {"role": "user", "content": "Repair only the JSON structure to match the schema. Do not add facts or change evidence or reference IDs."},
            ]
            repaired = self._generate_measured(request, repair_messages, schema, "structural_repair")
            try:
                return adapter.validate_python(json.loads(repaired.content))
            except (json.JSONDecodeError, ValidationError) as exc:
                raise InvalidDoctorSupportOutputError("INVALID_CONTRACT_AFTER_REPAIR") from exc

    def _generate_measured(self, request, messages, schema, attempt):
        started = time.perf_counter()
        generation = self._runtime.generate(messages, response_schema=schema)
        LOGGER.info(
            "doctor_execution_generation request_id=%s endpoint=/internal/v1/doctor-support/execute "
            "attempt=%s duration_ms=%d prompt_tokens=%s completion_tokens=%s finish_reason=%s",
            request.executionId, attempt, round((time.perf_counter() - started) * 1000),
            generation.prompt_tokens, generation.completion_tokens,
            generation.finish_reason if generation.finish_reason in {"stop", "length"} else "other",
        )
        return generation

    @staticmethod
    def _normalize_connect_evidence(result, model, request, retrieval):
        if result.taskId != "CONNECT_EVIDENCE":
            return result
        payload = result.model_dump(mode="json")
        normalized = False
        valid_patterns = []
        for pattern in payload["patterns"]:
            unique = []
            by_id = {}
            for reference in pattern["evidence"]:
                observation_id = reference["observationId"]
                previous = by_id.get(observation_id)
                if previous is None:
                    by_id[observation_id] = reference
                    unique.append(reference)
                elif previous != reference:
                    LOGGER.info("doctor_execution_rejection category=conflicting_duplicate_connect_evidence")
                    raise InvalidDoctorSupportOutputError("DUPLICATE_EVIDENCE_ID")
                else:
                    normalized = True
            if len(unique) < 2:
                LOGGER.info(
                    "doctor_execution_rejection category=insufficient_distinct_connect_evidence total=%d unique=%d",
                    len(pattern["evidence"]), len(unique),
                )
                normalized = True
                continue
            pattern["evidence"] = unique
            valid_patterns.append(pattern)
        grounded_patterns = []
        for pattern in valid_patterns:
            candidate_payload = {
                **payload,
                "summary": "The authorized findings can be reviewed together.",
                "patterns": [pattern],
                "limitations": [],
                "summaryReferenceChunkIds": [],
            }
            candidate = model.model_validate(candidate_payload)
            try:
                validate_grounding(
                    candidate, request.evidenceSnapshot, retrieval.chunks,
                    request.doctorNotes, request.appointmentContext,
                )
                grounded_patterns.append(pattern)
            except UnsafeDoctorSupportOutputError as exc:
                normalized = True
                LOGGER.info(
                    "doctor_execution_normalization category=discarded_unsafe_connect_pattern reason=%s",
                    exc.reason_code,
                )
        valid_patterns = grounded_patterns
        if normalized:
            payload["patterns"] = valid_patterns
            payload["summary"] = "The authorized findings can be reviewed together."
            payload["limitations"] = []
            payload["summaryReferenceChunkIds"] = []
            if not valid_patterns:
                payload["summary"] = (
                    "Clinora could not support a relationship using at least two distinct authorized observations."
                )
                limitation = "No model-proposed relationship contained two distinct authorized observations."
                payload["limitations"] = [limitation]
            LOGGER.info("doctor_execution_normalization category=connect_evidence_reference_deduplication")
            return model.model_validate(payload)
        return result

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

    def _failed(self, task_id, prompt, code, rag_policy="DISABLED", retrieval=None):
        metadata = self._runtime.metadata
        retrieval = retrieval or RetrievalResult(RetrievalStatus.NOT_REQUIRED)
        return TaskExecutionResponse(
            taskId=task_id, status="FAILED_SAFE", result=None, safeFailureCode=code,
            modelName=metadata.model_name, modelRevision=metadata.model_revision,
            quantization=metadata.quantization, promptVersion=prompt.PROMPT_VERSION,
            schemaVersion=prompt.SCHEMA_VERSION, groundingStatus="REJECTED",
            ragUsed=retrieval.status == RetrievalStatus.USED, ragPolicy=rag_policy,
            retrievalStatus=retrieval.status.value, knowledgeIndexVersion=retrieval.index_version,
            retrievedChunkIds=[item.chunk.chunk_id for item in retrieval.chunks], citedChunkIds=[],
            retrievalDurationMs=retrieval.duration_ms, references=[],
        )

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
