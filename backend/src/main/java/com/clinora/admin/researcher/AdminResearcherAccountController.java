package com.clinora.admin.researcher;

import com.clinora.access.domain.ApplicationStatus;
import com.clinora.admin.researcher.AdminResearcherAccountModels.*;
import com.clinora.common.api.ApiResponse;
import com.clinora.users.domain.AccountStatus;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import com.clinora.research.api.ResearcherCredentialModels.*;
import com.clinora.research.service.ResearcherCredentialService;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/researchers")
@PreAuthorize("hasRole('SYSTEM_ADMIN')")
public class AdminResearcherAccountController {

    private final AdminResearcherAccountService service;
    private final ResearcherCredentialService credentialService;

    public AdminResearcherAccountController(
            AdminResearcherAccountService service,
            ResearcherCredentialService credentialService
    ) {
        this.service = service;
        this.credentialService = credentialService;
    }

    @GetMapping
    public ApiResponse<ResearcherPageResponse<ResearcherSummaryView>> listResearchers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) AccountStatus accountStatus,
            @RequestParam(required = false) ApplicationStatus applicationStatus,
            @RequestParam(required = false) String researchField,
            @RequestParam(required = false) String institution,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        var result = service.listResearchers(q, accountStatus, applicationStatus, researchField, institution, page, size);
        return ApiResponse.success("Researcher accounts loaded successfully.", result);
    }

    @GetMapping("/{researcherUserId}")
    public ApiResponse<ResearcherDetailView> getResearcherDetail(
            @PathVariable UUID researcherUserId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request
    ) {
        var detail = service.getResearcherDetail(researcherUserId, userId(jwt), ip(request), userAgent(request));
        return ApiResponse.success("Researcher details loaded successfully.", detail);
    }

    @GetMapping("/{researcherUserId}/documents")
    public ApiResponse<List<ResearcherDocumentView>> getResearcherDocuments(
            @PathVariable UUID researcherUserId
    ) {
        var documents = service.getResearcherDocuments(researcherUserId);
        return ApiResponse.success("Researcher documents loaded successfully.", documents);
    }

    @GetMapping("/{researcherUserId}/documents/{documentId}/content")
    public ResponseEntity<byte[]> getDocumentContent(
            @PathVariable UUID researcherUserId,
            @PathVariable UUID documentId,
            @RequestParam(defaultValue = "false") boolean download,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request
    ) {
        var doc = service.downloadDocument(researcherUserId, documentId, !download, userId(jwt), ip(request), userAgent(request));

        ContentDisposition disposition = (download ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(doc.filename(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(doc.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate")
                .body(doc.bytes());
    }

    @GetMapping("/{researcherUserId}/research-activity")
    public ApiResponse<ResearcherActivityView> getResearcherActivity(
            @PathVariable UUID researcherUserId
    ) {
        var activity = service.getResearcherActivity(researcherUserId);
        return ApiResponse.success("Researcher activity loaded successfully.", activity);
    }

    @GetMapping("/{researcherUserId}/audit-events")
    public ApiResponse<ResearcherPageResponse<ResearcherAuditEventView>> getResearcherAuditEvents(
            @PathVariable UUID researcherUserId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        var events = service.getResearcherAuditEvents(researcherUserId, page, size);
        return ApiResponse.success("Researcher audit events loaded successfully.", events);
    }

    @PostMapping("/{researcherUserId}/suspend")
    public ApiResponse<Void> suspendResearcher(
            @PathVariable UUID researcherUserId,
            @Valid @RequestBody(required = false) SecurityActionRequest body,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request
    ) {
        String reason = body != null ? body.reason() : null;
        service.suspendResearcher(researcherUserId, reason, userId(jwt), ip(request), userAgent(request));
        return ApiResponse.success("Researcher account suspended successfully.", null);
    }

    @PostMapping("/{researcherUserId}/reactivate")
    public ApiResponse<Void> reactivateResearcher(
            @PathVariable UUID researcherUserId,
            @Valid @RequestBody(required = false) SecurityActionRequest body,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request
    ) {
        String reason = body != null ? body.reason() : null;
        service.reactivateResearcher(researcherUserId, reason, userId(jwt), ip(request), userAgent(request));
        return ApiResponse.success("Researcher account reactivated successfully.", null);
    }

    @PostMapping("/{researcherUserId}/revoke-sessions")
    public ApiResponse<Void> revokeSessions(
            @PathVariable UUID researcherUserId,
            @Valid @RequestBody(required = false) SecurityActionRequest body,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request
    ) {
        String reason = body != null ? body.reason() : null;
        service.revokeResearcherSessions(researcherUserId, reason, userId(jwt), ip(request), userAgent(request));
        return ApiResponse.success("Researcher active sessions revoked successfully.", null);
    }

    @GetMapping("/{researcherUserId}/credentials")
    public ApiResponse<ResearcherCredentialView> getCredentials(
            @PathVariable UUID researcherUserId
    ) {
        var view = credentialService.getOrCreateVerification(researcherUserId);
        return ApiResponse.success("Researcher credentials loaded.", view);
    }

    @PostMapping("/{researcherUserId}/credentials/verify")
    public ApiResponse<ResearcherCredentialView> verifyCredentials(
            @PathVariable UUID researcherUserId,
            @Valid @RequestBody AdminVerifyActionRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        var view = credentialService.adminVerify(
                researcherUserId,
                userId(jwt),
                request,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Researcher credentials updated.", view);
    }

    @PostMapping("/{researcherUserId}/credentials/extend-deadline")
    public ApiResponse<ResearcherCredentialView> extendDeadline(
            @PathVariable UUID researcherUserId,
            @Valid @RequestBody AdminExtendDeadlineRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        var view = credentialService.adminExtendDeadline(
                researcherUserId,
                userId(jwt),
                request,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Researcher deadline extended successfully.", view);
    }

    @GetMapping("/{researcherUserId}/credentials/documents/{docType}")
    public ResponseEntity<byte[]> downloadCredential(
            @PathVariable UUID researcherUserId,
            @PathVariable String docType,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        var stored = credentialService.downloadDocument(
                researcherUserId,
                docType,
                userId(jwt),
                true,
                ip(servletRequest),
                userAgent(servletRequest)
        );

        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        try {
            if (stored.contentType() != null) {
                mediaType = MediaType.parseMediaType(stored.contentType());
            }
        } catch (Exception ignored) {}

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"credential-" + docType + "\"")
                .body(stored.bytes());
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
}
