package com.clinora.access.api;

import com.clinora.access.domain.ApplicationStatus;
import com.clinora.access.domain.ApplicationType;
import com.clinora.access.service.AdminAccessReviewModels;
import com.clinora.access.service.AdminAccessReviewService;
import com.clinora.access.service.ApplicationDocumentService;
import com.clinora.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/access-applications")
public class AdminAccessReviewController {
    private final AdminAccessReviewService reviews;
    private final ApplicationDocumentService documents;

    public AdminAccessReviewController(AdminAccessReviewService reviews, ApplicationDocumentService documents) {
        this.reviews = reviews;
        this.documents = documents;
    }

    @GetMapping
    public ApiResponse<AdminAccessReviewModels.PageView<AdminAccessReviewModels.QueueItem>> queue(
        @RequestParam(required = false) ApplicationType applicationType,
        @RequestParam(required = false) ApplicationStatus status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success("Access review applications loaded.", reviews.queue(applicationType, status, page, size));
    }

    @GetMapping("/{applicationId}")
    public ApiResponse<AdminAccessReviewModels.DetailView> detail(@PathVariable UUID applicationId) {
        return ApiResponse.success("Access review application loaded.", reviews.detail(applicationId));
    }

    @PostMapping("/{applicationId}/start-review")
    public ApiResponse<AdminAccessReviewModels.DetailView> startReview(
        @PathVariable UUID applicationId,
        @AuthenticationPrincipal Jwt jwt,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Application review started.",
            reviews.startReview(applicationId, userId(jwt), ip(request), userAgent(request))
        );
    }

    @PostMapping("/{applicationId}/notes")
    public ApiResponse<AdminAccessReviewModels.DetailView> addNote(
        @PathVariable UUID applicationId,
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody NoteRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "Internal review note added.",
            reviews.addNote(applicationId, userId(jwt), body.text(), ip(request), userAgent(request))
        );
    }

    @PostMapping("/{applicationId}/request-more-information")
    public ApiResponse<AdminAccessReviewModels.DetailView> requestMoreInformation(
        @PathVariable UUID applicationId,
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody MoreInformationRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            "More information requested.",
            reviews.requestMoreInformation(applicationId, userId(jwt), body.message(), ip(request), userAgent(request))
        );
    }

    @GetMapping("/{applicationId}/documents/{documentId}/content")
    public ResponseEntity<byte[]> documentContent(
        @PathVariable UUID applicationId,
        @PathVariable UUID documentId
    ) {
        try {
            var download = documents.download(applicationId, documentId);
            return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.contentType()))
                .header(
                    HttpHeaders.CONTENT_DISPOSITION,
                    ContentDisposition.attachment()
                        .filename(download.filename(), StandardCharsets.UTF_8)
                        .build()
                        .toString()
                )
                .body(download.bytes());
        } catch (AccessApplicationException exception) {
            if ("APPLICANT_SESSION_INVALID".equals(exception.getErrorCode())) {
                throw AccessApplicationException.documentNotFound();
            }
            throw exception;
        }
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

    public record NoteRequest(@NotBlank @Size(max = 2000) String text) {
    }

    public record MoreInformationRequest(@NotBlank @Size(max = 500) String message) {
    }
}
