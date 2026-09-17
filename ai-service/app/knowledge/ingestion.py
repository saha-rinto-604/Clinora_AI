from __future__ import annotations

import hashlib
import json
import unicodedata
from datetime import date
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.knowledge.chunking import ClinicalDocumentChunker
from app.knowledge.models import ClinicalKnowledgeDocument, ReviewStatus
from app.knowledge.store import SqliteClinicalKnowledgeStore


class ManifestDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sourceId: str = Field(pattern=r"^[a-z0-9][a-z0-9._-]{2,79}$")
    documentId: str = Field(pattern=r"^[a-z0-9][a-z0-9._-]{2,79}$")
    title: str = Field(min_length=3, max_length=240)
    publisher: str = Field(min_length=2, max_length=200)
    sourceType: str = Field(min_length=2, max_length=60)
    clinicalDomain: str = Field(pattern=r"^[a-z][a-z0-9_]{2,79}$")
    publicationDate: date | None = None
    version: str | None = Field(default=None, max_length=80)
    jurisdiction: str | None = Field(default=None, max_length=80)
    sourceReference: str | None = Field(default=None, max_length=500)
    reviewStatus: ReviewStatus
    contentFile: str = Field(min_length=1, max_length=300)


class KnowledgeManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    corpusName: str = Field(min_length=3, max_length=120)
    corpusVersion: str = Field(min_length=1, max_length=80)
    documents: list[ManifestDocument] = Field(min_length=1, max_length=1000)


class ClinicalKnowledgeIngestionService:
    RETRIEVAL_CONFIG_VERSION = "clinical-hybrid-retrieval-v1"

    def __init__(self, store: SqliteClinicalKnowledgeStore, chunker: ClinicalDocumentChunker) -> None:
        self.store = store
        self.chunker = chunker

    def ingest_manifest(self, manifest_path: str | Path) -> dict[str, object]:
        path = Path(manifest_path).resolve()
        try:
            manifest = KnowledgeManifest.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, ValidationError, json.JSONDecodeError) as exc:
            raise ValueError("Clinical knowledge manifest is invalid or unreadable.") from exc
        document_ids = [item.documentId for item in manifest.documents]
        if len(document_ids) != len(set(document_ids)):
            raise ValueError("Clinical knowledge manifest contains duplicate document IDs.")

        changed = 0
        unchanged = 0
        chunks_written = 0
        expected_configuration = (
            self.chunker.embedding_provider.model_id,
            self.chunker.config.version,
            self.RETRIEVAL_CONFIG_VERSION,
        )
        force_rebuild = self.store.configuration() != expected_configuration
        for item in manifest.documents:
            content_path = (path.parent / item.contentFile).resolve()
            if path.parent not in content_path.parents:
                raise ValueError("Clinical knowledge content path escapes the manifest directory.")
            try:
                content = self._normalize(content_path.read_text(encoding="utf-8"))
            except OSError as exc:
                raise ValueError("Clinical knowledge document is unreadable.") from exc
            if len(content) < 20:
                raise ValueError("Clinical knowledge document content is too short.")
            checksum = hashlib.sha256(content.encode("utf-8")).hexdigest()
            document = ClinicalKnowledgeDocument(
                source_id=item.sourceId, document_id=item.documentId, title=item.title,
                publisher=item.publisher, source_type=item.sourceType,
                clinical_domain=item.clinicalDomain,
                publication_date=item.publicationDate.isoformat() if item.publicationDate else None,
                version=item.version, jurisdiction=item.jurisdiction,
                source_reference=item.sourceReference, review_status=item.reviewStatus,
                content_checksum=checksum, content=content,
            )
            chunks = self.chunker.chunk(document)
            updated = self.store.upsert_document(
                document, chunks, embedding_model=self.chunker.embedding_provider.model_id,
                chunking_version=self.chunker.config.version,
                retrieval_version=self.RETRIEVAL_CONFIG_VERSION,
                force=force_rebuild,
            )
            if updated:
                changed += 1
                chunks_written += len(chunks)
            else:
                unchanged += 1
        self.store.set_corpus_metadata(manifest.corpusName, manifest.corpusVersion)
        health = self.store.health()
        return {
            "corpusName": manifest.corpusName,
            "corpusVersion": manifest.corpusVersion,
            "changedDocuments": changed,
            "unchangedDocuments": unchanged,
            "chunksWritten": chunks_written,
            "approvedChunkCount": health.approved_chunk_count,
            "indexVersion": health.index_version,
            "embeddingModel": health.embedding_model,
            "chunkingVersion": self.chunker.config.version,
            "retrievalConfigVersion": self.RETRIEVAL_CONFIG_VERSION,
        }

    @staticmethod
    def _normalize(content: str) -> str:
        normalized = unicodedata.normalize("NFKC", content).replace("\r\n", "\n").replace("\r", "\n")
        lines = [line.rstrip() for line in normalized.splitlines()]
        return "\n".join(lines).strip()
