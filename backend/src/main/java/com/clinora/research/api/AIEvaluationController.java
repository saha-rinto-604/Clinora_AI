package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.api.AIEvaluationModels.*;
import com.clinora.research.service.AIEvaluationService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/research/projects/{projectId}/evaluations")
@PreAuthorize("hasRole('RESEARCHER')")
public class AIEvaluationController {

    private final AIEvaluationService evaluationService;

    public AIEvaluationController(AIEvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    @PostMapping
    public ApiResponse<AIEvaluationRunResponse> createRun(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateEvaluationRunRequest request
    ) {
        AIEvaluationRunResponse run = evaluationService.createAndExecuteRun(projectId, request, userId(jwt));
        return ApiResponse.success("AI model evaluation run initiated successfully.", run);
    }

    @GetMapping
    public ApiResponse<List<AIEvaluationRunResponse>> listRuns(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        List<AIEvaluationRunResponse> runs = evaluationService.listRunsForProject(projectId, userId(jwt));
        return ApiResponse.success("AI evaluation runs retrieved successfully.", runs);
    }

    @GetMapping("/{runId}")
    public ApiResponse<AIEvaluationRunResponse> getRun(
            @PathVariable UUID projectId,
            @PathVariable UUID runId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        AIEvaluationRunResponse run = evaluationService.getRun(projectId, runId, userId(jwt));
        return ApiResponse.success("AI evaluation run retrieved successfully.", run);
    }

    @PostMapping("/{runId}/cancel")
    public ApiResponse<AIEvaluationRunResponse> cancelRun(
            @PathVariable UUID projectId,
            @PathVariable UUID runId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        AIEvaluationRunResponse run = evaluationService.cancelRun(projectId, runId, userId(jwt));
        return ApiResponse.success("AI evaluation run cancelled successfully.", run);
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
