package com.clinora.blood.service;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("dev")
@ConditionalOnProperty(name = "clinora.blood-network.demo-seed-enabled", havingValue = "true")
public class BloodNetworkDevSeeder implements ApplicationRunner {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final String demoLoginPassword;

    public BloodNetworkDevSeeder(
        JdbcTemplate jdbc,
        PasswordEncoder passwordEncoder,
        @Value("${clinora.blood-network.demo-login-password:}") String demoLoginPassword
    ) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.demoLoginPassword = demoLoginPassword == null ? "" : demoLoginPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        Instant now = Instant.now();
        String unavailablePasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
        for (DemoPatient patient : demoPatients()) {
            seedPatient(patient, unavailablePasswordHash, now, false);
        }

        if (demoLoginPassword.isBlank()) {
            return;
        }
        String demoLoginPasswordHash = passwordEncoder.encode(demoLoginPassword);
        for (DemoPatient patient : loginPatients()) {
            seedPatient(patient, demoLoginPasswordHash, now, true);
        }
    }

    private void seedPatient(DemoPatient patient, String passwordHash, Instant now, boolean loginFixture) {
        if (loginFixture) {
            jdbc.update(
                """
                INSERT INTO users
                    (id, first_name, last_name, email, normalized_email, password_hash, role, account_status,
                     email_verified_at, created_at, updated_at, version)
                VALUES (?, ?, ?, ?, ?, ?, 'PATIENT', 'ACTIVE', ?, ?, ?, 0)
                ON CONFLICT (normalized_email) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    email = EXCLUDED.email,
                    password_hash = EXCLUDED.password_hash,
                    role = 'PATIENT',
                    account_status = 'ACTIVE',
                    email_verified_at = COALESCE(users.email_verified_at, EXCLUDED.email_verified_at),
                    updated_at = EXCLUDED.updated_at
                """,
                patient.userId(),
                patient.firstName(),
                patient.lastName(),
                patient.email(),
                patient.email().toLowerCase(),
                passwordHash,
                Timestamp.from(now),
                Timestamp.from(now),
                Timestamp.from(now)
            );
        } else {
            jdbc.update(
                """
                INSERT INTO users
                    (id, first_name, last_name, email, normalized_email, password_hash, role, account_status,
                     email_verified_at, created_at, updated_at, version)
                VALUES (?, ?, ?, ?, ?, ?, 'PATIENT', 'ACTIVE', ?, ?, ?, 0)
                ON CONFLICT (normalized_email) DO NOTHING
                """,
                patient.userId(),
                patient.firstName(),
                patient.lastName(),
                patient.email(),
                patient.email().toLowerCase(),
                passwordHash,
                Timestamp.from(now),
                Timestamp.from(now),
                Timestamp.from(now)
            );
        }
        jdbc.update(
            """
            INSERT INTO patient_profiles
                (id, user_id, date_of_birth, gender, blood_group, phone, address,
                 created_at, updated_at, version, latitude, longitude, geocoded_address,
                 geocoded_source_address, geocoded_at, blood_network_enabled, blood_network_available)
            SELECT ?, u.id, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, TRUE, TRUE
            FROM users u
            WHERE u.normalized_email = ?
            ON CONFLICT (user_id) DO UPDATE SET
                date_of_birth = EXCLUDED.date_of_birth,
                gender = EXCLUDED.gender,
                blood_group = EXCLUDED.blood_group,
                phone = EXCLUDED.phone,
                address = EXCLUDED.address,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                geocoded_address = EXCLUDED.geocoded_address,
                geocoded_source_address = EXCLUDED.geocoded_source_address,
                geocoded_at = EXCLUDED.geocoded_at,
                blood_network_enabled = TRUE,
                blood_network_available = TRUE,
                updated_at = EXCLUDED.updated_at
            """,
            patient.profileId(),
            Date.valueOf(patient.dateOfBirth()),
            patient.gender(),
            patient.bloodGroup(),
            patient.phone(),
            patient.address(),
            Timestamp.from(now),
            Timestamp.from(now),
            patient.latitude(),
            patient.longitude(),
            patient.address(),
            patient.address(),
            Timestamp.from(now),
            patient.email().toLowerCase()
        );
    }

    private List<DemoPatient> demoPatients() {
        return List.of(
            new DemoPatient(
                UUID.fromString("21000000-0000-0000-0000-000000000101"),
                UUID.fromString("22000000-0000-0000-0000-000000000101"),
                "Rahim", "Ahmed", "rahim.ahmed.demo@clinora.test", "+880 0000 000 101",
                "O_POSITIVE", "MALE", LocalDate.of(1996, 4, 12),
                "Ibrahimpur, Dhaka · Clinora demo", 23.7952, 90.3818
            ),
            new DemoPatient(
                UUID.fromString("21000000-0000-0000-0000-000000000102"),
                UUID.fromString("22000000-0000-0000-0000-000000000102"),
                "Nusrat", "Jahan", "nusrat.jahan.demo@clinora.test", "+880 0000 000 102",
                "O_POSITIVE", "FEMALE", LocalDate.of(1998, 9, 23),
                "Kafrul, Dhaka · Clinora demo", 23.8009, 90.3861
            ),
            new DemoPatient(
                UUID.fromString("21000000-0000-0000-0000-000000000103"),
                UUID.fromString("22000000-0000-0000-0000-000000000103"),
                "Tanvir", "Hasan", "tanvir.hasan.demo@clinora.test", "+880 0000 000 103",
                "A_POSITIVE", "MALE", LocalDate.of(1994, 1, 8),
                "Kazipara, Dhaka · Clinora demo", 23.7897, 90.3746
            ),
            new DemoPatient(
                UUID.fromString("21000000-0000-0000-0000-000000000104"),
                UUID.fromString("22000000-0000-0000-0000-000000000104"),
                "Sadia", "Islam", "sadia.islam.demo@clinora.test", "+880 0000 000 104",
                "B_POSITIVE", "FEMALE", LocalDate.of(1997, 6, 18),
                "Mirpur 14, Dhaka · Clinora demo", 23.8061, 90.3920
            ),
            new DemoPatient(
                UUID.fromString("21000000-0000-0000-0000-000000000105"),
                UUID.fromString("22000000-0000-0000-0000-000000000105"),
                "Farhan", "Kabir", "farhan.kabir.demo@clinora.test", "+880 0000 000 105",
                "O_POSITIVE", "MALE", LocalDate.of(1995, 11, 2),
                "Shewrapara, Dhaka · Clinora demo", 23.7835, 90.3677
            ),
            new DemoPatient(
                UUID.fromString("21000000-0000-0000-0000-000000000106"),
                UUID.fromString("22000000-0000-0000-0000-000000000106"),
                "Mim", "Akter", "mim.akter.demo@clinora.test", "+880 0000 000 106",
                "AB_POSITIVE", "FEMALE", LocalDate.of(1999, 3, 29),
                "ECB Chattar, Dhaka · Clinora demo", 23.8122, 90.3771
            ),
            new DemoPatient(
                UUID.fromString("21000000-0000-0000-0000-000000000107"),
                UUID.fromString("22000000-0000-0000-0000-000000000107"),
                "Arif", "Hossain", "arif.hossain.demo@clinora.test", "+880 0000 000 107",
                "A_NEGATIVE", "MALE", LocalDate.of(1993, 7, 14),
                "Mirpur 10, Dhaka · Clinora demo", 23.8067, 90.3697
            ),
            new DemoPatient(
                UUID.fromString("21000000-0000-0000-0000-000000000108"),
                UUID.fromString("22000000-0000-0000-0000-000000000108"),
                "Tania", "Rahman", "tania.rahman.demo@clinora.test", "+880 0000 000 108",
                "B_NEGATIVE", "FEMALE", LocalDate.of(1996, 12, 5),
                "Cantonment, Dhaka · Clinora demo", 23.8210, 90.3930
            )
        );
    }

    /** Login-capable synthetic fixtures. Coordinates are fixed dev data near 618/1 Ibrahimpur Road. */
    private List<DemoPatient> loginPatients() {
        return List.of(
            new DemoPatient(
                UUID.fromString("23000000-0000-0000-0000-000000000101"),
                UUID.fromString("24000000-0000-0000-0000-000000000101"),
                "Rahim", "Ahmed", "rahim.ahmed@clinora.test", "01700000011",
                "O_POSITIVE", "MALE", LocalDate.of(1996, 4, 12),
                "Ibrahimpur, Dhaka - Clinora dev fixture", 23.7952, 90.3818
            ),
            new DemoPatient(
                UUID.fromString("23000000-0000-0000-0000-000000000102"),
                UUID.fromString("24000000-0000-0000-0000-000000000102"),
                "Nusrat", "Jahan", "nusrat.jahan@clinora.test", "01700000012",
                "O_POSITIVE", "FEMALE", LocalDate.of(1998, 9, 23),
                "Kafrul, Dhaka - Clinora dev fixture", 23.8009, 90.3861
            ),
            new DemoPatient(
                UUID.fromString("23000000-0000-0000-0000-000000000103"),
                UUID.fromString("24000000-0000-0000-0000-000000000103"),
                "Tanvir", "Hasan", "tanvir.hasan@clinora.test", "01700000013",
                "A_POSITIVE", "MALE", LocalDate.of(1994, 1, 8),
                "Mirpur 14, Dhaka - Clinora dev fixture", 23.8061, 90.3920
            ),
            new DemoPatient(
                UUID.fromString("23000000-0000-0000-0000-000000000104"),
                UUID.fromString("24000000-0000-0000-0000-000000000104"),
                "Sadia", "Islam", "sadia.islam@clinora.test", "01700000014",
                "B_POSITIVE", "FEMALE", LocalDate.of(1997, 6, 18),
                "Shewrapara, Dhaka - Clinora dev fixture", 23.7835, 90.3677
            ),
            new DemoPatient(
                UUID.fromString("23000000-0000-0000-0000-000000000105"),
                UUID.fromString("24000000-0000-0000-0000-000000000105"),
                "Farhan", "Kabir", "farhan.kabir@clinora.test", "01700000015",
                "O_POSITIVE", "MALE", LocalDate.of(1995, 11, 2),
                "Cantonment/Kafrul area, Dhaka - Clinora dev fixture", 23.8122, 90.3930
            )
        );
    }

    private record DemoPatient(
        UUID userId,
        UUID profileId,
        String firstName,
        String lastName,
        String email,
        String phone,
        String bloodGroup,
        String gender,
        LocalDate dateOfBirth,
        String address,
        double latitude,
        double longitude
    ) {}
}
