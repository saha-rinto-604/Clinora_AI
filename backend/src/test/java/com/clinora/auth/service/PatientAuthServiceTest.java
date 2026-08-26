package com.clinora.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.auth.api.AuthApiException;
import com.clinora.audit.AuthAuditService;
import com.clinora.auth.session.IssuedRefreshSession;
import com.clinora.auth.session.RefreshSessionService;
import com.clinora.auth.token.EmailVerificationTokenRepository;
import com.clinora.auth.token.PasswordResetToken;
import com.clinora.auth.token.PasswordResetTokenRepository;
import com.clinora.config.AuthProperties;
import com.clinora.security.PasswordService;
import com.clinora.security.jwt.AccessTokenService;
import com.clinora.security.token.SecureTokenService;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import com.clinora.users.service.EmailAddressNormalizer;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

class PatientAuthServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-08T12:00:00Z");

    @Test
    void publicRegistrationAlwaysCreatesPendingPatientAccount() {
        UserAccountRepository users = mock(UserAccountRepository.class);
        EmailVerificationTokenRepository verificationTokens = mock(EmailVerificationTokenRepository.class);
        PasswordResetTokenRepository resetTokens = mock(PasswordResetTokenRepository.class);
        PasswordService passwords = mock(PasswordService.class);
        AccessTokenService accessTokens = mock(AccessTokenService.class);
        RefreshSessionService refreshSessions = mock(RefreshSessionService.class);
        AuthMailService mail = mock(AuthMailService.class);
        AuthRateLimitGuard limits = mock(AuthRateLimitGuard.class);
        AuthAuditService audit = mock(AuthAuditService.class);
        when(users.existsByNormalizedEmail("patient@example.com")).thenReturn(false);
        when(passwords.hash("Strong#Pass1")).thenReturn("hash");
        when(users.save(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PatientAuthService service = new PatientAuthService(
            users,
            verificationTokens,
            resetTokens,
            new EmailAddressNormalizer(),
            passwords,
            new PasswordPolicy(),
            new SecureTokenService(),
            accessTokens,
            refreshSessions,
            mail,
            limits,
            audit,
            new AuthProperties(),
            Clock.fixed(NOW, ZoneOffset.UTC)
        );

        service.register(
            "Amina",
            "Rahman",
            "Patient@Example.com",
            "Strong#Pass1",
            new PatientAuthService.RequestContext("127.0.0.1", "JUnit")
        );

        ArgumentCaptor<UserAccount> account = ArgumentCaptor.forClass(UserAccount.class);
        verify(users).save(account.capture());
        assertEquals(UserRole.PATIENT, account.getValue().getRole());
        assertEquals(AccountStatus.PENDING_EMAIL_VERIFICATION, account.getValue().getAccountStatus());
    }

    @Test
    void forgotPasswordUsesEnumerationResistantNoopForUnknownAccounts() {
        Fixture fixture = new Fixture();
        when(fixture.users.findByNormalizedEmail("unknown@example.test")).thenReturn(Optional.empty());

        fixture.service.forgotPassword(
            "Unknown@Example.test",
            new PatientAuthService.RequestContext("127.0.0.1", "JUnit")
        );

        verify(fixture.limits).forgotPassword("127.0.0.1", "unknown@example.test");
        verify(fixture.resetTokens, never()).save(any());
        verify(fixture.mail, never()).sendPasswordReset(any(), any(), any());
    }

    @Test
    void resetPasswordConsumesSingleUseTokenAndRevokesAllSessions() {
        Fixture fixture = new Fixture();
        UserAccount user = activeUser(UserRole.PATIENT);
        String rawToken = "reset-token";
        PasswordResetToken token = new PasswordResetToken(
            UUID.randomUUID(),
            user,
            fixture.secureTokens.hash(rawToken),
            NOW.plusSeconds(300),
            NOW.minusSeconds(60)
        );
        when(fixture.resetTokens.findByTokenHash(fixture.secureTokens.hash(rawToken))).thenReturn(Optional.of(token));
        when(fixture.passwords.hash("NewPass1!")).thenReturn("new-hash");

        fixture.service.resetPassword(rawToken, "NewPass1!", new PatientAuthService.RequestContext("127.0.0.1", "JUnit"));

        assertEquals("new-hash", user.getPasswordHash());
        verify(fixture.refreshSessions).revokeAll(user.getId(), "PASSWORD_RESET");
        assertThrows(
            AuthApiException.class,
            () -> fixture.service.resetPassword(rawToken, "NewPass1!", new PatientAuthService.RequestContext(null, null))
        );
    }

    @Test
    void changePasswordRevokesOtherSessionsAndRotatesCurrentSession() {
        Fixture fixture = new Fixture();
        UserAccount user = activeUser(UserRole.DOCTOR);
        UUID sessionId = UUID.randomUUID();
        when(fixture.users.findById(user.getId())).thenReturn(Optional.of(user));
        when(fixture.passwords.matches("CurrentPass1!", "old-hash")).thenReturn(true);
        when(fixture.passwords.hash("NewPass1!")).thenReturn("new-hash");
        when(fixture.refreshSessions.sessionId("refresh-token")).thenReturn(sessionId);
        when(fixture.refreshSessions.userForSession(sessionId)).thenReturn(user);
        when(fixture.accessTokens.issue(user.getId(), UserRole.DOCTOR)).thenReturn(
            new AccessTokenService.IssuedAccessToken("access-token", NOW.plusSeconds(900))
        );
        when(fixture.refreshSessions.rotate("refresh-token")).thenReturn(
            new IssuedRefreshSession(sessionId, "rotated-refresh-token", NOW.plusSeconds(3600))
        );

        var result = fixture.service.changePassword(
            user.getId(),
            "CurrentPass1!",
            "NewPass1!",
            "refresh-token",
            new PatientAuthService.RequestContext("127.0.0.1", "JUnit")
        );

        assertEquals("new-hash", user.getPasswordHash());
        assertEquals("rotated-refresh-token", result.refreshToken());
        verify(fixture.refreshSessions).revokeAllExcept(user.getId(), sessionId, "PASSWORD_CHANGED");
        verify(fixture.refreshSessions).rotate("refresh-token");
    }

    private static UserAccount activeUser(UserRole role) {
        UserAccount user = new UserAccount(
            "Pat",
            "Clinora",
            "patient@example.test",
            "patient@example.test",
            "old-hash",
            role,
            AccountStatus.ACTIVE,
            NOW.minusSeconds(3600)
        );
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(user, "emailVerifiedAt", NOW.minusSeconds(300));
        return user;
    }

    private static class Fixture {
        final UserAccountRepository users = mock(UserAccountRepository.class);
        final EmailVerificationTokenRepository verificationTokens = mock(EmailVerificationTokenRepository.class);
        final PasswordResetTokenRepository resetTokens = mock(PasswordResetTokenRepository.class);
        final PasswordService passwords = mock(PasswordService.class);
        final AccessTokenService accessTokens = mock(AccessTokenService.class);
        final RefreshSessionService refreshSessions = mock(RefreshSessionService.class);
        final AuthMailService mail = mock(AuthMailService.class);
        final AuthRateLimitGuard limits = mock(AuthRateLimitGuard.class);
        final AuthAuditService audit = mock(AuthAuditService.class);
        final SecureTokenService secureTokens = new SecureTokenService();
        final PatientAuthService service = new PatientAuthService(
            users,
            verificationTokens,
            resetTokens,
            new EmailAddressNormalizer(),
            passwords,
            new PasswordPolicy(),
            secureTokens,
            accessTokens,
            refreshSessions,
            mail,
            limits,
            audit,
            new AuthProperties(),
            Clock.fixed(NOW, ZoneOffset.UTC)
        );
    }
}
