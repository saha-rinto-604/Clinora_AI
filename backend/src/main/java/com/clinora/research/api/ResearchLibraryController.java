package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.ResearchPublicationModels.*;
import com.clinora.research.domain.PublicationType;
import com.clinora.research.service.ResearchPublicationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/research/library")
@PreAuthorize("hasRole('RESEARCHER')")
public class ResearchLibraryController {

    private final ResearchPublicationService publicationService;

    public ResearchLibraryController(ResearchPublicationService publicationService) {
        this.publicationService = publicationService;
    }

    /**
     * Browse and search published research outputs across Clinora projects.
     * Contains metadata, methodology, and safe provenance only.
     */
    @GetMapping("/publications")
    public ApiResponse<LibraryPublicationsPageResponse> searchPublished(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) PublicationType publicationType,
            @RequestParam(required = false) String researchField,
            @RequestParam(required = false) Integer year,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size
    ) {
        Page<LibraryPublicationSummary> result = publicationService.searchPublishedLibrary(
                search,
                publicationType,
                researchField,
                year,
                PageRequest.of(page - 1, size)
        );

        LibraryPublicationsPageResponse response = new LibraryPublicationsPageResponse(
                result.getContent(),
                page,
                size,
                result.getTotalElements(),
                result.getTotalPages(),
                result.hasPrevious(),
                result.hasNext()
        );

        return ApiResponse.success("Published research retrieved successfully.", response);
    }

    /**
     * View detailed metadata, methodology, APA/IEEE/BibTeX citations, and safe provenance.
     */
    @GetMapping("/publications/{publicationId}")
    public ApiResponse<LibraryPublicationDetail> getPublishedDetail(
            @PathVariable UUID publicationId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        LibraryPublicationDetail detail = publicationService.getPublishedLibraryDetail(publicationId, userId(jwt));
        return ApiResponse.success("Publication detail retrieved successfully.", detail);
    }

    /**
     * List research outputs authored or contributed to by the current researcher.
     */
    @GetMapping("/my-outputs")
    public ApiResponse<List<MyResearchOutputSummary>> listMyOutputs(
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<MyResearchOutputSummary> outputs = publicationService.listMyOutputs(userId(jwt));
        return ApiResponse.success("Research outputs retrieved successfully.", outputs);
    }

    /**
     * Register a new research output linked to an approved project.
     */
    @PostMapping("/my-outputs")
    public ApiResponse<LibraryPublicationDetail> registerOutput(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody RegisterResearchOutputRequest request,
            HttpServletRequest servletRequest
    ) {
        LibraryPublicationDetail output = publicationService.registerOutput(
                userId(jwt),
                request,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research output registered successfully.", output);
    }

    /**
     * Get details of a researcher's output for editing or review.
     */
    @GetMapping("/my-outputs/{publicationId}")
    public ApiResponse<LibraryPublicationDetail> getMyOutputDetail(
            @PathVariable UUID publicationId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        LibraryPublicationDetail detail = publicationService.getPublishedLibraryDetail(publicationId, userId(jwt));
        return ApiResponse.success("Research output retrieved successfully.", detail);
    }

    /**
     * Update an existing research output.
     */
    @PutMapping("/my-outputs/{publicationId}")
    public ApiResponse<LibraryPublicationDetail> updateOutput(
            @PathVariable UUID publicationId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateResearchOutputRequest request,
            HttpServletRequest servletRequest
    ) {
        LibraryPublicationDetail updated = publicationService.updateOutput(
                publicationId,
                userId(jwt),
                request,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research output updated successfully.", updated);
    }

    /**
     * Remove an existing research output.
     */
    @DeleteMapping("/my-outputs/{publicationId}")
    public ApiResponse<Void> deleteOutput(
            @PathVariable UUID publicationId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        publicationService.deleteOutput(
                publicationId,
                userId(jwt),
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research output removed successfully.", null);
    }

    /**
     * Get list of authorized projects (with their dataset versions and AI evaluation runs)
     * available to the current researcher for linking during output registration.
     */
    @GetMapping("/authorized-projects")
    public ApiResponse<List<ProjectSelectOption>> getAuthorizedProjects(
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<ProjectSelectOption> projects = publicationService.getAuthorizedProjectsForRegistration(userId(jwt));
        return ApiResponse.success("Authorized projects retrieved successfully.", projects);
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
