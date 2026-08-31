package com.clinora.appointments.api;

import com.clinora.appointments.service.PatientAppointmentService;
import com.clinora.appointments.service.PatientAppointmentService.AppointmentCollection;
import com.clinora.appointments.service.PatientAppointmentService.AvailabilitySlotView;
import com.clinora.appointments.service.PatientAppointmentService.AppointmentView;
import com.clinora.appointments.service.PatientAppointmentService.DoctorDetailView;
import com.clinora.appointments.service.PatientAppointmentService.DoctorSearchPage;
import com.clinora.appointments.service.PatientAppointmentService.ReportShareView;
import com.clinora.common.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;

@Validated
@RestController
@RequestMapping("/api/v1/patient")
@PreAuthorize("hasRole('PATIENT')")
public class PatientAppointmentController {
    private final PatientAppointmentService appointments;

    public PatientAppointmentController(PatientAppointmentService appointments) {
        this.appointments = appointments;
    }

    @GetMapping("/doctors")
    public ApiResponse<DoctorSearchPage> doctors(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false) @Size(max = 120) String query,
        @RequestParam(required = false) @Size(max = 180) String specialty,
        @RequestParam(defaultValue = "30") @Min(1) @Max(40) int limit
    ) {
        return ApiResponse.success("Clinora Doctors loaded.", appointments.searchDoctors(userId(jwt), query, specialty, limit));
    }

    @GetMapping("/doctors/{doctorId}")
    public ApiResponse<DoctorDetailView> doctor(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID doctorId) {
        return ApiResponse.success("Doctor profile loaded.", appointments.doctor(userId(jwt), doctorId));
    }

    @GetMapping("/doctors/{doctorId}/availability")
    public ApiResponse<List<AvailabilitySlotView>> availability(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID doctorId,
        @RequestParam(required = false) Instant after,
        @RequestParam(defaultValue = "60") @Min(1) @Max(100) int limit
    ) {
        return ApiResponse.success("Doctor availability loaded.", appointments.availability(userId(jwt), doctorId, after, limit));
    }

    @PostMapping("/appointments")
    public ApiResponse<AppointmentView> book(
        @AuthenticationPrincipal Jwt jwt,
        @RequestHeader("Idempotency-Key") @NotBlank @Size(max = 120) String idempotencyKey,
        @Valid @RequestBody BookAppointmentRequest request
    ) {
        return ApiResponse.success(
            "Appointment booked.",
            appointments.book(
                userId(jwt), idempotencyKey, request.slotId(), request.reasonForVisit(), request.timezone(), request.reportIds()
            )
        );
    }

    @GetMapping("/appointments")
    public ApiResponse<List<AppointmentView>> appointments(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "UPCOMING") AppointmentCollection collection
    ) {
        return ApiResponse.success("Appointments loaded.", appointments.appointments(userId(jwt), collection));
    }

    @GetMapping("/appointments/{appointmentId}")
    public ApiResponse<AppointmentView> appointment(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID appointmentId) {
        return ApiResponse.success("Appointment loaded.", appointments.appointment(userId(jwt), appointmentId));
    }

    @PostMapping("/appointments/{appointmentId}/cancel")
    public ApiResponse<AppointmentView> cancel(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @Valid @RequestBody(required = false) CancelAppointmentRequest request
    ) {
        return ApiResponse.success(
            "Appointment cancelled.",
            appointments.cancel(userId(jwt), appointmentId, request == null ? null : request.reason())
        );
    }

    @PostMapping("/appointments/{appointmentId}/reschedule")
    public ApiResponse<AppointmentView> reschedule(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @Valid @RequestBody RescheduleAppointmentRequest request
    ) {
        return ApiResponse.success(
            "Appointment rescheduled.",
            appointments.reschedule(userId(jwt), appointmentId, request.slotId(), request.timezone())
        );
    }

    @GetMapping("/appointments/{appointmentId}/report-shares")
    public ApiResponse<List<ReportShareView>> shares(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID appointmentId) {
        return ApiResponse.success("Report sharing loaded.", appointments.shares(userId(jwt), appointmentId));
    }

    @PostMapping("/appointments/{appointmentId}/report-shares")
    public ApiResponse<ReportShareView> share(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @Valid @RequestBody ShareReportRequest request
    ) {
        return ApiResponse.success("Medical report shared for this appointment.", appointments.shareReport(userId(jwt), appointmentId, request.reportId()));
    }

    @DeleteMapping("/appointments/{appointmentId}/report-shares/{reportId}")
    public ApiResponse<Void> revoke(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @PathVariable UUID reportId
    ) {
        appointments.revokeShare(userId(jwt), appointmentId, reportId);
        return ApiResponse.success("Medical report access revoked.", null);
    }

    private UUID userId(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }

    public record BookAppointmentRequest(
        @NotNull UUID slotId,
        @Size(max = 500) String reasonForVisit,
        @NotBlank @Size(max = 80) String timezone,
        @Size(max = 20) List<UUID> reportIds
    ) {}
    public record CancelAppointmentRequest(@Size(max = 240) String reason) {}
    public record RescheduleAppointmentRequest(@NotNull UUID slotId, @NotBlank @Size(max = 80) String timezone) {}
    public record ShareReportRequest(@NotNull UUID reportId) {}
}

