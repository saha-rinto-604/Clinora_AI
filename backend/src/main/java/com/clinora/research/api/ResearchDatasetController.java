package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.ResearchDatasetModels.*;
import com.clinora.research.domain.DatasetGenerationJob;
import com.clinora.research.domain.DatasetVersion;
import com.clinora.research.domain.ResearchDataset;
import com.clinora.research.repository.DatasetGenerationJobRepository;
import com.clinora.research.repository.ResearchDatasetRepository;
import com.clinora.research.service.DatasetGenerationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/research")
@PreAuthorize("hasAnyRole('RESEARCHER', 'ADMIN')")
public class ResearchDatasetController {

    private final DatasetGenerationService generationService;
    private final ResearchDatasetRepository datasetRepository;
    private final DatasetGenerationJobRepository jobRepository;

    public ResearchDatasetController(
            DatasetGenerationService generationService,
            ResearchDatasetRepository datasetRepository,
            DatasetGenerationJobRepository jobRepository
    ) {
        this.generationService = generationService;
        this.datasetRepository = datasetRepository;
        this.jobRepository = jobRepository;
    }

    @PostMapping("/dataset-requests/{requestId}/generate")
    public ApiResponse<DatasetGenerationJobResponse> triggerGeneration(
            @PathVariable UUID requestId
    ) {
        DatasetGenerationJob job = generationService.enqueueJob(requestId);
        return ApiResponse.success("Dataset generation job dispatched to background worker.", DatasetGenerationJobResponse.from(job));
    }

    @GetMapping("/dataset-requests/{requestId}/generation-jobs/latest")
    public ApiResponse<DatasetGenerationJobResponse> getLatestJob(
            @PathVariable UUID requestId
    ) {
        DatasetGenerationJob job = jobRepository.findFirstByDatasetRequestIdOrderByCreatedAtDesc(requestId)
                .orElse(null);
        return ApiResponse.success("Latest generation job status retrieved.", job != null ? DatasetGenerationJobResponse.from(job) : null);
    }

    @GetMapping("/datasets")
    public ApiResponse<List<ResearchDatasetResponse>> listMyDatasets(
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<ResearchDataset> datasets = generationService.listDatasetsForResearcher(userId(jwt));
        List<ResearchDatasetResponse> items = datasets.stream().map(ResearchDatasetResponse::from).toList();
        return ApiResponse.success("Research datasets retrieved successfully.", items);
    }

    @GetMapping("/projects/{projectId}/datasets")
    public ApiResponse<List<ResearchDatasetResponse>> listDatasets(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId
    ) {
        List<ResearchDataset> datasets = generationService.listDatasetsForProject(projectId, userId(jwt));
        List<ResearchDatasetResponse> items = datasets.stream().map(ResearchDatasetResponse::from).toList();
        return ApiResponse.success("Research datasets retrieved successfully.", items);
    }

    @GetMapping("/dataset-requests/{requestId}/dataset")
    public ApiResponse<ResearchDatasetResponse> getDatasetByRequest(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID requestId
    ) {
        ResearchDataset dataset = datasetRepository.findByDatasetRequestId(requestId)
                .orElse(null);
        return ApiResponse.success("Dataset retrieved for request.", dataset != null ? ResearchDatasetResponse.from(dataset) : null);
    }

    @GetMapping("/datasets/{datasetId}")
    public ApiResponse<ResearchDatasetResponse> getDataset(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID datasetId
    ) {
        ResearchDataset dataset = generationService.getDataset(datasetId, userId(jwt));
        return ApiResponse.success("Research dataset retrieved successfully.", ResearchDatasetResponse.from(dataset));
    }

    @GetMapping("/datasets/{datasetId}/versions")
    public ApiResponse<List<DatasetVersionResponse>> listVersions(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID datasetId
    ) {
        List<DatasetVersion> versions = generationService.listVersions(datasetId, userId(jwt));
        List<DatasetVersionResponse> items = versions.stream().map(DatasetVersionResponse::from).toList();
        return ApiResponse.success("Dataset versions retrieved successfully.", items);
    }

    @GetMapping("/datasets/{datasetId}/versions/{versionNumber}/download")
    public ResponseEntity<byte[]> downloadVersion(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID datasetId,
            @PathVariable int versionNumber,
            HttpServletRequest request
    ) {
        DatasetGenerationService.DatasetDownload download = generationService.downloadVersion(
                datasetId,
                versionNumber,
                userId(jwt),
                ip(request),
                userAgent(request)
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(download.contentType()));
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + download.filename() + "\"");
        headers.set("X-Dataset-Checksum", download.checksum());

        return ResponseEntity.ok()
                .headers(headers)
                .body(download.bytes());
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private String ip(HttpServletRequest request) {
        String f = request.getHeader("X-Forwarded-For");
        return (f != null && !f.isBlank()) ? f.split(",")[0].trim() : request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        String u = request.getHeader(HttpHeaders.USER_AGENT);
        return u != null ? u : "Unknown";
    }
}
