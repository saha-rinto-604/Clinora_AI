package com.clinora.audit;

import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class AuthAuditService {

    private final AuthAuditEventRepository repository;
    private final Clock clock;

    public AuthAuditService(AuthAuditEventRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public void record(
        UUID actorUserId,
        AuthAuditAction action,
        AuthAuditOutcome outcome,
        String ipAddress,
        String userAgent,
        String resourceId,
        String nonSensitiveMetadata
    ) {
        repository.save(new AuthAuditEvent(
            actorUserId,
            action,
            outcome,
            clock.instant(),
            ipAddress,
            userAgent,
            resourceId,
            nonSensitiveMetadata
        ));
    }
}
