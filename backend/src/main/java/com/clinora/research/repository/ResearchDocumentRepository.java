package com.clinora.research.repository;

import com.clinora.research.domain.ResearchDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchDocumentRepository extends JpaRepository<ResearchDocument, UUID> {

    List<ResearchDocument> findByProjectIdAndArchivedAtIsNullOrderByUpdatedAtDesc(UUID projectId);

    List<ResearchDocument> findByProjectIdOrderByUpdatedAtDesc(UUID projectId);

    Optional<ResearchDocument> findByIdAndProjectId(UUID id, UUID projectId);

    long countByProjectId(UUID projectId);
}
