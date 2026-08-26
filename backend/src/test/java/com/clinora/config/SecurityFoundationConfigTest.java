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
import org.springframework.security.access.prepost.PreAuthorize;
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

    @Test
    void systemAdminRoleCanReachAdminDocumentContent() throws Exception {
        mvc.perform(get("/api/v1/admin/access-applications/11111111-1111-1111-1111-111111111111/documents/22222222-2222-2222-2222-222222222222/content").with(roleJwt("SYSTEM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(content().string("admin-document-ok"));
    }

    @ParameterizedTest
    @MethodSource("nonAdminRoles")
    void nonAdminRolesCannotReachAdminMatcher(String role) throws Exception {
        mvc.perform(get("/api/v1/admin/probe").with(roleJwt(role)))
            .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @MethodSource("nonAdminRoles")
    void nonAdminRolesCannotReachAdminDocumentContent(String role) throws Exception {
        mvc.perform(get("/api/v1/admin/access-applications/11111111-1111-1111-1111-111111111111/documents/22222222-2222-2222-2222-222222222222/content").with(roleJwt(role)))
            .andExpect(status().isForbidden());
    }

    @Test
    void anonymousCallersCannotReachAdminMatchers() throws Exception {
        mvc.perform(get("/api/v1/admin/probe"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void anonymousCallersCannotReachAdminDocumentContent() throws Exception {
        mvc.perform(get("/api/v1/admin/access-applications/11111111-1111-1111-1111-111111111111/documents/22222222-2222-2222-2222-222222222222/content"))
            .andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @MethodSource("nonDoctorRoles")
    void patientResearcherAndSystemAdminDoNotBypassDoctorClinicalBoundary(String role) throws Exception {
        mvc.perform(get("/api/v1/doctor/clinical-probe").with(roleJwt(role)))
            .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @MethodSource("nonPatientIdentifiableRecordRoles")
    void researcherAndSystemAdminDoNotReceiveIdentifiablePatientAccessByRoleAlone(String role) throws Exception {
        mvc.perform(get("/api/v1/patient-records/identifiable-probe").with(roleJwt(role)))
            .andExpect(status().isForbidden());
    }

    @Test
    void applicantCookieWithoutRbacJwtCannotReachAuthenticatedUserApis() throws Exception {
        mvc.perform(get("/api/v1/auth/me").cookie(new jakarta.servlet.http.Cookie("clinora_applicant", "session.raw")))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void applicantLogoutAllMatcherDoesNotRequireJwt() throws Exception {
        mvc.perform(post("/api/v1/access-applications/logout-all"))
            .andExpect(status().isOk())
            .andExpect(content().string("applicant-logout-all-ok"));
    }

    @Test
    void applicantInterviewMatcherDoesNotRequireJwt() throws Exception {
        mvc.perform(get("/api/v1/access-applications/me/interview"))
            .andExpect(status().isOk())
            .andExpect(content().string("applicant-interview-ok"));
    }

    @Test
    void applicantActivationMatcherDoesNotRequireJwt() throws Exception {
        mvc.perform(post("/api/v1/access-applications/activate"))
            .andExpect(status().isOk())
            .andExpect(content().string("applicant-activation-ok"));
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

    private static Stream<String> nonDoctorRoles() {
        return Stream.of("PATIENT", "RESEARCHER", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "BLOOD_BANK_STAFF");
    }

    private static Stream<String> nonPatientIdentifiableRecordRoles() {
        return Stream.of("DOCTOR", "RESEARCHER", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "BLOOD_BANK_STAFF");
    }

    @RestController
    static class SecurityProbeController {

        @GetMapping(value = "/api/v1/admin/probe", produces = MediaType.TEXT_PLAIN_VALUE)
        String adminProbe() {
            return "admin-ok";
        }

        @GetMapping(value = "/api/v1/admin/access-applications/{applicationId}/documents/{documentId}/content", produces = MediaType.TEXT_PLAIN_VALUE)
        String adminDocumentProbe() {
            return "admin-document-ok";
        }

        @PostMapping(value = "/api/v1/access-applications/logout-all", produces = MediaType.TEXT_PLAIN_VALUE)
        String applicantLogoutAllProbe() {
            return "applicant-logout-all-ok";
        }

        @GetMapping(value = "/api/v1/access-applications/me/interview", produces = MediaType.TEXT_PLAIN_VALUE)
        String applicantInterviewProbe() {
            return "applicant-interview-ok";
        }

        @PostMapping(value = "/api/v1/access-applications/activate", produces = MediaType.TEXT_PLAIN_VALUE)
        String applicantActivationProbe() {
            return "applicant-activation-ok";
        }

        @GetMapping(value = "/api/v1/doctor/clinical-probe", produces = MediaType.TEXT_PLAIN_VALUE)
        @PreAuthorize("hasRole('DOCTOR')")
        String doctorClinicalProbe() {
            return "doctor-clinical-ok";
        }

        @GetMapping(value = "/api/v1/patient-records/identifiable-probe", produces = MediaType.TEXT_PLAIN_VALUE)
        @PreAuthorize("hasRole('PATIENT')")
        String identifiablePatientRecordProbe() {
            return "identifiable-patient-record-ok";
        }
    }
}
