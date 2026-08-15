package com.clinora.config;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest(controllers = SecurityFoundationConfigTest.SecurityProbeController.class)
@Import({SecurityFoundationConfig.class, SecurityFoundationConfigTest.SecurityProbeController.class})
@TestPropertySource(properties = "clinora.auth.jwt-secret=test-secret-that-is-at-least-32-bytes-long")
class SecurityFoundationConfigTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void systemAdminRoleCanReachAdminMatcher() throws Exception {
        mvc.perform(get("/api/v1/admin/probe").with(roleJwt("SYSTEM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(content().string("admin-ok"));
    }

    @ParameterizedTest
    @MethodSource("nonAdminRoles")
    void nonAdminRolesCannotReachAdminMatcher(String role) throws Exception {
        mvc.perform(get("/api/v1/admin/probe").with(roleJwt(role)))
            .andExpect(status().isForbidden());
    }

    @Test
    void applicantLogoutAllMatcherDoesNotRequireJwt() throws Exception {
        mvc.perform(post("/api/v1/access-applications/logout-all"))
            .andExpect(status().isOk())
            .andExpect(content().string("applicant-logout-all-ok"));
    }

    private static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor roleJwt(
        String role
    ) {
        return jwt()
            .jwt(token -> token.claim("role", role))
            .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    private static Stream<String> nonAdminRoles() {
        return Stream.of("PATIENT", "DOCTOR", "RESEARCHER", "HOSPITAL_ADMIN", "BLOOD_BANK_STAFF");
    }

    @RestController
    static class SecurityProbeController {

        @GetMapping(value = "/api/v1/admin/probe", produces = MediaType.TEXT_PLAIN_VALUE)
        String adminProbe() {
            return "admin-ok";
        }

        @PostMapping(value = "/api/v1/access-applications/logout-all", produces = MediaType.TEXT_PLAIN_VALUE)
        String applicantLogoutAllProbe() {
            return "applicant-logout-all-ok";
        }
    }
}
