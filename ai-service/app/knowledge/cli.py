from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from app.knowledge.chunking import ClinicalDocumentChunker
from app.knowledge.embeddings import ClinicalHashEmbeddingProvider
from app.knowledge.ingestion import ClinicalKnowledgeIngestionService
from app.knowledge.store import SqliteClinicalKnowledgeStore


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage Clinora's curated clinical knowledge index.")
    default_path = Path(__file__).resolve().parents[2] / "var" / "clinical-knowledge.db"
    parser.add_argument("--db", default=os.getenv("CLINICAL_KNOWLEDGE_DB_PATH", str(default_path)))
    subcommands = parser.add_subparsers(dest="command", required=True)
    ingest = subcommands.add_parser("ingest", help="Idempotently ingest a reviewed local manifest.")
    ingest.add_argument("--manifest", required=True)
    retire = subcommands.add_parser("retire", help="Retire a document from fresh retrieval.")
    retire.add_argument("--document-id", required=True)
    subcommands.add_parser("status", help="Show safe index readiness metadata.")
    args = parser.parse_args()

    embedding = ClinicalHashEmbeddingProvider()
    store = SqliteClinicalKnowledgeStore(args.db, create=True, embedding_model=embedding.model_id)
    if args.command == "ingest":
        service = ClinicalKnowledgeIngestionService(store, ClinicalDocumentChunker(embedding))
        result = service.ingest_manifest(args.manifest)
    elif args.command == "retire":
        result = {"retired": store.retire_document(args.document_id), "indexVersion": store.index_version()}
    else:
        health = store.health()
        result = {
            "ready": health.ready, "status": health.status,
            "indexVersion": health.index_version,
            "approvedChunkCount": health.approved_chunk_count,
            "embeddingModel": health.embedding_model,
        }
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
