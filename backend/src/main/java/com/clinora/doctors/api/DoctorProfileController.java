package com.clinora.doctors.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.doctors.service.DoctorProfileModels;
import com.clinora.doctors.service.DoctorProfileService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/doctor/profile")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorProfileController {
    private final DoctorProfileService profiles;

    public DoctorProfileController(DoctorProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping
    public ApiResponse<DoctorProfileModels.ProfileView> profile(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Doctor profile loaded.", profiles.profile(userId(jwt)));
    }

    @PutMapping
    public ApiResponse<DoctorProfileModels.ProfileView> update(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody UpdateProfileRequest request,
        HttpServletRequest servletRequest
    ) {
        return ApiResponse.success(
            "Professional profile updated.",
            profiles.update(
                userId(jwt),
                new DoctorProfileModels.UpdateProfileCommand(
                    request.version(),
                    request.professionalBio(),
                    request.professionalProfileUrl(),
                    request.displayTitle(),
                    request.currentOrganization(),
                    request.currentPosition(),
                    request.preferredTimezone(),
                    request.defaultConsultationMinutes()
                ),
                servletRequest.getRemoteAddr(),
                servletRequest.getHeader("User-Agent")
            )
        );
    }

    @GetMapping("/credentials/documents/{documentId}/content")
    public ResponseEntity<byte[]> documentContent(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID documentId,
        HttpServletRequest request
    ) {
        return document(userId(jwt), documentId, request, false);
    }

    @GetMapping("/credentials/documents/{documentId}/download")
    public ResponseEntity<byte[]> documentDownload(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID documentId,
        HttpServletRequest request
    ) {
        return document(userId(jwt), documentId, request, true);
    }

    private ResponseEntity<byte[]> document(UUID doctorId, UUID documentId, HttpServletRequest request, boolean download) {
        DoctorProfileModels.CredentialContent content = profiles.credentialContent(
            doctorId,
            documentId,
            request.getRemoteAddr(),
            request.getHeader("User-Agent")
        );
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(content.contentType());
        } catch (IllegalArgumentException exception) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        ContentDisposition disposition = ContentDisposition
            .builder(download ? "attachment" : "inline")
            .filename(content.filename(), StandardCharsets.UTF_8)
            .build();
        return ResponseEntity.ok()
            .contentType(mediaType)
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
            .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Security-Policy", "sandbox")
            .body(content.bytes());
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    public record UpdateProfileRequest(
        @NotNull Long version,
        @Size(max = 2000) String professionalBio,
        @Size(max = 500) String professionalProfileUrl,
        @Size(max = 160) String displayTitle,
        @Size(max = 220) String currentOrganization,
        @Size(max = 180) String currentPosition,
        @Size(max = 80) String preferredTimezone,
        @Min(15) @Max(120) Integer defaultConsultationMinutes
    ) {}
}
