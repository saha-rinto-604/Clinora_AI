package com.clinora.research.repository;

import com.clinora.research.domain.DatasetAccessGrant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DatasetAccessGrantRepository extends JpaRepository<DatasetAccessGrant, UUID> {
    List<DatasetAccessGrant> findByResearcherUserId(UUID researcherUserId);
    Optional<DatasetAccessGrant> findByDatasetIdAndResearcherUserId(UUID datasetId, UUID researcherUserId);

    /** Active (non-revoked) grants for a researcher — used for cascade revocation on member removal. */
    @Query("SELECT g FROM DatasetAccessGrant g WHERE g.researcherUserId = :userId AND g.revokedAt IS NULL")
    List<DatasetAccessGrant> findActiveByResearcherUserId(@Param("userId") UUID userId);
}

