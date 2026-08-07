package com.clinora.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "auth_audit_events")
public class AuthAuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "actor_user_id")
    private UUID actorUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 80)
    private AuthAuditAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome", nullable = false, length = 24)
    private AuthAuditOutcome outcome;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "resource_id", length = 120)
    private String resourceId;

    @Column(name = "metadata", length = 2000)
    private String metadata;

    protected AuthAuditEvent() {
    }

    public AuthAuditEvent(
        UUID actorUserId,
        AuthAuditAction action,
        AuthAuditOutcome outcome,
        Instant occurredAt,
        String ipAddress,
        String userAgent,
        String resourceId,
        String metadata
    ) {
        this.actorUserId = actorUserId;
        this.action = action;
        this.outcome = outcome;
        this.occurredAt = occurredAt;
        this.ipAddress = truncate(ipAddress, 64);
        this.userAgent = truncate(userAgent, 512);
        this.resourceId = truncate(resourceId, 120);
        this.metadata = truncate(metadata, 2000);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
