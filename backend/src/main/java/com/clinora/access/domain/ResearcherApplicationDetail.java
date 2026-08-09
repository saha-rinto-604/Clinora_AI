package com.clinora.access.domain;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name="researcher_application_details")
public class ResearcherApplicationDetail {
    @Id @Column(name="application_id") private UUID applicationId;
    @Column(length=220) private String institution;
    @Column(length=180) private String department;
    @Column(name="professional_title", length=180) private String professionalTitle;
    @Column(name="institutional_profile_url", length=500) private String institutionalProfileUrl;
    @Column(name="research_field", length=240) private String researchField;
    @Column(name="research_purpose", columnDefinition="text") private String researchPurpose;
    @Column(name="research_summary", columnDefinition="text") private String researchSummary;
    @Column(length=64) private String orcid;
    @Column(name="research_profile_url", length=500) private String researchProfileUrl;
    @Column(name="publication_profile_url", length=500) private String publicationProfileUrl;
    @Column(name="ethics_reference", length=300) private String ethicsReference;
    @Column(name="project_approval_reference", length=300) private String projectApprovalReference;
    protected ResearcherApplicationDetail(){}
    public ResearcherApplicationDetail(UUID applicationId){this.applicationId=applicationId;}
    public UUID getApplicationId(){return applicationId;} public String getInstitution(){return institution;} public String getDepartment(){return department;}
    public String getProfessionalTitle(){return professionalTitle;} public String getInstitutionalProfileUrl(){return institutionalProfileUrl;}
    public String getResearchField(){return researchField;} public String getResearchPurpose(){return researchPurpose;} public String getResearchSummary(){return researchSummary;}
    public String getOrcid(){return orcid;} public String getResearchProfileUrl(){return researchProfileUrl;} public String getPublicationProfileUrl(){return publicationProfileUrl;}
    public String getEthicsReference(){return ethicsReference;} public String getProjectApprovalReference(){return projectApprovalReference;}
    public void update(String institution,String department,String professionalTitle,String institutionalProfileUrl,String researchField,String researchPurpose,String researchSummary,String orcid,String researchProfileUrl,String publicationProfileUrl,String ethicsReference,String projectApprovalReference){
        if(institution!=null)this.institution=institution; if(department!=null)this.department=department; if(professionalTitle!=null)this.professionalTitle=professionalTitle;
        if(institutionalProfileUrl!=null)this.institutionalProfileUrl=institutionalProfileUrl; if(researchField!=null)this.researchField=researchField;
        if(researchPurpose!=null)this.researchPurpose=researchPurpose; if(researchSummary!=null)this.researchSummary=researchSummary; if(orcid!=null)this.orcid=orcid;
        if(researchProfileUrl!=null)this.researchProfileUrl=researchProfileUrl; if(publicationProfileUrl!=null)this.publicationProfileUrl=publicationProfileUrl;
        if(ethicsReference!=null)this.ethicsReference=ethicsReference; if(projectApprovalReference!=null)this.projectApprovalReference=projectApprovalReference;
    }
}
