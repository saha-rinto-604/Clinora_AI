package com.clinora.blood.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

class BloodNetworkDevSeederTest {
    private final ApplicationContextRunner context = new ApplicationContextRunner()
        .withBean(JdbcTemplate.class, () -> mock(JdbcTemplate.class))
        .withBean(PasswordEncoder.class, () -> mock(PasswordEncoder.class))
        .withUserConfiguration(BloodNetworkDevSeeder.class);

    @ParameterizedTest
    @ValueSource(strings = {"default", "test", "prod", "production", "dev,prod", "dev,production"})
    void neverRegistersOutsideDevelopmentOrAlongsideProduction(String profiles) {
        context.withPropertyValues("spring.profiles.active=" + profiles,
            "clinora.blood-network.demo-seed-enabled=true").run(c ->
                assertThat(c).doesNotHaveBean(BloodNetworkDevSeeder.class));
    }

    @Test
    void requiresExplicitSeedFlag() {
        context.withPropertyValues("spring.profiles.active=dev").run(c ->
            assertThat(c).doesNotHaveBean(BloodNetworkDevSeeder.class));
        context.withPropertyValues("spring.profiles.active=dev",
            "clinora.blood-network.demo-seed-enabled=true").run(c ->
                assertThat(c).hasSingleBean(BloodNetworkDevSeeder.class));
    }

    @Test
    void missingPasswordNeitherCreatesUsersNorDisablesLegacyAccounts() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        new BloodNetworkDevSeeder(jdbc, encoder, " ").run(new DefaultApplicationArguments());
        verifyNoInteractions(jdbc, encoder);
    }
}
