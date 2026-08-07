package com.clinora.auth.token;

import com.clinora.users.domain.UserAccount;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "password_reset_tokens")
public class PasswordResetToken extends AbstractOneTimeToken {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    protected PasswordResetToken() {
    }

    public PasswordResetToken(
        UUID id,
        UserAccount user,
        String tokenHash,
        Instant expiresAt,
        Instant createdAt
    ) {
        super(id, tokenHash, expiresAt, createdAt);
        this.user = user;
    }

    public UserAccount getUser() {
        return user;
    }
}
