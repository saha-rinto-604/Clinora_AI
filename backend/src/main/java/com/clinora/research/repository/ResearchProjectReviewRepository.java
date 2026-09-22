package com.clinora.research.repository;

import com.clinora.research.domain.ResearchProjectReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ResearchProjectReviewRepository extends JpaRepository<ResearchProjectReview, UUID> {

    List<ResearchProjectReview> findByProjectIdOrderByCreatedAtDesc(UUID projectId);
}
