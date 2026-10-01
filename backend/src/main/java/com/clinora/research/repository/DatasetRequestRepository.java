package com.clinora.research.repository;

import com.clinora.research.domain.DatasetRequest;
import com.clinora.research.domain.DatasetRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface DatasetRequestRepository extends JpaRepository<DatasetRequest, UUID> {

    List<DatasetRequest> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    Page<DatasetRequest> findByProjectId(UUID projectId, Pageable pageable);

    Page<DatasetRequest> findByStatus(DatasetRequestStatus status, Pageable pageable);

    Page<DatasetRequest> findByStatusIn(Collection<DatasetRequestStatus> statuses, Pageable pageable);

    boolean existsByProjectIdAndNameIgnoreCase(UUID projectId, String name);
}
