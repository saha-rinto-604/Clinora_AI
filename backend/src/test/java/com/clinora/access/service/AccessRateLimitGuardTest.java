package com.clinora.access.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.config.AccessApplicationProperties;
import com.clinora.security.ratelimit.RateLimitDecision;
import com.clinora.security.ratelimit.RateLimitService;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class AccessRateLimitGuardTest {

    @Test
    void usesConfigurablePolicyBucketsForApplicationEndpoints() {
        RateLimitService limits = Mockito.mock(RateLimitService.class);
        AccessApplicationProperties properties = new AccessApplicationProperties();
        properties.getRateLimits().getCreateIp().setLimit(12);
        properties.getRateLimits().getCreateEmail().setLimit(5);
        properties.getRateLimits().getAccessLinkIp().setLimit(9);
        when(limits.consume(Mockito.any(), Mockito.any(), Mockito.anyInt(), Mockito.any()))
            .thenReturn(new RateLimitDecision(true, 1, Duration.ZERO));

        AccessRateLimitGuard guard = new AccessRateLimitGuard(limits, properties);

        guard.create("127.0.0.1", "doctor@example.test");
        guard.verify("127.0.0.1");
        guard.accessLink("127.0.0.1", "doctor@example.test");
        guard.session("127.0.0.1");
        guard.upload("application-1");
        guard.submit("application-1");

        verify(limits).consume("access-create-ip", "127.0.0.1", 12, Duration.ofHours(1));
        verify(limits).consume("access-create-email", "doctor@example.test", 5, Duration.ofHours(1));
        verify(limits).consume("access-verify", "127.0.0.1", 30, Duration.ofHours(1));
        verify(limits).consume("access-link-ip", "127.0.0.1", 9, Duration.ofHours(1));
        verify(limits).consume("access-link-email", "doctor@example.test", 8, Duration.ofHours(1));
        verify(limits).consume("access-session", "127.0.0.1", 30, Duration.ofHours(1));
        verify(limits).consume("access-upload", "application-1", 30, Duration.ofHours(1));
        verify(limits).consume("access-submit", "application-1", 10, Duration.ofHours(1));
    }

    @Test
    void deniedRateLimitRaisesApplicationRateLimitError() {
        RateLimitService limits = Mockito.mock(RateLimitService.class);
        when(limits.consume(Mockito.any(), Mockito.any(), Mockito.anyInt(), Mockito.any()))
            .thenReturn(new RateLimitDecision(false, 0, Duration.ofMinutes(1)));

        AccessRateLimitGuard guard = new AccessRateLimitGuard(limits, new AccessApplicationProperties());

        assertThrows(AccessApplicationException.class, () -> guard.session("127.0.0.1"));
    }
}
