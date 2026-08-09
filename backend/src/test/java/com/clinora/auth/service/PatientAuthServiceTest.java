package com.clinora.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.audit.AuthAuditService;
import com.clinora.auth.session.RefreshSessionService;
import com.clinora.auth.token.EmailVerificationTokenRepository;
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
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PatientAuthServiceTest {

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
        Instant now = Instant.parse("2026-08-08T12:00:00Z");

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
            Clock.fixed(now, ZoneOffset.UTC)
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
}
