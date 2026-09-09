package com.clinora.blood.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.clinora.notifications.service.PatientNotificationService;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

class BloodNetworkServiceTest {

    @Test
    void distanceUsesGeographicCoordinatesRatherThanScreenDistance() {
        double meters = BloodNetworkService.distanceMeters(23.7952, 90.3818, 23.8009, 90.3861);
        assertThat(meters).isBetween(700.0, 900.0);
    }

    @Test
    void samePointHasZeroDistance() {
        assertThat(BloodNetworkService.distanceMeters(23.7952, 90.3818, 23.7952, 90.3818)).isZero();
    }

    @Test
    void everyNewMatchIsPersistedPendingWithoutResponseOrContactTimestamps() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        BloodNetworkService service = new BloodNetworkService(
            jdbc,
            mock(GoogleGeocodingService.class),
            mock(GoogleRoutesService.class),
            mock(PatientNotificationService.class),
            mock(Clock.class)
        );
        UUID requestId = UUID.randomUUID();
        UUID matchedPatientId = UUID.randomUUID();
        Instant notifiedAt = Instant.parse("2026-09-09T10:15:30Z");

        service.createPendingMatch(requestId, matchedPatientId, 812.6, notifiedAt);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> arguments = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(sql.capture(), arguments.capture());
        assertThat(sql.getValue())
            .contains("'PENDING'")
            .contains("NULL, NULL")
            .doesNotContain("'ACCEPTED'");
        assertThat(arguments.getValue())
            .containsExactly(
                arguments.getValue()[0],
                requestId,
                matchedPatientId,
                813,
                Timestamp.from(notifiedAt)
            );
        assertThat(arguments.getValue()[0]).isInstanceOf(UUID.class);
    }
}
