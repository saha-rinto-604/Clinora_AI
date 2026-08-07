package com.clinora.auth.session;

import java.time.Instant;
import java.util.UUID;

public record IssuedRefreshSession(UUID sessionId, String refreshToken, Instant expiresAt) {
}
