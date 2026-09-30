package com.clinora.research.repository;

import com.clinora.research.domain.ResearchNote;
import com.clinora.research.domain.ResearchNoteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchNoteRepository extends JpaRepository<ResearchNote, UUID> {

    List<ResearchNote> findByProjectIdAndStatusNotOrderByPinnedDescCreatedAtDesc(UUID projectId, ResearchNoteStatus status);

    List<ResearchNote> findByProjectIdOrderByPinnedDescCreatedAtDesc(UUID projectId);

    Optional<ResearchNote> findByIdAndProjectId(UUID id, UUID projectId);
}
