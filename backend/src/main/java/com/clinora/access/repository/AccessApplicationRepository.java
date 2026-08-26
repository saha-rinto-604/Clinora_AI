package com.clinora.access.repository;

import com.clinora.access.domain.AccessApplication;
import com.clinora.access.domain.ApplicationStatus;
import com.clinora.access.domain.ApplicationType;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface AccessApplicationRepository extends JpaRepository<AccessApplication, UUID> {
    Optional<AccessApplication> findFirstByNormalizedEmailAndStatusNotIn(String normalizedEmail, Collection<ApplicationStatus> statuses);

    @Query("""
        select application from AccessApplication application
        where application.status in :reviewStatuses
          and (:applicationType is null or application.applicationType = :applicationType)
          and (:status is null or application.status = :status)
        order by application.updatedAt desc
        """)
    Page<AccessApplication> findReviewQueue(
        @Param("reviewStatuses") Collection<ApplicationStatus> reviewStatuses,
        @Param("applicationType") ApplicationType applicationType,
        @Param("status") ApplicationStatus status,
        Pageable pageable
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select application from AccessApplication application where application.id = :id")
    Optional<AccessApplication> findByIdForReviewUpdate(@Param("id") UUID id);
}
