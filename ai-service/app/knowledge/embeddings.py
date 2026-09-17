from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Sequence
from typing import Protocol


class EmbeddingUnavailableError(RuntimeError):
    pass


class ClinicalEmbeddingProvider(Protocol):
    @property
    def model_id(self) -> str: ...

    @property
    def dimensions(self) -> int: ...

    def embed(self, text: str) -> tuple[float, ...]: ...


_CONCEPT_ALIASES = {
    "microcytic": "microcytosis",
    "microcytic anemia": "microcytosis anemia",
    "mean corpuscular volume": "mcv",
    "mean corpuscular hemoglobin": "mch",
    "iron stores": "ferritin iron studies",
    "serum ferritin": "ferritin iron studies",
    "haemoglobin electrophoresis": "hemoglobin electrophoresis thalassemia evaluation",
    "hb electrophoresis": "hemoglobin electrophoresis thalassemia evaluation",
    "thyrotropin": "tsh thyroid",
    "thyroid stimulating hormone": "tsh thyroid",
    "ns1": "ns1 antigen dengue",
    "nonstructural protein 1": "ns1 antigen dengue",
    "platelet count": "platelets",
}


def clinical_tokens(text: str) -> list[str]:
    normalized = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
    for phrase, replacement in sorted(_CONCEPT_ALIASES.items(), key=lambda item: -len(item[0])):
        normalized = re.sub(rf"\b{re.escape(phrase)}\b", replacement, normalized)
    tokens = [token for token in normalized.split() if len(token) > 1 or token in {"t3", "t4"}]
    return tokens + [f"{left}_{right}" for left, right in zip(tokens, tokens[1:])]


class ClinicalHashEmbeddingProvider:
    """Small offline CPU embedding baseline with controlled clinical alias expansion.

    It intentionally downloads nothing and records its version. The abstraction permits a
    future licensed/validated embedding model without changing ingestion or retrieval.
    """

    def __init__(self, dimensions: int = 384) -> None:
        if dimensions < 64 or dimensions > 2048:
            raise ValueError("Embedding dimensions must remain bounded.")
        self._dimensions = dimensions

    @property
    def model_id(self) -> str:
        return f"clinora-clinical-hash-embedding-v1:{self._dimensions}"

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def embed(self, text: str) -> tuple[float, ...]:
        values = [0.0] * self._dimensions
        tokens = clinical_tokens(text)
        if not tokens:
            return tuple(values)
        for token in tokens:
            digest = hashlib.blake2b(token.encode("utf-8"), digest_size=16, person=b"clinora-rag-v1").digest()
            index = int.from_bytes(digest[:8], "big") % self._dimensions
            sign = 1.0 if digest[8] & 1 else -1.0
            values[index] += sign
        magnitude = math.sqrt(sum(value * value for value in values))
        return tuple(value / magnitude for value in values) if magnitude else tuple(values)


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right):
        raise ValueError("Embedding dimensions do not match.")
    return max(0.0, sum(a * b for a, b in zip(left, right)))
