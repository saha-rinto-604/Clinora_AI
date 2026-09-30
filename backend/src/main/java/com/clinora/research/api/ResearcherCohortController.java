package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.CohortQueryModels.*;
import com.clinora.research.service.CohortBuilderService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@RestController
@RequestMapping("/api/v1/research")
@PreAuthorize("hasAnyRole('RESEARCHER', 'ADMIN')")
public class ResearcherCohortController {

    private final CohortBuilderService cohortBuilderService;

    public ResearcherCohortController(CohortBuilderService cohortBuilderService) {
        this.cohortBuilderService = cohortBuilderService;
    }

    @GetMapping("/catalog")
    public ApiResponse<CatalogResponse> getCatalog() {
        CatalogResponse response = cohortBuilderService.getCatalog();
        return ApiResponse.success("Research data catalog retrieved successfully.", response);
    }

    @PostMapping("/cohort/preview")
    public ApiResponse<CohortPreviewResponse> previewCohort(@Valid @RequestBody CohortFilterCriteria criteria) {
        CohortPreviewResponse response = cohortBuilderService.previewCohort(criteria);
        return ApiResponse.success("Cohort preview calculated successfully.", response);
    }
}
