package com.clinora.admin.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.auth.service.PasswordPolicy;
import com.clinora.config.SystemAdminProperties;
import com.clinora.security.PasswordService;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import com.clinora.users.service.EmailAddressNormalizer;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.ApplicationArguments;

class SystemAdminBootstrapTest {

    private static final Instant NOW = Instant.parse("2026-08-14T04:30:00Z");

    @Test
    void createsExactlyOneActiveVerifiedSystemAdminFromConfiguredValues() {
        UserAccountRepository users = mock(UserAccountRepository.class);
        PasswordService passwords = mock(PasswordService.class);
        AuthAuditService audit = mock(AuthAuditService.class);
        SystemAdminProperties properties = configuredProperties("Strong#Admin1");

        when(users.existsByRole(UserRole.SYSTEM_ADMIN)).thenReturn(false);
        when(users.findByNormalizedEmail("admin@example.com")).thenReturn(Optional.empty());
        when(passwords.hash("Strong#Admin1")).thenReturn("bcrypt-hash");
        when(users.save(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service(users, properties, passwords, audit).run(mock(ApplicationArguments.class));

        ArgumentCaptor<UserAccount> account = ArgumentCaptor.forClass(UserAccount.class);
        verify(users).save(account.capture());
        assertEquals(UserRole.SYSTEM_ADMIN, account.getValue().getRole());
        assertEquals(AccountStatus.ACTIVE, account.getValue().getAccountStatus());
        assertEquals("admin@example.com", account.getValue().getNormalizedEmail());
        assertEquals("bcrypt-hash", account.getValue().getPasswordHash());
        assertEquals(NOW, account.getValue().getEmailVerifiedAt());
        assertTrue(account.getValue().isLoginAllowed());
        verify(audit).record(
            isNull(),
            eq(AuthAuditAction.SYSTEM_ADMIN_BOOTSTRAPPED),
            eq(AuthAuditOutcome.SUCCESS),
            isNull(),
            isNull(),
            isNull(),
            eq("source=startup-bootstrap")
        );
    }

    @Test
    void existingSystemAdminMakesBootstrapIdempotentAndDoesNotResetPassword() {
        UserAccountRepository users = mock(UserAccountRepository.class);
        PasswordService passwords = mock(PasswordService.class);
        AuthAuditService audit = mock(AuthAuditService.class);
        SystemAdminProperties properties = configuredProperties("Changed#Password2");
        when(users.existsByRole(UserRole.SYSTEM_ADMIN)).thenReturn(true);

        service(users, properties, passwords, audit).run(mock(ApplicationArguments.class));

        verify(users, never()).findByNormalizedEmail(any());
        verify(users, never()).save(any());
        verifyNoInteractions(passwords, audit);
    }

    @Test
    void rejectsCollisionWithExistingNonAdminAccount() {
        UserAccountRepository users = mock(UserAccountRepository.class);
        PasswordService passwords = mock(PasswordService.class);
        AuthAuditService audit = mock(AuthAuditService.class);
        UserAccount patient = mock(UserAccount.class);
        when(patient.getRole()).thenReturn(UserRole.PATIENT);
        when(users.existsByRole(UserRole.SYSTEM_ADMIN)).thenReturn(false);
        when(users.findByNormalizedEmail("admin@example.com")).thenReturn(Optional.of(patient));

        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> service(users, configuredProperties("Strong#Admin1"), passwords, audit)
                .run(mock(ApplicationArguments.class))
        );

        assertTrue(exception.getMessage().contains("non-admin account"));
        verify(users, never()).save(any());
        verifyNoInteractions(passwords, audit);
    }

    @Test
    void failsFastWhenNoAdminExistsAndBootstrapConfigurationIsMissing() {
        UserAccountRepository users = mock(UserAccountRepository.class);
        when(users.existsByRole(UserRole.SYSTEM_ADMIN)).thenReturn(false);

        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> service(
                users,
                new SystemAdminProperties(),
                mock(PasswordService.class),
                mock(AuthAuditService.class)
            ).run(mock(ApplicationArguments.class))
        );

        assertTrue(exception.getMessage().contains("SYSTEM_ADMIN_EMAIL"));
    }

    @Test
    void failsFastWhenBootstrapPasswordIsMissing() {
        UserAccountRepository users = mock(UserAccountRepository.class);
        when(users.existsByRole(UserRole.SYSTEM_ADMIN)).thenReturn(false);

        SystemAdminProperties properties = configuredProperties("Strong#Admin1");
        properties.setPassword(" ");

        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> service(
                users,
                properties,
                mock(PasswordService.class),
                mock(AuthAuditService.class)
            ).run(mock(ApplicationArguments.class))
        );

        assertTrue(exception.getMessage().contains("SYSTEM_ADMIN_PASSWORD"));
    }

    @Test
    void rejectsBootstrapPasswordThatFailsExistingPasswordPolicy() {
        UserAccountRepository users = mock(UserAccountRepository.class);
        PasswordService passwords = mock(PasswordService.class);
        AuthAuditService audit = mock(AuthAuditService.class);
        when(users.existsByRole(UserRole.SYSTEM_ADMIN)).thenReturn(false);
        when(users.findByNormalizedEmail("admin@example.com")).thenReturn(Optional.empty());

        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> service(users, configuredProperties("weak"), passwords, audit)
                .run(mock(ApplicationArguments.class))
        );

        assertTrue(exception.getMessage().contains("password policy"));
        verify(users, never()).save(any());
        verifyNoInteractions(passwords, audit);
    }

    private SystemAdminBootstrap service(
        UserAccountRepository users,
        SystemAdminProperties properties,
        PasswordService passwords,
        AuthAuditService audit
    ) {
        return new SystemAdminBootstrap(
            users,
            properties,
            new EmailAddressNormalizer(),
            passwords,
            new PasswordPolicy(),
            audit,
            Clock.fixed(NOW, ZoneOffset.UTC)
        );
    }

    private SystemAdminProperties configuredProperties(String password) {
        SystemAdminProperties properties = new SystemAdminProperties();
        properties.setEmail(" Admin@Example.com ");
        properties.setPassword(password);
        properties.setFirstName(" Clinora ");
        properties.setLastName(" Admin ");
        return properties;
    }
}
