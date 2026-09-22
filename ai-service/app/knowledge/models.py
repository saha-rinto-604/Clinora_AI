from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class ReviewStatus(StrEnum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    RETIRED = "RETIRED"


class RetrievalStatus(StrEnum):
    NOT_REQUIRED = "NOT_REQUIRED"
    USED = "USED"
    NO_RELEVANT_REFERENCE = "NO_RELEVANT_REFERENCE"
    KNOWLEDGE_UNAVAILABLE = "KNOWLEDGE_UNAVAILABLE"
    RETRIEVAL_FAILED_SAFE = "RETRIEVAL_FAILED_SAFE"


@dataclass(frozen=True)
class ClinicalKnowledgeDocument:
    source_id: str
    document_id: str
    title: str
    publisher: str
    source_type: str
    clinical_domain: str
    publication_date: str | None
    version: str | None
    jurisdiction: str | None
    source_reference: str | None
    review_status: ReviewStatus
    content_checksum: str
    content: str


@dataclass(frozen=True)
class ClinicalKnowledgeChunk:
    chunk_id: str
    source_id: str
    document_id: str
    title: str
    publisher: str
    source_type: str
    clinical_domain: str
    publication_date: str | None
    version: str | None
    jurisdiction: str | None
    source_reference: str | None
    review_status: ReviewStatus
    section_path: str
    ordinal: int
    text: str
    chunk_checksum: str
    embedding: tuple[float, ...]


@dataclass(frozen=True)
class ScoredChunk:
    chunk: ClinicalKnowledgeChunk
    score: float


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: ClinicalKnowledgeChunk
    hybrid_score: float
    semantic_score: float
    lexical_score: float


@dataclass(frozen=True)
class KnowledgeHealth:
    ready: bool
    status: str
    index_version: str | None
    approved_chunk_count: int
    embedding_model: str


@dataclass(frozen=True)
class RetrievalResult:
    status: RetrievalStatus
    chunks: tuple[RetrievedChunk, ...] = ()
    index_version: str | None = None
    duration_ms: int = 0
    semantic_available: bool = False
    lexical_available: bool = False
    query_hash: str | None = None
    diagnostics: tuple[str, ...] = field(default_factory=tuple)
