package com.clinora.access.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.access.domain.ApplicantSession;
import com.clinora.access.repository.ApplicantSessionRepository;
import com.clinora.config.AccessApplicationProperties;
import com.clinora.security.token.SecureTokenService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

class ApplicantSessionServiceTest {

    @Test
    void storesOnlyHashAndCanResolveIssuedScopedSession() {
        ApplicantSessionRepository repository = Mockito.mock(ApplicantSessionRepository.class);
        AccessApplicationProperties properties = new AccessApplicationProperties();
        SecureTokenService tokens = new SecureTokenService();
        Clock clock = Clock.fixed(Instant.parse("2026-08-09T12:00:00Z"), ZoneOffset.UTC);
        ApplicantSessionService service = new ApplicantSessionService(repository, tokens, properties, clock);
        UUID applicationId = UUID.randomUUID();

        var issued = service.issue(applicationId, "test-agent", "127.0.0.1");

        ArgumentCaptor<ApplicantSession> captor = ArgumentCaptor.forClass(ApplicantSession.class);
        verify(repository).save(captor.capture());
        ApplicantSession persisted = captor.getValue();
        String rawSecret = issued.rawCookieValue().substring(issued.rawCookieValue().indexOf('.') + 1);
        assertFalse(persisted.getTokenHash().contains(rawSecret));
        assertTrue(tokens.hashesMatch(persisted.getTokenHash(), tokens.hash(rawSecret)));

        when(repository.findById(any(UUID.class))).thenReturn(java.util.Optional.of(persisted));
        assertTrue(service.requireApplication(issued.rawCookieValue()).equals(applicationId));
    }
}
