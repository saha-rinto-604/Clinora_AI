package com.clinora.doctors.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class DoctorProfileModels {
    private DoctorProfileModels() {}

    public record ProfileView(
        UUID doctorId,
        String displayName,
        String verifiedFirstName,
        String verifiedLastName,
        String specialization,
        Integer approvedYearsExperience,
        EditableProfile editable,
        VerifiedCredentials credentials,
        ProfileReadiness readiness,
        long version,
        Instant updatedAt
    ) {}

    public record EditableProfile(
        String professionalBio,
        String professionalProfileUrl,
        String displayTitle,
        String currentOrganization,
        String currentPosition,
        String preferredTimezone,
        Integer defaultConsultationMinutes
    ) {}

    public record VerifiedCredentials(
        String verifiedProfessionalTitle,
        String verifiedCurrentOrganization,
        String verifiedCurrentPosition,
        String registrationJurisdiction,
        String registrationAuthority,
        String registrationNumber,
        String registrationType,
        LocalDate registrationIssuedAt,
        LocalDate registrationValidUntil,
        List<QualificationView> qualifications,
        List<CredentialDocumentView> documents
    ) {}

    public record QualificationView(
        UUID id,
        String qualificationName,
        String institution,
        String countryCode,
        int completionYear
    ) {}

    public record CredentialDocumentView(
        UUID id,
        String documentType,
        String originalFilename,
        String mimeType,
        long sizeBytes,
        Instant uploadedAt
    ) {}

    public record ProfileReadiness(int percent, int completedItems, int totalItems, List<MissingSetupItem> missingItems) {}
    public record MissingSetupItem(String key, String label, String destination) {}

    public record UpdateProfileCommand(
        long version,
        String professionalBio,
        String professionalProfileUrl,
        String displayTitle,
        String currentOrganization,
        String currentPosition,
        String preferredTimezone,
        Integer defaultConsultationMinutes
    ) {}

    public record PatientFacingProfile(
        UUID doctorId,
        String displayName,
        String displayTitle,
        String specialization,
        Integer yearsExperience,
        String currentOrganization,
        String currentPosition,
        String professionalBio,
        String professionalProfileUrl,
        String preferredTimezone,
        Integer defaultConsultationMinutes,
        Instant nextAvailableAt,
        boolean clinoraVerified
    ) {}

    public record CredentialContent(String filename, String contentType, byte[] bytes) {}
}
