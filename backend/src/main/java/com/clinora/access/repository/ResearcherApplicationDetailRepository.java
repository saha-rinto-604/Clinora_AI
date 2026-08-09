package com.clinora.access.repository;
import com.clinora.access.domain.ResearcherApplicationDetail;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ResearcherApplicationDetailRepository extends JpaRepository<ResearcherApplicationDetail, UUID> {}
