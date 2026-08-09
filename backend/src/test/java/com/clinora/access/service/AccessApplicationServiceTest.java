package com.clinora.access.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.access.domain.AccessApplication;
import com.clinora.access.domain.ApplicationStatus;
import com.clinora.access.domain.ApplicationToken;
import com.clinora.access.domain.ApplicationTokenType;
import com.clinora.access.domain.ApplicationType;
import com.clinora.access.repository.AccessApplicationRepository;
import com.clinora.access.repository.ApplicationDocumentRepository;
import com.clinora.access.repository.ApplicationEventRepository;
import com.clinora.access.repository.ApplicationTokenRepository;
import com.clinora.access.repository.DoctorApplicationDetailRepository;
import com.clinora.access.repository.DoctorQualificationRepository;
import com.clinora.access.repository.ResearcherApplicationDetailRepository;
import com.clinora.audit.AuthAuditService;
import com.clinora.config.AccessApplicationProperties;
import com.clinora.security.token.SecureTokenService;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.repository.UserAccountRepository;
import com.clinora.users.service.EmailAddressNormalizer;
import java.lang.reflect.Field;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

class AccessApplicationServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-09T12:00:00Z");

    @Test
    void doctorApplicationCreationDoesNotCreatePrivilegedUser() throws Exception {
        ServiceFixture fixture = new ServiceFixture();

        when(fixture.normalizer.normalize("doctor@example.com")).thenReturn("doctor@example.com");
        when(fixture.users.existsByNormalizedEmail("doctor@example.com")).thenReturn(false);
        when(fixture.applications.findFirstByNormalizedEmailAndStatusNotIn(any(), any())).thenReturn(Optional.empty());
        when(fixture.applications.save(any(AccessApplication.class))).thenAnswer(invocation -> {
            AccessApplication application = invocation.getArgument(0);
            setId(application, UUID.randomUUID());
            return application;
        });

        fixture.service.create(
            ApplicationType.DOCTOR,
            new AccessApplicationModels.CreateRequest(
                "Amina",
                "Rahman",
                "doctor@example.com",
                "+8801700000000",
                "Bangladesh",
                true
            ),
            "127.0.0.1",
            "test-agent"
        );

        verify(fixture.users, never()).save(any(UserAccount.class));
        verify(fixture.doctorDetails).save(any());
        verify(fixture.mail).sendVerification(any(), any(), any());
    }

    @Test
    void emailVerificationDoesNotCreateApplicantSession() throws Exception {
        ServiceFixture fixture = new ServiceFixture();
        UUID applicationId = UUID.randomUUID();
        AccessApplication application = doctorApplication(applicationId);
        String rawVerification = "verify-token";
        ApplicationToken verificationToken = new ApplicationToken(
            applicationId,
            ApplicationTokenType.EMAIL_VERIFICATION,
            fixture.tokens.hash(rawVerification),
            NOW.plusSeconds(3600),
            NOW
        );

        when(fixture.applicationTokens.findByTokenHashAndTokenType(
            fixture.tokens.hash(rawVerification),
            ApplicationTokenType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(verificationToken));
        when(fixture.applications.findById(applicationId)).thenReturn(Optional.of(application));
        when(fixture.users.existsByNormalizedEmail("doctor@example.com")).thenReturn(false);

        AccessApplicationModels.VerificationResult result = fixture.service.verifyEmail(
            rawVerification,
            "127.0.0.1",
            "test-agent"
        );

        assertEquals(ApplicationStatus.DRAFT, application.getStatus());
        assertNotNull(application.getEmailVerifiedAt());
        assertNotNull(verificationToken.getConsumedAt());
        assertNotNull(result.continuationToken());
        verify(fixture.sessions, never()).issue(any(), any(), any());

        ArgumentCaptor<ApplicationToken> tokenCaptor = ArgumentCaptor.forClass(ApplicationToken.class);
        verify(fixture.applicationTokens).save(tokenCaptor.capture());
        assertEquals(ApplicationTokenType.PORTAL_ACCESS, tokenCaptor.getValue().getTokenType());
    }

    @Test
    void resumeLinkRequestDoesNotSendVerificationForUnverifiedApplication() throws Exception {
        ServiceFixture fixture = new ServiceFixture();
        AccessApplication application = doctorApplication(UUID.randomUUID());

        when(fixture.normalizer.normalize("doctor@example.com")).thenReturn("doctor@example.com");
        when(fixture.applications.findFirstByNormalizedEmailAndStatusNotIn(any(), any())).thenReturn(Optional.of(application));

        fixture.service.requestAccessLink("doctor@example.com", "127.0.0.1", "test-agent");

        verify(fixture.mail, never()).sendVerification(any(), any(), any());
        verify(fixture.mail, never()).sendAccessLink(any(), any(), any());
    }

    @Test
    void sessionCannotBeEstablishedForUnverifiedApplication() throws Exception {
        ServiceFixture fixture = new ServiceFixture();
        UUID applicationId = UUID.randomUUID();
        AccessApplication application = doctorApplication(applicationId);
        String rawAccess = "access-token";
        ApplicationToken accessToken = new ApplicationToken(
            applicationId,
            ApplicationTokenType.PORTAL_ACCESS,
            fixture.tokens.hash(rawAccess),
            NOW.plusSeconds(3600),
            NOW
        );

        when(fixture.applicationTokens.findByTokenHashAndTokenType(
            fixture.tokens.hash(rawAccess),
            ApplicationTokenType.PORTAL_ACCESS
        )).thenReturn(Optional.of(accessToken));
        when(fixture.applications.findById(applicationId)).thenReturn(Optional.of(application));

        assertThrows(
            AccessApplicationException.class,
            () -> fixture.service.establishSession(rawAccess, "127.0.0.1", "test-agent")
        );

        verify(fixture.sessions, never()).issue(any(), any(), any());
    }

    private static AccessApplication doctorApplication(UUID applicationId) throws Exception {
        AccessApplication application = new AccessApplication(
            ApplicationType.DOCTOR,
            "Amina",
            "Rahman",
            "doctor@example.com",
            "doctor@example.com",
            "+8801700000000",
            "Bangladesh",
            NOW
        );
        setId(application, applicationId);
        return application;
    }

    private static void setId(AccessApplication application, UUID id) throws Exception {
        Field field = AccessApplication.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(application, id);
    }

    private static class ServiceFixture {
        final AccessApplicationRepository applications = Mockito.mock(AccessApplicationRepository.class);
        final DoctorApplicationDetailRepository doctorDetails = Mockito.mock(DoctorApplicationDetailRepository.class);
        final ResearcherApplicationDetailRepository researcherDetails = Mockito.mock(ResearcherApplicationDetailRepository.class);
        final DoctorQualificationRepository qualifications = Mockito.mock(DoctorQualificationRepository.class);
        final ApplicationDocumentRepository documents = Mockito.mock(ApplicationDocumentRepository.class);
        final ApplicationTokenRepository applicationTokens = Mockito.mock(ApplicationTokenRepository.class);
        final ApplicationEventRepository events = Mockito.mock(ApplicationEventRepository.class);
        final UserAccountRepository users = Mockito.mock(UserAccountRepository.class);
        final EmailAddressNormalizer normalizer = Mockito.mock(EmailAddressNormalizer.class);
        final SecureTokenService tokens = new SecureTokenService();
        final ApplicantSessionService sessions = Mockito.mock(ApplicantSessionService.class);
        final AccessApplicationMailService mail = Mockito.mock(AccessApplicationMailService.class);
        final AccessApplicationProperties properties = new AccessApplicationProperties();
        final AuthAuditService audit = Mockito.mock(AuthAuditService.class);
        final AccessApplicationService service = new AccessApplicationService(
            applications,
            doctorDetails,
            researcherDetails,
            qualifications,
            documents,
            applicationTokens,
            events,
            users,
            normalizer,
            tokens,
            sessions,
            mail,
            properties,
            audit,
            Clock.fixed(NOW, ZoneOffset.UTC)
        );
    }
}
