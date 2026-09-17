from __future__ import annotations

import hashlib
import json
import math
import sqlite3
from collections.abc import Sequence
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Protocol

from app.knowledge.embeddings import clinical_tokens, cosine_similarity
from app.knowledge.models import (
    ClinicalKnowledgeChunk,
    ClinicalKnowledgeDocument,
    KnowledgeHealth,
    ReviewStatus,
    ScoredChunk,
)


class KnowledgeStoreError(RuntimeError):
    pass


class ClinicalKnowledgeStore(Protocol):
    def health(self) -> KnowledgeHealth: ...
    def index_version(self) -> str | None: ...
    def configuration(self) -> tuple[str | None, str | None, str | None]: ...
    def set_corpus_metadata(self, name: str, version: str) -> None: ...
    def upsert_document(self, document: ClinicalKnowledgeDocument, chunks: Sequence[ClinicalKnowledgeChunk], *, embedding_model: str, chunking_version: str, retrieval_version: str, force: bool = False) -> bool: ...
    def retire_document(self, document_id: str) -> bool: ...
    def semantic_search(self, embedding: Sequence[float], domains: Sequence[str], limit: int) -> list[ScoredChunk]: ...
    def lexical_search(self, query: str, domains: Sequence[str], limit: int) -> list[ScoredChunk]: ...
    def lookup_chunks(self, chunk_ids: Sequence[str]) -> list[ClinicalKnowledgeChunk]: ...


