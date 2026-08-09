package com.clinora.access.repository;
import com.clinora.access.domain.ApplicantSession;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ApplicantSessionRepository extends JpaRepository<ApplicantSession, UUID> {}
