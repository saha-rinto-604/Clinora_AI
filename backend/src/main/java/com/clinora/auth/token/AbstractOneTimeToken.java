package com.clinora.auth.token;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import java.util.UUID;

@MappedSuperclass
public abstract class AbstractOneTimeToken {

    @Id
    private UUID id;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AbstractOneTimeToken() {
    }

    protected AbstractOneTimeToken(UUID id, String tokenHash, Instant expiresAt, Instant createdAt) {
        this.id = id;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getConsumedAt() {
        return consumedAt;
    }

    public boolean canBeConsumedAt(Instant now) {
        return consumedAt == null && expiresAt.isAfter(now);
    }

    public void consume(Instant now) {
        if (!canBeConsumedAt(now)) {
            throw new IllegalStateException("Token is expired or already consumed");
        }
        this.consumedAt = now;
    }
}
