package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.ResearchDocumentModels.*;
import com.clinora.research.service.ResearchDocumentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/research/projects/{projectId}/documents")
@PreAuthorize("hasRole('RESEARCHER')")
public class ResearchDocumentController {

    private final ResearchDocumentService documentService;

    public ResearchDocumentController(ResearchDocumentService documentService) {
        this.documentService = documentService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<DocumentDetailDto> createDocument(
            @PathVariable UUID projectId,
            @Valid @RequestBody CreateDocumentRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        UUID userId = extractUserId(jwt);
        DocumentDetailDto doc = documentService.createDocument(
                projectId,
                request,
                userId,
                servletRequest.getRemoteAddr(),
                servletRequest.getHeader(HttpHeaders.USER_AGENT)
        );
        return ApiResponse.success("Document created successfully", doc);
    }

    @GetMapping
    public ApiResponse<List<DocumentSummaryDto>> listDocuments(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID userId = extractUserId(jwt);
        List<DocumentSummaryDto> docs = documentService.listDocuments(projectId, userId);
        return ApiResponse.success("Documents retrieved successfully", docs);
    }

    @GetMapping("/{documentId}")
    public ApiResponse<DocumentDetailDto> getDocument(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID userId = extractUserId(jwt);
        DocumentDetailDto doc = documentService.getDocument(projectId, documentId, userId);
        return ApiResponse.success("Document retrieved successfully", doc);
    }

    @PatchMapping("/{documentId}")
    public ApiResponse<DocumentDetailDto> updateDocument(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @Valid @RequestBody UpdateDocumentRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        UUID userId = extractUserId(jwt);
        DocumentDetailDto doc = documentService.updateDocument(
                projectId,
                documentId,
                request,
                userId,
                servletRequest.getRemoteAddr(),
                servletRequest.getHeader(HttpHeaders.USER_AGENT)
        );
        return ApiResponse.success("Document updated successfully", doc);
    }

    @PostMapping("/{documentId}/rename")
    public ApiResponse<DocumentDetailDto> renameDocument(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @Valid @RequestBody RenameDocumentRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        UUID userId = extractUserId(jwt);
        DocumentDetailDto doc = documentService.renameDocument(
                projectId,
                documentId,
                request,
                userId,
                servletRequest.getRemoteAddr(),
                servletRequest.getHeader(HttpHeaders.USER_AGENT)
        );
        return ApiResponse.success("Document renamed successfully", doc);
    }

    @PostMapping("/{documentId}/archive")
    public ApiResponse<DocumentDetailDto> archiveDocument(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @Valid @RequestBody RevisionExpectation revision,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        UUID userId = extractUserId(jwt);
        DocumentDetailDto doc = documentService.archiveDocument(
                projectId,
                documentId,
                revision.expectedRevisionNumber(),
                userId,
                servletRequest.getRemoteAddr(),
                servletRequest.getHeader(HttpHeaders.USER_AGENT)
        );
        return ApiResponse.success("Document archived successfully", doc);
    }

    @GetMapping("/{documentId}/versions")
    public ApiResponse<List<DocumentRevisionDto>> listRevisions(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID userId = extractUserId(jwt);
        List<DocumentRevisionDto> revisions = documentService.listRevisions(projectId, documentId, userId);
        return ApiResponse.success("Revisions retrieved successfully", revisions);
    }

    @GetMapping("/{documentId}/versions/{versionNumber}")
    public ApiResponse<DocumentRevisionDto> getRevision(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @PathVariable int versionNumber,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID userId = extractUserId(jwt);
        DocumentRevisionDto revision = documentService.getRevision(projectId, documentId, versionNumber, userId);
        return ApiResponse.success("Revision retrieved successfully", revision);
    }

    @PostMapping("/{documentId}/versions/{versionNumber}/restore")
    public ApiResponse<DocumentDetailDto> restoreRevision(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @PathVariable int versionNumber,
            @Valid @RequestBody RevisionExpectation revision,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        UUID userId = extractUserId(jwt);
        DocumentDetailDto doc = documentService.restoreRevision(
                projectId,
                documentId,
                versionNumber,
                revision.expectedRevisionNumber(),
                userId,
                servletRequest.getRemoteAddr(),
                servletRequest.getHeader(HttpHeaders.USER_AGENT)
        );
        return ApiResponse.success("Version " + versionNumber + " restored successfully", doc);
    }

    @GetMapping("/{documentId}/comments")
    public ApiResponse<List<DocumentCommentDto>> listComments(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID userId = extractUserId(jwt);
        List<DocumentCommentDto> comments = documentService.listComments(projectId, documentId, userId);
        return ApiResponse.success("Comments retrieved successfully", comments);
    }

    @PostMapping("/{documentId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<DocumentCommentDto> addComment(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @Valid @RequestBody AddDocumentCommentRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        UUID userId = extractUserId(jwt);
        DocumentCommentDto comment = documentService.addComment(
                projectId,
                documentId,
                request,
                userId,
                servletRequest.getRemoteAddr(),
                servletRequest.getHeader(HttpHeaders.USER_AGENT)
        );
        return ApiResponse.success("Comment added successfully", comment);
    }

    @PatchMapping("/{documentId}/comments/{commentId}")
    public ApiResponse<DocumentCommentDto> updateCommentResolution(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @PathVariable UUID commentId,
            @RequestBody Map<String, Boolean> body,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID userId = extractUserId(jwt);
        boolean resolved = Boolean.TRUE.equals(body.get("resolved"));
        DocumentCommentDto comment = documentService.resolveComment(projectId, documentId, commentId, resolved, userId);
        return ApiResponse.success(resolved ? "Comment resolved" : "Comment reopened", comment);
    }

    @GetMapping("/references/datasets")
    public ApiResponse<List<SafeDatasetReferenceDto>> getSafeDatasetReferences(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID userId = extractUserId(jwt);
        List<SafeDatasetReferenceDto> datasets = documentService.listSafeDatasetReferences(projectId, userId);
        return ApiResponse.success("Dataset references retrieved successfully", datasets);
    }

    @GetMapping("/references/evaluations")
    public ApiResponse<List<SafeAIEvaluationReferenceDto>> getSafeEvaluationReferences(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID userId = extractUserId(jwt);
        List<SafeAIEvaluationReferenceDto> evaluations = documentService.listSafeEvaluationReferences(projectId, userId);
        return ApiResponse.success("Evaluation references retrieved successfully", evaluations);
    }

    private UUID extractUserId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
