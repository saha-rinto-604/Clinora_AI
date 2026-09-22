from __future__ import annotations

import os
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, status

from app.api.internal_analysis import build_router
from app.model_runtime import MedGemmaRuntime, ModelUnavailableError
from app.gemini_runtime import GeminiRuntime
from app.services.report_analysis_service import ReportAnalysisService
from app.services.doctor_support_routing_service import DoctorSupportRoutingService
from app.services.doctor_support_execution_service import DoctorSupportExecutionService
from app.services.doctor_query_interpreter_service import DoctorQueryInterpreterService
from app.knowledge.embeddings import ClinicalHashEmbeddingProvider
from app.knowledge.retrieval import ClinicalKnowledgeRetriever
from app.knowledge.store import SqliteClinicalKnowledgeStore

logging.basicConfig(level=logging.INFO)

runtime = MedGemmaRuntime()
doctor_runtime = GeminiRuntime()
analysis_service = ReportAnalysisService(runtime)
doctor_support_service = DoctorSupportRoutingService(doctor_runtime)
knowledge_embedding = ClinicalHashEmbeddingProvider()
default_knowledge_path = Path(__file__).resolve().parents[1] / "var" / "clinical-knowledge.db"
knowledge_store = SqliteClinicalKnowledgeStore(
    os.getenv("CLINICAL_KNOWLEDGE_DB_PATH", str(default_knowledge_path)),
    create=False,
    embedding_model=knowledge_embedding.model_id,
)
knowledge_retriever = ClinicalKnowledgeRetriever(knowledge_store, knowledge_embedding)
doctor_support_execution_service = DoctorSupportExecutionService(doctor_runtime, knowledge_retriever)
doctor_query_interpreter_service = DoctorQueryInterpreterService(doctor_runtime)

app = FastAPI(title="Clinora AI Service", version="0.2.0")
app.include_router(build_router(
    analysis_service, doctor_support_service, doctor_support_execution_service, doctor_query_interpreter_service
))


@app.get("/health")
async def health() -> dict[str, object]:
    knowledge = knowledge_retriever.health()
    return {
        "status": "UP", "service": "ai-service",
        "clinicalKnowledge": {
            "status": knowledge.status, "ready": knowledge.ready,
            "indexVersion": knowledge.index_version, "approvedChunkCount": knowledge.approved_chunk_count,
            "embeddingModel": knowledge.embedding_model,
        },
        "doctorInference": {
            "configured": doctor_runtime.loaded,
            "model": doctor_runtime.metadata.model_name,
        },
    }


@app.get("/health/clinical-knowledge")
async def clinical_knowledge_health() -> dict[str, object]:
    knowledge = knowledge_retriever.health()
    return {
        "status": knowledge.status, "ready": knowledge.ready,
        "indexVersion": knowledge.index_version, "approvedChunkCount": knowledge.approved_chunk_count,
        "embeddingModel": knowledge.embedding_model,
    }


@app.get("/ready")
async def ready() -> dict[str, object]:
    try:
        runtime.ensure_loaded()
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MedGemma is not ready.",
        ) from exc
    metadata = runtime.metadata
    knowledge = knowledge_retriever.health()
    return {
        "status": "READY",
        "service": "ai-service",
        "model": metadata.model_name,
        "revision": metadata.model_revision,
        "quantization": metadata.quantization,
        "clinicalKnowledge": {"status": knowledge.status, "ready": knowledge.ready, "indexVersion": knowledge.index_version},
    }
