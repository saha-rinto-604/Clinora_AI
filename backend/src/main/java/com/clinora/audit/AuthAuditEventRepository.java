package com.clinora.audit;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthAuditEventRepository extends JpaRepository<AuthAuditEvent, UUID> {
    List<AuthAuditEvent> findByResourceIdOrderByOccurredAtDesc(String resourceId);
    List<AuthAuditEvent> findByActorUserIdOrderByOccurredAtDesc(UUID actorUserId);
}
