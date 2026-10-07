package com.clinora.research.service;

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

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Component
@Profile("dev")
@ConditionalOnProperty(name = "clinora.dev.research.patients.enabled", havingValue = "true")
public class ResearchPatientDevelopmentSeeder implements ApplicationRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(ResearchPatientDevelopmentSeeder.class);
    // Stable synthetic history: restarting later must not move fixtures outside approved date windows.
    private static final LocalDate FIXTURE_REPORT_DATE = LocalDate.of(2026, 8, 1);

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final String defaultPassword;

    public ResearchPatientDevelopmentSeeder(
        JdbcTemplate jdbc,
        PasswordEncoder passwordEncoder,
        Clock clock,
        @Value("${clinora.dev.patient.password:password}") String defaultPassword
    ) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.defaultPassword = defaultPassword;
    }

    private record ResearchPatientFixture(
        int number,
        String firstName,
        String lastName,
        String email,
        LocalDate dob,
        String gender,
        List<String> variables
    ) {}

    private static final List<ResearchPatientFixture> FIXTURES = List.of(
        new ResearchPatientFixture(1, "Research", "Fixture 01", "research.patient01@clinora.test", LocalDate.of(1980, 1, 1), "FEMALE", List.of("HEMOGLOBIN", "WBC", "PLATELETS", "RBC", "HBA1C")),
        new ResearchPatientFixture(2, "Research", "Fixture 02", "research.patient02@clinora.test", LocalDate.of(1982, 2, 2), "MALE", List.of("HEMOGLOBIN", "WBC", "PLATELETS", "RBC")),
        new ResearchPatientFixture(3, "Research", "Fixture 03", "research.patient03@clinora.test", LocalDate.of(1984, 3, 3), "FEMALE", List.of("HEMOGLOBIN", "WBC", "RBC", "FASTING_GLUCOSE")),
        new ResearchPatientFixture(4, "Research", "Fixture 04", "research.patient04@clinora.test", LocalDate.of(1986, 4, 4), "MALE", List.of("HEMOGLOBIN", "PLATELETS", "RBC", "HBA1C")),
        new ResearchPatientFixture(5, "Research", "Fixture 05", "research.patient05@clinora.test", LocalDate.of(1988, 5, 5), "FEMALE", List.of("WBC", "PLATELETS", "RBC", "FASTING_GLUCOSE")),
        new ResearchPatientFixture(6, "Research", "Fixture 06", "research.patient06@clinora.test", LocalDate.of(1990, 6, 6), "MALE", List.of("HEMOGLOBIN", "WBC", "PLATELETS", "RBC")),
        new ResearchPatientFixture(7, "Research", "Fixture 07", "research.patient07@clinora.test", LocalDate.of(1992, 7, 7), "FEMALE", List.of("HEMOGLOBIN", "WBC", "RBC", "HBA1C")),
        new ResearchPatientFixture(8, "Research", "Fixture 08", "research.patient08@clinora.test", LocalDate.of(1994, 8, 8), "MALE", List.of("HEMOGLOBIN", "PLATELETS", "RBC", "FASTING_GLUCOSE")),
        new ResearchPatientFixture(9, "Research", "Fixture 09", "research.patient09@clinora.test", LocalDate.of(1996, 9, 9), "FEMALE", List.of("HEMOGLOBIN", "WBC", "PLATELETS", "RBC")),
        new ResearchPatientFixture(10, "Research", "Fixture 10", "research.patient10@clinora.test", LocalDate.of(1998, 10, 10), "MALE", List.of("HEMOGLOBIN", "WBC", "PLATELETS")),
        new ResearchPatientFixture(11, "Research", "Fixture 11", "research.patient11@clinora.test", LocalDate.of(2000, 11, 11), "FEMALE", List.of("HEMOGLOBIN", "WBC", "RBC")),
        new ResearchPatientFixture(12, "Research", "Fixture 12", "research.patient12@clinora.test", LocalDate.of(1975, 12, 12), "MALE", List.of("WBC", "PLATELETS", "RBC")),
        new ResearchPatientFixture(13, "Research", "Fixture 13", "research.patient13@clinora.test", LocalDate.of(1978, 1, 15), "FEMALE", List.of("HEMOGLOBIN", "WBC", "PLATELETS", "RBC", "HBA1C")),
        new ResearchPatientFixture(14, "Research", "Fixture 14", "research.patient14@clinora.test", LocalDate.of(1973, 2, 20), "MALE", List.of("HEMOGLOBIN", "WBC", "PLATELETS", "FASTING_GLUCOSE")),
        new ResearchPatientFixture(15, "Research", "Fixture 15", "research.patient15@clinora.test", LocalDate.of(1971, 3, 25), "FEMALE", List.of("HEMOGLOBIN", "WBC", "PLATELETS", "RBC"))
    );

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void run(ApplicationArguments args) {
        Instant now = clock.instant();
        String passwordHash = passwordEncoder.encode(defaultPassword);

        for (ResearchPatientFixture fixture : FIXTURES) {
            seedPatient(fixture, passwordHash, now);
        }

        LOGGER.info("Clinora Research Patient fixtures ready: {} verified Patient accounts seeded.", FIXTURES.size());
    }

    private void seedPatient(ResearchPatientFixture fixture, String passwordHash, Instant now) {
        UUID userId = id(fixture.email(), "user");
        UUID profileId = id(fixture.email(), "profile");
        UUID consentId = id(fixture.email(), "consent");
        UUID reportId = id(fixture.email(), "report");
        UUID resultId = id(fixture.email(), "result");
        UUID jobId = id(fixture.email(), "job");
        
        jdbc.update(
            """
            INSERT INTO users
                (id, first_name, last_name, email, normalized_email, password_hash, role, account_status,
                 email_verified_at, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, 'PATIENT', 'ACTIVE', ?, ?, ?, 0)
            ON CONFLICT (normalized_email) DO NOTHING
            """,
            userId, fixture.firstName(), fixture.lastName(), fixture.email(), fixture.email().toLowerCase(),
            passwordHash, Timestamp.from(now), Timestamp.from(now), Timestamp.from(now)
        );

        jdbc.update(
            """
            INSERT INTO patient_profiles
                (id, user_id, date_of_birth, gender, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, 0)
            ON CONFLICT (user_id) DO NOTHING
            """,
            profileId, userId, Date.valueOf(fixture.dob()), fixture.gender(),
            Timestamp.from(now), Timestamp.from(now)
        );

        jdbc.update(
            """
            INSERT INTO patient_research_consents
                (id, patient_user_id, consent_status, policy_version, consented_at, created_at, updated_at)
            VALUES (?, ?, 'CONSENTED', 'v1.0-2026', ?, ?, ?)
            ON CONFLICT (patient_user_id) DO NOTHING
            """,
            consentId, userId, Timestamp.from(now), Timestamp.from(now), Timestamp.from(now)
        );

        Date reportDate = Date.valueOf(FIXTURE_REPORT_DATE.minusDays(fixture.number() * 2L));
        jdbc.update(
            """
            INSERT INTO patient_medical_reports
                (id, patient_user_id, subject_type, report_date, report_name, report_type, object_key,
                 original_filename, mime_type, size_bytes, sha256_checksum, created_at, updated_at, version)
            VALUES (?, ?, 'SELF', ?, ?, 'LAB_RESULTS', ?, 'dev_fixture.pdf', 'application/pdf', 10240, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', ?, ?, 0)
            ON CONFLICT (id) DO UPDATE SET report_date = EXCLUDED.report_date
            WHERE patient_medical_reports.patient_user_id = EXCLUDED.patient_user_id
              AND patient_medical_reports.object_key = EXCLUDED.object_key
              AND patient_medical_reports.original_filename = 'dev_fixture.pdf'
              AND patient_medical_reports.subject_type = 'SELF'
              AND patient_medical_reports.archived_at IS NULL
              AND patient_medical_reports.report_date IS DISTINCT FROM EXCLUDED.report_date
            """,
            reportId, userId, reportDate,
            "Research Lab Report " + fixture.number(),
            "vault/dev/research_report_" + fixture.number() + ".pdf",
            Timestamp.from(now), Timestamp.from(now)
        );
        
        jdbc.update(
            """
            INSERT INTO medical_report_extraction_jobs
                (id, report_id, patient_user_id, source_checksum, status, pipeline_profile,
                 attempt_count, requested_at, created_at, updated_at)
            SELECT ?, ?, ?, 'dummy_checksum', 'SUCCEEDED', 'clinora-lab-v1', 1, ?, ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM medical_report_extraction_jobs WHERE id = ?)
            """,
            jobId, reportId, userId, Timestamp.from(now), Timestamp.from(now), Timestamp.from(now), jobId
        );

        jdbc.update(
            """
            INSERT INTO medical_report_extraction_results
                (id, job_id, report_id, document_type, page_count, parser_version, normalizer_version, review_status, created_at, updated_at)
            SELECT ?, ?, ?, 'LAB_REPORT', 1, 'v1', 'v1', 'VERIFIED', ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM medical_report_extraction_results WHERE id = ?)
            """,
            resultId, jobId, reportId, Timestamp.from(now), Timestamp.from(now), resultId
        );

        for (String var : fixture.variables()) {
            UUID obsId = id(fixture.email(), "obs-" + var);
            BigDecimal val = getSyntheticValue(var, fixture.number());
            String unit = getSyntheticUnit(var);
            jdbc.update(
                """
                INSERT INTO medical_report_observations
                    (id, extraction_result_id, source_label, normalized_label, effective_label,
                     ocr_value_type, effective_value_type, ocr_numeric_value, effective_numeric_value,
                     ocr_unit, effective_unit, page_number, verification_status, review_required, created_at, updated_at)
                SELECT ?, ?, ?, ?, ?, 'NUMERIC', 'NUMERIC', ?, ?, ?, ?, 1, 'DOCTOR_VERIFIED', false, ?, ?
                WHERE NOT EXISTS (SELECT 1 FROM medical_report_observations WHERE id = ?)
                """,
                obsId, resultId, var, var, var, val, val, unit, unit, Timestamp.from(now), Timestamp.from(now), obsId
            );
        }
    }

    private BigDecimal getSyntheticValue(String varCode, int offset) {
        return switch (varCode) {
            case "HEMOGLOBIN" -> new BigDecimal("12.0").add(new BigDecimal(offset).multiply(new BigDecimal("0.1")));
            case "WBC" -> new BigDecimal("5.0").add(new BigDecimal(offset).multiply(new BigDecimal("0.2")));
            case "PLATELETS" -> new BigDecimal("150").add(new BigDecimal(offset).multiply(new BigDecimal("10")));
            case "RBC" -> new BigDecimal("4.0").add(new BigDecimal(offset).multiply(new BigDecimal("0.05")));
            case "HBA1C" -> new BigDecimal("5.0").add(new BigDecimal(offset).multiply(new BigDecimal("0.1")));
            case "FASTING_GLUCOSE" -> new BigDecimal("90").add(new BigDecimal(offset).multiply(new BigDecimal("2")));
            default -> new BigDecimal("1.0");
        };
    }

    private String getSyntheticUnit(String varCode) {
        return switch (varCode) {
            case "HEMOGLOBIN" -> "g/dL";
            case "WBC", "PLATELETS" -> "10^9/L";
            case "RBC" -> "10^12/L";
            case "HBA1C" -> "%";
            case "FASTING_GLUCOSE" -> "mg/dL";
            default -> "";
        };
    }

    private UUID id(String email, String prefix) {
        return UUID.nameUUIDFromBytes((prefix + ":" + email).getBytes(StandardCharsets.UTF_8));
    }
}
