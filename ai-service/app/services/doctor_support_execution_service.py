from __future__ import annotations

import json

from pydantic import TypeAdapter, ValidationError

from app.model_runtime import MalformedModelResponseError, MedGemmaRuntime
from app.prompts import (
    doctor_compare_evidence_v1,
    doctor_connect_evidence_v1,
    doctor_cross_check_assessment_v1,
    doctor_find_gaps_v1,
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
    "CONNECT_EVIDENCE": (ConnectEvidenceResult, doctor_connect_evidence_v1),
    "COMPARE_EVIDENCE": (CompareEvidenceResult, doctor_compare_evidence_v1),
    "CROSS_CHECK_ASSESSMENT": (CrossCheckAssessmentResult, doctor_cross_check_assessment_v1),
    "FIND_GAPS": (FindGapsResult, doctor_find_gaps_v1),
}


class DoctorSupportExecutionService:
    def __init__(self, runtime: MedGemmaRuntime) -> None:
        self._runtime = runtime

    def execute(self, request: DoctorSupportExecutionRequest) -> DoctorSupportExecutionResponse:
        results = [self._execute_task(request, task) for task in request.tasks]
        return DoctorSupportExecutionResponse(taskResults=results)

    def _execute_task(self, request: DoctorSupportExecutionRequest, task) -> TaskExecutionResponse:
        task_id = task.taskId
        model, prompt = TASKS[task_id]
        if task.promptVersion != prompt.PROMPT_VERSION or task.schemaVersion != prompt.SCHEMA_VERSION:
            return self._failed(task_id, prompt, "TASK_VERSION_MISMATCH")
        metadata = self._runtime.metadata
        try:
            result = self._generate_with_one_structural_repair(request, model, prompt)
            validate_grounding(result, request.evidenceSnapshot)
            return TaskExecutionResponse(
                taskId=task_id, status="SUCCEEDED", result=result, safeFailureCode=None,
                modelName=metadata.model_name, modelRevision=metadata.model_revision,
                quantization=metadata.quantization, promptVersion=prompt.PROMPT_VERSION,
                schemaVersion=prompt.SCHEMA_VERSION, groundingStatus="PASSED",
            )
        except UnsafeDoctorSupportOutputError as exc:
            return self._failed(task_id, prompt, exc.reason_code)
        except (InvalidDoctorSupportOutputError, MalformedModelResponseError) as exc:
            return self._failed(task_id, prompt, getattr(exc, "reason_code", "INVALID_MODEL_OUTPUT"))

    def _generate_with_one_structural_repair(self, request, model, prompt):
        adapter = TypeAdapter(model)
        schema = adapter.json_schema()
        messages = prompt.build_messages(request)
        generation = self._runtime.generate(messages, response_schema=schema)
        try:
            return adapter.validate_python(json.loads(generation.content))
        except (json.JSONDecodeError, ValidationError):
            repair_messages = messages + [
                {"role": "assistant", "content": generation.content},
                {"role": "user", "content": "Repair only the JSON structure to match the schema. Do not add facts or change evidence IDs."},
            ]
            repaired = self._runtime.generate(repair_messages, response_schema=schema)
            try:
                return adapter.validate_python(json.loads(repaired.content))
            except (json.JSONDecodeError, ValidationError) as exc:
                raise InvalidDoctorSupportOutputError("INVALID_CONTRACT_AFTER_REPAIR") from exc

    def _failed(self, task_id, prompt, code):
        metadata = self._runtime.metadata
        return TaskExecutionResponse(
            taskId=task_id, status="FAILED_SAFE", result=None, safeFailureCode=code,
            modelName=metadata.model_name, modelRevision=metadata.model_revision,
            quantization=metadata.quantization, promptVersion=prompt.PROMPT_VERSION,
            schemaVersion=prompt.SCHEMA_VERSION, groundingStatus="REJECTED",
        )
