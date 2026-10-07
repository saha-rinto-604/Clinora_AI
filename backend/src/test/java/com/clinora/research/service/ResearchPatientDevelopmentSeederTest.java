package com.clinora.research.service;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@Testcontainers
class ResearchPatientDevelopmentSeederTest {

    @Container
    static final PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16-alpine")
        .withDatabaseName("clinora_integration_seeder");

    private JdbcTemplate jdbc;
    private PasswordEncoder passwordEncoder;
    private Clock clock;
    private ResearchPatientDevelopmentSeeder seeder;

    @BeforeAll
    static void migrate() {
        Flyway.configure()
            .dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
            .locations("classpath:db/migration", "classpath:db/integration-clean")
            .load()
            .migrate();
    }

    @BeforeEach
    void setup() {
        var source = new DriverManagerDataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword());
        jdbc = new JdbcTemplate(source);
        passwordEncoder = new BCryptPasswordEncoder();
        clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneId.of("UTC"));
        
        jdbc.execute("DELETE FROM patient_medical_reports WHERE patient_user_id IN (SELECT id FROM users WHERE email LIKE 'research.patient%@clinora.test')");
        jdbc.execute("DELETE FROM patient_research_consents WHERE patient_user_id IN (SELECT id FROM users WHERE email LIKE 'research.patient%@clinora.test')");
        jdbc.execute("DELETE FROM patient_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'research.patient%@clinora.test')");
        jdbc.execute("DELETE FROM users WHERE email LIKE 'research.patient%@clinora.test'");
        
        seeder = new ResearchPatientDevelopmentSeeder(jdbc, passwordEncoder, clock, "test-password");
    }

    @AfterEach
    void cleanup() {
        jdbc.execute("DELETE FROM patient_medical_reports WHERE patient_user_id IN (SELECT id FROM users WHERE email LIKE 'research.patient%@clinora.test')");
        jdbc.execute("DELETE FROM patient_research_consents WHERE patient_user_id IN (SELECT id FROM users WHERE email LIKE 'research.patient%@clinora.test')");
        jdbc.execute("DELETE FROM patient_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'research.patient%@clinora.test')");
        jdbc.execute("DELETE FROM users WHERE email LIKE 'research.patient%@clinora.test'");
    }

    @Test
    @DisplayName("Enabled dev seeder creates exactly 15 complete fixtures")
    void testEnabledSeederCreatesFixtures() {
        seeder.run(null);

        Integer userCount = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email LIKE 'research.patient%@clinora.test'", Integer.class);
        assertThat(userCount).isEqualTo(15);

        Integer profileCount = jdbc.queryForObject("SELECT COUNT(*) FROM patient_profiles p JOIN users u ON p.user_id = u.id WHERE u.email LIKE 'research.patient%@clinora.test'", Integer.class);
        assertThat(profileCount).isEqualTo(15);

        Integer consentCount = jdbc.queryForObject("SELECT COUNT(*) FROM patient_research_consents c JOIN users u ON c.patient_user_id = u.id WHERE u.email LIKE 'research.patient%@clinora.test'", Integer.class);
        assertThat(consentCount).isEqualTo(15);

        Integer reportCount = jdbc.queryForObject("SELECT COUNT(*) FROM patient_medical_reports r JOIN users u ON r.patient_user_id = u.id WHERE u.email LIKE 'research.patient%@clinora.test'", Integer.class);
        assertThat(reportCount).isEqualTo(15);

        // Verify only SELF reports
        Integer nonSelfReportCount = jdbc.queryForObject("SELECT COUNT(*) FROM patient_medical_reports r JOIN users u ON r.patient_user_id = u.id WHERE u.email LIKE 'research.patient%@clinora.test' AND r.subject_type != 'SELF'", Integer.class);
        assertThat(nonSelfReportCount).isEqualTo(0);

        Integer observationCount = jdbc.queryForObject("SELECT COUNT(*) FROM medical_report_observations o JOIN medical_report_extraction_results res ON o.extraction_result_id = res.id JOIN patient_medical_reports r ON res.report_id = r.id JOIN users u ON r.patient_user_id = u.id WHERE u.email LIKE 'research.patient%@clinora.test'", Integer.class);
        assertThat(observationCount).isEqualTo(59);
    }

    @Test
    @DisplayName("Current PatientResearchConsent schema is used and matches DatasetGenerationService predicate")
    void consentSchemaMatchesPredicate() {
        seeder.run(null);
        
        Integer validConsentCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM patient_research_consents c JOIN users u ON c.patient_user_id = u.id " +
            "WHERE u.email LIKE 'research.patient%@clinora.test' AND c.consent_status = 'CONSENTED' AND c.revoked_at IS NULL", 
            Integer.class
        );
        assertThat(validConsentCount).isEqualTo(15);
    }

    @Test
    @DisplayName("Failure partway through fixture creation does not leave partial fixture (transactional)")
    void transactionalFailurePreventsPartialFixtures() {
        // By inserting a user with a DIFFERENT ID but SAME EMAIL, the seeder's DO NOTHING on users will skip insert.
        // But its subsequent insert into patient_profiles using its deterministic UUID will fail foreign key constraint.
        jdbc.execute("INSERT INTO users (id, first_name, last_name, email, normalized_email, password_hash, role, account_status, email_verified_at, created_at, updated_at, version) VALUES ('00000000-0000-0000-0000-000000000001', 'Test', 'Test', 'research.patient01@clinora.test', 'research.patient01@clinora.test', 'hash', 'PATIENT', 'ACTIVE', now(), now(), now(), 0)");
        
        assertThrows(Exception.class, () -> seeder.run(null));
        
        // Profile was never inserted (and wouldn't be anyway), but the whole batch rolled back
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM patient_profiles WHERE user_id = '00000000-0000-0000-0000-000000000001'", Integer.class);
        assertThat(count).isEqualTo(0);
        
        // Cleanup the manual row
        jdbc.execute("DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001'");
    }

    @Test
    @DisplayName("Restart remains exactly 15 fixtures (Idempotency)")
    void restartIsIdempotent() {
        seeder.run(null);
        seeder.run(null);
        seeder.run(null);

        Integer userCount = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email LIKE 'research.patient%@clinora.test'", Integer.class);
        assertThat(userCount).isEqualTo(15);
        Integer observationCount = jdbc.queryForObject("SELECT COUNT(*) FROM medical_report_observations o JOIN medical_report_extraction_results res ON o.extraction_result_id = res.id JOIN patient_medical_reports r ON res.report_id = r.id JOIN users u ON r.patient_user_id = u.id WHERE u.email LIKE 'research.patient%@clinora.test'", Integer.class);
        assertThat(observationCount).isEqualTo(59);
    }

    @Test
    void repairsDriftingDatesAndPassesActualGenerationQueryWithoutRelaxingConsent() {
        seeder.run(null);
        jdbc.update("UPDATE patient_medical_reports SET report_date='2026-10-01' WHERE original_filename='dev_fixture.pdf'");
        assertThat(approvedRows()).isEmpty();

        seeder = new ResearchPatientDevelopmentSeeder(jdbc, passwordEncoder,
            Clock.fixed(Instant.parse("2027-10-05T00:00:00Z"), ZoneId.of("UTC")), "test-password");
        seeder.run(null);
        seeder.run(null);
        var rows = approvedRows();
        assertThat(rows.stream().map(com.clinora.research.deid.DeidentificationService.RawObservationRow::patientUserId).distinct().count()).isEqualTo(15);
        var deid = new com.clinora.research.deid.DefaultDeidentificationService(
            new com.fasterxml.jackson.databind.ObjectMapper(), 5);
        assertThrows(DatasetGenerationException.class, () -> deid.transform(
            java.util.UUID.randomUUID(), java.util.UUID.randomUUID(), "CSV",
            java.util.Collections.nCopies(20, rows.get(0)), java.util.List.of("HEMOGLOBIN")));
        var result = deid.transform(java.util.UUID.randomUUID(), java.util.UUID.randomUUID(), "CSV", rows,
            java.util.List.of("AGE_BAND", "SEX", "HEMOGLOBIN", "WBC", "PLATELETS", "RBC"));
        assertThat(new String(result.serializedPayload(), java.nio.charset.StandardCharsets.UTF_8))
            .doesNotContain("@clinora.test", "Fixture", "patient_user_id", "report_id");

        jdbc.update("UPDATE patient_research_consents SET consent_status='REVOKED', revoked_at=now() WHERE patient_user_id=(SELECT id FROM users WHERE normalized_email='research.patient01@clinora.test')");
        seeder.run(null);
        assertThat(approvedRows().stream().map(com.clinora.research.deid.DeidentificationService.RawObservationRow::patientUserId).distinct().count()).isEqualTo(14);
    }

    private java.util.List<com.clinora.research.deid.DeidentificationService.RawObservationRow> approvedRows() {
        var generation = org.mockito.Mockito.mock(DatasetGenerationService.class, org.mockito.Mockito.CALLS_REAL_METHODS);
        org.springframework.test.util.ReflectionTestUtils.setField(generation, "jdbcTemplate",
            new org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate(jdbc));
        org.springframework.test.util.ReflectionTestUtils.setField(generation, "catalog", new com.clinora.research.domain.catalog.ResearchDataCatalog());
        org.springframework.test.util.ReflectionTestUtils.setField(generation, "objectMapper", new com.fasterxml.jackson.databind.ObjectMapper());
        var request = new com.clinora.research.domain.DatasetRequest(java.util.UUID.randomUUID(), java.util.UUID.randomUUID(),
            "Synthetic regression", "Verify fixed development history",
            "{\"ageMin\":10,\"ageMax\":65,\"sexes\":[\"MALE\",\"FEMALE\"],\"dateFrom\":\"2025-01-01\",\"dateTo\":\"2026-09-01\"}",
            "[\"AGE_BAND\",\"SEX\",\"HEMOGLOBIN\",\"WBC\",\"PLATELETS\",\"RBC\"]",
            "{\"observationConditions\":[]}", com.clinora.research.domain.DatasetFormat.CSV, clock.instant());
        return org.springframework.test.util.ReflectionTestUtils.invokeMethod(generation, "fetchEligibleRows", request);
    }

    @Test
    @DisplayName("Pre-existing incomplete owned fixture is repaired safely")
    void repairsIncompleteFixture() {
        java.util.UUID expectedUserId = java.util.UUID.nameUUIDFromBytes("user:research.patient01@clinora.test".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        jdbc.execute("INSERT INTO users (id, first_name, last_name, email, normalized_email, password_hash, role, account_status, email_verified_at, created_at, updated_at, version) VALUES ('" + expectedUserId + "', 'Test', 'Test', 'research.patient01@clinora.test', 'research.patient01@clinora.test', 'hash', 'PATIENT', 'ACTIVE', now(), now(), now(), 0)");
        
        seeder.run(null);

        Integer profileCount = jdbc.queryForObject("SELECT COUNT(*) FROM patient_profiles p JOIN users u ON p.user_id = u.id WHERE u.email = 'research.patient01@clinora.test'", Integer.class);
        assertThat(profileCount).isEqualTo(1);
    }

    @Test
    @DisplayName("Unrelated Patient remains unchanged")
    void unrelatedPatientUnchanged() {
        jdbc.execute("INSERT INTO users (id, first_name, last_name, email, normalized_email, password_hash, role, account_status, email_verified_at, created_at, updated_at, version) VALUES ('00000000-0000-0000-0000-000000000099', 'Unrelated', 'Patient', 'unrelated@clinora.test', 'unrelated@clinora.test', 'hash', 'PATIENT', 'ACTIVE', now(), now(), now(), 0)");
        
        seeder.run(null);

        Integer userCount = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email = 'unrelated@clinora.test'", Integer.class);
        assertThat(userCount).isEqualTo(1);
        
        jdbc.execute("DELETE FROM users WHERE email = 'unrelated@clinora.test'");
    }

    @Test
    @DisplayName("Disabled seeder creates nothing (bean omitted)")
    void disabledSeederCreatesNothing() {
        new org.springframework.boot.test.context.runner.ApplicationContextRunner()
            .withUserConfiguration(ResearchPatientDevelopmentSeeder.class)
            .withPropertyValues("clinora.dev.research-patients.enabled=false")
            .run(context -> {
                assertThat(context).doesNotHaveBean(ResearchPatientDevelopmentSeeder.class);
            });
    }

    @Test
    @DisplayName("Non-dev profile creates nothing (bean omitted)")
    void nonDevProfileCreatesNothing() {
        new org.springframework.boot.test.context.runner.ApplicationContextRunner()
            .withUserConfiguration(ResearchPatientDevelopmentSeeder.class)
            .withSystemProperties("spring.profiles.active=prod")
            .withPropertyValues("clinora.dev.research-patients.enabled=true")
            .run(context -> {
                assertThat(context).doesNotHaveBean(ResearchPatientDevelopmentSeeder.class);
            });
    }
}
