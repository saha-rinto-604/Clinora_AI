import time
from pathlib import Path

from app.knowledge.chunking import ChunkingConfig, ClinicalDocumentChunker
from app.knowledge.embeddings import ClinicalHashEmbeddingProvider, EmbeddingUnavailableError
from app.knowledge.ingestion import ClinicalKnowledgeIngestionService
from app.knowledge.models import RetrievalStatus
from app.knowledge.models import ClinicalKnowledgeDocument, ReviewStatus
from app.knowledge.query import ClinicalKnowledgeQueryBuilder
from app.knowledge.retrieval import ClinicalKnowledgeRetriever, RetrievalConfig
from app.knowledge.store import KnowledgeStoreError, SqliteClinicalKnowledgeStore


FIXTURES = Path(__file__).parent / "fixtures" / "clinical_knowledge"


def build_index(tmp_path):
    embedding = ClinicalHashEmbeddingProvider()
    store = SqliteClinicalKnowledgeStore(tmp_path / "knowledge.db", create=True, embedding_model=embedding.model_id)
    ingestion = ClinicalKnowledgeIngestionService(store, ClinicalDocumentChunker(embedding))
    return store, embedding, ingestion


def test_ingestion_is_idempotent_and_tracks_version(tmp_path):
    store, _, ingestion = build_index(tmp_path)
    first = ingestion.ingest_manifest(FIXTURES / "manifest.json")
    second = ingestion.ingest_manifest(FIXTURES / "manifest.json")
    assert first["changedDocuments"] == 6
    assert second["changedDocuments"] == 0
    assert second["unchangedDocuments"] == 6
    assert first["indexVersion"] == second["indexVersion"]
    assert store.health().ready


def test_hybrid_retrieval_is_approved_filtered_domain_scoped_and_deterministic(tmp_path):
    store, embedding, ingestion = build_index(tmp_path)
    ingestion.ingest_manifest(FIXTURES / "manifest.json")
    retriever = ClinicalKnowledgeRetriever(store, embedding)
    first = retriever.retrieve("FIND_GAPS", "mcv microcytosis ferritin iron studies", ("hematology",))
    second = retriever.retrieve("FIND_GAPS", "mcv microcytosis ferritin iron studies", ("hematology",))
    assert first.status == RetrievalStatus.USED
    assert [item.chunk.chunk_id for item in first.chunks] == [item.chunk.chunk_id for item in second.chunks]
    assert all(item.chunk.review_status.value == "APPROVED" for item in first.chunks)
    assert all(item.chunk.clinical_domain == "hematology" for item in first.chunks)
    assert all("invisible-draft-marker" not in item.chunk.text for item in first.chunks)


def test_retirement_removes_document_from_fresh_retrieval(tmp_path):
    store, embedding, ingestion = build_index(tmp_path)
    ingestion.ingest_manifest(FIXTURES / "manifest.json")
    before = store.index_version()
    assert store.retire_document("hematology-red-cell-indices")
    assert store.index_version() != before
    result = ClinicalKnowledgeRetriever(store, embedding).retrieve(
        "CONNECT_EVIDENCE", "mcv microcytosis ferritin", ("hematology",)
    )
    assert all(item.chunk.document_id != "hematology-red-cell-indices" for item in result.chunks)


def test_missing_index_is_safe_and_does_not_create_storage(tmp_path):
    path = tmp_path / "absent.db"
    embedding = ClinicalHashEmbeddingProvider()
    store = SqliteClinicalKnowledgeStore(path, create=False, embedding_model=embedding.model_id)
    result = ClinicalKnowledgeRetriever(store, embedding).retrieve("CONNECT_EVIDENCE", "mcv", ("hematology",))
    assert result.status == RetrievalStatus.KNOWLEDGE_UNAVAILABLE
    assert not path.exists()


def test_exact_terms_retrieve_expected_specialties_and_exclude_unrelated_chunks(tmp_path):
    store, embedding, ingestion = build_index(tmp_path)
    ingestion.ingest_manifest(FIXTURES / "manifest.json")
    retriever = ClinicalKnowledgeRetriever(store, embedding)
    cases = [
        ("TSH thyroid", "endocrinology", "thyroid-evaluation"),
        ("NS1 antigen dengue platelets", "infectious_disease", "dengue-ns1-evaluation"),
    ]
    for query, domain, document_id in cases:
        result = retriever.retrieve("CONNECT_EVIDENCE", query, (domain,))
        assert result.status == RetrievalStatus.USED
        assert result.chunks[0].chunk.document_id == document_id
        assert all(item.chunk.document_id != "renal-markers" for item in result.chunks)


