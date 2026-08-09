package com.clinora.access.repository;
import com.clinora.access.domain.ApplicationEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ApplicationEventRepository extends JpaRepository<ApplicationEvent, UUID> {
    List<ApplicationEvent> findAllByApplicationIdOrderByCreatedAtDesc(UUID applicationId);
}
