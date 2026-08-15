package com.clinora.access.repository;

import com.clinora.access.domain.ApplicationReviewNote;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApplicationReviewNoteRepository extends JpaRepository<ApplicationReviewNote, UUID> {
    List<ApplicationReviewNote> findAllByApplicationIdOrderByCreatedAtDesc(UUID applicationId);
}
