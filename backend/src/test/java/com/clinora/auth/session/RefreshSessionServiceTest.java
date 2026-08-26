package com.clinora.auth.session;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.clinora.config.AuthProperties;
import com.clinora.security.token.SecureTokenService;
import com.clinora.users.domain.UserAccount;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class RefreshSessionServiceTest {

    @Test
    void rotatesRefreshTokensAndRevokesTheSessionWhenAnOlderRotationIsReused() {
        AuthSessionRepository repository = mock(AuthSessionRepository.class);
        AuthProperties properties = new AuthProperties();
        Instant now = Instant.parse("2026-08-07T12:00:00Z");
        RefreshSessionService service = new RefreshSessionService(
            repository,
            new SecureTokenService(),
            properties,
            Clock.fixed(now, ZoneOffset.UTC)
        );
        UserAccount user = mock(UserAccount.class);
        AtomicReference<AuthSession> persisted = new AtomicReference<>();

        when(user.isLoginAllowed()).thenReturn(true);
        when(repository.save(any(AuthSession.class))).thenAnswer(invocation -> {
            AuthSession session = invocation.getArgument(0);
            persisted.set(session);
            return session;
        });

        IssuedRefreshSession first = service.create(user, "JUnit", "127.0.0.1");
        when(repository.findById(first.sessionId())).thenAnswer(invocation -> Optional.of(persisted.get()));

        IssuedRefreshSession second = service.rotate(first.refreshToken());

        assertNotEquals(first.refreshToken(), second.refreshToken());
        assertThrows(RefreshTokenReuseDetectedException.class, () -> service.rotate(first.refreshToken()));
        assertNotNull(persisted.get().getRevokedAt());
    }

    @Test
    void rejectsRevokedRefreshSessions() {
        AuthSessionRepository repository = mock(AuthSessionRepository.class);
        AuthProperties properties = new AuthProperties();
        Instant now = Instant.parse("2026-08-07T12:00:00Z");
        RefreshSessionService service = new RefreshSessionService(
            repository,
            new SecureTokenService(),
            properties,
            Clock.fixed(now, ZoneOffset.UTC)
        );
        UserAccount user = mock(UserAccount.class);
        AtomicReference<AuthSession> persisted = new AtomicReference<>();
        when(user.isLoginAllowed()).thenReturn(true);
        when(repository.save(any(AuthSession.class))).thenAnswer(invocation -> {
            AuthSession session = invocation.getArgument(0);
            persisted.set(session);
            return session;
        });
        IssuedRefreshSession issued = service.create(user, "JUnit", "127.0.0.1");
        persisted.get().revoke("USER_REVOKED", now.plusSeconds(1));
        when(repository.findById(issued.sessionId())).thenReturn(Optional.of(persisted.get()));

        assertThrows(RefreshSessionException.class, () -> service.rotate(issued.refreshToken()));
    }

    @Test
    void revokedAccountCannotRefreshAndSessionIsRevoked() {
        AuthSessionRepository repository = mock(AuthSessionRepository.class);
        AuthProperties properties = new AuthProperties();
        Instant now = Instant.parse("2026-08-07T12:00:00Z");
        RefreshSessionService service = new RefreshSessionService(
            repository,
            new SecureTokenService(),
            properties,
            Clock.fixed(now, ZoneOffset.UTC)
        );
        UserAccount user = mock(UserAccount.class);
        AtomicReference<AuthSession> persisted = new AtomicReference<>();
        when(user.isLoginAllowed()).thenReturn(true);
        when(repository.save(any(AuthSession.class))).thenAnswer(invocation -> {
            AuthSession session = invocation.getArgument(0);
            persisted.set(session);
            return session;
        });
        IssuedRefreshSession issued = service.create(user, "JUnit", "127.0.0.1");
        when(user.isLoginAllowed()).thenReturn(false);
        when(repository.findById(issued.sessionId())).thenReturn(Optional.of(persisted.get()));

        assertThrows(RefreshSessionException.class, () -> service.rotate(issued.refreshToken()));
        assertNotNull(persisted.get().getRevokedAt());
    }
}
