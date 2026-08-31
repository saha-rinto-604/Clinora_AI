package com.clinora.admin.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.audit.AuthAuditService;
import com.clinora.auth.service.AuthMailService;
import com.clinora.auth.service.AuthRateLimitGuard;
import com.clinora.auth.service.PasswordPolicy;
import com.clinora.auth.service.PatientAuthService;
import com.clinora.auth.session.IssuedRefreshSession;
import com.clinora.auth.session.RefreshSessionService;
import com.clinora.auth.token.EmailVerificationTokenRepository;
import com.clinora.auth.token.PasswordResetTokenRepository;
import com.clinora.config.AuthProperties;
import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.security.PasswordService;
import com.clinora.security.jwt.AccessTokenService;
import com.clinora.security.jwt.AccessTokenService.IssuedAccessToken;
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

class SystemAdminLoginTest {

    @Test
    void commonLoginPreservesSystemAdminRole() {
        Instant now = Instant.parse("2026-08-14T04:45:00Z");
        UUID userId = UUID.randomUUID();
        UserAccountRepository users = mock(UserAccountRepository.class);
        PasswordService passwords = mock(PasswordService.class);
        AccessTokenService accessTokens = mock(AccessTokenService.class);
        RefreshSessionService refreshSessions = mock(RefreshSessionService.class);
        UserAccount admin = mock(UserAccount.class);

        when(users.findByNormalizedEmail("admin@example.com")).thenReturn(Optional.of(admin));
        when(passwords.matches("Strong#Admin1", "bcrypt-hash")).thenReturn(true);
        when(admin.getId()).thenReturn(userId);
        when(admin.getPasswordHash()).thenReturn("bcrypt-hash");
        when(admin.isLoginAllowed()).thenReturn(true);
        when(admin.getFirstName()).thenReturn("Clinora");
        when(admin.getLastName()).thenReturn("Admin");
        when(admin.getEmail()).thenReturn("admin@example.com");
        when(admin.getRole()).thenReturn(UserRole.SYSTEM_ADMIN);
        when(admin.getAccountStatus()).thenReturn(AccountStatus.ACTIVE);
        when(admin.getEmailVerifiedAt()).thenReturn(now.minusSeconds(60));
        when(refreshSessions.create(admin, "JUnit", "127.0.0.1")).thenReturn(
            new IssuedRefreshSession(UUID.randomUUID(), "refresh", now.plusSeconds(3600))
        );
        when(accessTokens.issue(userId, UserRole.SYSTEM_ADMIN)).thenReturn(
            new IssuedAccessToken("access", now.plusSeconds(900))
        );

        PatientAuthService auth = new PatientAuthService(
            users,
            mock(EmailVerificationTokenRepository.class),
            mock(PasswordResetTokenRepository.class),
            new EmailAddressNormalizer(),
            passwords,
            new PasswordPolicy(),
            mock(SecureTokenService.class),
            accessTokens,
            refreshSessions,
            mock(AuthMailService.class),
            mock(AuthRateLimitGuard.class),
            mock(AuthAuditService.class),
            mock(PatientNotificationService.class),
            new AuthProperties(),
            Clock.fixed(now, ZoneOffset.UTC)
        );

        PatientAuthService.SessionResult result = auth.login(
            "Admin@Example.com",
            "Strong#Admin1",
            new PatientAuthService.RequestContext("127.0.0.1", "JUnit")
        );

        assertEquals("SYSTEM_ADMIN", result.response().user().role());
        verify(accessTokens).issue(userId, UserRole.SYSTEM_ADMIN);
    }
}
