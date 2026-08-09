package com.clinora.access.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="application_tokens")
public class ApplicationToken {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="application_id",nullable=false) private UUID applicationId;
    @Enumerated(EnumType.STRING) @Column(name="token_type",nullable=false,length=32) private ApplicationTokenType tokenType;
    @Column(name="token_hash",nullable=false,unique=true,length=64) private String tokenHash;
    @Column(name="expires_at",nullable=false) private Instant expiresAt;
    @Column(name="consumed_at") private Instant consumedAt;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    protected ApplicationToken(){}
    public ApplicationToken(UUID applicationId,ApplicationTokenType tokenType,String tokenHash,Instant expiresAt,Instant createdAt){this.applicationId=applicationId;this.tokenType=tokenType;this.tokenHash=tokenHash;this.expiresAt=expiresAt;this.createdAt=createdAt;}
    public UUID getApplicationId(){return applicationId;} public ApplicationTokenType getTokenType(){return tokenType;} public String getTokenHash(){return tokenHash;} public Instant getExpiresAt(){return expiresAt;} public Instant getConsumedAt(){return consumedAt;}
    public boolean usableAt(Instant now){return consumedAt==null && expiresAt.isAfter(now);} public void consume(Instant now){consumedAt=now;}
}
