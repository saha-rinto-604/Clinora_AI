package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.ResearchWorkspaceModels.*;
import com.clinora.research.service.ResearchWorkspaceService;
import com.clinora.research.service.ResearchWorkspaceService.DownloadableFile;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@Validated
@RestController
@PreAuthorize("hasRole('RESEARCHER')")
public class ResearchWorkspaceController {

    private final ResearchWorkspaceService workspaceService;

    public ResearchWorkspaceController(ResearchWorkspaceService workspaceService) {
        this.workspaceService = workspaceService;
    }

    // ─── Research Notes ────────────────────────────────────────────────────────

    @GetMapping("/api/v1/research/projects/{projectId}/notes")
    public ApiResponse<List<NoteResponse>> listNotes(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<NoteResponse> notes = workspaceService.listNotes(projectId, userId(jwt));
        return ApiResponse.success("Research notes retrieved.", notes);
    }

    @GetMapping("/api/v1/research/projects/{projectId}/notes/{noteId}")
    public ApiResponse<NoteResponse> getNote(
            @PathVariable UUID projectId,
            @PathVariable UUID noteId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        NoteResponse note = workspaceService.getNote(projectId, noteId, userId(jwt));
        return ApiResponse.success("Research note retrieved.", note);
    }

    @PostMapping("/api/v1/research/projects/{projectId}/notes")
    public ApiResponse<NoteResponse> createNote(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateNoteRequest request,
            HttpServletRequest servletRequest
    ) {
        NoteResponse note = workspaceService.createNote(
                projectId, userId(jwt), request, ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Research note created.", note);
    }

    @PutMapping("/api/v1/research/projects/{projectId}/notes/{noteId}")
    public ApiResponse<NoteResponse> updateNote(
            @PathVariable UUID projectId,
            @PathVariable UUID noteId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateNoteRequest request,
            HttpServletRequest servletRequest
    ) {
        NoteResponse note = workspaceService.updateNote(
                projectId, noteId, userId(jwt), request, ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Research note updated.", note);
    }

    @DeleteMapping("/api/v1/research/projects/{projectId}/notes/{noteId}")
    public ApiResponse<Void> archiveNote(
            @PathVariable UUID projectId,
            @PathVariable UUID noteId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        workspaceService.archiveNote(
                projectId, noteId, userId(jwt), ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Research note archived.", null);
    }

    @PostMapping("/api/v1/research/projects/{projectId}/notes/{noteId}/pin")
    public ApiResponse<NoteResponse> togglePin(
            @PathVariable UUID projectId,
            @PathVariable UUID noteId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        NoteResponse note = workspaceService.togglePin(
                projectId, noteId, userId(jwt), ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Note pin status updated.", note);
    }

    // ─── Note Comments ─────────────────────────────────────────────────────────

    @GetMapping("/api/v1/research/projects/{projectId}/notes/{noteId}/comments")
    public ApiResponse<List<CommentResponse>> listComments(
            @PathVariable UUID projectId,
            @PathVariable UUID noteId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<CommentResponse> comments = workspaceService.listComments(projectId, noteId, userId(jwt));
        return ApiResponse.success("Note comments retrieved.", comments);
    }

    @PostMapping("/api/v1/research/projects/{projectId}/notes/{noteId}/comments")
    public ApiResponse<CommentResponse> addComment(
            @PathVariable UUID projectId,
            @PathVariable UUID noteId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AddCommentRequest request,
            HttpServletRequest servletRequest
    ) {
        CommentResponse comment = workspaceService.addComment(
                projectId, noteId, userId(jwt), request, ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Comment added.", comment);
    }

    @DeleteMapping("/api/v1/research/projects/{projectId}/notes/{noteId}/comments/{commentId}")
    public ApiResponse<Void> deleteComment(
            @PathVariable UUID projectId,
            @PathVariable UUID noteId,
            @PathVariable UUID commentId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        workspaceService.deleteComment(
                projectId, noteId, commentId, userId(jwt), ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Comment deleted.", null);
    }

    // ─── Project Files & Versions ──────────────────────────────────────────────

    @GetMapping("/api/v1/research/projects/{projectId}/files")
    public ApiResponse<List<FileResponse>> listFiles(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<FileResponse> files = workspaceService.listFiles(projectId, userId(jwt));
        return ApiResponse.success("Project documents retrieved.", files);
    }

    @PostMapping(value = "/api/v1/research/projects/{projectId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<FileResponse> uploadFile(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "displayName", required = false) String displayName,
            HttpServletRequest servletRequest
    ) {
        FileResponse response = workspaceService.uploadFile(
                projectId, userId(jwt), file, displayName, ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Project document uploaded successfully.", response);
    }

    @PostMapping(value = "/api/v1/research/projects/{projectId}/files/{fileId}/versions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<FileVersionResponse> uploadFileVersion(
            @PathVariable UUID projectId,
            @PathVariable UUID fileId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest servletRequest
    ) {
        FileVersionResponse response = workspaceService.uploadFileVersion(
                projectId, fileId, userId(jwt), file, ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("New document version uploaded successfully.", response);
    }

    @GetMapping("/api/v1/research/projects/{projectId}/files/{fileId}/versions")
    public ApiResponse<List<FileVersionResponse>> listFileVersions(
            @PathVariable UUID projectId,
            @PathVariable UUID fileId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<FileVersionResponse> versions = workspaceService.listFileVersions(projectId, fileId, userId(jwt));
        return ApiResponse.success("Document versions retrieved.", versions);
    }

    @GetMapping("/api/v1/research/projects/{projectId}/files/{fileId}/download")
    public ResponseEntity<byte[]> downloadFile(
            @PathVariable UUID projectId,
            @PathVariable UUID fileId,
            @RequestParam(value = "version", required = false) Integer version,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        DownloadableFile downloaded = workspaceService.downloadFile(
                projectId, fileId, version, userId(jwt), ip(servletRequest), userAgent(servletRequest));

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(downloaded.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + downloaded.filename() + "\"")
                .body(downloaded.bytes());
    }

    @DeleteMapping("/api/v1/research/projects/{projectId}/files/{fileId}")
    public ApiResponse<Void> archiveFile(
            @PathVariable UUID projectId,
            @PathVariable UUID fileId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        workspaceService.archiveFile(
                projectId, fileId, userId(jwt), ip(servletRequest), userAgent(servletRequest));
        return ApiResponse.success("Project document archived.", null);
    }

    // ─── Activity Feed ─────────────────────────────────────────────────────────

    @GetMapping("/api/v1/research/projects/{projectId}/activity")
    public ApiResponse<List<ProjectActivityItem>> getProjectActivity(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<ProjectActivityItem> activity = workspaceService.getProjectActivity(projectId, userId(jwt));
        return ApiResponse.success("Project activity retrieved.", activity);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private UUID userId(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
    private String ip(HttpServletRequest req) { return req.getRemoteAddr(); }
    private String userAgent(HttpServletRequest req) { return req.getHeader(HttpHeaders.USER_AGENT); }
}
