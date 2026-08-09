package com.clinora.access.repository;
import com.clinora.access.domain.DoctorQualification;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface DoctorQualificationRepository extends JpaRepository<DoctorQualification, UUID> {
    List<DoctorQualification> findAllByApplicationIdOrderById(UUID applicationId);
    long countByApplicationId(UUID applicationId);
    void deleteAllByApplicationId(UUID applicationId);
}
