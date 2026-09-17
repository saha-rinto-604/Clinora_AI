from __future__ import annotations

import json

from pydantic import TypeAdapter, ValidationError

from app.knowledge.models import RetrievalResult, RetrievalStatus
from app.knowledge.query import ClinicalKnowledgeQueryBuilder
from app.knowledge.retrieval import ClinicalKnowledgeRetriever
from app.model_runtime import MalformedModelResponseError, MedGemmaRuntime
from app.prompts import (
    doctor_compare_evidence_v1,
    doctor_connect_evidence_v2,
    doctor_cross_check_assessment_v2,
    doctor_find_gaps_v2,
)
from app.schemas.doctor_support_execution import (
    CompareEvidenceResult,
    ConnectEvidenceResult,
    CrossCheckAssessmentResult,
    DoctorSupportExecutionRequest,
    DoctorSupportExecutionResponse,
    FindGapsResult,
    TaskExecutionResponse,
)
from app.services.doctor_support_grounding import UnsafeDoctorSupportOutputError, validate_grounding


class InvalidDoctorSupportOutputError(RuntimeError):
    def __init__(self, reason_code: str) -> None:
        super().__init__("Doctor support model output was rejected.")
        self.reason_code = reason_code


TASKS = {
    "CONNECT_EVIDENCE": (ConnectEvidenceResult, doctor_connect_evidence_v2),
    "COMPARE_EVIDENCE": (CompareEvidenceResult, doctor_compare_evidence_v1),
    "CROSS_CHECK_ASSESSMENT": (CrossCheckAssessmentResult, doctor_cross_check_assessment_v2),
    "FIND_GAPS": (FindGapsResult, doctor_find_gaps_v2),
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
        retrieval = self._retrieve(task_id, task.ragPolicy, request)
        if task.ragPolicy == "REQUIRED_WHEN_AVAILABLE" and retrieval.status != RetrievalStatus.USED:
            return self._failed(task_id, prompt, "CLINICAL_REFERENCE_REQUIRED", task.ragPolicy, retrieval)
        metadata = self._runtime.metadata
        try:
            result = self._generate_with_one_structural_repair(request, model, prompt, retrieval)
            validate_grounding(result, request.evidenceSnapshot, retrieval.chunks)
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
        generation = self._runtime.generate(messages, response_schema=schema)
        try:
            return adapter.validate_python(json.loads(generation.content))
        except (json.JSONDecodeError, ValidationError):
            repair_messages = messages + [
                {"role": "assistant", "content": generation.content},
                {"role": "user", "content": "Repair only the JSON structure to match the schema. Do not add facts or change evidence or reference IDs."},
            ]
            repaired = self._runtime.generate(repair_messages, response_schema=schema)
            try:
                return adapter.validate_python(json.loads(repaired.content))
            except (json.JSONDecodeError, ValidationError) as exc:
                raise InvalidDoctorSupportOutputError("INVALID_CONTRACT_AFTER_REPAIR") from exc

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
