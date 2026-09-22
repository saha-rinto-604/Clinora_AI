package com.clinora.research.repository;

import com.clinora.research.domain.ResearchPublication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchPublicationRepository extends JpaRepository<ResearchPublication, UUID> {
    List<ResearchPublication> findByProjectIdOrderByCreatedAtDesc(UUID projectId);
    Optional<ResearchPublication> findByIdAndProjectId(UUID id, UUID projectId);
    boolean existsByProjectIdAndTitleIgnoreCase(UUID projectId, String title);
    long countByProjectId(UUID projectId);
}
