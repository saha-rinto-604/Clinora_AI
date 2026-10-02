package com.clinora.config;

import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/** Explicitly prevents this unapproved convergence path from upgrading retained databases. */
@Configuration
public class IntegrationMigrationSafetyConfig {
    @Bean
    FlywayMigrationStrategy isolatedIntegrationMigrations(Environment environment) {
        return flyway -> {
            if (environment.matchesProfiles("retained-approved")) {
                flyway.migrate();
                return;
            }
            if (!environment.matchesProfiles("integration-clean")) {
                throw new IllegalStateException("Retained database upgrades await lineage review. Use integration-clean only with a disposable clinora_integration_ database.");
            }
            try (var connection = flyway.getConfiguration().getDataSource().getConnection();
                 var statement = connection.createStatement()) {
                try (var name = statement.executeQuery("SELECT current_database()")) {
                    name.next();
                    if (!name.getString(1).startsWith("clinora_integration_")) {
                        throw new IllegalStateException("Refusing migration: database is not an isolated clinora_integration_ database.");
                    }
                }
                try (var history = statement.executeQuery("SELECT to_regclass('public.flyway_schema_history')")) {
                    history.next();
                    if (history.getString(1) != null) {
                        try (var check = connection.createStatement();
                             var rows = check.executeQuery("SELECT count(*) FROM flyway_schema_history WHERE success AND version='46' AND script='V46__research_access_and_consent_provenance.sql'")) {
                            rows.next();
                            if (rows.getInt(1) != 1) throw new IllegalStateException("Existing database history is not the validated integration lineage; review required.");
                        }
                    }
                }
            } catch (java.sql.SQLException exception) {
                throw new IllegalStateException("Cannot verify isolated database identity", exception);
            }
            flyway.migrate();
        };
    }
}
