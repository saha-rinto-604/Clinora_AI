package com.clinora.research;

import com.clinora.audit.AuthAuditEventRepository;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.service.ResearchAuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class ResearchAuditServiceTest {

    private ResearchAuditService auditService;

    @BeforeEach
    void setUp() {
        AuthAuditService authAuditService = mock(AuthAuditService.class);
        AuthAuditEventRepository repo = mock(AuthAuditEventRepository.class);
        auditService = new ResearchAuditService(authAuditService, repo);
    }

    @Test
    @DisplayName("Phase R16 Guardrail: Audit metadata sanitization strips tokens, credentials, and raw medical payloads")
    void sanitizesSensitiveAuditMetadata() {
        Map<String, Object> dangerousMetadata = Map.of(
                "collaboratorUserId", "550e8400-e29b-41d4-a716-446655440000",
                "role", "CO_RESEARCHER",
                "accessToken", "bearer eyJhbGciOiJIUzI1Ni...",
                "userPassword", "SuperSecret123!",
                "raw_observations_payload", "Patient blood glucose 240 mg/dL, HbA1c 8.2%",
                "patient_ssn", "000-12-3456"
        );

        String sanitized = auditService.sanitizeMetadata(dangerousMetadata);

        assertNotNull(sanitized);
        // Safe metadata retained
        assertTrue(sanitized.contains("collaboratorUserId"));
        assertTrue(sanitized.contains("CO_RESEARCHER"));

        // Sensitive metadata stripped
        assertFalse(sanitized.contains("accessToken"));
        assertFalse(sanitized.contains("bearer"));
        assertFalse(sanitized.contains("userPassword"));
        assertFalse(sanitized.contains("SuperSecret123!"));
        assertFalse(sanitized.contains("raw_observations_payload"));
        assertFalse(sanitized.contains("patient_ssn"));
    }
}
