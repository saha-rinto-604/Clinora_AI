package com.clinora.access.repository;

import com.clinora.access.domain.DoctorInterview;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DoctorInterviewRepository extends JpaRepository<DoctorInterview, UUID> {
    Optional<DoctorInterview> findByApplicationId(UUID applicationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select interview from DoctorInterview interview where interview.applicationId = :applicationId")
    Optional<DoctorInterview> findByApplicationIdForUpdate(@Param("applicationId") UUID applicationId);
}
