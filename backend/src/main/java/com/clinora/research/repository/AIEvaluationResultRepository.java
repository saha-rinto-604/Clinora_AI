package com.clinora.research.repository;

import com.clinora.research.domain.AIEvaluationResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AIEvaluationResultRepository extends JpaRepository<AIEvaluationResult, UUID> {
    List<AIEvaluationResult> findByEvaluationRunId(UUID evaluationRunId);
}
