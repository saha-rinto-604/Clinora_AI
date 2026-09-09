package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.domain.PatientMedicalReport;
import com.clinora.patients.repository.PatientMedicalReportRepository;
import com.clinora.patients.service.PatientReportExtractionService.CorrectionCommand;
import com.clinora.patients.service.PatientReportExtractionService.ExtractionView;
import com.clinora.patients.storage.PatientReportStoragePort;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class PatientReportExtractionServiceTest {
    private static final UUID PATIENT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OTHER_PATIENT_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID REPORT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID JOB_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final UUID RESULT_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final UUID OBSERVATION_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
    private static final Instant NOW = Instant.parse("2026-09-02T08:00:00Z");

    @Test
    void confirmsFlaggedObservationWithoutChangingItsClinicalValue() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport();
        fixture.observation(true, "UNREVIEWED", new BigDecimal("8"));
        fixture.unresolvedCount(0);

        ExtractionView result = fixture.service.confirmObservation(PATIENT_ID, REPORT_ID, OBSERVATION_ID);

        assertEquals(fixture.view, result);
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(fixture.jdbc, atLeastOnce()).update(sql.capture(), any(Object[].class));
        String confirmationSql = sql.getAllValues().stream()
            .filter(value -> value.contains("verification_status = 'PATIENT_CONFIRMED'"))
            .findFirst()
            .orElseThrow();
        assertTrue(confirmationSql.contains("review_required = FALSE"));
        assertTrue(!confirmationSql.contains("effective_numeric_value"));
        verify(fixture.jdbc).update(
            contains("verification_status = 'PATIENT_CONFIRMED'"),
            any(Timestamp.class),
            eq(OBSERVATION_ID),
            eq(RESULT_ID)
        );
    }

    @Test
    void correctionKeepsHistoryAndResolvesReviewAsPatientCorrected() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport();
        fixture.observation(true, "UNREVIEWED", new BigDecimal("8"));
        fixture.unresolvedCount(0);
        when(fixture.jdbc.queryForObject(
            contains("medical_report_observation_corrections"),
            eq(Integer.class),
            eq(OBSERVATION_ID)
        )).thenReturn(1);

        fixture.service.correct(
            PATIENT_ID,
            REPORT_ID,
            OBSERVATION_ID,
            new CorrectionCommand("MPV", "NUMERIC", new BigDecimal("8.5"), null, null, "fL", null, null, null, null)
        );

        verify(fixture.jdbc).update(
            contains("INSERT INTO medical_report_observation_corrections"),
            any(Object[].class)
        );
        verify(fixture.jdbc).update(
            contains("verification_status = 'PATIENT_CORRECTED'"),
            any(Object[].class)
        );
    }

    @Test
    void finalConfirmationIsBlockedWhileAnyFlaggedObservationIsUnresolved() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport();
        fixture.latestSuccessfulExtraction();
        fixture.observationCount(2);
        fixture.unresolvedCount(1);

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> fixture.service.confirm(PATIENT_ID, REPORT_ID)
        );

        assertEquals("REPORT_EXTRACTION_REVIEW_REQUIRED", exception.getErrorCode());
        verify(fixture.jdbc, never()).update(contains("review_status = 'VERIFIED'"), any(Object[].class));
    }

    @Test
    void finalConfirmationVerifiesExtractionAfterAllRequiredReviewsAreResolved() throws Exception {
        Fixture fixture = new Fixture();
        fixture.ownedReport();
        fixture.latestSuccessfulExtraction();
        fixture.observationCount(2);
        fixture.unresolvedCount(0);

        ExtractionView result = fixture.service.confirm(PATIENT_ID, REPORT_ID);

        assertEquals(fixture.view, result);
        verify(fixture.jdbc).update(
            contains("SET verification_status = 'PATIENT_CONFIRMED'"),
            any(Object[].class)
        );
        verify(fixture.jdbc).update(contains("SET review_status = 'VERIFIED'"), any(Object[].class));
    }

    @Test
    void patientCannotReviewAnObservationFromAnotherPatientsReport() {
        Fixture fixture = new Fixture();
        fixture.activePatient();
        when(fixture.reports.findByIdAndPatientUserId(REPORT_ID, OTHER_PATIENT_ID)).thenReturn(Optional.empty());

        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> fixture.service.confirmObservation(OTHER_PATIENT_ID, REPORT_ID, OBSERVATION_ID)
        );

        assertEquals("REPORT_NOT_FOUND", exception.getErrorCode());
        verify(fixture.jdbc, never()).update(contains("PATIENT_CONFIRMED"), any(Object[].class));
    }

    private static final class Fixture {
        private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        private final PatientMedicalReportRepository reports = mock(PatientMedicalReportRepository.class);
        private final PatientTimelineService timeline = mock(PatientTimelineService.class);
        private final ExtractionView view = ExtractionView.notRequested(REPORT_ID);
        private final PatientReportExtractionService service;

        private Fixture() {
            PatientReportExtractionService target = new PatientReportExtractionService(
                jdbc,
                reports,
                mock(PatientReportStoragePort.class),
                mock(RabbitTemplate.class),
                timeline,
                mock(PatientNotificationService.class),
                new ObjectMapper(),
                Clock.fixed(NOW, ZoneOffset.UTC),
                "test-ocr-queue",
                15,
                600
            );
            service = spy(target);
            doReturn(view).when(service).view(PATIENT_ID, REPORT_ID);
            doReturn(view).when(service).view(OTHER_PATIENT_ID, REPORT_ID);
            when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        }

        private void activePatient() {
            when(jdbc.queryForObject(contains("FROM users"), eq(Integer.class), any(UUID.class))).thenReturn(1);
        }

        private void ownedReport() {
            activePatient();
            when(reports.findByIdAndPatientUserId(REPORT_ID, PATIENT_ID)).thenReturn(Optional.of(mock(PatientMedicalReport.class)));
        }

        private void observation(boolean reviewRequired, String verificationStatus, BigDecimal numericValue) throws Exception {
            when(jdbc.query(
                contains("FROM medical_report_observations o"),
                any(RowMapper.class),
                eq(OBSERVATION_ID),
                eq(REPORT_ID),
                eq(PATIENT_ID)
            )).thenAnswer(invocation -> {
                @SuppressWarnings("unchecked")
                RowMapper<Object> mapper = invocation.getArgument(1);
                ResultSet rs = mock(ResultSet.class);
                when(rs.getObject("id", UUID.class)).thenReturn(OBSERVATION_ID);
                when(rs.getObject("extraction_result_id", UUID.class)).thenReturn(RESULT_ID);
                when(rs.getString("source_label")).thenReturn("MPV");
                when(rs.getString("effective_label")).thenReturn("MPV");
                when(rs.getString("effective_value_type")).thenReturn("NUMERIC");
                when(rs.getBigDecimal("effective_numeric_value")).thenReturn(numericValue);
                when(rs.getString("effective_unit")).thenReturn("fL");
                when(rs.getBoolean("review_required")).thenReturn(reviewRequired);
                when(rs.getString("verification_status")).thenReturn(verificationStatus);
                return List.of(mapper.mapRow(rs, 0));
            });
        }

        private void unresolvedCount(int count) {
            when(jdbc.queryForObject(
                contains("review_required = TRUE AND verification_status = 'UNREVIEWED'"),
                eq(Integer.class),
                eq(RESULT_ID)
            )).thenReturn(count);
        }

        private void observationCount(int count) {
            when(jdbc.queryForObject(
                contains("COUNT(*) FROM medical_report_observations WHERE extraction_result_id"),
                eq(Integer.class),
                eq(RESULT_ID)
            )).thenReturn(count);
        }

        private void latestSuccessfulExtraction() throws Exception {
            when(jdbc.query(
                contains("FROM medical_report_extraction_jobs"),
                any(RowMapper.class),
                eq(REPORT_ID)
            )).thenAnswer(invocation -> {
                @SuppressWarnings("unchecked")
                RowMapper<Object> mapper = invocation.getArgument(1);
                ResultSet rs = mock(ResultSet.class);
                when(rs.getObject("id", UUID.class)).thenReturn(JOB_ID);
                when(rs.getObject("report_id", UUID.class)).thenReturn(REPORT_ID);
                when(rs.getObject("patient_user_id", UUID.class)).thenReturn(PATIENT_ID);
                when(rs.getString("source_checksum")).thenReturn("checksum");
                when(rs.getString("status")).thenReturn("SUCCEEDED");
                when(rs.getTimestamp("requested_at")).thenReturn(Timestamp.from(NOW));
                return List.of(mapper.mapRow(rs, 0));
            });
            when(jdbc.query(
                contains("FROM medical_report_extraction_results WHERE job_id"),
                any(RowMapper.class),
                eq(JOB_ID)
            )).thenAnswer(invocation -> {
                @SuppressWarnings("unchecked")
                RowMapper<Object> mapper = invocation.getArgument(1);
                ResultSet rs = mock(ResultSet.class);
                when(rs.getObject("id", UUID.class)).thenReturn(RESULT_ID);
                when(rs.getString("document_type")).thenReturn("LAB_REPORT");
                when(rs.getInt("page_count")).thenReturn(1);
                when(rs.getString("review_status")).thenReturn("READY_FOR_CONFIRMATION");
                return List.of(mapper.mapRow(rs, 0));
            });
        }
    }
}
