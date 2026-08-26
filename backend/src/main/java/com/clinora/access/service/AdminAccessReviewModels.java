package com.clinora.access.service;

import com.clinora.access.domain.ApplicationDocumentType;
import com.clinora.access.domain.ApplicationStatus;
import com.clinora.access.domain.ApplicationType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AdminAccessReviewModels {
    private AdminAccessReviewModels() {}

    public record PageView<T>(List<T> items, int page, int size, long totalItems, int totalPages) {}

    public record QueueItem(
        UUID id,
        ApplicationType applicationType,
        String firstName,
        String lastName,
        String email,
        ApplicationStatus status,
        Instant submittedAt,
        Instant updatedAt
    ) {}

    public record DocumentView(
        UUID id,
        ApplicationDocumentType documentType,
        String originalFilename,
        String mimeType,
        long sizeBytes,
        Instant createdAt
    ) {}

    public record EventView(String type, String message, Instant createdAt) {}

    public record ReviewNoteView(UUID id, UUID reviewerUserId, String text, Instant createdAt) {}

    public record DetailView(
        UUID id,
        ApplicationType applicationType,
        String firstName,
        String lastName,
        String email,
        String phone,
        String countryCode,
        ApplicationStatus status,
        Instant emailVerifiedAt,
        Instant submittedAt,
        Instant updatedAt,
        AccessApplicationModels.DoctorDetailView doctor,
        AccessApplicationModels.ResearcherDetailView researcher,
        List<AccessApplicationModels.QualificationView> qualifications,
        List<DocumentView> documents,
        List<EventView> events,
        List<ReviewNoteView> internalNotes,
        List<ApplicationStatus> allowedNextStatuses
    ) {}
}
