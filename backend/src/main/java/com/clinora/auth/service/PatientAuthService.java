package com.clinora.auth.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.auth.api.AuthApiException;
import com.clinora.auth.session.AuthSession;
import com.clinora.auth.session.IssuedRefreshSession;
import com.clinora.auth.session.RefreshSessionException;
import com.clinora.auth.session.RefreshSessionService;
import com.clinora.auth.session.RefreshTokenReuseDetectedException;
import com.clinora.auth.token.EmailVerificationToken;
import com.clinora.auth.token.EmailVerificationTokenRepository;
import com.clinora.auth.token.PasswordResetToken;
import com.clinora.auth.token.PasswordResetTokenRepository;
import com.clinora.config.AuthProperties;
import com.clinora.security.PasswordService;
import com.clinora.security.jwt.AccessTokenService;
import com.clinora.security.jwt.AccessTokenService.IssuedAccessToken;
import com.clinora.security.token.GeneratedSecureToken;
import com.clinora.security.token.SecureTokenService;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import com.clinora.users.service.EmailAddressNormalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PatientAuthService {

    private final UserAccountRepository users;
    private final EmailVerificationTokenRepository verificationTokens;
    private final PasswordResetTokenRepository resetTokens;
    private final EmailAddressNormalizer emailNormalizer;
    private final PasswordService passwords;
    private final PasswordPolicy passwordPolicy;
    private final SecureTokenService secureTokens;
    private final AccessTokenService accessTokens;
    private final RefreshSessionService refreshSessions;
    private final AuthMailService mail;
    private final AuthRateLimitGuard limits;
    private final AuthAuditService audit;
    private final AuthProperties properties;
    private final Clock clock;

    public PatientAuthService(
        UserAccountRepository users,
        EmailVerificationTokenRepository verificationTokens,
        PasswordResetTokenRepository resetTokens,
        EmailAddressNormalizer emailNormalizer,
        PasswordService passwords,
        PasswordPolicy passwordPolicy,
        SecureTokenService secureTokens,
        AccessTokenService accessTokens,
        RefreshSessionService refreshSessions,
        AuthMailService mail,
        AuthRateLimitGuard limits,
        AuthAuditService audit,
        AuthProperties properties,
        Clock clock
    ) {
        this.users = users;
        this.verificationTokens = verificationTokens;
        this.resetTokens = resetTokens;
        this.emailNormalizer = emailNormalizer;
        this.passwords = passwords;
        this.passwordPolicy = passwordPolicy;
        this.secureTokens = secureTokens;
        this.accessTokens = accessTokens;
        this.refreshSessions = refreshSessions;
        this.mail = mail;
        this.limits = limits;
        this.audit = audit;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    public String register(String firstName, String lastName, String email, String password, RequestContext context) {
        String normalized = emailNormalizer.normalize(email);
        limits.registration(context.ipAddress(), normalized);
        passwordPolicy.validate(password);
        if (users.existsByNormalizedEmail(normalized)) {
            throw new AuthApiException(
                HttpStatus.CONFLICT,
                "EMAIL_ALREADY_REGISTERED",
                "An account already exists for this email address."
            );
        }

        Instant now = clock.instant();
        UserAccount user = users.save(new UserAccount(
            firstName.trim(),
            lastName.trim(),
            email.trim(),
            normalized,
            passwords.hash(password),
            UserRole.PATIENT,
            AccountStatus.PENDING_EMAIL_VERIFICATION,
            now
        ));
        GeneratedSecureToken token = secureTokens.generate();
        verificationTokens.save(new EmailVerificationToken(
            UUID.randomUUID(),
            user,
            token.tokenHash(),
            now.plus(properties.getEmailVerificationTtl()),
            now
        ));
        record(user, AuthAuditAction.PATIENT_REGISTERED, AuthAuditOutcome.SUCCESS, context, id(user.getId()));
        record(user, AuthAuditAction.EMAIL_VERIFICATION_SENT, AuthAuditOutcome.SUCCESS, context, id(user.getId()));
        mail.sendPatientVerification(user.getEmail(), user.getFirstName(), token.rawToken());
        return user.getEmail();
    }

    @Transactional
    public void verifyEmail(String rawToken, RequestContext context) {
        Instant now = clock.instant();
        EmailVerificationToken token = verificationTokens
            .findByTokenHash(secureTokens.hash(rawToken))
            .orElseThrow(AuthApiException::invalidToken);
        if (!token.canBeConsumedAt(now)) {
            throw AuthApiException.invalidToken();
        }
        token.consume(now);
        UserAccount user = token.getUser();
        user.markEmailVerified(now);
        record(user, AuthAuditAction.EMAIL_VERIFIED, AuthAuditOutcome.SUCCESS, context, id(user.getId()));
    }

    @Transactional
    public void resendVerification(String email, RequestContext context) {
        String normalized = emailNormalizer.normalize(email);
        limits.resendVerification(context.ipAddress(), normalized);
        users.findByNormalizedEmail(normalized)
            .filter(user -> user.getAccountStatus() == AccountStatus.PENDING_EMAIL_VERIFICATION)
            .filter(user -> user.getEmailVerifiedAt() == null)
            .ifPresent(user -> {
                verificationTokens.deleteAllByUser_IdAndConsumedAtIsNull(user.getId());
                Instant now = clock.instant();
                GeneratedSecureToken token = secureTokens.generate();
                verificationTokens.save(new EmailVerificationToken(
                    UUID.randomUUID(),
                    user,
                    token.tokenHash(),
                    now.plus(properties.getEmailVerificationTtl()),
                    now
                ));
                record(user, AuthAuditAction.EMAIL_VERIFICATION_SENT, AuthAuditOutcome.SUCCESS, context, id(user.getId()));
                mail.sendPatientVerification(user.getEmail(), user.getFirstName(), token.rawToken());
            });
    }

    @Transactional
    public SessionResult login(String email, String password, RequestContext context) {
        String normalized = emailNormalizer.normalize(email);
        limits.login(context.ipAddress(), normalized);
        UserAccount user = users.findByNormalizedEmail(normalized).orElse(null);

        if (user == null || !passwords.matches(password, user.getPasswordHash())) {
            audit.record(
                user == null ? null : user.getId(),
                AuthAuditAction.LOGIN_FAILED,
                AuthAuditOutcome.FAILURE,
                context.ipAddress(),
                context.userAgent(),
                user == null ? null : id(user.getId()),
                null
            );
            throw AuthApiException.invalidCredentials();
        }
        if (!user.isLoginAllowed()) {
            record(user, AuthAuditAction.LOGIN_FAILED, AuthAuditOutcome.REJECTED, context, id(user.getId()));
            if (user.getAccountStatus() == AccountStatus.PENDING_EMAIL_VERIFICATION) {
                throw new AuthApiException(
                    HttpStatus.FORBIDDEN,
                    "EMAIL_VERIFICATION_REQUIRED",
                    "Verify your email before signing in."
                );
            }
            throw new AuthApiException(HttpStatus.FORBIDDEN, "ACCOUNT_NOT_ACTIVE", "This account is not active.");
        }

        user.recordSuccessfulLogin(clock.instant());
        IssuedRefreshSession refresh = refreshSessions.create(user, context.userAgent(), context.ipAddress());
        IssuedAccessToken access = accessTokens.issue(user.getId(), user.getRole());
        record(user, AuthAuditAction.LOGIN_SUCCEEDED, AuthAuditOutcome.SUCCESS, context, id(user.getId()));
        return sessionResult(user, access, refresh);
    }

    public SessionResult refresh(String refreshToken, RequestContext context) {
        limits.refresh(context.ipAddress());
        try {
            IssuedRefreshSession refresh = refreshSessions.rotate(refreshToken);
            UserAccount user = refreshSessions.userForSession(refresh.sessionId());
            IssuedAccessToken access = accessTokens.issue(user.getId(), user.getRole());
            record(user, AuthAuditAction.TOKEN_REFRESHED, AuthAuditOutcome.SUCCESS, context, id(refresh.sessionId()));
            return sessionResult(user, access, refresh);
        } catch (RefreshTokenReuseDetectedException exception) {
            throw new AuthApiException(
                HttpStatus.UNAUTHORIZED,
                "REFRESH_TOKEN_REUSE_DETECTED",
                "This session was revoked because an older refresh token was reused."
            );
        } catch (RefreshSessionException exception) {
            throw AuthApiException.sessionInvalid();
        }
    }

    @Transactional
    public void logout(String refreshToken, RequestContext context) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        try {
            UUID sessionId = refreshSessions.sessionId(refreshToken);
            UserAccount user = refreshSessions.userForSession(sessionId);
            refreshSessions.revoke(refreshToken, "LOGOUT");
            record(user, AuthAuditAction.LOGOUT, AuthAuditOutcome.SUCCESS, context, id(sessionId));
        } catch (RefreshSessionException ignored) {
            // Idempotent logout: the controller still clears the browser cookie.
        }
    }

    @Transactional(readOnly = true)
    public UserView me(UUID userId) {
        return UserView.from(requireUser(userId));
    }

    @Transactional
    public void forgotPassword(String email, RequestContext context) {
        String normalized = emailNormalizer.normalize(email);
        limits.forgotPassword(context.ipAddress(), normalized);
        users.findByNormalizedEmail(normalized)
            .filter(UserAccount::isLoginAllowed)
            .ifPresent(user -> {
                resetTokens.deleteAllByUser_IdAndConsumedAtIsNull(user.getId());
                Instant now = clock.instant();
                GeneratedSecureToken token = secureTokens.generate();
                resetTokens.save(new PasswordResetToken(
                    UUID.randomUUID(),
                    user,
                    token.tokenHash(),
                    now.plus(properties.getPasswordResetTtl()),
                    now
                ));
                record(user, AuthAuditAction.PASSWORD_RESET_REQUESTED, AuthAuditOutcome.SUCCESS, context, id(user.getId()));
                mail.sendPasswordReset(user.getEmail(), user.getFirstName(), token.rawToken());
            });
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword, RequestContext context) {
        passwordPolicy.validate(newPassword);
        Instant now = clock.instant();
        PasswordResetToken token = resetTokens
            .findByTokenHash(secureTokens.hash(rawToken))
            .orElseThrow(AuthApiException::invalidToken);
        if (!token.canBeConsumedAt(now)) {
            throw AuthApiException.invalidToken();
        }
        UserAccount user = token.getUser();
        user.changePasswordHash(passwords.hash(newPassword), now);
        token.consume(now);
        refreshSessions.revokeAll(user.getId(), "PASSWORD_RESET");
        record(user, AuthAuditAction.PASSWORD_RESET_COMPLETED, AuthAuditOutcome.SUCCESS, context, id(user.getId()));
    }

    @Transactional
    public SessionResult changePassword(
        UUID userId,
        String currentPassword,
        String newPassword,
        String refreshToken,
        RequestContext context
    ) {
        passwordPolicy.validate(newPassword);
        UserAccount user = requireUser(userId);
        if (!passwords.matches(currentPassword, user.getPasswordHash())) {
            throw new AuthApiException(
                HttpStatus.BAD_REQUEST,
                "CURRENT_PASSWORD_INCORRECT",
                "The current password is incorrect."
            );
        }

        UUID currentSession;
        try {
            currentSession = refreshSessions.sessionId(refreshToken);
            if (!refreshSessions.userForSession(currentSession).getId().equals(userId)) {
                throw AuthApiException.sessionInvalid();
            }
        } catch (RefreshSessionException exception) {
            throw AuthApiException.sessionInvalid();
        }

        user.changePasswordHash(passwords.hash(newPassword), clock.instant());
        refreshSessions.revokeAllExcept(userId, currentSession, "PASSWORD_CHANGED");
        IssuedRefreshSession refresh = refreshSessions.rotate(refreshToken);
        IssuedAccessToken access = accessTokens.issue(user.getId(), user.getRole());
        record(user, AuthAuditAction.PASSWORD_CHANGED, AuthAuditOutcome.SUCCESS, context, id(user.getId()));
        return sessionResult(user, access, refresh);
    }

    @Transactional(readOnly = true)
    public List<SessionView> sessions(UUID userId, String refreshToken) {
        requireUser(userId);
        UUID current = safeSessionId(refreshToken);
        return refreshSessions.list(userId).stream().map(session -> SessionView.from(session, current)).toList();
    }

    @Transactional
    public void revokeSession(UUID userId, UUID sessionId, RequestContext context) {
        requireUser(userId);
        try {
            refreshSessions.revokeSession(userId, sessionId, "USER_REVOKED");
        } catch (RefreshSessionException exception) {
            throw new AuthApiException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "Session was not found.");
        }
        audit.record(
            userId,
            AuthAuditAction.SESSION_REVOKED,
            AuthAuditOutcome.SUCCESS,
            context.ipAddress(),
            context.userAgent(),
            id(sessionId),
            null
        );
    }

    @Transactional
    public void revokeOthers(UUID userId, String refreshToken, RequestContext context) {
        UUID current = safeSessionId(refreshToken);
        if (current == null) {
            throw AuthApiException.sessionInvalid();
        }
        refreshSessions.revokeAllExcept(userId, current, "USER_REVOKED_OTHERS");
        audit.record(
            userId,
            AuthAuditAction.SESSION_REVOKED,
            AuthAuditOutcome.SUCCESS,
            context.ipAddress(),
            context.userAgent(),
            "other-sessions",
            null
        );
    }

    public Duration refreshCookieMaxAge() {
        return properties.getRefreshTokenTtl();
    }

    private UserAccount requireUser(UUID userId) {
        return users.findById(userId)
            .filter(UserAccount::isLoginAllowed)
            .orElseThrow(() -> new AuthApiException(
                HttpStatus.UNAUTHORIZED,
                "ACCOUNT_NOT_ACTIVE",
                "The account is not available."
            ));
    }

    private SessionResult sessionResult(UserAccount user, IssuedAccessToken access, IssuedRefreshSession refresh) {
        return new SessionResult(
            new AuthenticatedView(access.token(), access.expiresAt(), UserView.from(user)),
            refresh.refreshToken()
        );
    }

    private UUID safeSessionId(String refreshToken) {
        try {
            return refreshToken == null ? null : refreshSessions.sessionId(refreshToken);
        } catch (RefreshSessionException exception) {
            return null;
        }
    }

    private void record(
        UserAccount user,
        AuthAuditAction action,
        AuthAuditOutcome outcome,
        RequestContext context,
        String resourceId
    ) {
        audit.record(
            user == null ? null : user.getId(),
            action,
            outcome,
            context.ipAddress(),
            context.userAgent(),
            resourceId,
            null
        );
    }

    private String id(UUID value) {
        return value == null ? null : value.toString();
    }

    public record RequestContext(String ipAddress, String userAgent) {
    }

    public record UserView(
        UUID id,
        String firstName,
        String lastName,
        String email,
        String role,
        String accountStatus,
        boolean emailVerified
    ) {
        static UserView from(UserAccount user) {
            return new UserView(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getRole().name(),
                user.getAccountStatus().name(),
                user.getEmailVerifiedAt() != null
            );
        }
    }

    public record AuthenticatedView(String accessToken, Instant accessTokenExpiresAt, UserView user) {
    }

    public record SessionView(
        UUID id,
        Instant createdAt,
        Instant lastUsedAt,
        Instant expiresAt,
        String userAgent,
        String ipAddress,
        boolean current
    ) {
        static SessionView from(AuthSession session, UUID currentId) {
            return new SessionView(
                session.getId(),
                session.getCreatedAt(),
                session.getLastUsedAt(),
                session.getExpiresAt(),
                session.getUserAgent(),
                session.getIpAddress(),
                session.getId().equals(currentId)
            );
        }
    }

    public record SessionResult(AuthenticatedView response, String refreshToken) {
    }
}
