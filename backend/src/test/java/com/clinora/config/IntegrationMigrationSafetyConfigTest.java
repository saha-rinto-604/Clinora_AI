package com.clinora.config;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.Configuration;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import javax.sql.DataSource;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class IntegrationMigrationSafetyConfigTest {
    @Test void ordinaryProfilesCannotRunIntegrationMigrations() {
        var flyway = mock(Flyway.class);
        assertThrows(IllegalStateException.class, () -> new IntegrationMigrationSafetyConfig().isolatedIntegrationMigrations(new MockEnvironment()).migrate(flyway));
        verifyNoInteractions(flyway);
    }

    @Test void retainedDatabaseNameCannotRunMigrations() throws Exception {
        var fixture = fixture("clinora", false);
        assertThrows(IllegalStateException.class, () -> strategy().migrate(fixture.flyway));
        verify(fixture.flyway, never()).migrate();
    }

    @Test void cleanDisposableDatabaseCanMigrate() throws Exception {
        var fixture = fixture("clinora_integration_test", false);
        strategy().migrate(fixture.flyway);
        verify(fixture.flyway).migrate();
    }

    @Test void existingUnapprovedHistoryCannotMigrate() throws Exception {
        var fixture = fixture("clinora_integration_test", true);
        assertThrows(IllegalStateException.class, () -> strategy().migrate(fixture.flyway));
        verify(fixture.flyway, never()).migrate();
    }

    private org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy strategy() {
        var env = new MockEnvironment(); env.setActiveProfiles("integration-clean");
        return new IntegrationMigrationSafetyConfig().isolatedIntegrationMigrations(env);
    }

    private Fixture fixture(String name, boolean historyExists) throws Exception {
        var flyway=mock(Flyway.class); var config=mock(Configuration.class); var source=mock(DataSource.class);
        var connection=mock(Connection.class); var statement=mock(Statement.class);
        when(flyway.getConfiguration()).thenReturn(config); when(config.getDataSource()).thenReturn(source);
        when(source.getConnection()).thenReturn(connection); when(connection.createStatement()).thenReturn(statement);
        var database=mock(ResultSet.class); when(database.getString(1)).thenReturn(name);
        when(statement.executeQuery("SELECT current_database()")).thenReturn(database);
        var history=mock(ResultSet.class); when(history.getString(1)).thenReturn(historyExists ? "flyway_schema_history" : null);
        when(statement.executeQuery("SELECT to_regclass('public.flyway_schema_history')")).thenReturn(history);
        var marker=mock(ResultSet.class);
        when(statement.executeQuery("SELECT count(*) FROM flyway_schema_history WHERE success AND version='46' AND script='V46__research_access_and_consent_provenance.sql'")).thenReturn(marker);
        return new Fixture(flyway);
    }
    record Fixture(Flyway flyway) {}
}
