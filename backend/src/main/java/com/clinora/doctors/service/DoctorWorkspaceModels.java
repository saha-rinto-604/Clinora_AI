package com.clinora.doctors.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class DoctorWorkspaceModels {
    private DoctorWorkspaceModels() {}

    public record DashboardView(
        DoctorIdentity doctor,
        int profileCompletion,
        int profileCompletedItems,
        int profileTotalItems,
        List<DoctorProfileModels.MissingSetupItem> profileMissingItems,
        int todayCount,
        int upcomingCount,
        int sharedReportsForUpcomingCare,
        int availableSlotCount,
        Instant nextAvailableAt,
        AppointmentSummary nextAppointment,
        List<AppointmentSummary> today
    ) {}

    public record DoctorIdentity(
        UUID id,
        String displayName,
        String professionalTitle,
        String specialization,
        String currentOrganization,
        String currentPosition
    ) {}

    public record AppointmentPage(
        List<AppointmentSummary> items,
        int limit,
        int offset,
        boolean hasMore
    ) {}

    public record AppointmentSummary(
        UUID id,
        UUID patientId,
        String patientName,
        Instant scheduledStart,
        Instant scheduledEnd,
        String timezone,
        String status,
        String reason,
        int sharedReportCount
    ) {}

    public record AppointmentDetail(
        UUID id,
        String status,
        String reason,
        Instant scheduledStart,
        Instant scheduledEnd,
        String timezone,
        boolean canModify,
        boolean reportAccessActive,
        PatientContext patient,
        List<SharedReportSummary> sharedReports
    ) {}

    public record PatientContext(
        UUID id,
        String displayName,
        LocalDate dateOfBirth,
        String gender,
        String bloodGroup,
        List<String> allergies,
        List<String> chronicConditions,
        List<String> currentMedications
    ) {}

    public record SharedReportSummary(
        UUID reportId,
        String displayName,
        String reportType,
        LocalDate reportDate,
        String providerLaboratory,
        String mimeType,
        Instant sharedAt
    ) {}

    public record CancelAppointmentRequest(String reason) {}
    public record RescheduleAppointmentRequest(UUID slotId, String timezone) {}

    public record ReportReviewView(
        UUID appointmentId,
        UUID reportId,
        String displayName,
        String reportType,
        LocalDate reportDate,
        String providerLaboratory,
        String mimeType,
        String extractionReviewStatus,
        Instant sharedAt,
        List<ObservationView> observations
    ) {}

    public record ReportComparisonView(ReportReviewView left, ReportReviewView right) {}

    public record ObservationView(
        UUID id,
        String label,
        String valueType,
        String displayValue,
        String comparator,
        String unit,
        String referenceRange,
        String sourceFlag,
        String derivedRangeFlag,
        Integer pageNumber,
        String patientVerification,
        String doctorDecision,
        String doctorComment,
        String resultStatus
    ) {}

    public record ObservationReviewRequest(String decision, String comment) {}

    public record ObservationReviewView(
        UUID observationId,
        String decision,
        String comment,
        Instant reviewedAt
    ) {}
}
