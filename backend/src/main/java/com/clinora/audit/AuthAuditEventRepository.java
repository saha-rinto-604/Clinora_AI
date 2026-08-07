package com.clinora.audit;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthAuditEventRepository extends JpaRepository<AuthAuditEvent, UUID> {
}
