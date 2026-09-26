package com.clinora.research.repository;

import com.clinora.research.domain.ProjectMemberRole;
import com.clinora.research.domain.ResearchProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchProjectMemberRepository extends JpaRepository<ResearchProjectMember, UUID> {

    /** Active (non-removed) members ordered by join date. */
    @Query("SELECT m FROM ResearchProjectMember m WHERE m.projectId = :projectId AND m.removedAt IS NULL ORDER BY m.createdAt ASC")
    List<ResearchProjectMember> findActiveByProjectIdOrderByCreatedAtAsc(@Param("projectId") UUID projectId);

    /** Kept for backward compatibility — returns ALL including soft-deleted. */
    List<ResearchProjectMember> findByProjectIdOrderByCreatedAtAsc(UUID projectId);

    /** Active membership for a specific user in a project. */
    @Query("SELECT m FROM ResearchProjectMember m WHERE m.projectId = :projectId AND m.userId = :userId AND m.removedAt IS NULL")
    Optional<ResearchProjectMember> findActiveByProjectIdAndUserId(@Param("projectId") UUID projectId, @Param("userId") UUID userId);

    Optional<ResearchProjectMember> findByProjectIdAndUserId(UUID projectId, UUID userId);

    @Query("SELECT CASE WHEN COUNT(m) > 0 THEN TRUE ELSE FALSE END FROM ResearchProjectMember m WHERE m.projectId = :projectId AND m.userId = :userId AND m.removedAt IS NULL")
    boolean existsActiveByProjectIdAndUserId(@Param("projectId") UUID projectId, @Param("userId") UUID userId);

    boolean existsByProjectIdAndUserId(UUID projectId, UUID userId);

    List<ResearchProjectMember> findByUserId(UUID userId);

    @Query("SELECT COUNT(m) FROM ResearchProjectMember m WHERE m.projectId = :projectId AND m.role = :role AND m.removedAt IS NULL")
    long countActiveByProjectIdAndRole(@Param("projectId") UUID projectId, @Param("role") ProjectMemberRole role);

    long countByProjectIdAndRole(UUID projectId, ProjectMemberRole role);
}
