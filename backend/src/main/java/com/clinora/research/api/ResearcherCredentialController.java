package com.clinora.research.api;

import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.ResearcherCredentialModels.*;
import com.clinora.research.service.ResearcherCredentialService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/research/credentials")
public class ResearcherCredentialController {

    private final ResearcherCredentialService credentialService;

    public ResearcherCredentialController(ResearcherCredentialService credentialService) {
        this.credentialService = credentialService;
    }

    @GetMapping
    @PreAuthorize("hasRole('RESEARCHER')")
    public ApiResponse<ResearcherCredentialView> getMyCredentials(
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());
        ResearcherCredentialView view = credentialService.getOrCreateVerification(userId);
        return ApiResponse.success("Researcher credential status retrieved.", view);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('RESEARCHER')")
    public ApiResponse<ResearcherCredentialView> submitCredentials(
            @AuthenticationPrincipal Jwt jwt,
            @RequestPart("data") @Valid SubmitCredentialsRequest request,
            @RequestPart("studentId") MultipartFile studentId,
            @RequestPart("certificate") MultipartFile certificate,
            HttpServletRequest servletRequest
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());
        String ip = servletRequest.getRemoteAddr();
        String userAgent = servletRequest.getHeader("User-Agent");

        ResearcherCredentialView view = credentialService.submitCredentials(
                userId,
                request,
                studentId,
                certificate,
                ip,
                userAgent
        );
        return ApiResponse.success("Credentials submitted for admin verification.", view);
    }

    @GetMapping("/documents/{docType}")
    @PreAuthorize("hasAnyRole('RESEARCHER', 'SYSTEM_ADMIN')")
    public ResponseEntity<byte[]> downloadDocument(
            @PathVariable String docType,
            @RequestParam(required = false) UUID userId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        UUID callerId = UUID.fromString(jwt.getSubject());
        boolean isAdmin = jwt.getClaimAsStringList("roles") != null && jwt.getClaimAsStringList("roles").contains("ROLE_SYSTEM_ADMIN");
        // Also check authories/role claim
        if (!isAdmin) {
            String role = jwt.getClaimAsString("role");
            if ("SYSTEM_ADMIN".equals(role) || "ROLE_SYSTEM_ADMIN".equals(role)) {
                isAdmin = true;
            }
        }

        UUID targetUserId = (isAdmin && userId != null) ? userId : callerId;
        String ip = servletRequest.getRemoteAddr();
        String userAgent = servletRequest.getHeader("User-Agent");

        ApplicationDocumentStoragePort.StoredObject stored = credentialService.downloadDocument(
                targetUserId,
                docType,
                callerId,
                isAdmin,
                ip,
                userAgent
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
}
