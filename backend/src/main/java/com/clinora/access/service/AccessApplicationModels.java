package com.clinora.access.service;

import com.clinora.access.domain.ApplicationDocumentType;
import com.clinora.access.domain.ApplicationStatus;
import com.clinora.access.domain.ApplicationType;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class AccessApplicationModels {
    private AccessApplicationModels() {}

    public record CreateRequest(String firstName,String lastName,String email,String phone,String countryCode,boolean consentToApplicationProcessing) {}
    public record QualificationInput(String qualificationName,String institution,String countryCode,Integer completionYear) {}
    public record UpdateRequest(
        String firstName,String lastName,String phone,String countryCode,
        String professionalTitle,String specialization,Integer yearsExperience,String currentOrganization,String currentPosition,String professionalProfileUrl,
        String registrationJurisdiction,String registrationAuthority,String registrationNumber,String registrationType,LocalDate registrationIssuedAt,LocalDate registrationValidUntil,
        List<QualificationInput> qualifications,
        String institution,String department,String institutionalProfileUrl,String researchField,String researchPurpose,String researchSummary,String orcid,
        String researchProfileUrl,String publicationProfileUrl,String ethicsReference,String projectApprovalReference
    ) {}
    public record DocumentView(UUID id,ApplicationDocumentType documentType,String originalFilename,String mimeType,long sizeBytes,Instant createdAt) {}
    public record QualificationView(UUID id,String qualificationName,String institution,String countryCode,Integer completionYear) {}
    public record DoctorDetailView(String professionalTitle,String specialization,Integer yearsExperience,String currentOrganization,String currentPosition,String professionalProfileUrl,String registrationJurisdiction,String registrationAuthority,String registrationNumber,String registrationType,LocalDate registrationIssuedAt,LocalDate registrationValidUntil) {}
    public record ResearcherDetailView(String institution,String department,String professionalTitle,String institutionalProfileUrl,String researchField,String researchPurpose,String researchSummary,String orcid,String researchProfileUrl,String publicationProfileUrl,String ethicsReference,String projectApprovalReference) {}
    public record ApplicationView(UUID id,ApplicationType applicationType,String firstName,String lastName,String email,String phone,String countryCode,ApplicationStatus status,Instant emailVerifiedAt,Instant submittedAt,DoctorDetailView doctor,ResearcherDetailView researcher,List<QualificationView> qualifications,List<DocumentView> documents) {}
    public record EventView(String type,String message,Instant createdAt) {}
    public record VerificationResult(String continuationToken) {}
}
