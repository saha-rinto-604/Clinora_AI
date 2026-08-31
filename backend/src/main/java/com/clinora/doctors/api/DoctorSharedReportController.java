package com.clinora.doctors.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.doctors.service.DoctorSharedReportService;
import com.clinora.doctors.service.DoctorSharedReportService.Access;
import com.clinora.doctors.service.DoctorSharedReportService.SharedReportContent;
import com.clinora.doctors.service.DoctorSharedReportService.SharedReportView;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/doctor/appointments/{appointmentId}/reports")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorSharedReportController {
    private final DoctorSharedReportService reports;

    public DoctorSharedReportController(DoctorSharedReportService reports) {
        this.reports = reports;
    }

    @GetMapping
    public ApiResponse<List<SharedReportView>> list(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId
    ) {
        return ApiResponse.success("Shared medical reports loaded.", reports.list(userId(jwt), appointmentId));
    }

    @GetMapping("/{reportId}/content")
    public ResponseEntity<byte[]> content(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @PathVariable UUID reportId,
        HttpServletRequest request
    ) {
        return response(
            reports.content(userId(jwt), appointmentId, reportId, Access.VIEW, request.getRemoteAddr(), request.getHeader(HttpHeaders.USER_AGENT)),
            false
        );
    }

    @GetMapping("/{reportId}/download")
    public ResponseEntity<byte[]> download(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID appointmentId,
        @PathVariable UUID reportId,
        HttpServletRequest request
    ) {
        return response(
            reports.content(userId(jwt), appointmentId, reportId, Access.DOWNLOAD, request.getRemoteAddr(), request.getHeader(HttpHeaders.USER_AGENT)),
            true
        );
    }

    private ResponseEntity<byte[]> response(SharedReportContent content, boolean attachment) {
        ContentDisposition disposition = attachment
            ? ContentDisposition.attachment().filename(content.filename(), StandardCharsets.UTF_8).build()
            : ContentDisposition.inline().filename(content.filename(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore().mustRevalidate())
            .contentType(MediaType.parseMediaType(content.contentType()))
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
            .header("X-Content-Type-Options", "nosniff")
            .body(content.bytes());
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
