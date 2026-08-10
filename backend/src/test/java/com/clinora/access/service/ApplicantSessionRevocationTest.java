package com.clinora.access.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.access.domain.ApplicantSession;
import com.clinora.access.repository.ApplicantSessionRepository;
import com.clinora.config.AccessApplicationProperties;
import com.clinora.security.token.SecureTokenService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ApplicantSessionRevocationTest {

    @Test
    void revokeAllEndsEveryActiveSessionForTheApplication() {
        ApplicantSessionRepository repository = Mockito.mock(ApplicantSessionRepository.class);
        AccessApplicationProperties properties = new AccessApplicationProperties();
        SecureTokenService tokens = new SecureTokenService();
        Instant now = Instant.parse("2026-08-09T12:00:00Z");
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        ApplicantSessionService service = new ApplicantSessionService(repository, tokens, properties, clock);
        UUID applicationId = UUID.randomUUID();
        UUID currentId = UUID.randomUUID();
        var currentSecret = tokens.generate();
        var otherSecret = tokens.generate();
        ApplicantSession current = new ApplicantSession(
            currentId,
            applicationId,
            currentSecret.tokenHash(),
            now,
            now.plusSeconds(3600),
            "current-agent",
            "127.0.0.1"
        );
        ApplicantSession other = new ApplicantSession(
            UUID.randomUUID(),
            applicationId,
            otherSecret.tokenHash(),
            now,
            now.plusSeconds(3600),
            "other-agent",
            "127.0.0.2"
        );

        when(repository.findById(currentId)).thenReturn(java.util.Optional.of(current));
        when(repository.findAllByApplicationId(applicationId)).thenReturn(List.of(current, other));

        service.revokeAll(currentId + "." + currentSecret.rawToken());

        assertFalse(current.activeAt(now.plusSeconds(1)));
        assertFalse(other.activeAt(now.plusSeconds(1)));
        verify(repository).findAllByApplicationId(applicationId);
    }
}
