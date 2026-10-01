package com.clinora.research.repository;

import com.clinora.research.domain.ResearchDocumentRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchDocumentRevisionRepository extends JpaRepository<ResearchDocumentRevision, UUID> {

    List<ResearchDocumentRevision> findByDocumentIdOrderByRevisionNumberDesc(UUID documentId);

    Optional<ResearchDocumentRevision> findByDocumentIdAndRevisionNumber(UUID documentId, int revisionNumber);

    Optional<ResearchDocumentRevision> findTopByDocumentIdOrderByRevisionNumberDesc(UUID documentId);

    long countByDocumentId(UUID documentId);

    @Query("SELECT DISTINCT r.editedByUserId FROM ResearchDocumentRevision r WHERE r.documentId = :documentId")
    List<UUID> findDistinctEditorIdsByDocumentId(@Param("documentId") UUID documentId);
}
