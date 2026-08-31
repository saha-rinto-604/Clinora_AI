package com.clinora.doctors.api;

import com.clinora.appointments.service.PatientAppointmentService;
import com.clinora.appointments.service.PatientAppointmentService.AvailabilitySlotView;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/doctor/availability")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorAvailabilityController {
    private final PatientAppointmentService appointments;

    public DoctorAvailabilityController(PatientAppointmentService appointments) {
        this.appointments = appointments;
    }

    @GetMapping
    public ApiResponse<List<AvailabilitySlotView>> list(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Doctor availability loaded.", appointments.doctorAvailability(userId(jwt)));
    }

    @PostMapping
    public ApiResponse<List<AvailabilitySlotView>> create(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody AvailabilityRequest request
    ) {
        return ApiResponse.success(
            "Availability added.",
            appointments.addAvailability(userId(jwt), request.startsAt(), request.endsAt(), request.slotMinutes(), request.timezone())
        );
    }

    @DeleteMapping("/{slotId}")
    public ApiResponse<Void> remove(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID slotId) {
        appointments.removeAvailability(userId(jwt), slotId);
        return ApiResponse.success("Availability removed.", null);
    }

    private UUID userId(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }

    public record AvailabilityRequest(
        @NotNull Instant startsAt,
        @NotNull Instant endsAt,
        @Min(15) @Max(120) int slotMinutes,
        @NotBlank @Size(max = 80) String timezone
    ) {}
}

