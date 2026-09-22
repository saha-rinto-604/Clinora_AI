package com.clinora.research.repository;

import com.clinora.research.domain.DatasetAccessGrant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DatasetAccessGrantRepository extends JpaRepository<DatasetAccessGrant, UUID> {
    List<DatasetAccessGrant> findByResearcherUserId(UUID researcherUserId);
    Optional<DatasetAccessGrant> findByDatasetIdAndResearcherUserId(UUID datasetId, UUID researcherUserId);
}
