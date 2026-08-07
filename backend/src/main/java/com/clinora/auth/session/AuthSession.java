package com.clinora.auth.session;

import com.clinora.users.domain.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "auth_sessions")
public class AuthSession {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "current_token_hash", nullable = false, length = 64)
    private String currentTokenHash;

    @Column(nullable = false)
    private long rotation;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_used_at", nullable = false)
    private Instant lastUsedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "revoke_reason", length = 120)
    private String revokeReason;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Version
    @Column(nullable = false)
    private long version;

    protected AuthSession() {
    }

    private AuthSession(
        UUID id,
        UserAccount user,
        String tokenHash,
        Instant now,
        Instant expiresAt,
        String userAgent,
        String ipAddress
    ) {
        this.id = id;
        this.user = user;
        this.currentTokenHash = tokenHash;
        this.createdAt = now;
        this.lastUsedAt = now;
        this.expiresAt = expiresAt;
        this.userAgent = userAgent;
        this.ipAddress = ipAddress;
    }

    public static AuthSession create(
        UUID id,
        UserAccount user,
        String tokenHash,
        Instant now,
        Instant expiresAt,
        String userAgent,
        String ipAddress
    ) {
        return new AuthSession(id, user, tokenHash, now, expiresAt, userAgent, ipAddress);
    }

    public UUID getId() {
        return id;
    }

    public UserAccount getUser() {
        return user;
    }

    public String getCurrentTokenHash() {
        return currentTokenHash;
    }

    public long getRotation() {
        return rotation;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public boolean isActiveAt(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public void rotate(String newTokenHash, Instant now) {
        this.rotation++;
        this.currentTokenHash = newTokenHash;
        this.lastUsedAt = now;
    }

    public void revoke(String reason, Instant now) {
        if (this.revokedAt == null) {
            this.revokedAt = now;
            this.revokeReason = reason;
        }
    }
}
