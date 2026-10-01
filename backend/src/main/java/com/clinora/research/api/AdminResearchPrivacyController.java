package com.clinora.research.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.research.service.ResearchPrivacyService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/research/dataset-versions")
@PreAuthorize("hasRole('SYSTEM_ADMIN')")
public class AdminResearchPrivacyController {
    private final ResearchPrivacyService privacy;
    public AdminResearchPrivacyController(ResearchPrivacyService privacy) { this.privacy = privacy; }

    public record GovernanceDecision(@NotBlank @Size(max = 1000) String reason) {}

    @PostMapping("/{versionId}/privacy-review/restore")
    public ApiResponse<Void> restore(@PathVariable UUID versionId, @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody GovernanceDecision decision, HttpServletRequest request) {
        privacy.restoreVersion(versionId, UUID.fromString(jwt.getSubject()), decision.reason(),
            request.getRemoteAddr(), request.getHeader("User-Agent"));
        return ApiResponse.success("Privacy suspension cleared after governance review; grants and all other access rules still apply.", null);
    }
}
