package com.clinora.access.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="application_events")
public class ApplicationEvent {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="application_id",nullable=false) private UUID applicationId;
    @Enumerated(EnumType.STRING) @Column(name="event_type",nullable=false,length=64) private ApplicationEventType eventType;
    @Column(name="public_message",nullable=false,length=500) private String publicMessage;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    protected ApplicationEvent(){}
    public ApplicationEvent(UUID applicationId,ApplicationEventType eventType,String publicMessage,Instant createdAt){this.applicationId=applicationId;this.eventType=eventType;this.publicMessage=publicMessage;this.createdAt=createdAt;}
    public UUID getId(){return id;} public ApplicationEventType getEventType(){return eventType;} public String getPublicMessage(){return publicMessage;} public Instant getCreatedAt(){return createdAt;}
}
