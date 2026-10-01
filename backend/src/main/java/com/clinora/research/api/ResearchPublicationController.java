package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.ResearchPublicationModels.*;
import com.clinora.research.service.ResearchPublicationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
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
@RequestMapping("/api/v1/research/projects/{projectId}/publications")
@PreAuthorize("hasRole('RESEARCHER')")
public class ResearchPublicationController {

    private final ResearchPublicationService publicationService;

    public ResearchPublicationController(ResearchPublicationService publicationService) {
        this.publicationService = publicationService;
    }

    @PostMapping
    public ApiResponse<PublicationResponse> createPublication(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreatePublicationRequest request,
            HttpServletRequest servletRequest
    ) {
        PublicationResponse pub = publicationService.createPublication(
                projectId,
                userId(jwt),
                request,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research publication registered successfully.", pub);
    }

    @GetMapping
    public ApiResponse<List<PublicationResponse>> listPublications(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<PublicationResponse> pubs = publicationService.listPublications(projectId, userId(jwt));
        return ApiResponse.success("Research publications retrieved successfully.", pubs);
    }

    @GetMapping("/{publicationId}")
    public ApiResponse<PublicationResponse> getPublication(
            @PathVariable UUID projectId,
            @PathVariable UUID publicationId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        PublicationResponse pub = publicationService.getPublication(projectId, publicationId, userId(jwt));
        return ApiResponse.success("Research publication retrieved successfully.", pub);
    }

    @PutMapping("/{publicationId}")
    public ApiResponse<PublicationResponse> updatePublication(
            @PathVariable UUID projectId,
            @PathVariable UUID publicationId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdatePublicationRequest request,
            HttpServletRequest servletRequest
    ) {
        PublicationResponse pub = publicationService.updatePublication(
                projectId,
                publicationId,
                userId(jwt),
                request,
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research publication updated successfully.", pub);
    }

    @DeleteMapping("/{publicationId}")
    public ApiResponse<Void> deletePublication(
            @PathVariable UUID projectId,
            @PathVariable UUID publicationId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        publicationService.deletePublication(
                projectId,
                publicationId,
                userId(jwt),
                ip(servletRequest),
                userAgent(servletRequest)
        );
        return ApiResponse.success("Research publication removed successfully.", null);
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
