package com.clinora.research.repository;

import com.clinora.research.domain.DatasetVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DatasetVersionRepository extends JpaRepository<DatasetVersion, UUID> {
    List<DatasetVersion> findByDatasetIdOrderByVersionNumberDesc(UUID datasetId);
    Optional<DatasetVersion> findByDatasetIdAndVersionNumber(UUID datasetId, int versionNumber);
}
