package com.clinora.users.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "first_name", nullable = false, length = 120)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 120)
    private String lastName;

    @Column(nullable = false, length = 320)
    private String email;

    @Column(name = "normalized_email", nullable = false, unique = true, length = 320)
    private String normalizedEmail;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private UserRole role;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_status", nullable = false, length = 48)
    private AccountStatus accountStatus;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deactivated_at")
    private Instant deactivatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected UserAccount() {
    }

    public UserAccount(
        String firstName,
        String lastName,
        String email,
        String normalizedEmail,
        String passwordHash,
        UserRole role,
        AccountStatus accountStatus,
        Instant createdAt
    ) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.normalizedEmail = normalizedEmail;
        this.passwordHash = passwordHash;
        this.role = role;
        this.accountStatus = accountStatus;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getEmail() {
        return email;
    }

    public String getNormalizedEmail() {
        return normalizedEmail;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public UserRole getRole() {
        return role;
    }

    public AccountStatus getAccountStatus() {
        return accountStatus;
    }

    public Instant getEmailVerifiedAt() {
        return emailVerifiedAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getDeactivatedAt() {
        return deactivatedAt;
    }

    public boolean isLoginAllowed() {
        return accountStatus == AccountStatus.ACTIVE && emailVerifiedAt != null;
    }

    public void markEmailVerified(Instant now) {
        this.emailVerifiedAt = now;
        if (this.accountStatus == AccountStatus.PENDING_EMAIL_VERIFICATION) {
            this.accountStatus = AccountStatus.ACTIVE;
        }
        touch(now);
    }

    public void recordSuccessfulLogin(Instant now) {
        this.lastLoginAt = now;
        touch(now);
    }

    public void changePasswordHash(String passwordHash, Instant now) {
        this.passwordHash = passwordHash;
        touch(now);
    }

    public void suspend(Instant now) {
        this.accountStatus = AccountStatus.SUSPENDED;
        touch(now);
    }

    public void reactivate(Instant now) {
        this.accountStatus = AccountStatus.ACTIVE;
        this.deactivatedAt = null;
        touch(now);
    }

    public void deactivate(Instant now) {
        this.accountStatus = AccountStatus.DEACTIVATED;
        this.deactivatedAt = now;
        touch(now);
    }

    private void touch(Instant now) {
        this.updatedAt = now;
    }
}
