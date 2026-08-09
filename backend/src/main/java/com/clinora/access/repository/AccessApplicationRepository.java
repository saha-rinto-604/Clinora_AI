package com.clinora.access.repository;

import com.clinora.access.domain.AccessApplication;
import com.clinora.access.domain.ApplicationStatus;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccessApplicationRepository extends JpaRepository<AccessApplication, UUID> {
    Optional<AccessApplication> findFirstByNormalizedEmailAndStatusNotIn(String normalizedEmail, Collection<ApplicationStatus> statuses);
}
