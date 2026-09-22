package com.clinora.research.repository;

import com.clinora.research.domain.ResearchDataset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Repository
public interface ResearchDatasetRepository extends JpaRepository<ResearchDataset, UUID> {
    List<ResearchDataset> findByProjectIdOrderByCreatedAtDesc(UUID projectId);
    Optional<ResearchDataset> findByDatasetRequestId(UUID datasetRequestId);
    List<ResearchDataset> findByIdInOrderByCreatedAtDesc(Set<UUID> ids);
}

