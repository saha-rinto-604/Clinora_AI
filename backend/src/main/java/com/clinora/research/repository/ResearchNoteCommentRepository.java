package com.clinora.research.repository;

import com.clinora.research.domain.ResearchNoteComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchNoteCommentRepository extends JpaRepository<ResearchNoteComment, UUID> {

    @Query("SELECT c FROM ResearchNoteComment c WHERE c.noteId = :noteId AND c.removedAt IS NULL ORDER BY c.createdAt ASC")
    List<ResearchNoteComment> findActiveByNoteIdOrderByCreatedAtAsc(@Param("noteId") UUID noteId);

    List<ResearchNoteComment> findByNoteIdOrderByCreatedAtAsc(UUID noteId);

    Optional<ResearchNoteComment> findByIdAndNoteId(UUID id, UUID noteId);
}
