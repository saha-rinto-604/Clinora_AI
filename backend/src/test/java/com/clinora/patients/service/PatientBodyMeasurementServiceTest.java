package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class PatientBodyMeasurementServiceTest {
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PROFILE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final Instant NOW = Instant.parse("2026-08-31T08:00:00Z");

    @Test
    void unchangedMeasurementsCreateNoSnapshot() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        PatientBodyMeasurementService service = new PatientBodyMeasurementService(jdbc);

        boolean recorded = service.appendProfileSnapshotIfChanged(
            USER_ID, PROFILE_ID, decimal("165"), decimal("63"), decimal("165.0"), decimal("63.00"), NOW, "same"
        );

        assertFalse(recorded);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void heightAndWeightChangeCreateExactlyOneSnapshot() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        PatientBodyMeasurementService service = new PatientBodyMeasurementService(jdbc);

        boolean recorded = service.appendProfileSnapshotIfChanged(
            USER_ID, PROFILE_ID, decimal("164"), decimal("62"), decimal("165"), decimal("63"), NOW, "mutation-1"
        );

        assertTrue(recorded);
        verify(jdbc).update(anyString(), any(Object[].class));
    }

    @Test
    void weightRemovalWithRemainingHeightIsRecorded() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        PatientBodyMeasurementService service = new PatientBodyMeasurementService(jdbc);

        assertTrue(service.appendProfileSnapshotIfChanged(
            USER_ID, PROFILE_ID, decimal("165"), decimal("63"), decimal("165"), null, NOW, "weight-removed"
        ));
    }

    @Test
    void clearingAllMeasurementsDoesNotCreateAnInvalidEmptySnapshot() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        PatientBodyMeasurementService service = new PatientBodyMeasurementService(jdbc);

        assertFalse(service.appendProfileSnapshotIfChanged(
            USER_ID, PROFILE_ID, decimal("165"), decimal("63"), null, null, NOW, "all-removed"
        ));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void duplicateDeduplicationKeyIsReportedAsNotRecorded() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(0);
        PatientBodyMeasurementService service = new PatientBodyMeasurementService(jdbc);

        assertFalse(service.appendProfileSnapshotIfChanged(
            USER_ID, PROFILE_ID, decimal("165"), decimal("62"), decimal("165"), decimal("63"), NOW, "retry"
        ));
    }

    @Test
    void bmiUsesSnapshotHeightAndWeightAndRoundsToOneDecimal() {
        assertEquals(decimal("23.1"), PatientBodyMeasurementService.bmi(decimal("165"), decimal("63")));
        assertNull(PatientBodyMeasurementService.bmi(null, decimal("63")));
        assertNull(PatientBodyMeasurementService.bmi(decimal("20"), decimal("63")));
    }

    private static BigDecimal decimal(String value) {
        return new BigDecimal(value);
    }
}
