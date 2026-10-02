package com.clinora.research.service;

import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import com.clinora.users.service.EmailAddressNormalizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Component
@Profile("dev")
@ConditionalOnProperty(name = "clinora.dev.researchers.enabled", havingValue = "true")
public class ResearcherDevelopmentSeeder implements ApplicationRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(ResearcherDevelopmentSeeder.class);
    private static final String TEST_DOMAIN = "@clinora.test";

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final String researcherPassword;
    private final UserAccountRepository users;
    private final EmailAddressNormalizer emailNormalizer;

    public ResearcherDevelopmentSeeder(
        JdbcTemplate jdbc,
        PasswordEncoder passwordEncoder,
        Clock clock,
        UserAccountRepository users,
        EmailAddressNormalizer emailNormalizer,
        @Value("${clinora.dev.researcher.password:}") String researcherPassword
    ) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.users = users;
        this.emailNormalizer = emailNormalizer;
        this.researcherPassword = researcherPassword == null ? "" : researcherPassword;
    }

    private record ResearcherFixture(String firstName, String lastName, String email) {}

    private static final List<ResearcherFixture> FIXTURES = List.of(
        new ResearcherFixture("Development", "Researcher", "clinora.researcher@clinora.test"),
        new ResearcherFixture("Nahid", "Hasan", "nahid.hasan.researcher@clinora.test"),
        new ResearcherFixture("Sabrina", "Rahman", "sabrina.rahman.researcher@clinora.test"),
        new ResearcherFixture("Fahim", "Ahmed", "fahim.ahmed.researcher@clinora.test"),
        new ResearcherFixture("Tasnia", "Islam", "tasnia.islam.researcher@clinora.test"),
        new ResearcherFixture("Mehedi", "Hassan", "mehedi.hassan.researcher@clinora.test"),
        new ResearcherFixture("Nusrat", "Sultana", "nusrat.sultana.researcher@clinora.test"),
        new ResearcherFixture("Samiul", "Karim", "samiul.karim.researcher@clinora.test"),
        new ResearcherFixture("Farzana", "Yasmin", "farzana.yasmin.researcher@clinora.test"),
        new ResearcherFixture("Arif", "Hossain", "arif.hossain.researcher@clinora.test"),
        new ResearcherFixture("Lamia", "Akter", "lamia.akter.researcher@clinora.test")
    );

    @Override
    public void run(ApplicationArguments args) {
        if (researcherPassword.isBlank()) {
            LOGGER.info("Clinora Researcher development fixtures are enabled but no password is configured; fixture seeding was skipped.");
            return;
        }

        Instant now = clock.instant();
        String passwordHash = passwordEncoder.encode(researcherPassword);

        for (ResearcherFixture fixture : FIXTURES) {
            assertFixtureAccount(fixture.email(), "RESEARCHER");
            seedResearcher(fixture.firstName(), fixture.lastName(), fixture.email(), passwordHash, now);
        }

        LOGGER.info("Clinora Researcher development fixtures ready: {} verified Researcher accounts seeded.", FIXTURES.size());
    }

    private void seedResearcher(String firstName, String lastName, String email, String passwordHash, Instant now) {
        UUID applicationId = id(email, "application");
        Instant createdAt = now.minus(Duration.ofDays(120));
        Instant verifiedAt = now.minus(Duration.ofDays(116));
        Instant interviewAt = now.minus(Duration.ofDays(105));
        Instant activatedAt = now.minus(Duration.ofDays(100));

        upsertUser(firstName, lastName, email, passwordHash, now);

        jdbc.update(
            """
            INSERT INTO access_applications
                (id, application_type, first_name, last_name, email, normalized_email, phone, country_code,
                 status, processing_consent_at, email_verified_at, attested_at, submitted_at, created_at, updated_at, version)
            VALUES (?, 'RESEARCHER', ?, ?, ?, ?, '01700000000', 'BD', 'ACTIVATED', ?, ?, ?, ?, ?, ?, 0)
            ON CONFLICT (id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                email = EXCLUDED.email,
                normalized_email = EXCLUDED.normalized_email,
                status = 'ACTIVATED',
                email_verified_at = EXCLUDED.email_verified_at,
                submitted_at = EXCLUDED.submitted_at,
                updated_at = EXCLUDED.updated_at
            """,
            applicationId,
            firstName,
            lastName,
            email,
            email.toLowerCase(Locale.ROOT),
            Timestamp.from(createdAt.plus(Duration.ofHours(1))),
            Timestamp.from(verifiedAt),
            Timestamp.from(verifiedAt.plus(Duration.ofHours(1))),
            Timestamp.from(verifiedAt.plus(Duration.ofDays(1))),
            Timestamp.from(createdAt),
            Timestamp.from(now)
        );

        jdbc.update(
            """
            INSERT INTO researcher_application_details
                (application_id, institution, department, professional_title, institutional_profile_url,
                 research_field, research_purpose, research_summary, orcid, research_profile_url,
                 publication_profile_url, ethics_reference, project_approval_reference)
            VALUES (?, 'Development University', 'Biomedical Informatics', 'Senior Researcher', 'https://clinora.test/profile',
                    'Health Data Science', 'Test research dashboard functionality', 'Validating system logic',
                    '0000-0000-0000-0000', NULL, NULL, 'ETHICS-1234', 'PROJ-5678')
            ON CONFLICT (application_id) DO UPDATE SET
                institution = EXCLUDED.institution,
                department = EXCLUDED.department,
                professional_title = EXCLUDED.professional_title,
                research_field = EXCLUDED.research_field,
                research_purpose = EXCLUDED.research_purpose,
                research_summary = EXCLUDED.research_summary,
                orcid = EXCLUDED.orcid,
                ethics_reference = EXCLUDED.ethics_reference,
                project_approval_reference = EXCLUDED.project_approval_reference
            """,
            applicationId
        );

        seedApplicationEvent(applicationId, "APPLICATION_CREATED", "Professional access application started.", createdAt);
        seedApplicationEvent(applicationId, "EMAIL_VERIFIED", "Application email verified.", verifiedAt);
        seedApplicationEvent(applicationId, "SUBMITTED", "Professional access application submitted for review.", verifiedAt.plus(Duration.ofDays(1)));
        seedApplicationEvent(applicationId, "REVIEW_STARTED", "Application review started.", verifiedAt.plus(Duration.ofDays(3)));
        seedApplicationEvent(applicationId, "APPLICATION_APPROVED", "Professional access application approved.", interviewAt.plus(Duration.ofDays(1)));
        seedApplicationEvent(applicationId, "ACCOUNT_ACTIVATION_SENT", "Account activation instructions sent.", activatedAt.minus(Duration.ofHours(2)));
        seedApplicationEvent(applicationId, "ACCOUNT_ACTIVATED", "Professional account activated.", activatedAt);
    }

    private void seedApplicationEvent(
        UUID applicationId,
        String eventType,
        String message,
        Instant createdAt
    ) {
        jdbc.update(
            """
            INSERT INTO application_events (id, application_id, event_type, public_message, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (id) DO NOTHING
            """,
            UUID.nameUUIDFromBytes(("clinora-phase6-development:researcher-event:" + applicationId + ":" + eventType).getBytes(StandardCharsets.UTF_8)),
            applicationId,
            eventType,
            message,
            Timestamp.from(createdAt)
        );
    }

    private void upsertUser(
        String firstName,
        String lastName,
        String email,
        String passwordHash,
        Instant now
    ) {
        String normalized = emailNormalizer.normalize(email);
        UserAccount user = users.findByNormalizedEmail(normalized).orElse(null);
        if (user == null) {
            user = new UserAccount(
                firstName,
                lastName,
                email,
                normalized,
                passwordHash,
                UserRole.RESEARCHER,
                AccountStatus.ACTIVE,
                now
            );
            user.markEmailVerified(now);
        } else {
            user.changePasswordHash(passwordHash, now);
            user.updateName(firstName, lastName, now);
            if (user.getAccountStatus() != AccountStatus.ACTIVE) {
                user.reactivate(now);
            }
            if (user.getEmailVerifiedAt() == null) {
                user.markEmailVerified(now);
            }
        }
        users.save(user);
    }

    private void assertFixtureAccount(String email, String expectedRole) {
        if (!email.toLowerCase(Locale.ROOT).endsWith(TEST_DOMAIN)) {
            throw new IllegalStateException("Development fixture email must use @clinora.test");
        }
        String normalized = emailNormalizer.normalize(email);
        UserAccount user = users.findByNormalizedEmail(normalized).orElse(null);
        if (user != null && !expectedRole.equals(user.getRole().name())) {
            throw new IllegalStateException("Refusing to overwrite a non-fixture account for " + email);
        }
    }

    private static UUID id(String namespace, String purpose) {
        return UUID.nameUUIDFromBytes(
            ("clinora-phase6-development:" + namespace.toLowerCase(Locale.ROOT) + ":" + purpose)
                .getBytes(StandardCharsets.UTF_8)
        );
    }
}
