package com.clinora.access.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name="doctor_application_details")
public class DoctorApplicationDetail {
    @Id @Column(name="application_id") private UUID applicationId;
    @Column(name="professional_title", length=160) private String professionalTitle;
    @Column(length=180) private String specialization;
    @Column(name="years_experience") private Integer yearsExperience;
    @Column(name="current_organization", length=220) private String currentOrganization;
    @Column(name="current_position", length=180) private String currentPosition;
    @Column(name="professional_profile_url", length=500) private String professionalProfileUrl;
    @Column(name="registration_jurisdiction", length=160) private String registrationJurisdiction;
    @Column(name="registration_authority", length=220) private String registrationAuthority;
    @Column(name="registration_number", length=160) private String registrationNumber;
    @Column(name="registration_type", length=120) private String registrationType;
    @Column(name="registration_issued_at") private LocalDate registrationIssuedAt;
    @Column(name="registration_valid_until") private LocalDate registrationValidUntil;
    protected DoctorApplicationDetail(){}
    public DoctorApplicationDetail(UUID applicationId){this.applicationId=applicationId;}
    public UUID getApplicationId(){return applicationId;} public String getProfessionalTitle(){return professionalTitle;}
    public String getSpecialization(){return specialization;} public Integer getYearsExperience(){return yearsExperience;}
    public String getCurrentOrganization(){return currentOrganization;} public String getCurrentPosition(){return currentPosition;}
    public String getProfessionalProfileUrl(){return professionalProfileUrl;} public String getRegistrationJurisdiction(){return registrationJurisdiction;}
    public String getRegistrationAuthority(){return registrationAuthority;} public String getRegistrationNumber(){return registrationNumber;}
    public String getRegistrationType(){return registrationType;} public LocalDate getRegistrationIssuedAt(){return registrationIssuedAt;}
    public LocalDate getRegistrationValidUntil(){return registrationValidUntil;}
    public void update(String professionalTitle,String specialization,Integer yearsExperience,String currentOrganization,String currentPosition,String profileUrl,String jurisdiction,String authority,String number,String type,LocalDate issued,LocalDate validUntil){
        if(professionalTitle!=null)this.professionalTitle=professionalTitle; if(specialization!=null)this.specialization=specialization;
        if(yearsExperience!=null)this.yearsExperience=yearsExperience; if(currentOrganization!=null)this.currentOrganization=currentOrganization;
        if(currentPosition!=null)this.currentPosition=currentPosition; if(profileUrl!=null)this.professionalProfileUrl=profileUrl;
        if(jurisdiction!=null)this.registrationJurisdiction=jurisdiction; if(authority!=null)this.registrationAuthority=authority;
        if(number!=null)this.registrationNumber=number; if(type!=null)this.registrationType=type;
        if(issued!=null)this.registrationIssuedAt=issued; if(validUntil!=null)this.registrationValidUntil=validUntil;
    }
}
