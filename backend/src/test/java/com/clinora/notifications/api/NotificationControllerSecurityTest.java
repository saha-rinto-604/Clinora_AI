package com.clinora.notifications.api;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.clinora.config.SecurityFoundationConfig;
import com.clinora.notifications.service.DoctorNotificationService;
import com.clinora.notifications.service.PatientNotificationService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = {DoctorNotificationController.class, PatientNotificationController.class})
@Import(SecurityFoundationConfig.class)
@TestPropertySource(properties = "clinora.auth.jwt-secret=test-secret-that-is-at-least-32-bytes-long")
class NotificationControllerSecurityTest {
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private DoctorNotificationService doctorNotifications;

    @MockitoBean
    private PatientNotificationService patientNotifications;

    @Test
    void doctorNotificationEndpointsRejectPatientUsers() throws Exception {
        mvc.perform(get("/api/v1/doctor/notifications/unread-count").with(roleJwt("PATIENT")))
            .andExpect(status().isForbidden());
    }

    @Test
    void doctorNotificationEndpointsAcceptDoctorUsers() throws Exception {
        mvc.perform(get("/api/v1/doctor/notifications/unread-count").with(roleJwt("DOCTOR")))
            .andExpect(status().isOk());
    }

    @Test
    void patientNotificationEndpointsRemainPatientOnly() throws Exception {
        mvc.perform(get("/api/v1/patient/notifications/unread-count").with(roleJwt("DOCTOR")))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/patient/notifications/unread-count").with(roleJwt("PATIENT")))
            .andExpect(status().isOk());
    }

    private static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor roleJwt(
        String role
    ) {
        return jwt()
            .jwt(token -> token.subject(USER_ID.toString()).claim("role", role))
            .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