class SqliteClinicalKnowledgeStore:
    SCHEMA_VERSION = "clinical-knowledge-sqlite-v1"

    def __init__(self, path: str | Path, *, create: bool, embedding_model: str) -> None:
        self.path = Path(path)
        self.create = create
        self.embedding_model = embedding_model
        if create:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self._connect(write=True) as connection:
                self._initialize(connection)

    def health(self) -> KnowledgeHealth:
        try:
            with self._connect() as connection:
                count = connection.execute(
                    "SELECT COUNT(*) FROM clinical_knowledge_chunks c JOIN clinical_knowledge_documents d ON d.document_id=c.document_id WHERE d.review_status='APPROVED'"
                ).fetchone()[0]
                version = self._meta(connection, "index_version")
                indexed_model = self._meta(connection, "embedding_model") or self.embedding_model
                if indexed_model != self.embedding_model:
                    return KnowledgeHealth(False, "INDEX_INCOMPATIBLE", version, count, indexed_model)
                return KnowledgeHealth(bool(count and version), "READY" if count and version else "INDEX_EMPTY", version, count, indexed_model)
        except (sqlite3.Error, OSError, KnowledgeStoreError):
            return KnowledgeHealth(False, "INDEX_UNAVAILABLE", None, 0, self.embedding_model)

    def index_version(self) -> str | None:
        try:
            with self._connect() as connection:
                return self._meta(connection, "index_version")
        except (sqlite3.Error, OSError, KnowledgeStoreError):
            return None

    def configuration(self) -> tuple[str | None, str | None, str | None]:
        try:
            with self._connect() as connection:
                return (
                    self._meta(connection, "embedding_model"),
                    self._meta(connection, "chunking_version"),
                    self._meta(connection, "retrieval_version"),
                )
        except (sqlite3.Error, OSError, KnowledgeStoreError):
            return (None, None, None)

    def set_corpus_metadata(self, name: str, version: str) -> None:
        if not self.create:
            raise KnowledgeStoreError("Knowledge store is read-only for runtime retrieval.")
        with self._connect(write=True) as connection:
            self._initialize(connection)
            self._set_meta(connection, "corpus_name", name)
            self._set_meta(connection, "corpus_version", version)
            self._refresh_index_version(connection)

    def upsert_document(
        self,
        document: ClinicalKnowledgeDocument,
        chunks: Sequence[ClinicalKnowledgeChunk],
        *,
        embedding_model: str,
        chunking_version: str,
        retrieval_version: str,
        force: bool = False,
    ) -> bool:
        if not self.create:
            raise KnowledgeStoreError("Knowledge store is read-only for runtime retrieval.")
        with self._connect(write=True) as connection:
            self._initialize(connection)
            current = connection.execute(
                """SELECT content_checksum, version, review_status, source_id, title, publisher,
                          source_type, clinical_domain, publication_date, jurisdiction, source_reference
                     FROM clinical_knowledge_documents WHERE document_id=?""",
                (document.document_id,),
            ).fetchone()
            expected = (
                document.content_checksum, document.version, document.review_status.value,
                document.source_id, document.title, document.publisher, document.source_type,
                document.clinical_domain, document.publication_date, document.jurisdiction,
                document.source_reference,
            )
            unchanged = not force and current and tuple(current) == expected
            if unchanged:
                return False
            connection.execute(
                """
                INSERT INTO clinical_knowledge_documents (
                    document_id, source_id, title, publisher, source_type, clinical_domain,
                    publication_date, version, jurisdiction, source_reference, review_status,
                    content_checksum, ingested_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
                ON CONFLICT(document_id) DO UPDATE SET
                    source_id=excluded.source_id, title=excluded.title, publisher=excluded.publisher,
                    source_type=excluded.source_type, clinical_domain=excluded.clinical_domain,
                    publication_date=excluded.publication_date, version=excluded.version,
                    jurisdiction=excluded.jurisdiction, source_reference=excluded.source_reference,
                    review_status=excluded.review_status, content_checksum=excluded.content_checksum,
                    ingested_at=CURRENT_TIMESTAMP
                """,
                (document.document_id, document.source_id, document.title, document.publisher,
                 document.source_type, document.clinical_domain, document.publication_date,
                 document.version, document.jurisdiction, document.source_reference,
                 document.review_status.value, document.content_checksum),
            )
            connection.execute("DELETE FROM clinical_knowledge_chunks WHERE document_id=?", (document.document_id,))
            connection.executemany(
                """
                INSERT INTO clinical_knowledge_chunks (
                    chunk_id, document_id, section_path, ordinal, text, chunk_checksum, embedding_json
                ) VALUES (?,?,?,?,?,?,?)
                """,
                [(chunk.chunk_id, chunk.document_id, chunk.section_path, chunk.ordinal, chunk.text,
                  chunk.chunk_checksum, json.dumps(chunk.embedding, separators=(",", ":"))) for chunk in chunks],
            )
            self._set_meta(connection, "embedding_model", embedding_model)
            self._set_meta(connection, "chunking_version", chunking_version)
            self._set_meta(connection, "retrieval_version", retrieval_version)
            self._refresh_index_version(connection)
            return True

    def retire_document(self, document_id: str) -> bool:
        if not self.create:
            raise KnowledgeStoreError("Knowledge store is read-only for runtime retrieval.")
        with self._connect(write=True) as connection:
            self._initialize(connection)
            cursor = connection.execute(
                "UPDATE clinical_knowledge_documents SET review_status='RETIRED', ingested_at=CURRENT_TIMESTAMP WHERE document_id=? AND review_status<>'RETIRED'",
                (document_id,),
            )
            if cursor.rowcount:
                self._refresh_index_version(connection)
            return bool(cursor.rowcount)

    def semantic_search(self, embedding: Sequence[float], domains: Sequence[str], limit: int) -> list[ScoredChunk]:
        chunks = self._approved_chunks(domains)
        scored = [ScoredChunk(chunk, cosine_similarity(embedding, chunk.embedding)) for chunk in chunks]
        return sorted(scored, key=lambda item: (-item.score, item.chunk.chunk_id))[:limit]

    def lexical_search(self, query: str, domains: Sequence[str], limit: int) -> list[ScoredChunk]:
        query_tokens = list(dict.fromkeys(clinical_tokens(query)))
        if not query_tokens:
            return []
        chunks = self._approved_chunks(domains)
        document_frequency = {
            token: sum(1 for chunk in chunks if token in set(clinical_tokens(chunk.text)))
            for token in query_tokens
        }
        scored: list[ScoredChunk] = []
        for chunk in chunks:
            tokens = clinical_tokens(f"{chunk.section_path} {chunk.text}")
            token_set = set(tokens)
            score = 0.0
            for token in query_tokens:
                if token in token_set:
                    idf = math.log((len(chunks) + 1) / (document_frequency[token] + 1)) + 1
                    score += idf * (1 + min(tokens.count(token), 3) * 0.15)
            normalized = score / max(1.0, len(query_tokens))
            if normalized > 0:
                scored.append(ScoredChunk(chunk, min(normalized, 1.0)))
        return sorted(scored, key=lambda item: (-item.score, item.chunk.chunk_id))[:limit]

    def lookup_chunks(self, chunk_ids: Sequence[str]) -> list[ClinicalKnowledgeChunk]:
        if not chunk_ids:
            return []
        placeholders = ",".join("?" for _ in chunk_ids)
        with self._connect() as connection:
            rows = connection.execute(
                f"""{self._chunk_select()} WHERE d.review_status='APPROVED' AND c.chunk_id IN ({placeholders})""",
                tuple(chunk_ids),
            ).fetchall()
        by_id = {row[0]: self._row_to_chunk(row) for row in rows}
        return [by_id[item] for item in chunk_ids if item in by_id]

    def _approved_chunks(self, domains: Sequence[str]) -> list[ClinicalKnowledgeChunk]:
        where = "WHERE d.review_status='APPROVED'"
        params: list[str] = []
        if domains:
            where += " AND d.clinical_domain IN (" + ",".join("?" for _ in domains) + ")"
            params.extend(domains)
        try:
            with self._connect() as connection:
                rows = connection.execute(f"{self._chunk_select()} {where}", params).fetchall()
            return [self._row_to_chunk(row) for row in rows]
        except (sqlite3.Error, OSError, KnowledgeStoreError) as exc:
            raise KnowledgeStoreError("Clinical knowledge index could not be read.") from exc

    @staticmethod
    def _chunk_select() -> str:
        return """
            SELECT c.chunk_id, d.source_id, d.document_id, d.title, d.publisher, d.source_type,
                   d.clinical_domain, d.publication_date, d.version, d.jurisdiction,
                   d.source_reference, d.review_status, c.section_path, c.ordinal, c.text,
                   c.chunk_checksum, c.embedding_json
              FROM clinical_knowledge_chunks c
              JOIN clinical_knowledge_documents d ON d.document_id=c.document_id
        """

    @staticmethod
    def _row_to_chunk(row: sqlite3.Row) -> ClinicalKnowledgeChunk:
        return ClinicalKnowledgeChunk(
            chunk_id=row[0], source_id=row[1], document_id=row[2], title=row[3], publisher=row[4],
            source_type=row[5], clinical_domain=row[6], publication_date=row[7], version=row[8],
            jurisdiction=row[9], source_reference=row[10], review_status=ReviewStatus(row[11]),
            section_path=row[12], ordinal=row[13], text=row[14], chunk_checksum=row[15],
            embedding=tuple(json.loads(row[16])),
        )

    @contextmanager
    def _connect(self, *, write: bool = False) -> Iterator[sqlite3.Connection]:
        if not self.path.exists() and not (write and self.create):
            raise KnowledgeStoreError("Clinical knowledge index is not installed.")
        try:
            connection = sqlite3.connect(self.path, timeout=5)
            connection.execute("PRAGMA foreign_keys=ON")
            if not write:
                connection.execute("PRAGMA query_only=ON")
            try:
                yield connection
                if write:
                    connection.commit()
            except Exception:
                if write:
                    connection.rollback()
                raise
            finally:
                connection.close()
        except sqlite3.Error as exc:
            raise KnowledgeStoreError("Clinical knowledge index is unavailable.") from exc

    @staticmethod
    def _initialize(connection: sqlite3.Connection) -> None:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS clinical_knowledge_documents (
                document_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, title TEXT NOT NULL,
                publisher TEXT NOT NULL, source_type TEXT NOT NULL, clinical_domain TEXT NOT NULL,
                publication_date TEXT, version TEXT, jurisdiction TEXT, source_reference TEXT,
                review_status TEXT NOT NULL CHECK(review_status IN ('DRAFT','APPROVED','RETIRED')),
                content_checksum TEXT NOT NULL, ingested_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS clinical_knowledge_chunks (
                chunk_id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES clinical_knowledge_documents(document_id) ON DELETE CASCADE,
                section_path TEXT NOT NULL, ordinal INTEGER NOT NULL, text TEXT NOT NULL,
                chunk_checksum TEXT NOT NULL, embedding_json TEXT NOT NULL,
                UNIQUE(document_id, ordinal)
            );
            CREATE TABLE IF NOT EXISTS clinical_knowledge_index_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            """
        )
        SqliteClinicalKnowledgeStore._set_meta(connection, "schema_version", SqliteClinicalKnowledgeStore.SCHEMA_VERSION)

    @staticmethod
    def _meta(connection: sqlite3.Connection, key: str) -> str | None:
        row = connection.execute("SELECT value FROM clinical_knowledge_index_meta WHERE key=?", (key,)).fetchone()
        return row[0] if row else None

    @staticmethod
    def _set_meta(connection: sqlite3.Connection, key: str, value: str) -> None:
        connection.execute(
            "INSERT INTO clinical_knowledge_index_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )

    def _refresh_index_version(self, connection: sqlite3.Connection) -> None:
        rows = connection.execute(
            """
            SELECT d.document_id, d.source_id, d.title, d.publisher, d.source_type, d.clinical_domain,
                   d.publication_date, d.version, d.jurisdiction, d.source_reference,
                   d.content_checksum, c.chunk_id, c.section_path, c.chunk_checksum
              FROM clinical_knowledge_documents d LEFT JOIN clinical_knowledge_chunks c ON c.document_id=d.document_id
             WHERE d.review_status='APPROVED' ORDER BY d.document_id, c.ordinal
            """
        ).fetchall()
        config = "|".join((self._meta(connection, "corpus_name") or "",
                           self._meta(connection, "corpus_version") or "",
                           self._meta(connection, "embedding_model") or "",
                           self._meta(connection, "chunking_version") or "",
                           self._meta(connection, "retrieval_version") or ""))
        payload = config + "|" + "|".join("|".join(str(item or "") for item in row) for row in rows)
        version = "cki_" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]
        self._set_meta(connection, "index_version", version)
