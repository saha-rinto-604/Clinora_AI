package com.clinora.research.repository;

import com.clinora.research.domain.ResearchProjectFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchProjectFileRepository extends JpaRepository<ResearchProjectFile, UUID> {

    List<ResearchProjectFile> findByProjectIdAndArchivedAtIsNullOrderByCreatedAtDesc(UUID projectId);

    List<ResearchProjectFile> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    Optional<ResearchProjectFile> findByIdAndProjectId(UUID id, UUID projectId);
}
