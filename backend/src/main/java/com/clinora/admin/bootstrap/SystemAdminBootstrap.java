package com.clinora.admin.bootstrap;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.auth.api.AuthApiException;
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
import java.util.regex.Pattern;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SystemAdminBootstrap implements ApplicationRunner {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final UserAccountRepository users;
    private final SystemAdminProperties properties;
    private final EmailAddressNormalizer emailNormalizer;
    private final PasswordService passwords;
    private final PasswordPolicy passwordPolicy;
    private final AuthAuditService audit;
    private final Clock clock;

    public SystemAdminBootstrap(
        UserAccountRepository users,
        SystemAdminProperties properties,
        EmailAddressNormalizer emailNormalizer,
        PasswordService passwords,
        PasswordPolicy passwordPolicy,
        AuthAuditService audit,
        Clock clock
    ) {
        this.users = users;
        this.properties = properties;
        this.emailNormalizer = emailNormalizer;
        this.passwords = passwords;
        this.passwordPolicy = passwordPolicy;
        this.audit = audit;
        this.clock = clock;
    }

    @Override
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public void run(ApplicationArguments args) {
        if (users.existsByRole(UserRole.SYSTEM_ADMIN)) {
            return;
        }

        BootstrapValues values = validatedValues();
        String normalizedEmail = emailNormalizer.normalize(values.email());
        if (users.findByNormalizedEmail(normalizedEmail).isPresent()) {
            throw new IllegalStateException(
                "Configured SYSTEM_ADMIN_EMAIL is already assigned to a non-admin account."
            );
        }

        try {
            passwordPolicy.validate(values.password());
        } catch (AuthApiException exception) {
            throw new IllegalStateException(
                "SYSTEM_ADMIN_PASSWORD does not satisfy the configured password policy.",
                exception
            );
        }

        Instant now = clock.instant();
        UserAccount admin = new UserAccount(
            values.firstName(),
            values.lastName(),
            values.email(),
            normalizedEmail,
            passwords.hash(values.password()),
            UserRole.SYSTEM_ADMIN,
            AccountStatus.ACTIVE,
            now
        );
        admin.markEmailVerified(now);
        UserAccount saved = users.save(admin);

        audit.record(
            null,
            AuthAuditAction.SYSTEM_ADMIN_BOOTSTRAPPED,
            AuthAuditOutcome.SUCCESS,
            null,
            null,
            saved.getId() == null ? null : saved.getId().toString(),
            "source=startup-bootstrap"
        );
    }

    private BootstrapValues validatedValues() {
        String email = requireTrimmed("SYSTEM_ADMIN_EMAIL", properties.getEmail(), 320);
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new IllegalStateException("SYSTEM_ADMIN_EMAIL must be a valid email address.");
        }

        String firstName = requireTrimmed("SYSTEM_ADMIN_FIRST_NAME", properties.getFirstName(), 120);
        String lastName = requireTrimmed("SYSTEM_ADMIN_LAST_NAME", properties.getLastName(), 120);
        String password = properties.getPassword();
        if (password == null || password.isBlank() || password.length() > 128) {
            throw new IllegalStateException("SYSTEM_ADMIN_PASSWORD must be configured and at most 128 characters.");
        }
        return new BootstrapValues(firstName, lastName, email, password);
    }

    private String requireTrimmed(String key, String value, int maxLength) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(key + " must be configured before the first System Admin bootstrap.");
        }
        String trimmed = value.trim();
        if (trimmed.length() > maxLength) {
            throw new IllegalStateException(key + " exceeds the maximum supported length.");
        }
        return trimmed;
    }

    private record BootstrapValues(String firstName, String lastName, String email, String password) {
    }
}
