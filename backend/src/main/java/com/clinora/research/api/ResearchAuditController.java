package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.service.ResearchAuditService;
import com.clinora.research.service.ResearchAuditService.ResearchAuditLogEntry;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/research/projects/{projectId}/audit-events")
@PreAuthorize("hasRole('RESEARCHER')")
public class ResearchAuditController {
    private final com.clinora.research.service.ResearchAccessGuard accessGuard;

    private final ResearchAuditService auditService;

    public ResearchAuditController(ResearchAuditService auditService, com.clinora.research.service.ResearchAccessGuard accessGuard) {
        this.auditService = auditService;
        this.accessGuard = accessGuard;
    }

    @GetMapping
    public ApiResponse<List<ResearchAuditLogEntry>> getProjectAuditHistory(
            @PathVariable UUID projectId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt
    ) {
        accessGuard.project(projectId, UUID.fromString(jwt.getSubject()));
        List<ResearchAuditLogEntry> entries = auditService.getProjectAuditHistory(projectId);
        return ApiResponse.success("Project audit trail retrieved successfully.", entries);
    }
}
