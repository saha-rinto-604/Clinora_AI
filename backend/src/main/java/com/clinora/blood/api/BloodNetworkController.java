package com.clinora.blood.api;

import com.clinora.blood.service.BloodNetworkService;
import com.clinora.blood.service.BloodNetworkService.BloodNetworkOverview;
import com.clinora.blood.service.BloodNetworkService.BloodRequestDetailView;
import com.clinora.blood.service.BloodNetworkService.CreateBloodRequestCommand;
import com.clinora.blood.service.BloodNetworkService.CurrentUserView;
import com.clinora.blood.service.BloodNetworkService.RequestStatusAction;
import com.clinora.blood.service.BloodNetworkService.RouteView;
import com.clinora.blood.service.BloodNetworkService.ResponseAction;
import com.clinora.common.api.ApiResponse;
import com.clinora.patients.domain.BloodGroup;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/patient/blood-network")
@PreAuthorize("hasRole('PATIENT')")
public class BloodNetworkController {

    private final BloodNetworkService service;

    public BloodNetworkController(BloodNetworkService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<BloodNetworkOverview> overview(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false) BloodGroup bloodGroup
    ) {
        return ApiResponse.success("Blood Network overview.", service.overview(userId(jwt), bloodGroup));
    }

    @PatchMapping("/preferences")
    public ApiResponse<CurrentUserView> preferences(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody BloodNetworkPreferencesRequest request
    ) {
        return ApiResponse.success(
            "Blood Network preferences updated.",
            service.updatePreferences(userId(jwt), request.enabled(), request.available())
        );
    }

    @PostMapping("/requests")
    public ApiResponse<BloodRequestDetailView> createRequest(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody CreateBloodRequestRequest request
    ) {
        return ApiResponse.success("Blood request created.", service.createRequest(userId(jwt), request.toCommand()));
    }

    @GetMapping("/requests/{requestId}")
    public ApiResponse<BloodRequestDetailView> request(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID requestId
    ) {
        return ApiResponse.success("Blood request.", service.requestDetail(userId(jwt), requestId));
    }

    @GetMapping("/requests/{requestId}/route")
    public ApiResponse<RouteView> route(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID requestId,
        @RequestParam(required = false) UUID matchedUserId
    ) {
        return ApiResponse.success(
            "Blood request driving route.",
            service.route(userId(jwt), requestId, matchedUserId)
        );
    }

    @PostMapping("/requests/{requestId}/responses")
    public ApiResponse<BloodRequestDetailView> respond(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID requestId,
        @Valid @RequestBody BloodRequestResponseRequest request
    ) {
        return ApiResponse.success("Blood request response updated.", service.respond(userId(jwt), requestId, request.action()));
    }

    @PatchMapping("/requests/{requestId}/status")
    public ApiResponse<BloodRequestDetailView> updateStatus(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID requestId,
        @Valid @RequestBody BloodRequestStatusRequest request
    ) {
        return ApiResponse.success(
            "Blood request status updated.",
            service.updateRequestStatus(userId(jwt), requestId, request.action())
        );
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    public record BloodNetworkPreferencesRequest(boolean enabled, boolean available) {}

    public record CreateBloodRequestRequest(
        @NotNull BloodGroup bloodGroup,
        @Min(1) @Max(20) int unitsNeeded,
        @NotBlank @Size(max = 180) String hospitalName,
        @NotBlank @Size(max = 500) String hospitalAddress,
        Double latitude,
        Double longitude,
        Instant neededBy,
        @Size(max = 600) String note
    ) {
        CreateBloodRequestCommand toCommand() {
            return new CreateBloodRequestCommand(
                bloodGroup,
                unitsNeeded,
                hospitalName,
                hospitalAddress,
                latitude,
                longitude,
                neededBy,
                note
            );
        }
    }

    public record BloodRequestResponseRequest(@NotNull ResponseAction action) {}
    public record BloodRequestStatusRequest(@NotNull RequestStatusAction action) {}
}
