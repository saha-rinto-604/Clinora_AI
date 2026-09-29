package com.clinora.research.repository;

import com.clinora.research.domain.ResearchDocumentComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchDocumentCommentRepository extends JpaRepository<ResearchDocumentComment, UUID> {

    List<ResearchDocumentComment> findByDocumentIdOrderByCreatedAtAsc(UUID documentId);

    Optional<ResearchDocumentComment> findByIdAndDocumentId(UUID id, UUID documentId);

    long countByDocumentId(UUID documentId);
}
