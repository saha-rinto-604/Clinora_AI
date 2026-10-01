package com.clinora.admin.researcher;

import com.clinora.admin.researcher.AdminResearcherAccountModels.ResearcherPageResponse;
import com.clinora.config.SecurityFoundationConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AdminResearcherAccountController.class)
@Import(SecurityFoundationConfig.class)
@TestPropertySource(properties = "clinora.auth.jwt-secret=test-secret-that-is-at-least-32-bytes-long")
class AdminResearcherAccountControllerSecurityTest {
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    com.clinora.research.service.ResearchAccessGuard researchAccessGuard;

    private static final UUID ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private AdminResearcherAccountService service;

    @MockitoBean
    private com.clinora.research.service.ResearcherCredentialService credentialService;

    private JwtRequestPostProcessor roleJwt(String role) {
        return jwt()
                .jwt(token -> token.subject(ADMIN_ID.toString()).claim("role", role))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Test
    void systemAdminCanAccessResearcherList() throws Exception {
        when(service.listResearchers(any(), any(), any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(new ResearcherPageResponse<>(List.of(), 0, 20, 0L, 0));

        mvc.perform(get("/api/v1/admin/researchers").with(roleJwt("SYSTEM_ADMIN")))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"PATIENT", "DOCTOR", "RESEARCHER"})
    void nonAdminRolesAreForbiddenFromResearcherList(String role) throws Exception {
        mvc.perform(get("/api/v1/admin/researchers").with(roleJwt(role)))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedRequestIsUnauthorized() throws Exception {
        mvc.perform(get("/api/v1/admin/researchers"))
                .andExpect(status().isUnauthorized());
    }
}
