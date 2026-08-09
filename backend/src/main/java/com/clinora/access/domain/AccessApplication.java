package com.clinora.access.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "access_applications")
public class AccessApplication {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Enumerated(EnumType.STRING) @Column(name="application_type", nullable=false, length=24)
    private ApplicationType applicationType;
    @Column(name="first_name", nullable=false, length=120) private String firstName;
    @Column(name="last_name", nullable=false, length=120) private String lastName;
    @Column(nullable=false, length=320) private String email;
    @Column(name="normalized_email", nullable=false, length=320) private String normalizedEmail;
    @Column(length=40) private String phone;
    @Column(name="country_code", length=120) private String countryCode;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=48) private ApplicationStatus status;
    @Column(name="processing_consent_at",nullable=false) private Instant processingConsentAt;
    @Column(name="email_verified_at") private Instant emailVerifiedAt;
    @Column(name="attested_at") private Instant attestedAt;
    @Column(name="submitted_at") private Instant submittedAt;
    @Column(name="created_at", nullable=false) private Instant createdAt;
    @Column(name="updated_at", nullable=false) private Instant updatedAt;
    @Version @Column(nullable=false) private long version;

    protected AccessApplication() {}
    public AccessApplication(ApplicationType type, String firstName, String lastName, String email, String normalizedEmail, String phone, String countryCode, Instant now) {
        this.applicationType=type; this.firstName=firstName; this.lastName=lastName; this.email=email;
        this.normalizedEmail=normalizedEmail; this.phone=phone; this.countryCode=countryCode;
        this.status=ApplicationStatus.EMAIL_PENDING; this.processingConsentAt=now; this.createdAt=now; this.updatedAt=now;
    }
    public UUID getId(){return id;} public ApplicationType getApplicationType(){return applicationType;}
    public String getFirstName(){return firstName;} public String getLastName(){return lastName;}
    public String getEmail(){return email;} public String getNormalizedEmail(){return normalizedEmail;}
    public String getPhone(){return phone;} public String getCountryCode(){return countryCode;}
    public ApplicationStatus getStatus(){return status;} public Instant getEmailVerifiedAt(){return emailVerifiedAt;}
    public Instant getAttestedAt(){return attestedAt;} public Instant getSubmittedAt(){return submittedAt;}
    public Instant getCreatedAt(){return createdAt;} public Instant getUpdatedAt(){return updatedAt;}
    public boolean isEditable(){return status==ApplicationStatus.DRAFT || status==ApplicationStatus.MORE_INFO_REQUIRED;}
    public void markEmailVerified(Instant now){ if(status!=ApplicationStatus.EMAIL_PENDING) return; emailVerifiedAt=now; status=ApplicationStatus.DRAFT; touch(now); }
    public void updateCommon(String firstName,String lastName,String phone,String countryCode,Instant now){
        if(firstName!=null)this.firstName=firstName; if(lastName!=null)this.lastName=lastName;
        if(phone!=null)this.phone=phone; if(countryCode!=null)this.countryCode=countryCode; touch(now);
    }
    public void submit(Instant now){ status=ApplicationStatus.SUBMITTED; submittedAt=now; attestedAt=now; touch(now); }
    public void withdraw(Instant now){ status=ApplicationStatus.WITHDRAWN; touch(now); }
    public void moveToReviewStatus(ApplicationStatus nextStatus, Instant now){
        if(applicationType==ApplicationType.RESEARCHER && nextStatus.isInterviewState())
            throw new IllegalStateException("Researcher applications do not use interview states.");
        status=nextStatus; touch(now);
    }
    private void touch(Instant now){updatedAt=now;}
}
