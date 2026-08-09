package com.clinora.access.domain;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name="doctor_qualifications")
public class DoctorQualification {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="application_id", nullable=false) private UUID applicationId;
    @Column(name="qualification_name", nullable=false, length=220) private String qualificationName;
    @Column(nullable=false, length=220) private String institution;
    @Column(name="country_code", nullable=false, length=120) private String countryCode;
    @Column(name="completion_year", nullable=false) private Integer completionYear;
    protected DoctorQualification(){}
    public DoctorQualification(UUID applicationId,String qualificationName,String institution,String countryCode,Integer completionYear){this.applicationId=applicationId;this.qualificationName=qualificationName;this.institution=institution;this.countryCode=countryCode;this.completionYear=completionYear;}
    public UUID getId(){return id;} public UUID getApplicationId(){return applicationId;} public String getQualificationName(){return qualificationName;} public String getInstitution(){return institution;} public String getCountryCode(){return countryCode;} public Integer getCompletionYear(){return completionYear;}
}
