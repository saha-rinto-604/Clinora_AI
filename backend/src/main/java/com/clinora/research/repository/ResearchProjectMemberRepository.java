package com.clinora.research.repository;

import com.clinora.research.domain.ProjectMemberRole;
import com.clinora.research.domain.ResearchProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchProjectMemberRepository extends JpaRepository<ResearchProjectMember, UUID> {
    List<ResearchProjectMember> findByProjectIdOrderByCreatedAtAsc(UUID projectId);
    Optional<ResearchProjectMember> findByProjectIdAndUserId(UUID projectId, UUID userId);
    boolean existsByProjectIdAndUserId(UUID projectId, UUID userId);
    List<ResearchProjectMember> findByUserId(UUID userId);
    long countByProjectIdAndRole(UUID projectId, ProjectMemberRole role);
}
