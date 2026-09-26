package com.clinora.research.repository;

import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectStatus;
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
public interface ResearchProjectRepository extends JpaRepository<ResearchProject, UUID> {

    List<ResearchProject> findByOwnerUserIdOrderByCreatedAtDesc(UUID ownerUserId);

    List<ResearchProject> findByOwnerUserIdAndStatusOrderByCreatedAtDesc(UUID ownerUserId, ResearchProjectStatus status);

    Page<ResearchProject> findByOwnerUserId(UUID ownerUserId, Pageable pageable);

    Page<ResearchProject> findByOwnerUserIdAndStatus(UUID ownerUserId, ResearchProjectStatus status, Pageable pageable);

    @Query("""
        SELECT p FROM ResearchProject p
        WHERE p.ownerUserId = :userId
           OR p.id IN (
               SELECT m.projectId FROM ResearchProjectMember m
               WHERE m.userId = :userId AND m.removedAt IS NULL
           )
    """)
    Page<ResearchProject> findAccessibleByUserId(@Param("userId") UUID userId, Pageable pageable);

    @Query("""
        SELECT p FROM ResearchProject p
        WHERE (p.ownerUserId = :userId
           OR p.id IN (
               SELECT m.projectId FROM ResearchProjectMember m
               WHERE m.userId = :userId AND m.removedAt IS NULL
           ))
          AND p.status = :status
    """)
    Page<ResearchProject> findAccessibleByUserIdAndStatus(
            @Param("userId") UUID userId,
            @Param("status") ResearchProjectStatus status,
            Pageable pageable);

    @Query("""
        SELECT p FROM ResearchProject p
        WHERE p.id = :id
          AND (p.ownerUserId = :userId
           OR p.id IN (
               SELECT m.projectId FROM ResearchProjectMember m
               WHERE m.userId = :userId AND m.removedAt IS NULL
           ))
    """)
    Optional<ResearchProject> findAccessibleByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    Page<ResearchProject> findByStatus(ResearchProjectStatus status, Pageable pageable);

    Page<ResearchProject> findByStatusIn(Collection<ResearchProjectStatus> statuses, Pageable pageable);

    Optional<ResearchProject> findByIdAndOwnerUserId(UUID id, UUID ownerUserId);

    List<ResearchProject> findByStatusOrderBySubmittedAtAsc(ResearchProjectStatus status);

    List<ResearchProject> findByStatusInOrderBySubmittedAtAsc(Collection<ResearchProjectStatus> statuses);

    long countByOwnerUserIdAndStatus(UUID ownerUserId, ResearchProjectStatus status);

    boolean existsByOwnerUserIdAndTitleIgnoreCase(UUID ownerUserId, String title);
}
