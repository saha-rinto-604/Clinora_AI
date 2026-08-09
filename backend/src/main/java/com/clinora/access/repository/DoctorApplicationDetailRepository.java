package com.clinora.access.repository;
import com.clinora.access.domain.DoctorApplicationDetail;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface DoctorApplicationDetailRepository extends JpaRepository<DoctorApplicationDetail, UUID> {}
