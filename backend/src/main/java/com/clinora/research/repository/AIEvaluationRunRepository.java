package com.clinora.research.repository;

import com.clinora.research.domain.AIEvaluationRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AIEvaluationRunRepository extends JpaRepository<AIEvaluationRun, UUID> {
    List<AIEvaluationRun> findByProjectIdOrderByCreatedAtDesc(UUID projectId);
    Optional<AIEvaluationRun> findByIdAndProjectId(UUID id, UUID projectId);
    List<AIEvaluationRun> findByDatasetVersionIdOrderByCreatedAtDesc(UUID datasetVersionId);
    long countByProjectId(UUID projectId);
}