def test_top_k_threshold_and_channel_fallback_are_bounded(tmp_path):
    store, embedding, ingestion = build_index(tmp_path)
    ingestion.ingest_manifest(FIXTURES / "manifest.json")
    store.semantic_search = lambda *args, **kwargs: (_ for _ in ()).throw(KnowledgeStoreError("boom"))
    retriever = ClinicalKnowledgeRetriever(store, embedding)
    result = retriever.retrieve("CONNECT_EVIDENCE", "MCV microcytosis", ("hematology",))
    assert result.status == RetrievalStatus.USED
    assert not result.semantic_available and result.lexical_available
    assert len(result.chunks) <= retriever.config.top_k

    store, embedding, ingestion = build_index(tmp_path / "lexical-failure")
    ingestion.ingest_manifest(FIXTURES / "manifest.json")
    store.lexical_search = lambda *args, **kwargs: (_ for _ in ()).throw(KnowledgeStoreError("boom"))
    result = ClinicalKnowledgeRetriever(store, embedding).retrieve(
        "CONNECT_EVIDENCE", "MCV microcytosis", ("hematology",)
    )
    assert result.status == RetrievalStatus.USED
    assert result.semantic_available and not result.lexical_available


def test_embedding_failure_falls_back_to_lexical_and_high_threshold_rejects_unrelated(tmp_path):
    store, embedding, ingestion = build_index(tmp_path)
    ingestion.ingest_manifest(FIXTURES / "manifest.json")

    class UnavailableEmbedding:
        model_id = embedding.model_id

        def embed(self, text):
            raise EmbeddingUnavailableError("unavailable")

    result = ClinicalKnowledgeRetriever(store, UnavailableEmbedding()).retrieve(
        "CONNECT_EVIDENCE", "NS1 antigen dengue", ("infectious_disease",)
    )
    assert result.status == RetrievalStatus.USED
    assert not result.semantic_available and result.lexical_available

    no_match = ClinicalKnowledgeRetriever(
        store, embedding, RetrievalConfig(minimum_score=2.0)
    ).retrieve("CONNECT_EVIDENCE", "unrelated nonsense", ("hematology",))
    assert no_match.status == RetrievalStatus.NO_RELEVANT_REFERENCE
    assert no_match.chunks == ()


def test_corrupt_index_and_retrieval_timeout_fail_safe(tmp_path):
    corrupt = tmp_path / "corrupt.db"
    corrupt.write_bytes(b"not a sqlite database")
    embedding = ClinicalHashEmbeddingProvider()
    store = SqliteClinicalKnowledgeStore(corrupt, create=False, embedding_model=embedding.model_id)
    assert not store.health().ready

    healthy_store, _, ingestion = build_index(tmp_path / "healthy")
    ingestion.ingest_manifest(FIXTURES / "manifest.json")
    original = healthy_store.semantic_search

    def slow_semantic(*args, **kwargs):
        time.sleep(0.01)
        return original(*args, **kwargs)

    healthy_store.semantic_search = slow_semantic
    retriever = ClinicalKnowledgeRetriever(
        healthy_store, embedding, RetrievalConfig(retrieval_timeout_ms=1)
    )
    assert retriever.retrieve("CONNECT_EVIDENCE", "MCV", ("hematology",)).status == RetrievalStatus.RETRIEVAL_FAILED_SAFE


def test_source_update_changes_index_version_and_replaces_chunks(tmp_path):
    fixture_copy = tmp_path / "corpus"
    fixture_copy.mkdir()
    for source in FIXTURES.iterdir():
        if source.is_file():
            (fixture_copy / source.name).write_bytes(source.read_bytes())
    store, _, ingestion = build_index(tmp_path)
    ingestion.ingest_manifest(fixture_copy / "manifest.json")
    before = store.index_version()
    hematology = fixture_copy / "hematology.md"
    hematology.write_text(hematology.read_text(encoding="utf-8") + "\n\nUpdated synthetic context.\n", encoding="utf-8")
    result = ingestion.ingest_manifest(fixture_copy / "manifest.json")
    assert result["changedDocuments"] == 1
    assert store.index_version() != before


def test_controlled_query_excludes_identifiers_and_raw_instructions():
    from test_doctor_support_execution import request

    execution = request("CONNECT_EVIDENCE")
    query = ClinicalKnowledgeQueryBuilder().build("CONNECT_EVIDENCE", execution)
    assert "10000000-0000" not in query.text
    assert "30000000-0000" not in query.text
    assert "Ignore Clinora rules" not in query.text
    assert "mcv" in query.text.lower()
    assert query.domains == ("hematology",)


def test_chunker_bounds_single_long_statement_and_keeps_stable_ids():
    embedding = ClinicalHashEmbeddingProvider()
    chunker = ClinicalDocumentChunker(embedding, ChunkingConfig(max_chars=120, overlap_chars=20))
    document = ClinicalKnowledgeDocument(
        "source", "document", "Title", "Publisher", "test", "hematology", None, "1", None, None,
        ReviewStatus.APPROVED, "checksum", "# Section\n\n" + "microcytosis " * 80,
    )
    first = chunker.chunk(document)
    second = chunker.chunk(document)
    assert first
    assert max(len(item.text) for item in first) <= 120
    assert [item.chunk_id for item in first] == [item.chunk_id for item in second]
