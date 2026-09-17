from __future__ import annotations

import hashlib
import time
from collections import OrderedDict, defaultdict
from dataclasses import dataclass
from threading import Lock

from app.knowledge.embeddings import ClinicalEmbeddingProvider, EmbeddingUnavailableError
from app.knowledge.models import RetrievalResult, RetrievalStatus, RetrievedChunk, ScoredChunk
from app.knowledge.store import ClinicalKnowledgeStore, KnowledgeStoreError


@dataclass(frozen=True)
class RetrievalConfig:
    version: str = "clinical-hybrid-retrieval-v1"
    candidates_per_channel: int = 12
    top_k: int = 4
    minimum_score: float = 0.16
    maximum_characters: int = 5000
    maximum_chunks_per_document: int = 2
    cache_entries: int = 128
    retrieval_timeout_ms: int = 1500


class ClinicalKnowledgeRetriever:
    def __init__(self, store: ClinicalKnowledgeStore, embedding_provider: ClinicalEmbeddingProvider, config: RetrievalConfig | None = None) -> None:
        self.store = store
        self.embedding_provider = embedding_provider
        self.config = config or RetrievalConfig()
        self._cache: OrderedDict[str, RetrievalResult] = OrderedDict()
        self._cache_lock = Lock()

    def health(self):
        return self.store.health()

    def retrieve(self, task_id: str, query: str, domains: tuple[str, ...]) -> RetrievalResult:
        started = time.perf_counter()
        health = self.store.health()
        query_hash = hashlib.sha256(query.encode("utf-8")).hexdigest()
        if not health.ready:
            return RetrievalResult(
                RetrievalStatus.KNOWLEDGE_UNAVAILABLE, index_version=health.index_version,
                duration_ms=self._elapsed(started), query_hash=query_hash,
            )
        cache_key = "|".join((task_id, query_hash, ",".join(domains), health.index_version or "", self.config.version))
        with self._cache_lock:
            cached = self._cache.get(cache_key)
            if cached:
                self._cache.move_to_end(cache_key)
                return cached

        semantic: list[ScoredChunk] = []
        lexical: list[ScoredChunk] = []
        diagnostics: list[str] = []
        try:
            semantic = self.store.semantic_search(
                self.embedding_provider.embed(query), domains, self.config.candidates_per_channel
            )
        except (KnowledgeStoreError, EmbeddingUnavailableError, ValueError):
            diagnostics.append("SEMANTIC_CHANNEL_UNAVAILABLE")
        if self._elapsed(started) > self.config.retrieval_timeout_ms:
            return RetrievalResult(
                RetrievalStatus.RETRIEVAL_FAILED_SAFE, index_version=health.index_version,
                duration_ms=self._elapsed(started), query_hash=query_hash, diagnostics=("RETRIEVAL_TIMEOUT",),
            )
        try:
            lexical = self.store.lexical_search(query, domains, self.config.candidates_per_channel)
        except KnowledgeStoreError:
            diagnostics.append("LEXICAL_CHANNEL_UNAVAILABLE")
        if self._elapsed(started) > self.config.retrieval_timeout_ms:
            return RetrievalResult(
                RetrievalStatus.RETRIEVAL_FAILED_SAFE, index_version=health.index_version,
                duration_ms=self._elapsed(started), query_hash=query_hash, diagnostics=("RETRIEVAL_TIMEOUT",),
            )
        if not semantic and not lexical and len(diagnostics) == 2:
            return RetrievalResult(
                RetrievalStatus.RETRIEVAL_FAILED_SAFE, index_version=health.index_version,
                duration_ms=self._elapsed(started), query_hash=query_hash, diagnostics=tuple(diagnostics),
            )

        semantic_scores = {item.chunk.chunk_id: item for item in semantic}
        lexical_scores = {item.chunk.chunk_id: item for item in lexical}
        candidates = {}
        for item in (*semantic, *lexical):
            candidates[item.chunk.chunk_id] = item.chunk
        ranked: list[RetrievedChunk] = []
        for chunk_id, chunk in candidates.items():
            semantic_score = semantic_scores.get(chunk_id).score if chunk_id in semantic_scores else 0.0
            lexical_score = lexical_scores.get(chunk_id).score if chunk_id in lexical_scores else 0.0
            hybrid = semantic_score * 0.55 + lexical_score * 0.45
            if hybrid >= self.config.minimum_score:
                ranked.append(RetrievedChunk(chunk, hybrid, semantic_score, lexical_score))
        ranked.sort(key=lambda item: (-item.hybrid_score, item.chunk.chunk_id))

        selected: list[RetrievedChunk] = []
        chars = 0
        per_document: dict[str, int] = defaultdict(int)
        checksums: set[str] = set()
        for item in ranked:
            chunk = item.chunk
            if chunk.chunk_checksum in checksums or per_document[chunk.document_id] >= self.config.maximum_chunks_per_document:
                continue
            if selected and chars + len(chunk.text) > self.config.maximum_characters:
                continue
            selected.append(item)
            chars += len(chunk.text)
            checksums.add(chunk.chunk_checksum)
            per_document[chunk.document_id] += 1
            if len(selected) == self.config.top_k:
                break
        result = RetrievalResult(
            RetrievalStatus.USED if selected else RetrievalStatus.NO_RELEVANT_REFERENCE,
            tuple(selected), health.index_version, self._elapsed(started), bool(semantic), bool(lexical),
            query_hash, tuple(diagnostics),
        )
        with self._cache_lock:
            self._cache[cache_key] = result
            self._cache.move_to_end(cache_key)
            while len(self._cache) > self.config.cache_entries:
                self._cache.popitem(last=False)
        return result

    @staticmethod
    def _elapsed(started: float) -> int:
        return max(0, round((time.perf_counter() - started) * 1000))
