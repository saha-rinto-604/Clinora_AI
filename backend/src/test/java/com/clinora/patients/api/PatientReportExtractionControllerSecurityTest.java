package com.clinora.patients.api;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.clinora.config.SecurityFoundationConfig;
import com.clinora.patients.service.PatientReportExtractionService;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = PatientReportExtractionController.class)
@Import(SecurityFoundationConfig.class)
@TestPropertySource(properties = "clinora.auth.jwt-secret=test-secret-that-is-at-least-32-bytes-long")
class PatientReportExtractionControllerSecurityTest {
    private static final UUID PATIENT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID REPORT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID OBSERVATION_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private PatientReportExtractionService extraction;

    @Test
    void patientIdentityComesFromJwtWhenConfirmingObservation() throws Exception {
        mvc.perform(post(path()).with(roleJwt("PATIENT")))
            .andExpect(status().isOk());

        verify(extraction).confirmObservation(PATIENT_ID, REPORT_ID, OBSERVATION_ID);
    }

    @ParameterizedTest
    @MethodSource("nonPatientClinicalRoles")
    void researcherAndSystemAdminCannotConfirmPatientObservation(String role) throws Exception {
        mvc.perform(post(path()).with(roleJwt(role)))
            .andExpect(status().isForbidden());

        verify(extraction, never()).confirmObservation(PATIENT_ID, REPORT_ID, OBSERVATION_ID);
    }

    private static String path() {
        return "/api/v1/patient/reports/" + REPORT_ID + "/extraction/observations/" + OBSERVATION_ID + "/confirm";
    }

    private static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor roleJwt(
        String role
    ) {
        return jwt()
            .jwt(token -> token.subject(PATIENT_ID.toString()).claim("role", role))
            .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    private static Stream<String> nonPatientClinicalRoles() {
        return Stream.of("RESEARCHER", "SYSTEM_ADMIN");
    }
}
