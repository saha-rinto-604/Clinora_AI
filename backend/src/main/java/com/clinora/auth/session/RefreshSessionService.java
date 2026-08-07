package com.clinora.auth.session;

import com.clinora.config.AuthProperties;
import com.clinora.security.token.GeneratedSecureToken;
import com.clinora.security.token.SecureTokenService;
import com.clinora.users.domain.UserAccount;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RefreshSessionService {

    private static final String TOKEN_SEPARATOR = ".";

    private final AuthSessionRepository repository;
    private final SecureTokenService secureTokenService;
    private final AuthProperties authProperties;
    private final Clock clock;

    public RefreshSessionService(
        AuthSessionRepository repository,
        SecureTokenService secureTokenService,
        AuthProperties authProperties,
        Clock clock
    ) {
        this.repository = repository;
        this.secureTokenService = secureTokenService;
        this.authProperties = authProperties;
        this.clock = clock;
    }

    @Transactional
    public IssuedRefreshSession create(UserAccount user, String userAgent, String ipAddress) {
        Instant now = clock.instant();
        UUID sessionId = UUID.randomUUID();
        GeneratedSecureToken token = secureTokenService.generate();
        Instant expiresAt = now.plus(authProperties.getRefreshTokenTtl());

        AuthSession session = AuthSession.create(
            sessionId,
            user,
            token.tokenHash(),
            now,
            expiresAt,
            truncate(userAgent, 512),
            truncate(ipAddress, 64)
        );
        repository.save(session);

        return new IssuedRefreshSession(sessionId, formatToken(sessionId, 0, token.rawToken()), expiresAt);
    }

    @Transactional(noRollbackFor = RefreshTokenReuseDetectedException.class)
    public IssuedRefreshSession rotate(String presentedToken) {
        ParsedRefreshToken parsed = parse(presentedToken);
        AuthSession session = repository.findById(parsed.sessionId())
            .orElseThrow(() -> new RefreshSessionException("Refresh session not found"));

        Instant now = clock.instant();
        if (!session.isActiveAt(now)) {
            throw new RefreshSessionException("Refresh session is expired or revoked");
        }

        if (parsed.rotation() < session.getRotation()) {
            session.revoke("REFRESH_TOKEN_REUSE", now);
            throw new RefreshTokenReuseDetectedException();
        }
        if (parsed.rotation() > session.getRotation()) {
            throw new RefreshSessionException("Refresh token is invalid");
        }

        String presentedHash = secureTokenService.hash(parsed.secret());
        if (!secureTokenService.hashesMatch(session.getCurrentTokenHash(), presentedHash)) {
            throw new RefreshSessionException("Refresh token is invalid");
        }

        GeneratedSecureToken next = secureTokenService.generate();
        session.rotate(next.tokenHash(), now);
        return new IssuedRefreshSession(
            session.getId(),
            formatToken(session.getId(), session.getRotation(), next.rawToken()),
            session.getExpiresAt()
        );
    }

    @Transactional
    public void revoke(String presentedToken, String reason) {
        ParsedRefreshToken parsed = parse(presentedToken);
        repository.findById(parsed.sessionId())
            .ifPresent(session -> session.revoke(reason, clock.instant()));
    }

    private String formatToken(UUID sessionId, long rotation, String secret) {
        return sessionId + TOKEN_SEPARATOR + rotation + TOKEN_SEPARATOR + secret;
    }

    private ParsedRefreshToken parse(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new RefreshSessionException("Refresh token is missing");
        }

        String[] parts = rawToken.split("\\.", 3);
        if (parts.length != 3 || parts[2].isBlank()) {
            throw new RefreshSessionException("Refresh token is malformed");
        }

        try {
            UUID sessionId = UUID.fromString(parts[0]);
            long rotation = Long.parseLong(parts[1]);
            if (rotation < 0) {
                throw new NumberFormatException("negative rotation");
            }
            return new ParsedRefreshToken(sessionId, rotation, parts[2]);
        } catch (IllegalArgumentException exception) {
            throw new RefreshSessionException("Refresh token is malformed");
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private record ParsedRefreshToken(UUID sessionId, long rotation, String secret) {
    }
}
