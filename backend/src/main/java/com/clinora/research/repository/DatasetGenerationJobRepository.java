package com.clinora.research.repository;

import com.clinora.research.domain.DatasetGenerationJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DatasetGenerationJobRepository extends JpaRepository<DatasetGenerationJob, UUID> {
    List<DatasetGenerationJob> findByDatasetRequestIdOrderByCreatedAtDesc(UUID datasetRequestId);
    Optional<DatasetGenerationJob> findFirstByDatasetRequestIdOrderByCreatedAtDesc(UUID datasetRequestId);
}
