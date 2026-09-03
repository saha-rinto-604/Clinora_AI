package com.clinora.patients.service;

import com.clinora.ocr.client.OcrClient.ExtractionResponse;
import com.clinora.ocr.client.OcrClient.Observation;
import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.notifications.service.PatientNotificationService.NotificationCategory;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.domain.PatientMedicalReport;
import com.clinora.patients.repository.PatientMedicalReportRepository;
import com.clinora.patients.storage.PatientReportStoragePort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class PatientReportExtractionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PatientReportExtractionService.class);

    private final JdbcTemplate jdbc;
    private final PatientMedicalReportRepository reportRepository;
    private final PatientReportStoragePort storage;
    private final RabbitTemplate rabbit;
    private final PatientTimelineService timeline;
    private final PatientNotificationService notifications;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final String queueName;
    private final long recoveryMinAgeSeconds;
    private final long processingTimeoutSeconds;

    public PatientReportExtractionService(
        JdbcTemplate jdbc,
        PatientMedicalReportRepository reportRepository,
        PatientReportStoragePort storage,
        RabbitTemplate rabbit,
        PatientTimelineService timeline,
        PatientNotificationService notifications,
        ObjectMapper objectMapper,
        Clock clock,
        @Value("${clinora.ocr.queue:clinora.patient-report-extraction}") String queueName,
        @Value("${clinora.ocr.recovery-min-age-seconds:15}") long recoveryMinAgeSeconds,
        @Value("${clinora.ocr.processing-timeout-seconds:600}") long processingTimeoutSeconds
    ) {
        this.jdbc = jdbc;
        this.reportRepository = reportRepository;
        this.storage = storage;
        this.rabbit = rabbit;
        this.timeline = timeline;
        this.notifications = notifications;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.queueName = queueName;
        this.recoveryMinAgeSeconds = recoveryMinAgeSeconds;
        this.processingTimeoutSeconds = processingTimeoutSeconds;
    }

    @Transactional
    public ExtractionView request(UUID patientUserId, UUID reportId) {
        PatientMedicalReport report = requireOwnedActiveReport(patientUserId, reportId);
        lockReport(reportId);
        Optional<JobRow> latest = latestJob(reportId);
        if (latest.isPresent()) {
            JobRow job = latest.get();
            boolean sameSource = report.getSha256Checksum().equals(job.sourceChecksum());
            if (sameSource && (job.status().equals("QUEUED") || job.status().equals("PROCESSING") || job.status().equals("SUCCEEDED"))) {
                return viewForJob(patientUserId, reportId, job);
            }
        }

        Instant now = clock.instant();
        UUID jobId = UUID.randomUUID();
        jdbc.update(
            """
            INSERT INTO medical_report_extraction_jobs (
                id, report_id, patient_user_id, source_checksum, status, pipeline_profile,
                requested_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'QUEUED', 'clinora-lab-v1', ?, ?, ?)
            """,
            jobId,
            reportId,
            patientUserId,
            report.getSha256Checksum(),
            Timestamp.from(now),
            Timestamp.from(now),
            Timestamp.from(now)
        );
        timeline.append(
            patientUserId,
            "REPORT_EXTRACTION_REQUESTED",
            PatientTimelineService.TimelineCategory.REPORTS,
            "MEDICAL_REPORT",
            reportId,
            "Report data extraction requested",
            "Clinora queued this report for secure information extraction.",
            now,
            "report-extraction-requested:" + jobId
        );
        publishAfterCommit(jobId);
        return viewForJob(patientUserId, reportId, requireJob(jobId));
    }

    @Transactional(readOnly = true)
    public ExtractionView view(UUID patientUserId, UUID reportId) {
        requireOwnedReport(patientUserId, reportId);
        return latestJob(reportId)
            .map(job -> viewForJob(patientUserId, reportId, job))
            .orElseGet(() -> ExtractionView.notRequested(reportId));
    }

    @Transactional
    public ExtractionView correct(
        UUID patientUserId,
        UUID reportId,
        UUID observationId,
        CorrectionCommand command
    ) {
        requireOwnedReport(patientUserId, reportId);
        ObservationRow previous = requireObservation(patientUserId, reportId, observationId);
        validateCorrection(command);
        Instant now = clock.instant();
        int nextVersion = jdbc.queryForObject(
            "SELECT COALESCE(MAX(correction_version), 0) + 1 FROM medical_report_observation_corrections WHERE observation_id = ?",
            Integer.class,
            observationId
        );
        String valueType = normalizedValueType(command.valueType());
        BigDecimal effectiveNumericValue = valueType.equals("NUMERIC") ? command.numericValue() : null;
        String effectiveTextValue = valueType.equals("NUMERIC") ? null : cleanNullable(command.textValue());
        String effectiveComparator = valueType.equals("NUMERIC") ? cleanNullable(command.comparator()) : null;
        String previousSnapshot = snapshot(previous);
        String correctedSnapshot = snapshot(command);
        jdbc.update(
            """
            INSERT INTO medical_report_observation_corrections (
                id, observation_id, patient_user_id, previous_snapshot, corrected_snapshot,
                correction_version, corrected_at
            ) VALUES (?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), ?, ?)
            """,
            UUID.randomUUID(), observationId, patientUserId, previousSnapshot, correctedSnapshot,
            nextVersion, Timestamp.from(now)
        );
        jdbc.update(
            """
            UPDATE medical_report_observations
            SET effective_label = ?, effective_value_type = ?, effective_numeric_value = ?, effective_text_value = ?,
                effective_comparator = ?, effective_unit = ?, reference_range_raw = ?,
                reference_low = ?, reference_high = ?, source_flag = ?, derived_range_flag = ?,
                review_required = FALSE, verification_status = 'PATIENT_CORRECTED', updated_at = ?
            WHERE id = ?
            """,
            clean(command.label()), valueType, effectiveNumericValue, effectiveTextValue,
            effectiveComparator, cleanNullable(command.unit()), cleanNullable(command.referenceRangeRaw()),
            command.referenceLow(), command.referenceHigh(), cleanNullable(command.sourceFlag()),
            deriveRangeFlag(effectiveNumericValue, command.referenceLow(), command.referenceHigh()),
            Timestamp.from(now), observationId
        );
        refreshReviewStatus(previous.resultId(), now);
        return view(patientUserId, reportId);
    }

    @Transactional
    public ExtractionView confirmObservation(UUID patientUserId, UUID reportId, UUID observationId) {
        requireOwnedReport(patientUserId, reportId);
        ObservationRow observation = requireObservation(patientUserId, reportId, observationId);
        if ("PATIENT_CONFIRMED".equals(observation.verificationStatus())) {
            return view(patientUserId, reportId);
        }
        if (!observation.reviewRequired() || !"UNREVIEWED".equals(observation.verificationStatus())) {
            throw new PatientApiException(
                HttpStatus.CONFLICT,
                "EXTRACTED_RESULT_REVIEW_NOT_REQUIRED",
                "This extracted value does not require Patient review."
            );
        }

        Instant now = clock.instant();
        int changed = jdbc.update(
            """
            UPDATE medical_report_observations
            SET review_required = FALSE, verification_status = 'PATIENT_CONFIRMED', updated_at = ?
            WHERE id = ? AND extraction_result_id = ?
              AND review_required = TRUE AND verification_status = 'UNREVIEWED'
            """,
            Timestamp.from(now), observationId, observation.resultId()
        );
        if (changed != 1) {
            throw new PatientApiException(
                HttpStatus.CONFLICT,
                "EXTRACTED_RESULT_ALREADY_REVIEWED",
                "This extracted value was already reviewed. Refresh the report and try again."
            );
        }
        refreshReviewStatus(observation.resultId(), now);
        return view(patientUserId, reportId);
    }

    @Transactional
    public ExtractionView confirm(UUID patientUserId, UUID reportId) {
        requireOwnedReport(patientUserId, reportId);
        JobRow job = latestJob(reportId).orElseThrow(() -> new PatientApiException(
            HttpStatus.CONFLICT,
            "REPORT_EXTRACTION_REQUIRED",
            "Extract the report data before confirming it."
        ));
        if (!job.status().equals("SUCCEEDED")) {
            throw new PatientApiException(HttpStatus.CONFLICT, "REPORT_EXTRACTION_NOT_READY", "Report extraction is not ready yet.");
        }
        ResultRow result = requireResult(job.id());
        Integer observationCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM medical_report_observations WHERE extraction_result_id = ?",
            Integer.class,
            result.id()
        );
        if (observationCount == null || observationCount == 0) {
            throw new PatientApiException(
                HttpStatus.CONFLICT,
                "NO_STRUCTURED_RESULTS",
                "Clinora did not find structured laboratory values to confirm in this report."
            );
        }
        Integer unresolved = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM medical_report_observations
            WHERE extraction_result_id = ? AND review_required = TRUE AND verification_status = 'UNREVIEWED'
            """,
            Integer.class,
            result.id()
        );
        if (unresolved != null && unresolved > 0) {
            throw new PatientApiException(
                HttpStatus.CONFLICT,
                "REPORT_EXTRACTION_REVIEW_REQUIRED",
                "Review the flagged extracted values before confirming this report."
            );
        }
        Instant now = clock.instant();
        jdbc.update(
            """
            UPDATE medical_report_observations
            SET verification_status = 'PATIENT_CONFIRMED', updated_at = ?
            WHERE extraction_result_id = ? AND verification_status = 'UNREVIEWED'
            """,
            Timestamp.from(now), result.id()
        );
        jdbc.update(
            """
            UPDATE medical_report_extraction_results
            SET review_status = 'VERIFIED', confirmed_at = ?, updated_at = ?
            WHERE id = ?
            """,
            Timestamp.from(now), Timestamp.from(now), result.id()
        );
        timeline.append(
            patientUserId,
            "REPORT_EXTRACTION_CONFIRMED",
            PatientTimelineService.TimelineCategory.REPORTS,
            "MEDICAL_REPORT",
            reportId,
            "Extracted report data reviewed",
            "The extracted values were reviewed and are ready for AI-assisted analysis.",
            now,
            "report-extraction-confirmed:" + result.id()
        );
        return view(patientUserId, reportId);
    }

    @Transactional
    public WorkItem claim(UUID jobId) {
        Instant now = clock.instant();
        int updated = jdbc.update(
            """
            UPDATE medical_report_extraction_jobs
            SET status = 'PROCESSING', started_at = COALESCE(started_at, ?),
                attempt_count = attempt_count + 1, failure_code = NULL, updated_at = ?
            WHERE id = ? AND status = 'QUEUED'
            """,
            Timestamp.from(now), Timestamp.from(now), jobId
        );
        if (updated != 1) return null;
        return jdbc.query(
            """
            SELECT j.id, j.report_id, j.patient_user_id, r.object_key, r.original_filename, r.mime_type
            FROM medical_report_extraction_jobs j
            JOIN patient_medical_reports r ON r.id = j.report_id
            WHERE j.id = ?
            """,
            (rs, rowNum) -> new WorkItem(
                rs.getObject("id", UUID.class),
                rs.getObject("report_id", UUID.class),
                rs.getObject("patient_user_id", UUID.class),
                rs.getString("object_key"),
                rs.getString("original_filename"),
                rs.getString("mime_type")
            ),
            jobId
        ).stream().findFirst().orElse(null);
    }

    public SourceObject source(WorkItem work) {
        PatientReportStoragePort.StoredObject stored = storage.get(work.objectKey());
        return new SourceObject(stored.bytes(), work.filename(), stored.contentType() == null ? work.mimeType() : stored.contentType());
    }

    @Transactional
    public void complete(WorkItem work, ExtractionResponse response) {
        JobRow job = requireJob(work.jobId());
        if (!job.status().equals("PROCESSING")) return;
        Instant now = clock.instant();
        UUID resultId = UUID.randomUUID();
        List<Observation> observations = response.observations() == null ? List.of() : response.observations();
        boolean needsReview = observations.stream().anyMatch(Observation::reviewRequired);
        String reviewStatus = needsReview ? "REVIEW_REQUIRED" : "READY_FOR_CONFIRMATION";
        jdbc.update(
            """
            INSERT INTO medical_report_extraction_results (
                id, job_id, report_id, document_type, page_count, overall_confidence,
                parser_version, normalizer_version, review_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            resultId, work.jobId(), work.reportId(), safe(response.documentType(), "MEDICAL_REPORT"),
            Math.max(1, response.pageCount()), response.overallConfidence(),
            safe(response.parserVersion(), "clinora-lab-parser-v1"),
            safe(response.normalizerVersion(), "clinora-lab-normalizer-v1"), reviewStatus,
            Timestamp.from(now), Timestamp.from(now)
        );
        for (Observation observation : observations) {
            insertObservation(resultId, observation, now);
        }
        jdbc.update(
            """
            UPDATE medical_report_extraction_jobs
            SET status = 'SUCCEEDED', engine = ?, engine_version = ?, completed_at = ?, updated_at = ?
            WHERE id = ?
            """,
            safe(response.engine(), "OCR"), safe(response.engineVersion(), "unknown"),
            Timestamp.from(now), Timestamp.from(now), work.jobId()
        );
        timeline.append(
            work.patientUserId(),
            "REPORT_EXTRACTION_COMPLETED",
            PatientTimelineService.TimelineCategory.REPORTS,
            "MEDICAL_REPORT",
            work.reportId(),
            needsReview ? "Report data ready for review" : "Report data extracted",
            needsReview
                ? "Some extracted values should be checked against the original report."
                : "Clinora organized the reported values for your review.",
            now,
            "report-extraction-completed:" + work.jobId()
        );
        notifications.create(
            work.patientUserId(),
            "REPORT_EXTRACTION_READY",
            NotificationCategory.REPORTS,
            needsReview ? "Report data needs your review" : "Report data is ready",
            needsReview
                ? "Some extracted values should be checked before AI-assisted analysis."
                : "Clinora organized the report data. Review and confirm the extracted values.",
            "REPORT_ANALYSIS",
            work.reportId(),
            "report-extraction-ready:" + work.jobId()
        );
    }

    @Transactional
    public void fail(WorkItem work, String failureCode) {
        Instant now = clock.instant();
        int changed = jdbc.update(
            """
            UPDATE medical_report_extraction_jobs
            SET status = 'FAILED', failure_code = ?, failed_at = ?, updated_at = ?
            WHERE id = ? AND status = 'PROCESSING'
            """,
            safe(failureCode, "PROCESSING_FAILED"), Timestamp.from(now), Timestamp.from(now), work.jobId()
        );
        if (changed != 1) return;
        timeline.append(
            work.patientUserId(),
            "REPORT_EXTRACTION_FAILED",
            PatientTimelineService.TimelineCategory.REPORTS,
            "MEDICAL_REPORT",
            work.reportId(),
            "Report data could not be extracted",
            "The original report is unchanged. You can try the extraction again.",
            now,
            "report-extraction-failed:" + work.jobId()
        );
        notifications.create(
            work.patientUserId(),
            "REPORT_EXTRACTION_FAILED",
            NotificationCategory.REPORTS,
            "Report analysis needs attention",
            "Clinora could not read this report reliably. The original report is unchanged.",
            "REPORT_ANALYSIS",
            work.reportId(),
            "report-extraction-failed:" + work.jobId()
        );
    }

    private void insertObservation(UUID resultId, Observation observation, Instant now) {
        UUID id = UUID.randomUUID();
        String sourceLabel = safe(observation.sourceLabel(), "Extracted result");
        String normalizedLabel = safe(observation.normalizedLabel(), sourceLabel);
        String valueType = safe(observation.valueType(), observation.numericValue() == null ? "TEXT" : "NUMERIC");
        String boxJson = observation.boundingBox() == null ? null : json(Map.of(
            "x", observation.boundingBox().x(),
            "y", observation.boundingBox().y(),
            "width", observation.boundingBox().width(),
            "height", observation.boundingBox().height()
        ));
        jdbc.update(
            """
            INSERT INTO medical_report_observations (
                id, extraction_result_id, source_label, normalized_label, effective_label, ocr_value_type, effective_value_type,
                ocr_numeric_value, ocr_text_value, ocr_comparator, ocr_unit,
                effective_numeric_value, effective_text_value, effective_comparator, effective_unit,
                reference_range_raw, reference_low, reference_high, source_flag, derived_range_flag,
                page_number, bounding_box_json, ocr_confidence, review_required, verification_status,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, 'UNREVIEWED', ?, ?)
            """,
            id, resultId, sourceLabel, normalizedLabel, normalizedLabel, valueType, valueType,
            observation.numericValue(), cleanNullable(observation.textValue()), cleanNullable(observation.comparator()), cleanNullable(observation.unit()),
            observation.numericValue(), cleanNullable(observation.textValue()), cleanNullable(observation.comparator()), cleanNullable(observation.unit()),
            cleanNullable(observation.referenceRangeRaw()), observation.referenceLow(), observation.referenceHigh(), cleanNullable(observation.sourceFlag()),
            cleanNullable(observation.derivedRangeFlag()), Math.max(1, observation.pageNumber()), boxJson,
            observation.confidence(), observation.reviewRequired(), Timestamp.from(now), Timestamp.from(now)
        );
    }

    private ExtractionView viewForJob(UUID patientUserId, UUID reportId, JobRow job) {
        if (!job.patientUserId().equals(patientUserId) || !job.reportId().equals(reportId)) {
            throw new PatientApiException(HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND", "Medical report was not found.");
        }
        if (!job.status().equals("SUCCEEDED")) {
            return new ExtractionView(
                reportId, job.id(), job.status(), null, null, null, null, null,
                List.of(), job.failureCode(), job.requestedAt(), job.startedAt(), job.completedAt()
            );
        }
        ResultRow result = requireResult(job.id());
        List<ObservationView> observations = jdbc.query(
            """
            SELECT id, source_label, effective_label, effective_value_type, effective_numeric_value,
                effective_text_value, effective_comparator, effective_unit, reference_range_raw,
                reference_low, reference_high, source_flag, derived_range_flag, page_number,
                bounding_box_json::text AS bounding_box_json, ocr_confidence, review_required,
                verification_status
            FROM medical_report_observations
            WHERE extraction_result_id = ?
            ORDER BY page_number, created_at, id
            """,
            (rs, rowNum) -> observationView(rs),
            result.id()
        );
        return new ExtractionView(
            reportId, job.id(), job.status(), result.id(), result.documentType(), result.pageCount(),
            result.overallConfidence(), result.reviewStatus(), List.copyOf(observations), null,
            job.requestedAt(), job.startedAt(), job.completedAt()
        );
    }

    private ObservationView observationView(ResultSet rs) throws SQLException {
        BoundingBoxView box = null;
        String rawBox = rs.getString("bounding_box_json");
        if (rawBox != null) {
            try {
                var node = objectMapper.readTree(rawBox);
                box = new BoundingBoxView(
                    node.path("x").asDouble(), node.path("y").asDouble(),
                    node.path("width").asDouble(), node.path("height").asDouble()
                );
            } catch (JsonProcessingException ignored) {
                box = null;
            }
        }
        return new ObservationView(
            rs.getObject("id", UUID.class), rs.getString("source_label"), rs.getString("effective_label"),
            rs.getString("effective_value_type"), rs.getBigDecimal("effective_numeric_value"), rs.getString("effective_text_value"),
            rs.getString("effective_comparator"), rs.getString("effective_unit"), rs.getString("reference_range_raw"),
            rs.getBigDecimal("reference_low"), rs.getBigDecimal("reference_high"), rs.getString("source_flag"),
            rs.getString("derived_range_flag"), rs.getInt("page_number"), box, rs.getBigDecimal("ocr_confidence"),
            rs.getBoolean("review_required"), rs.getString("verification_status")
        );
    }

    private void refreshReviewStatus(UUID resultId, Instant now) {
        Integer unresolved = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM medical_report_observations
            WHERE extraction_result_id = ? AND review_required = TRUE AND verification_status = 'UNREVIEWED'
            """,
            Integer.class,
            resultId
        );
        String status = unresolved != null && unresolved > 0 ? "REVIEW_REQUIRED" : "READY_FOR_CONFIRMATION";
        jdbc.update(
            "UPDATE medical_report_extraction_results SET review_status = ?, updated_at = ? WHERE id = ? AND review_status <> 'VERIFIED'",
            status, Timestamp.from(now), resultId
        );
    }

    private void validateCorrection(CorrectionCommand command) {
        if (command.label() == null || command.label().isBlank() || command.label().trim().length() > 160) {
            throw new PatientApiException(HttpStatus.BAD_REQUEST, "INVALID_EXTRACTION_CORRECTION", "Enter a valid test or result name.");
        }
        String valueType = normalizedValueType(command.valueType());
        if (valueType.equals("NUMERIC") && command.numericValue() == null) {
            throw new PatientApiException(HttpStatus.BAD_REQUEST, "INVALID_EXTRACTION_CORRECTION", "Enter the numeric value shown on the report.");
        }
        if (!valueType.equals("NUMERIC") && (command.textValue() == null || command.textValue().isBlank())) {
            throw new PatientApiException(HttpStatus.BAD_REQUEST, "INVALID_EXTRACTION_CORRECTION", "Enter the text value shown on the report.");
        }
        if (command.unit() != null && command.unit().trim().length() > 80) {
            throw new PatientApiException(HttpStatus.BAD_REQUEST, "INVALID_EXTRACTION_CORRECTION", "Use 80 characters or fewer for the unit.");
        }
        if (command.referenceLow() != null && command.referenceHigh() != null && command.referenceHigh().compareTo(command.referenceLow()) < 0) {
            throw new PatientApiException(HttpStatus.BAD_REQUEST, "INVALID_REFERENCE_RANGE", "The upper reference value must be greater than or equal to the lower value.");
        }
    }


    private void lockReport(UUID reportId) {
        jdbc.queryForObject(
            "SELECT id FROM patient_medical_reports WHERE id = ? FOR UPDATE",
            UUID.class,
            reportId
        );
    }

    private PatientMedicalReport requireOwnedActiveReport(UUID patientUserId, UUID reportId) {
        PatientMedicalReport report = requireOwnedReport(patientUserId, reportId);
        if (report.getArchivedAt() != null) {
            throw new PatientApiException(HttpStatus.CONFLICT, "REPORT_ARCHIVED", "Restore this report before extracting its data.");
        }
        return report;
    }

    private PatientMedicalReport requireOwnedReport(UUID patientUserId, UUID reportId) {
        requireActivePatient(patientUserId);
        return reportRepository.findByIdAndPatientUserId(reportId, patientUserId)
            .orElseThrow(() -> new PatientApiException(HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND", "Medical report was not found."));
    }

    private void requireActivePatient(UUID patientUserId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'PATIENT' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            patientUserId
        );
        if (count == null || count != 1) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "ACTIVE_PATIENT_REQUIRED", "An active Patient account is required.");
        }
    }

    private Optional<JobRow> latestJob(UUID reportId) {
        return jdbc.query(
            """
            SELECT id, report_id, patient_user_id, source_checksum, status, failure_code,
                requested_at, started_at, completed_at
            FROM medical_report_extraction_jobs
            WHERE report_id = ?
            ORDER BY requested_at DESC, created_at DESC
            LIMIT 1
            """,
            (rs, rowNum) -> jobRow(rs),
            reportId
        ).stream().findFirst();
    }

    private JobRow requireJob(UUID jobId) {
        return jdbc.query(
            """
            SELECT id, report_id, patient_user_id, source_checksum, status, failure_code,
                requested_at, started_at, completed_at
            FROM medical_report_extraction_jobs WHERE id = ?
            """,
            (rs, rowNum) -> jobRow(rs),
            jobId
        ).stream().findFirst().orElseThrow(() -> new IllegalStateException("OCR job not found: " + jobId));
    }

    private JobRow jobRow(ResultSet rs) throws SQLException {
        return new JobRow(
            rs.getObject("id", UUID.class), rs.getObject("report_id", UUID.class), rs.getObject("patient_user_id", UUID.class),
            rs.getString("source_checksum"), rs.getString("status"), rs.getString("failure_code"),
            instant(rs, "requested_at"), instant(rs, "started_at"), instant(rs, "completed_at")
        );
    }

    private ResultRow requireResult(UUID jobId) {
        return jdbc.query(
            """
            SELECT id, document_type, page_count, overall_confidence, review_status
            FROM medical_report_extraction_results WHERE job_id = ?
            """,
            (rs, rowNum) -> new ResultRow(
                rs.getObject("id", UUID.class), rs.getString("document_type"), rs.getInt("page_count"),
                rs.getBigDecimal("overall_confidence"), rs.getString("review_status")
            ),
            jobId
        ).stream().findFirst().orElseThrow(() -> new IllegalStateException("OCR result not found for job: " + jobId));
    }

    private ObservationRow requireObservation(UUID patientUserId, UUID reportId, UUID observationId) {
        return jdbc.query(
            """
            SELECT o.id, o.extraction_result_id, o.source_label, o.effective_label, o.effective_value_type,
                o.effective_numeric_value, o.effective_text_value, o.effective_comparator,
                o.effective_unit, o.reference_range_raw, o.reference_low, o.reference_high,
                o.source_flag, o.derived_range_flag, o.review_required, o.verification_status
            FROM medical_report_observations o
            JOIN medical_report_extraction_results r ON r.id = o.extraction_result_id
            JOIN medical_report_extraction_jobs j ON j.id = r.job_id
            WHERE o.id = ? AND r.report_id = ? AND j.patient_user_id = ?
            """,
            (rs, rowNum) -> new ObservationRow(
                rs.getObject("id", UUID.class), rs.getObject("extraction_result_id", UUID.class),
                rs.getString("source_label"), rs.getString("effective_label"), rs.getString("effective_value_type"),
                rs.getBigDecimal("effective_numeric_value"),
                rs.getString("effective_text_value"), rs.getString("effective_comparator"), rs.getString("effective_unit"),
                rs.getString("reference_range_raw"), rs.getBigDecimal("reference_low"), rs.getBigDecimal("reference_high"),
                rs.getString("source_flag"), rs.getString("derived_range_flag"),
                rs.getBoolean("review_required"), rs.getString("verification_status")
            ),
            observationId, reportId, patientUserId
        ).stream().findFirst().orElseThrow(() -> new PatientApiException(
            HttpStatus.NOT_FOUND, "EXTRACTED_RESULT_NOT_FOUND", "The extracted result was not found."
        ));
    }

    @Scheduled(
        fixedDelayString = "${clinora.ocr.recovery-delay-ms:30000}",
        initialDelayString = "${clinora.ocr.recovery-initial-delay-ms:15000}"
    )
    public void recoverStaleQueuedJobs() {
        Instant cutoff = clock.instant().minusSeconds(Math.max(5L, recoveryMinAgeSeconds));
        List<UUID> queuedJobIds = jdbc.query(
            """
            SELECT id FROM medical_report_extraction_jobs
            WHERE status = 'QUEUED' AND requested_at <= ?
            ORDER BY requested_at ASC
            LIMIT 25
            """,
            (rs, rowNum) -> rs.getObject("id", UUID.class),
            Timestamp.from(cutoff)
        );
        queuedJobIds.forEach(this::publishJob);
    }

    @Scheduled(
        fixedDelayString = "${clinora.ocr.processing-recovery-delay-ms:30000}",
        initialDelayString = "${clinora.ocr.processing-recovery-initial-delay-ms:60000}"
    )
    @Transactional
    public void failStaleProcessingJobs() {
        Instant now = clock.instant();
        Instant cutoff = now.minusSeconds(Math.max(180L, processingTimeoutSeconds));
        List<JobRow> staleJobs = jdbc.query(
            """
            SELECT id, report_id, patient_user_id, source_checksum, status, failure_code,
                requested_at, started_at, completed_at
            FROM medical_report_extraction_jobs
            WHERE status = 'PROCESSING' AND started_at IS NOT NULL AND started_at <= ?
            ORDER BY started_at ASC
            LIMIT 25
            FOR UPDATE SKIP LOCKED
            """,
            (rs, rowNum) -> jobRow(rs),
            Timestamp.from(cutoff)
        );
        for (JobRow job : staleJobs) {
            int changed = jdbc.update(
                """
                UPDATE medical_report_extraction_jobs
                SET status = 'FAILED', failure_code = 'PROCESSING_INTERRUPTED', failed_at = ?, updated_at = ?
                WHERE id = ? AND status = 'PROCESSING'
                """,
                Timestamp.from(now), Timestamp.from(now), job.id()
            );
            if (changed != 1) continue;
            timeline.append(
                job.patientUserId(),
                "REPORT_EXTRACTION_FAILED",
                PatientTimelineService.TimelineCategory.REPORTS,
                "MEDICAL_REPORT",
                job.reportId(),
                "Report data could not be extracted",
                "Processing was interrupted. The original report is unchanged and can be tried again.",
                now,
                "report-extraction-interrupted:" + job.id()
            );
            notifications.create(
                job.patientUserId(),
                "REPORT_EXTRACTION_FAILED",
                NotificationCategory.REPORTS,
                "Report analysis needs attention",
                "Report processing was interrupted. Your original report is unchanged and can be tried again.",
                "REPORT_ANALYSIS",
                job.reportId(),
                "report-extraction-interrupted:" + job.id()
            );
        }
    }

    private void publishAfterCommit(UUID jobId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            publishJob(jobId);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                publishJob(jobId);
            }
        });
    }

    private void publishJob(UUID jobId) {
        try {
            rabbit.convertAndSend(queueName, jobId.toString());
        } catch (RuntimeException exception) {
            LOGGER.warn(
                "Could not publish report extraction job {}. A background recovery attempt will retry it.",
                jobId,
                exception
            );
        }
    }

    private String snapshot(ObservationRow row) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("label", row.effectiveLabel());
        values.put("valueType", row.valueType());
        values.put("numericValue", row.numericValue());
        values.put("textValue", row.textValue());
        values.put("comparator", row.comparator());
        values.put("unit", row.unit());
        values.put("referenceRangeRaw", row.referenceRangeRaw());
        values.put("referenceLow", row.referenceLow());
        values.put("referenceHigh", row.referenceHigh());
        values.put("sourceFlag", row.sourceFlag());
        values.put("derivedRangeFlag", row.derivedRangeFlag());
        return json(values);
    }

    private String snapshot(CorrectionCommand command) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("label", clean(command.label()));
        values.put("valueType", normalizedValueType(command.valueType()));
        values.put("numericValue", command.numericValue());
        values.put("textValue", cleanNullable(command.textValue()));
        values.put("comparator", cleanNullable(command.comparator()));
        values.put("unit", cleanNullable(command.unit()));
        values.put("referenceRangeRaw", cleanNullable(command.referenceRangeRaw()));
        values.put("referenceLow", command.referenceLow());
        values.put("referenceHigh", command.referenceHigh());
        values.put("sourceFlag", cleanNullable(command.sourceFlag()));
        values.put("derivedRangeFlag", deriveRangeFlag(command.numericValue(), command.referenceLow(), command.referenceHigh()));
        return json(values);
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize extraction provenance.", exception);
        }
    }

    private String deriveRangeFlag(BigDecimal value, BigDecimal low, BigDecimal high) {
        if (value == null || (low == null && high == null)) return null;
        if (low != null && value.compareTo(low) < 0) return "BELOW_REPORTED_RANGE";
        if (high != null && value.compareTo(high) > 0) return "ABOVE_REPORTED_RANGE";
        return "WITHIN_REPORTED_RANGE";
    }

    private String normalizedValueType(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT);
        if (!normalized.equals("NUMERIC") && !normalized.equals("TEXT") && !normalized.equals("QUALITATIVE")) {
            throw new PatientApiException(
                HttpStatus.BAD_REQUEST,
                "INVALID_EXTRACTION_VALUE_TYPE",
                "Choose whether the extracted value is numeric or text."
            );
        }
        return normalized;
    }

    private String safe(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String cleanNullable(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private record JobRow(
        UUID id,
        UUID reportId,
        UUID patientUserId,
        String sourceChecksum,
        String status,
        String failureCode,
        Instant requestedAt,
        Instant startedAt,
        Instant completedAt
    ) {
    }

    private record ResultRow(UUID id, String documentType, int pageCount, BigDecimal overallConfidence, String reviewStatus) {
    }

    private record ObservationRow(
        UUID id,
        UUID resultId,
        String sourceLabel,
        String effectiveLabel,
        String valueType,
        BigDecimal numericValue,
        String textValue,
        String comparator,
        String unit,
        String referenceRangeRaw,
        BigDecimal referenceLow,
        BigDecimal referenceHigh,
        String sourceFlag,
        String derivedRangeFlag,
        boolean reviewRequired,
        String verificationStatus
    ) {
    }

    public record WorkItem(
        UUID jobId,
        UUID reportId,
        UUID patientUserId,
        String objectKey,
        String filename,
        String mimeType
    ) {
    }

    public record SourceObject(byte[] bytes, String filename, String contentType) {
    }

    public record CorrectionCommand(
        String label,
        String valueType,
        BigDecimal numericValue,
        String textValue,
        String comparator,
        String unit,
        String referenceRangeRaw,
        BigDecimal referenceLow,
        BigDecimal referenceHigh,
        String sourceFlag
    ) {
    }

    public record BoundingBoxView(double x, double y, double width, double height) {
    }

    public record ObservationView(
        UUID id,
        String sourceLabel,
        String label,
        String valueType,
        BigDecimal numericValue,
        String textValue,
        String comparator,
        String unit,
        String referenceRangeRaw,
        BigDecimal referenceLow,
        BigDecimal referenceHigh,
        String sourceFlag,
        String derivedRangeFlag,
        int pageNumber,
        BoundingBoxView boundingBox,
        BigDecimal confidence,
        boolean reviewRequired,
        String verificationStatus
    ) {
    }

    public record ExtractionView(
        UUID reportId,
        UUID jobId,
        String status,
        UUID resultId,
        String documentType,
        Integer pageCount,
        BigDecimal overallConfidence,
        String reviewStatus,
        List<ObservationView> observations,
        String failureCode,
        Instant requestedAt,
        Instant startedAt,
        Instant completedAt
    ) {
        static ExtractionView notRequested(UUID reportId) {
            return new ExtractionView(
                reportId, null, "NOT_REQUESTED", null, null, null, null, null,
                List.of(), null, null, null, null
            );
        }
    }
}
