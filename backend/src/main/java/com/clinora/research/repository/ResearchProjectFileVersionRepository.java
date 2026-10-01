package com.clinora.research.repository;

import com.clinora.research.domain.ResearchProjectFileVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchProjectFileVersionRepository extends JpaRepository<ResearchProjectFileVersion, UUID> {

    List<ResearchProjectFileVersion> findByProjectFileIdOrderByVersionNumberDesc(UUID projectFileId);

    Optional<ResearchProjectFileVersion> findByProjectFileIdAndVersionNumber(UUID projectFileId, int versionNumber);
}
