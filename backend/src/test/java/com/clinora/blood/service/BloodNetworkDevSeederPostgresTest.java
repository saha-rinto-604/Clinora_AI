package com.clinora.blood.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.patients.domain.BloodGroup;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class BloodNetworkDevSeederPostgresTest {
    @Container
    static final PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16-alpine");
    private JdbcTemplate jdbc;
    private TransactionTemplate tx;
    private BloodNetworkDevSeeder seeder;
    private BloodNetworkService service;
    private static final UUID RAHIM = UUID.fromString("23000000-0000-0000-0000-000000000101");
    private static final UUID NUSRAT = UUID.fromString("23000000-0000-0000-0000-000000000102");
    private static final UUID FARHAN = UUID.fromString("23000000-0000-0000-0000-000000000105");

    @BeforeAll
    static void migrate() {
        Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
            .locations("classpath:db/migration", "classpath:db/integration-clean").load().migrate();
    }

    @BeforeEach
    void setup() {
        var source = new DriverManagerDataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword());
        jdbc = new JdbcTemplate(source);
        tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        // Only this disposable test database is cleared.
        jdbc.execute("DELETE FROM patient_profiles");
        jdbc.execute("DELETE FROM users");
        seeder = new BloodNetworkDevSeeder(jdbc, new BCryptPasswordEncoder(4), UUID.randomUUID().toString());
        service = new BloodNetworkService(jdbc, mock(GoogleGeocodingService.class), mock(GoogleRoutesService.class),
            mock(PatientNotificationService.class), Clock.systemUTC());
    }

    @Test
    void threeRunsKeepExactlyFiveOriginalIdentitiesAndProfiles() {
        List<Map<String, Object>> originalIds = null;
        for (int run = 0; run < 3; run++) {
            seed();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class)).isEqualTo(5);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM patient_profiles", Integer.class)).isEqualTo(5);
            var ids = jdbc.queryForList("SELECT u.id, p.id AS profile_id FROM users u JOIN patient_profiles p ON p.user_id=u.id ORDER BY u.normalized_email");
            if (originalIds == null) originalIds = ids;
            assertThat(ids).isEqualTo(originalIds);
            assertThat(jdbc.queryForList("SELECT normalized_email FROM users ORDER BY normalized_email", String.class))
                .containsExactly("farhan.kabir@clinora.test", "nusrat.jahan@clinora.test", "rahim.ahmed@clinora.test",
                    "sadia.islam@clinora.test", "tanvir.hasan@clinora.test");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM patient_profiles WHERE blood_network_enabled AND blood_network_available AND latitude IS NOT NULL AND longitude IS NOT NULL", Integer.class)).isEqualTo(5);
        }
        assertThat(jdbc.queryForList("SELECT blood_group FROM patient_profiles p JOIN users u ON u.id=p.user_id ORDER BY u.normalized_email", String.class))
            .containsExactly("O_POSITIVE", "O_POSITIVE", "O_POSITIVE", "B_POSITIVE", "A_POSITIVE");
        assertThat(jdbc.queryForList("SELECT latitude::text || ',' || longitude::text FROM patient_profiles p JOIN users u ON u.id=p.user_id ORDER BY u.normalized_email", String.class))
            .containsExactly("23.8122,90.393", "23.8009,90.3861", "23.7952,90.3818", "23.7835,90.3677", "23.8061,90.392");
    }

    @Test
    void reusesExistingEmailAndProfileEvenWithDifferentIds() {
        UUID userId = UUID.randomUUID();
        UUID profileId = UUID.randomUUID();
        insertPatient(userId, profileId, "rahim.ahmed@clinora.test");
        seed();
        seed();
        assertThat(jdbc.queryForObject("SELECT id FROM users WHERE normalized_email='rahim.ahmed@clinora.test'", UUID.class)).isEqualTo(userId);
        assertThat(jdbc.queryForObject("SELECT id FROM patient_profiles WHERE user_id=?", UUID.class, userId)).isEqualTo(profileId);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class)).isEqualTo(5);
    }

    @Test
    void retiresOnlyProvenLegacyAliasesWithoutDeletingAccountsOrChangingOtherPatients() {
        UUID legacy = UUID.fromString("21000000-0000-0000-0000-000000000101");
        insertPatient(legacy, UUID.fromString("22000000-0000-0000-0000-000000000101"), "rahim.ahmed.demo@clinora.test");
        UUID other = UUID.randomUUID();
        insertPatient(other, UUID.randomUUID(), "unrelated@example.test");
        // A reserved-looking email alone is not sufficient to retire an account.
        UUID unprovenAlias = UUID.randomUUID();
        insertPatient(unprovenAlias, UUID.randomUUID(), "nusrat.jahan.demo@clinora.test");
        var before = jdbc.queryForList("SELECT row_to_json(u)::text AS account, row_to_json(p)::text AS profile FROM users u JOIN patient_profiles p ON p.user_id=u.id WHERE u.id IN (?,?) ORDER BY u.id", other, unprovenAlias);
        seed();
        seed();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class)).isEqualTo(8);
        assertThat(jdbc.queryForObject("SELECT blood_network_enabled OR blood_network_available FROM patient_profiles WHERE user_id=?", Boolean.class, legacy)).isFalse();
        assertThat(jdbc.queryForList("SELECT row_to_json(u)::text AS account, row_to_json(p)::text AS profile FROM users u JOIN patient_profiles p ON p.user_id=u.id WHERE u.id IN (?,?) ORDER BY u.id", other, unprovenAlias)).isEqualTo(before);
    }

    @Test
    void existingMatchingRespectsGroupRadiusAvailabilitySelfAndPrivacy() {
        seed();
        var matches = service.overview(RAHIM, BloodGroup.O_POSITIVE).nearbyPeople();
        assertThat(matches).extracting(BloodNetworkService.NearbyPersonView::userId).containsExactly(NUSRAT, FARHAN);
        assertThat(matches).allSatisfy(person -> {
            assertThat(person.phone()).isNull();
            assertThat(person.latitude()).isEqualTo(Math.round(person.latitude() * 1000.0) / 1000.0);
        });
        assertThat(service.overview(RAHIM, BloodGroup.A_POSITIVE).nearbyPeople()).hasSize(1);
        assertThat(service.overview(RAHIM, BloodGroup.B_POSITIVE).nearbyPeople()).hasSize(1);
        assertThat(service.overview(RAHIM, BloodGroup.O_NEGATIVE).nearbyPeople()).isEmpty();
        service.updatePreferences(NUSRAT, false, false);
        assertThat(service.overview(RAHIM, BloodGroup.O_POSITIVE).nearbyPeople()).extracting(BloodNetworkService.NearbyPersonView::userId).containsExactly(FARHAN);
        service.updatePreferences(NUSRAT, true, false);
        assertThat(service.overview(RAHIM, BloodGroup.O_POSITIVE).nearbyPeople()).hasSize(1);
        service.updatePreferences(NUSRAT, true, true);
        assertThat(service.overview(RAHIM, BloodGroup.O_POSITIVE).nearbyPeople()).hasSize(2);
        jdbc.update("UPDATE patient_profiles SET latitude=23.9 WHERE user_id=?", NUSRAT);
        assertThat(service.overview(RAHIM, BloodGroup.O_POSITIVE).nearbyPeople()).extracting(BloodNetworkService.NearbyPersonView::userId).containsExactly(FARHAN);
    }

    private void seed() {
        tx.executeWithoutResult(status -> seeder.run(new DefaultApplicationArguments()));
    }

    private void insertPatient(UUID userId, UUID profileId, String email) {
        jdbc.update("INSERT INTO users(id,first_name,last_name,email,normalized_email,password_hash,role,account_status,email_verified_at,created_at,updated_at) VALUES (?,'Existing','Patient',?,?,'not-a-login','PATIENT','ACTIVE',now(),now(),now())", userId, email, email);
        jdbc.update("INSERT INTO patient_profiles(id,user_id,blood_group,latitude,longitude,blood_network_enabled,blood_network_available,created_at,updated_at) VALUES (?,?,'O_POSITIVE',23.7952,90.3818,true,true,now(),now())", profileId, userId);
    }
}
