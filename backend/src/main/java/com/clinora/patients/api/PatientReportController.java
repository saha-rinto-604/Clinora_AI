package com.clinora.patients.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.patients.domain.PatientReportType;
import com.clinora.patients.service.PatientReportMutationService;
import com.clinora.patients.service.PatientReportService;
import com.clinora.patients.service.PatientReportService.ContentAccess;
import com.clinora.patients.service.PatientReportService.ReportCollection;
import com.clinora.patients.service.PatientReportService.ReportPageView;
import com.clinora.patients.service.PatientReportService.ReportView;
import com.clinora.patients.service.PatientReportService.UpdateReportCommand;
import com.clinora.patients.service.PatientReportService.UploadReportCommand;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Validated
@RestController
@RequestMapping("/api/v1/patient/reports")
@PreAuthorize("hasRole('PATIENT')")
public class PatientReportController {
    private final PatientReportService reports;
    private final PatientReportMutationService mutations;

    public PatientReportController(PatientReportService reports, PatientReportMutationService mutations) {
        this.reports = reports;
        this.mutations = mutations;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ReportView> upload(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam @NotBlank @Size(max = 160) String reportName,
        @RequestParam @NotNull PatientReportType reportType,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate reportDate,
        @RequestParam(required = false) @Size(max = 200) String providerLaboratory,
        @RequestPart("file") MultipartFile file,
        HttpServletRequest request
    ) {
        ReportView report = mutations.upload(
            userId(jwt),
            new UploadReportCommand(reportName, reportType, reportDate, providerLaboratory),
            file,
            ip(request),
            userAgent(request)
        );
        return ApiResponse.success("Medical report uploaded securely.", report);
    }

    @GetMapping
    public ApiResponse<ReportPageView> list(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false) @Size(max = 100) String query,
        @RequestParam(required = false) PatientReportType reportType,
        @RequestParam(defaultValue = "ACTIVE") ReportCollection collection,
        @RequestParam(defaultValue = "1") @Min(1) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return ApiResponse.success(
            "Medical reports loaded.",
            reports.list(userId(jwt), query, reportType, collection, page, size)
        );
    }

    @GetMapping("/{reportId}")
    public ApiResponse<ReportView> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID reportId) {
        return ApiResponse.success("Medical report loaded.", reports.detail(userId(jwt), reportId));
    }

    @PatchMapping("/{reportId}")
    public ApiResponse<ReportView> update(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId,
        @Valid @RequestBody UpdateReportRequest body,
        HttpServletRequest request
    ) {
        ReportView report = mutations.updateMetadata(
            userId(jwt),
            reportId,
            body.toCommand(),
            ip(request),
            userAgent(request)
        );
        return ApiResponse.success("Report details updated.", report);
    }

    @PostMapping("/{reportId}/archive")
    public ApiResponse<ReportView> archive(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Medical report archived.",
            mutations.archive(userId(jwt), reportId, ip(request), userAgent(request))
        );
    }

    @PostMapping("/{reportId}/restore")
    public ApiResponse<ReportView> restore(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Medical report restored.",
            mutations.restore(userId(jwt), reportId, ip(request), userAgent(request))
        );
    }

    @GetMapping("/{reportId}/content")
    public ResponseEntity<byte[]> content(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId,
        HttpServletRequest request
    ) {
        return contentResponse(
            reports.content(userId(jwt), reportId, ContentAccess.VIEW, ip(request), userAgent(request)),
            false
        );
    }

    @GetMapping("/{reportId}/download")
    public ResponseEntity<byte[]> download(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID reportId,
        HttpServletRequest request
    ) {
        return contentResponse(
            reports.content(userId(jwt), reportId, ContentAccess.DOWNLOAD, ip(request), userAgent(request)),
            true
        );
    }

    private ResponseEntity<byte[]> contentResponse(PatientReportService.ReportContent content, boolean attachment) {
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

    private String ip(HttpServletRequest request) {
        return request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        return request.getHeader(HttpHeaders.USER_AGENT);
    }

    public record UpdateReportRequest(
        @NotBlank @Size(max = 160) String reportName,
        @NotNull PatientReportType reportType,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate reportDate,
        @Size(max = 200) String providerLaboratory
    ) {
        UpdateReportCommand toCommand() {
            return new UpdateReportCommand(reportName, reportType, reportDate, providerLaboratory);
        }
    }
}
