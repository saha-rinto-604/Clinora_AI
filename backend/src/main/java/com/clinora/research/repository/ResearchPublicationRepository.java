package com.clinora.research.repository;

import com.clinora.research.domain.LibraryVisibility;
import com.clinora.research.domain.PublicationStatus;
import com.clinora.research.domain.PublicationType;
import com.clinora.research.domain.ResearchPublication;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchPublicationRepository extends JpaRepository<ResearchPublication, UUID> {

    List<ResearchPublication> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    Optional<ResearchPublication> findByIdAndProjectId(UUID id, UUID projectId);

    boolean existsByProjectIdAndTitleIgnoreCase(UUID projectId, String title);

    long countByProjectId(UUID projectId);

    @Query("""
        SELECT p FROM ResearchPublication p
        WHERE p.status = com.clinora.research.domain.PublicationStatus.PUBLISHED
          AND p.libraryVisibility = com.clinora.research.domain.LibraryVisibility.CLINORA_RESEARCHERS
          AND (:search IS NULL OR :search = ''
               OR LOWER(p.title) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(p.authors) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(COALESCE(p.keywords, '')) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(COALESCE(p.researchField, '')) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(COALESCE(p.journal, '')) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(COALESCE(p.conference, '')) LIKE LOWER(CONCAT('%', :search, '%')))
          AND (:pubType IS NULL OR p.publicationType = :pubType)
          AND (:researchField IS NULL OR :researchField = '' OR LOWER(p.researchField) = LOWER(:researchField))
          AND (:year IS NULL OR (p.publicationDate IS NOT NULL AND YEAR(p.publicationDate) = :year))
        ORDER BY p.publicationDate DESC NULLS LAST, p.createdAt DESC
    """)
    Page<ResearchPublication> searchPublished(
            @Param("search") String search,
            @Param("pubType") PublicationType pubType,
            @Param("researchField") String researchField,
            @Param("year") Integer year,
            Pageable pageable
    );

    @Query("""
        SELECT p FROM ResearchPublication p
        WHERE p.createdBy = :userId OR p.projectId IN :projectIds
        ORDER BY p.updatedAt DESC
    """)
    List<ResearchPublication> findMyOutputs(
            @Param("userId") UUID userId,
            @Param("projectIds") Collection<UUID> projectIds
    );

    List<ResearchPublication> findByCreatedByOrderByUpdatedAtDesc(UUID createdBy);
}
