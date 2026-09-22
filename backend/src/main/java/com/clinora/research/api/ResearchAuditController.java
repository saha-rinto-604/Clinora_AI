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
@PreAuthorize("hasAnyRole('RESEARCHER', 'ADMIN')")
public class ResearchAuditController {

    private final ResearchAuditService auditService;

    public ResearchAuditController(ResearchAuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    public ApiResponse<List<ResearchAuditLogEntry>> getProjectAuditHistory(
            @PathVariable UUID projectId
    ) {
        List<ResearchAuditLogEntry> entries = auditService.getProjectAuditHistory(projectId);
        return ApiResponse.success("Project audit trail retrieved successfully.", entries);
    }
}
