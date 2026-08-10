package com.clinora.access.repository;
import com.clinora.access.domain.ApplicantSession;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ApplicantSessionRepository extends JpaRepository<ApplicantSession, UUID> {
    List<ApplicantSession> findAllByApplicationId(UUID applicationId);
}
