from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from app.knowledge.embeddings import ClinicalEmbeddingProvider
from app.knowledge.models import ClinicalKnowledgeChunk, ClinicalKnowledgeDocument


@dataclass(frozen=True)
class ChunkingConfig:
    version: str = "clinical-section-chunker-v1"
    max_chars: int = 1200
    overlap_chars: int = 180


class ClinicalDocumentChunker:
    def __init__(self, embedding_provider: ClinicalEmbeddingProvider, config: ChunkingConfig | None = None) -> None:
        self.embedding_provider = embedding_provider
        self.config = config or ChunkingConfig()

    def chunk(self, document: ClinicalKnowledgeDocument) -> list[ClinicalKnowledgeChunk]:
        sections = self._sections(document.content)
        chunks: list[ClinicalKnowledgeChunk] = []
        ordinal = 0
        for section_path, blocks in sections:
            current = ""
            for block in self._bounded_blocks(blocks):
                if current and len(current) + 2 + len(block) > self.config.max_chars:
                    chunks.append(self._chunk(document, section_path, ordinal, current))
                    ordinal += 1
                    available_overlap = max(0, self.config.max_chars - len(block) - 2)
                    overlap = current[-min(self.config.overlap_chars, available_overlap):].strip() if available_overlap else ""
                    current = f"{overlap}\n\n{block}" if overlap else block
                else:
                    current = f"{current}\n\n{block}".strip()
            if current:
                chunks.append(self._chunk(document, section_path, ordinal, current))
                ordinal += 1
        return chunks

    def _bounded_blocks(self, blocks: list[str]) -> list[str]:
        bounded: list[str] = []
        for block in blocks:
            if len(block) <= self.config.max_chars:
                bounded.append(block)
                continue
            sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", block) if part.strip()]
            current = ""
            for sentence in sentences:
                if len(sentence) > self.config.max_chars:
                    if current:
                        bounded.append(current)
                        current = ""
                    step = max(1, self.config.max_chars - self.config.overlap_chars)
                    for start in range(0, len(sentence), step):
                        part = sentence[start:start + self.config.max_chars].strip()
                        if part:
                            bounded.append(part)
                    continue
                if current and len(current) + 1 + len(sentence) > self.config.max_chars:
                    bounded.append(current)
                    current = sentence
                else:
                    current = f"{current} {sentence}".strip()
            if current:
                bounded.append(current)
        return bounded

    def _chunk(self, document: ClinicalKnowledgeDocument, section: str, ordinal: int, text: str) -> ClinicalKnowledgeChunk:
        normalized = re.sub(r"[ \t]+", " ", text).strip()
        stable_key = f"{document.source_id}:{document.document_id}:{section}:{ordinal}"
        chunk_id = "ck_" + hashlib.sha256(stable_key.encode("utf-8")).hexdigest()[:24]
        checksum = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        return ClinicalKnowledgeChunk(
            chunk_id=chunk_id, source_id=document.source_id, document_id=document.document_id,
            title=document.title, publisher=document.publisher, source_type=document.source_type,
            clinical_domain=document.clinical_domain, publication_date=document.publication_date,
            version=document.version, jurisdiction=document.jurisdiction,
            source_reference=document.source_reference, review_status=document.review_status,
            section_path=section, ordinal=ordinal, text=normalized, chunk_checksum=checksum,
            embedding=self.embedding_provider.embed(f"{section}\n{normalized}"),
        )

    @staticmethod
    def _sections(content: str) -> list[tuple[str, list[str]]]:
        normalized = content.replace("\r\n", "\n").replace("\r", "\n").strip()
        heading = "Document"
        sections: list[tuple[str, list[str]]] = []
        blocks: list[str] = []
        for part in re.split(r"\n\s*\n", normalized):
            clean = part.strip()
            if not clean:
                continue
            lines = clean.splitlines()
            if len(lines) == 1 and re.match(r"^#{1,6}\s+", lines[0]):
                if blocks:
                    sections.append((heading, blocks))
                    blocks = []
                heading = re.sub(r"^#{1,6}\s+", "", lines[0]).strip()
            else:
                blocks.append(clean)
        if blocks:
            sections.append((heading, blocks))
        return sections or [("Document", [normalized])]
