package com.clinora.consultations.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class ConsultationModels {
    private ConsultationModels() {}

    public record ConsultationView(
        UUID id,
        UUID appointmentId,
        UUID patientId,
        String status,
        long version,
        String historyNotes,
        String findingsNotes,
        String assessment,
        String plan,
        Instant startedAt,
        Instant completedAt,
        List<PrescriptionView> prescriptions,
        List<InvestigationView> investigations,
        FollowUpView followUp
    ) {}

    public record ConsultationDraftRequest(
        Long version,
        String historyNotes,
        String findingsNotes,
        String assessment,
        String plan,
        List<PrescriptionInput> prescriptions,
        List<InvestigationInput> investigations,
        FollowUpInput followUp
    ) {}

    public record PrescriptionInput(
        String medicationName,
        String strength,
        String dose,
        String route,
        String frequency,
        String duration,
        String instructions
    ) {}

    public record PrescriptionView(
        UUID id,
        String medicationName,
        String strength,
        String dose,
        String route,
        String frequency,
        String duration,
        String instructions
    ) {}

    public record InvestigationInput(
        String testName,
        String reason,
        String instructions,
        String priority
    ) {}

    public record InvestigationView(
        UUID id,
        String testName,
        String reason,
        String instructions,
        String priority
    ) {}

    public record FollowUpInput(
        LocalDate recommendedDate,
        String reason,
        String instructions
    ) {}

    public record FollowUpView(
        UUID id,
        LocalDate recommendedDate,
        String reason,
        String instructions
    ) {}

    public record PatientConsultationSummary(
        UUID consultationId,
        UUID appointmentId,
        UUID doctorId,
        String doctorName,
        String specialization,
        String assessment,
        String plan,
        Instant completedAt,
        List<PrescriptionView> prescriptions,
        List<InvestigationView> investigations,
        FollowUpView followUp
    ) {}

    public record ClinicalInboxView(
        int inProgressCount,
        int evidenceReadyCount,
        int followUpCount,
        int upcomingCount,
        List<ClinicalInboxItem> items
    ) {}

    public record ClinicalInboxItem(
        String key,
        String type,
        String priority,
        UUID patientId,
        String patientName,
        UUID appointmentId,
        UUID consultationId,
        String title,
        String detail,
        Instant dueAt,
        String destination
    ) {}

    public record DoctorPatientListItem(
        UUID patientId,
        String patientName,
        Instant lastConsultationAt,
        Instant nextAppointmentAt,
        int investigationCount,
        int currentlySharedReportCount
    ) {}

    public record DoctorPatientDetail(
        UUID patientId,
        String patientName,
        List<PatientAppointmentLink> upcomingAppointments,
        List<PatientCareEpisode> careHistory
    ) {}

    public record PatientAppointmentLink(
        UUID appointmentId,
        Instant scheduledStart,
        Instant scheduledEnd,
        String timezone,
        String consultationMode,
        int sharedReportCount
    ) {}

    public record PatientCareEpisode(
        UUID consultationId,
        UUID appointmentId,
        String status,
        Instant startedAt,
        Instant completedAt,
        String assessment,
        String plan,
        int prescriptionCount,
        int investigationCount,
        LocalDate followUpDate
    ) {}
}
