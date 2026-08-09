package com.clinora.access.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="applicant_sessions")
public class ApplicantSession {
    @Id private UUID id;
    @Column(name="application_id",nullable=false) private UUID applicationId;
    @Column(name="token_hash",nullable=false,length=64) private String tokenHash;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @Column(name="last_used_at",nullable=false) private Instant lastUsedAt;
    @Column(name="expires_at",nullable=false) private Instant expiresAt;
    @Column(name="revoked_at") private Instant revokedAt;
    @Column(name="user_agent",length=500) private String userAgent;
    @Column(name="ip_address",length=64) private String ipAddress;
    protected ApplicantSession(){}
    public ApplicantSession(UUID id,UUID applicationId,String tokenHash,Instant now,Instant expiresAt,String userAgent,String ipAddress){this.id=id;this.applicationId=applicationId;this.tokenHash=tokenHash;this.createdAt=now;this.lastUsedAt=now;this.expiresAt=expiresAt;this.userAgent=userAgent;this.ipAddress=ipAddress;}
    public UUID getId(){return id;} public UUID getApplicationId(){return applicationId;} public String getTokenHash(){return tokenHash;} public Instant getExpiresAt(){return expiresAt;} public Instant getRevokedAt(){return revokedAt;}
    public boolean activeAt(Instant now){return revokedAt==null && expiresAt.isAfter(now);} public void touch(Instant now){lastUsedAt=now;} public void revoke(Instant now){revokedAt=now;}
}
