package com.clinora.research.repository;

import com.clinora.research.domain.CredentialVerificationStatus;
import com.clinora.research.domain.ResearcherCredentialVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearcherCredentialVerificationRepository extends JpaRepository<ResearcherCredentialVerification, UUID> {

    Optional<ResearcherCredentialVerification> findByUserId(UUID userId);

    List<ResearcherCredentialVerification> findAllByVerificationStatusInAndSubmissionDeadlineBefore(
            Collection<CredentialVerificationStatus> statuses,
            Instant deadline
    );
}
