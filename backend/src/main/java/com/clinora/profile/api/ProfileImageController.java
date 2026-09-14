package com.clinora.profile.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.profile.service.ProfileImageService;
import com.clinora.profile.service.ProfileImageService.ProfileImageContent;
import com.clinora.profile.service.ProfileImageService.ProfileImageView;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/profile-images")
public class ProfileImageController {
    private final ProfileImageService images;

    public ProfileImageController(ProfileImageService images) {
        this.images = images;
    }

    @GetMapping("/me")
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR')")
    public ApiResponse<ProfileImageView> metadata(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Profile image state loaded.", images.metadata(userId(jwt)).orElse(null));
    }

    @GetMapping("/me/content")
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR')")
    public ResponseEntity<byte[]> selfContent(@AuthenticationPrincipal Jwt jwt) {
        return content(images.selfContent(userId(jwt)).orElse(null));
    }

    @PutMapping(value = "/me", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR')")
    public ApiResponse<ProfileImageView> replace(
        @AuthenticationPrincipal Jwt jwt,
        @RequestPart("file") MultipartFile file,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Profile photo updated.",
            images.replace(userId(jwt), file, request.getRemoteAddr(), request.getHeader("User-Agent"))
        );
    }

    @DeleteMapping("/me")
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR')")
    public ApiResponse<Void> remove(@AuthenticationPrincipal Jwt jwt, HttpServletRequest request) {
        images.remove(userId(jwt), request.getRemoteAddr(), request.getHeader("User-Agent"));
        return ApiResponse.success("Profile photo removed.", null);
    }

    @GetMapping("/patient/doctors/{doctorId}")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<byte[]> patientVisibleDoctor(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID doctorId
    ) {
        return content(images.patientVisibleDoctorContent(userId(jwt), doctorId).orElse(null));
    }

    @GetMapping("/doctor/appointments/{appointmentId}/patient")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<byte[]> doctorVisiblePatient(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId
    ) {
        return content(images.doctorVisiblePatientContent(userId(jwt), appointmentId).orElse(null));
    }

    private static ResponseEntity<byte[]> content(ProfileImageContent image) {
        if (image == null) return ResponseEntity.noContent().build();
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(image.contentType());
        } catch (IllegalArgumentException exception) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
            .contentType(mediaType)
            .cacheControl(CacheControl.noCache().cachePrivate())
            .eTag('"' + image.checksum() + '"')
            .header(HttpHeaders.VARY, HttpHeaders.AUTHORIZATION)
            .header("X-Content-Type-Options", "nosniff")
            .body(image.bytes());
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
