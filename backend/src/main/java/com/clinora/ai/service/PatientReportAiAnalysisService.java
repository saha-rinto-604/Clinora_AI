package com.clinora.ai.service;

import com.clinora.ai.client.MedGemmaClient;
import com.clinora.ai.client.MedGemmaClient.AnalysisInputSnapshot;
import com.clinora.ai.client.MedGemmaClient.ClinicalObservation;
import com.clinora.ai.client.MedGemmaClient.ReportAnalysisResponse;
import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.notifications.service.PatientNotificationService.NotificationCategory;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.service.PatientTimelineService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class PatientReportAiAnalysisService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PatientReportAiAnalysisService.class);
    private static final Set<String> ALLOWED_ANALYSIS_STATUSES = Set.of(
        "POSSIBLE_CLINICAL_PATTERN",
        "NO_CLEAR_ABNORMAL_PATTERN",
        "INSUFFICIENT_EVIDENCE"
    );
    private static final Set<String> ALLOWED_EVIDENCE_SUPPORT = Set.of("LIMITED", "MODERATE", "STRONG");
    private static final Set<String> ALLOWED_DISCUSSION_TYPES = Set.of("POSSIBLE_TEST", "CLINICAL_QUESTION", "FOLLOW_UP");
    private static final List<Pattern> PROHIBITED_PATIENT_OUTPUT = List.of(
        Pattern.compile("\\bstart taking\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\bstop taking\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\bchange your dose\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\btake \\d+(?:\\.\\d+)?\\s*(?:mg|mcg|g|ml)\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\bi prescribe\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\bthe diagnosis is\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\bdiagnosed with\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\bconfirmed diagnosis\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\bthis proves\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\byou (?:definitely|certainly) have\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile(
            "\\b(?:confidence|probability|likelihood)\\s*(?:is|of|:)?\\s*\\d{1,3}(?:\\.\\d+)?%",
            Pattern.CASE_INSENSITIVE
        ),
        Pattern.compile(
            "\\d{1,3}(?:\\.\\d+)?%\\s*(?:chance|probability|confidence|likelihood)",
            Pattern.CASE_INSENSITIVE
        )
    );

    private final JdbcTemplate jdbc;
    private final RabbitTemplate rabbit;
    private final PatientTimelineService timeline;
    private final PatientNotificationService notifications;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final String queueName;
    private final String modelName;
    private final String modelRevision;
    private final String promptVersion;
    private final String schemaVersion;
    private final long recoveryMinAgeSeconds;
    private final long processingTimeoutSeconds;

    public PatientReportAiAnalysisService(
        JdbcTemplate jdbc,
        RabbitTemplate rabbit,
        PatientTimelineService timeline,
        PatientNotificationService notifications,
        ObjectMapper objectMapper,
        ObjectProvider<Clock> clockProvider,
        @Value("${clinora.ai.queue:clinora.patient-report-ai-analysis}") String queueName,
        @Value("${clinora.ai.hf-model:google/medgemma-1.5-4b-it}") String modelName,
        @Value("${clinora.ai.model-revision:main}") String modelRevision,
        @Value("${clinora.ai.prompt-version:patient-lab-report-v1}") String promptVersion,
        @Value("${clinora.ai.schema-version:1.0}") String schemaVersion,
        @Value("${clinora.ai.recovery-min-age-seconds:15}") long recoveryMinAgeSeconds,
        @Value("${clinora.ai.processing-timeout-seconds:300}") long processingTimeoutSeconds
    ) {
        this.jdbc = jdbc;
        this.rabbit = rabbit;
        this.timeline = timeline;
        this.notifications = notifications;
        this.objectMapper = objectMapper;
        this.clock = clockProvider.getIfAvailable(Clock::systemUTC);
        this.queueName = queueName;
        this.modelName = fallback(modelName, "google/medgemma-1.5-4b-it");
        this.modelRevision = fallback(modelRevision, "main");
        this.promptVersion = fallback(promptVersion, "patient-lab-report-v1");
        this.schemaVersion = fallback(schemaVersion, "1.0");
        this.recoveryMinAgeSeconds = recoveryMinAgeSeconds;
        this.processingTimeoutSeconds = processingTimeoutSeconds;
    }

    @Transactional
    public AnalysisView request(UUID patientUserId, UUID reportId) {
        ReportRow report = requireOwnedReport(patientUserId, reportId);
        if (report.archivedAt() != null) {
            throw new PatientApiException(
                HttpStatus.CONFLICT,
                "REPORT_ARCHIVED",
                "Restore this report before generating a new AI insight."
            );
        }
        lockReport(reportId);
        AnalysisContext context = requireVerifiedContext(patientUserId, reportId, report.reportType());

        Optional<JobRow> reusable = reusableJob(patientUserId, reportId, context.fingerprint());
        if (reusable.isPresent()) {
            return viewForJob(reportId, context, reusable.get());
        }

        Optional<JobRow> active = activeJob(reportId);
        if (active.isPresent()) {
            return viewForJob(reportId, context, active.get());
        }

        Instant now = clock.instant();
        UUID jobId = UUID.randomUUID();
        jdbc.update(
            """
            INSERT INTO medical_report_ai_analysis_jobs (
                id, report_id, patient_user_id, extraction_result_id, input_fingerprint, input_snapshot,
                status, model_name, model_revision, prompt_version, schema_version,
                requested_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, CAST(? AS jsonb), 'QUEUED', ?, ?, ?, ?, ?, ?, ?)
            """,
            jobId,
            reportId,
            patientUserId,
            context.extractionResultId(),
            context.fingerprint(),
            json(context.input()),
            modelName,
            modelRevision,
            promptVersion,
            schemaVersion,
            Timestamp.from(now),
            Timestamp.from(now),
            Timestamp.from(now)
        );
        timeline.append(
            patientUserId,
            "REPORT_AI_ANALYSIS_REQUESTED",
            PatientTimelineService.TimelineCategory.REPORTS,
            "MEDICAL_REPORT",
            reportId,
            "AI report insight requested",
            "Clinora queued the verified report values for private AI-assisted interpretation.",
            now,
            "report-ai-analysis-requested:" + jobId
        );
        publishAfterCommit(jobId);
        return viewForJob(reportId, context, requireJob(jobId));
    }

    @Transactional(readOnly = true)
    public AnalysisView view(UUID patientUserId, UUID reportId) {
        ReportRow report = requireOwnedReport(patientUserId, reportId);
        Optional<AnalysisContext> context = verifiedContext(patientUserId, reportId, report.reportType());
        if (context.isEmpty()) {
            return AnalysisView.notReady(reportId, "REPORT_EXTRACTION_NOT_VERIFIED");
        }
        Optional<JobRow> currentInputJob = reusableJob(patientUserId, reportId, context.get().fingerprint());
        if (currentInputJob.isPresent()) {
            return viewForJob(reportId, context.get(), currentInputJob.get());
        }
        return latestJob(patientUserId, reportId)
            .map(job -> viewForJob(reportId, context.get(), job))
            .orElseGet(() -> AnalysisView.notRequested(reportId));
    }

    @Transactional
    public WorkItem claim(UUID jobId) {
        Instant now = clock.instant();
        int changed = jdbc.update(
            """
            UPDATE medical_report_ai_analysis_jobs
            SET status = 'PROCESSING', started_at = COALESCE(started_at, ?),
                attempt_count = attempt_count + 1, failure_code = NULL, updated_at = ?
            WHERE id = ? AND status = 'QUEUED'
            """,
            Timestamp.from(now),
            Timestamp.from(now),
            jobId
        );
        if (changed != 1) return null;

        return jdbc.query(
            """
            SELECT id, report_id, patient_user_id, extraction_result_id, input_snapshot::text AS input_snapshot,
                model_name, model_revision, prompt_version, schema_version
            FROM medical_report_ai_analysis_jobs
            WHERE id = ?
            """,
            (rs, rowNum) -> new WorkItem(
                rs.getObject("id", UUID.class),
                rs.getObject("report_id", UUID.class),
                rs.getObject("patient_user_id", UUID.class),
                rs.getObject("extraction_result_id", UUID.class),
                parseInput(rs.getString("input_snapshot")),
                rs.getString("model_name"),
                rs.getString("model_revision"),
                rs.getString("prompt_version"),
                rs.getString("schema_version")
            ),
            jobId
        ).stream().findFirst().orElse(null);
    }

    @Transactional
    public void complete(WorkItem work, ReportAnalysisResponse response) {
        JobRow job = requireJob(work.jobId());
        if (!job.status().equals("PROCESSING")) return;
        validateResponse(work, response);

        Instant now = clock.instant();
        UUID resultId = UUID.randomUUID();
        jdbc.update(
            """
            INSERT INTO medical_report_ai_analysis_results (
                id, job_id, report_id, patient_user_id, extraction_result_id,
                analysis_status, result_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?)
            """,
            resultId,
            work.jobId(),
            work.reportId(),
            work.patientUserId(),
            work.extractionResultId(),
            response.analysisStatus(),
            json(response),
            Timestamp.from(now)
        );
        jdbc.update(
            """
            UPDATE medical_report_ai_analysis_jobs
            SET status = 'SUCCEEDED', model_name = ?, model_revision = ?,
                completed_at = ?, updated_at = ?
            WHERE id = ? AND status = 'PROCESSING'
            """,
            fallback(response.modelName(), modelName),
            fallback(response.modelRevision(), modelRevision),
            Timestamp.from(now),
            Timestamp.from(now),
            work.jobId()
        );
        timeline.append(
            work.patientUserId(),
            "REPORT_AI_ANALYSIS_COMPLETED",
            PatientTimelineService.TimelineCategory.REPORTS,
            "MEDICAL_REPORT",
            work.reportId(),
            "AI report insight ready",
            "Clinora generated an AI-assisted interpretation from the verified report values.",
            now,
            "report-ai-analysis-completed:" + work.jobId()
        );
        notifications.create(
            work.patientUserId(),
            "REPORT_AI_ANALYSIS_READY",
            NotificationCategory.REPORTS,
            "Your AI report insight is ready",
            "Open Clinora to review the AI-assisted interpretation of your verified report values.",
            "REPORT_ANALYSIS",
            work.reportId(),
            "report-ai-analysis-ready:" + work.jobId()
        );
    }

    @Transactional
    public void fail(WorkItem work, String failureCode) {
        Instant now = clock.instant();
        int changed = jdbc.update(
            """
            UPDATE medical_report_ai_analysis_jobs
            SET status = 'FAILED', failure_code = ?, failed_at = ?, updated_at = ?
            WHERE id = ? AND status = 'PROCESSING'
            """,
            fallback(failureCode, "AI_PROCESSING_FAILED"),
            Timestamp.from(now),
            Timestamp.from(now),
            work.jobId()
        );
        if (changed != 1) return;
        timeline.append(
            work.patientUserId(),
            "REPORT_AI_ANALYSIS_FAILED",
            PatientTimelineService.TimelineCategory.REPORTS,
            "MEDICAL_REPORT",
            work.reportId(),
            "AI report insight unavailable",
            "AI processing could not be completed. Your report and verified values are unchanged.",
            now,
            "report-ai-analysis-failed:" + work.jobId()
        );
        notifications.create(
            work.patientUserId(),
            "REPORT_AI_ANALYSIS_FAILED",
            NotificationCategory.REPORTS,
            "AI report insight needs attention",
            "Clinora could not complete the AI analysis. Your report and verified values are unchanged.",
            "REPORT_ANALYSIS",
            work.reportId(),
            "report-ai-analysis-failed:" + work.jobId()
        );
    }

    @Scheduled(
        fixedDelayString = "${clinora.ai.recovery-delay-ms:30000}",
        initialDelayString = "${clinora.ai.recovery-initial-delay-ms:15000}"
    )
    public void recoverStaleQueuedJobs() {
        Instant cutoff = clock.instant().minusSeconds(Math.max(5L, recoveryMinAgeSeconds));
        List<UUID> jobIds = jdbc.query(
            """
            SELECT id FROM medical_report_ai_analysis_jobs
            WHERE status = 'QUEUED' AND requested_at <= ?
            ORDER BY requested_at ASC
            LIMIT 25
            """,
            (rs, rowNum) -> rs.getObject("id", UUID.class),
            Timestamp.from(cutoff)
        );
        jobIds.forEach(this::publishJob);
    }

    @Scheduled(
        fixedDelayString = "${clinora.ai.processing-recovery-delay-ms:30000}",
        initialDelayString = "${clinora.ai.processing-recovery-initial-delay-ms:90000}"
    )
    @Transactional
    public void failStaleProcessingJobs() {
        Instant now = clock.instant();
        Instant cutoff = now.minusSeconds(Math.max(180L, processingTimeoutSeconds));
        List<JobRow> jobs = jdbc.query(
            """
            SELECT id, report_id, patient_user_id, extraction_result_id, input_fingerprint, status,
                failure_code, model_name, model_revision, prompt_version, schema_version,
                requested_at, started_at, completed_at
            FROM medical_report_ai_analysis_jobs
            WHERE status = 'PROCESSING' AND started_at IS NOT NULL AND started_at <= ?
            ORDER BY started_at ASC
            LIMIT 25
            FOR UPDATE SKIP LOCKED
            """,
            (rs, rowNum) -> jobRow(rs),
            Timestamp.from(cutoff)
        );
        for (JobRow job : jobs) {
            int changed = jdbc.update(
                """
                UPDATE medical_report_ai_analysis_jobs
                SET status = 'FAILED', failure_code = 'AI_PROCESSING_INTERRUPTED', failed_at = ?, updated_at = ?
                WHERE id = ? AND status = 'PROCESSING'
                """,
                Timestamp.from(now),
                Timestamp.from(now),
                job.id()
            );
            if (changed != 1) continue;
            timeline.append(
                job.patientUserId(),
                "REPORT_AI_ANALYSIS_FAILED",
                PatientTimelineService.TimelineCategory.REPORTS,
                "MEDICAL_REPORT",
                job.reportId(),
                "AI report insight unavailable",
                "AI processing was interrupted. Your report and verified values are unchanged and can be analyzed again.",
                now,
                "report-ai-analysis-interrupted:" + job.id()
            );
            notifications.create(
                job.patientUserId(),
                "REPORT_AI_ANALYSIS_FAILED",
                NotificationCategory.REPORTS,
                "AI report insight needs attention",
                "Clinora could not complete the AI analysis. Your report and verified values are unchanged.",
                "REPORT_ANALYSIS",
                job.reportId(),
                "report-ai-analysis-interrupted:" + job.id()
            );
        }
    }

    private AnalysisView viewForJob(UUID reportId, AnalysisContext context, JobRow job) {
        boolean stale = !job.inputFingerprint().equals(context.fingerprint());
        AnalysisResultRow result = job.status().equals("SUCCEEDED") ? resultForJob(job.id()).orElse(null) : null;
        ReportAnalysisResponse response = result == null ? null : parseResponse(result.resultJson());
        return new AnalysisView(
            reportId,
            true,
            null,
            job.id(),
            job.status(),
            result == null ? null : result.id(),
            result == null ? null : result.analysisStatus(),
            stale,
            response,
            job.failureCode(),
            job.modelName(),
            job.modelRevision(),
            job.promptVersion(),
            job.schemaVersion(),
            job.requestedAt(),
            job.startedAt(),
            job.completedAt()
        );
    }

    private AnalysisContext requireVerifiedContext(UUID patientUserId, UUID reportId, String reportType) {
        return verifiedContext(patientUserId, reportId, reportType).orElseThrow(() -> new PatientApiException(
            HttpStatus.CONFLICT,
            "REPORT_EXTRACTION_NOT_VERIFIED",
            "Review and confirm the extracted report values before generating an AI insight."
        ));
    }

    private Optional<AnalysisContext> verifiedContext(UUID patientUserId, UUID reportId, String reportType) {
        Optional<VerifiedExtractionRow> extraction = jdbc.query(
            """
            SELECT er.id, er.document_type, er.review_status
            FROM medical_report_extraction_results er
            JOIN medical_report_extraction_jobs ej ON ej.id = er.job_id
            WHERE er.report_id = ? AND ej.patient_user_id = ?
              AND ej.status = 'SUCCEEDED'
            ORDER BY er.created_at DESC, er.id DESC
            LIMIT 1
            """,
            (rs, rowNum) -> new VerifiedExtractionRow(
                rs.getObject("id", UUID.class),
                rs.getString("document_type"),
                rs.getString("review_status")
            ),
            reportId,
            patientUserId
        ).stream().findFirst();
        if (extraction.isEmpty() || !"VERIFIED".equals(extraction.get().reviewStatus())) return Optional.empty();

        List<ClinicalObservation> observations = jdbc.query(
            """
            SELECT id, effective_label, effective_value_type, effective_numeric_value, effective_text_value,
                effective_comparator, effective_unit, reference_range_raw, reference_low, reference_high,
                source_flag, derived_range_flag
            FROM medical_report_observations
            WHERE extraction_result_id = ?
              AND verification_status IN ('PATIENT_CONFIRMED', 'PATIENT_CORRECTED', 'DOCTOR_VERIFIED')
            ORDER BY page_number, created_at, id
            """,
            (rs, rowNum) -> new ClinicalObservation(
                rs.getObject("id", UUID.class),
                rs.getString("effective_label"),
                rs.getString("effective_value_type"),
                rs.getBigDecimal("effective_numeric_value"),
                rs.getString("effective_text_value"),
                rs.getString("effective_comparator"),
                rs.getString("effective_unit"),
                rs.getString("reference_range_raw"),
                rs.getBigDecimal("reference_low"),
                rs.getBigDecimal("reference_high"),
                preferredRangeFlag(rs)
            ),
            extraction.get().id()
        );
        if (observations.isEmpty()) return Optional.empty();

        String clinicalReportType = fallback(extraction.get().documentType(), reportType);
        AnalysisInputSnapshot input = new AnalysisInputSnapshot(clinicalReportType, observations);
        String fingerprint = fingerprint(input);
        return Optional.of(new AnalysisContext(extraction.get().id(), input, fingerprint));
    }

    private String preferredRangeFlag(ResultSet rs) throws SQLException {
        String derived = rs.getString("derived_range_flag");
        return derived == null || derived.isBlank() ? rs.getString("source_flag") : derived;
    }

    private ReportRow requireOwnedReport(UUID patientUserId, UUID reportId) {
        requireActivePatient(patientUserId);
        return jdbc.query(
            "SELECT report_type, archived_at FROM patient_medical_reports WHERE id = ? AND patient_user_id = ?",
            (rs, rowNum) -> new ReportRow(rs.getString("report_type"), instant(rs, "archived_at")),
            reportId,
            patientUserId
        ).stream().findFirst().orElseThrow(() -> new PatientApiException(
            HttpStatus.NOT_FOUND,
            "REPORT_NOT_FOUND",
            "Medical report was not found."
        ));
    }

    private void requireActivePatient(UUID patientUserId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'PATIENT' AND account_status = 'ACTIVE' AND email_verified_at IS NOT NULL",
            Integer.class,
            patientUserId
        );
        if (count == null || count != 1) {
            throw new PatientApiException(
                HttpStatus.FORBIDDEN,
                "ACTIVE_PATIENT_REQUIRED",
                "An active Patient account is required."
            );
        }
    }

    private void lockReport(UUID reportId) {
        jdbc.queryForObject(
            "SELECT id FROM patient_medical_reports WHERE id = ? FOR UPDATE",
            UUID.class,
            reportId
        );
    }

    private Optional<JobRow> reusableJob(UUID patientUserId, UUID reportId, String fingerprint) {
        return jdbc.query(
            """
            SELECT id, report_id, patient_user_id, extraction_result_id, input_fingerprint, status,
                failure_code, model_name, model_revision, prompt_version, schema_version,
                requested_at, started_at, completed_at
            FROM medical_report_ai_analysis_jobs
            WHERE patient_user_id = ? AND report_id = ? AND input_fingerprint = ?
              AND status IN ('QUEUED', 'PROCESSING', 'SUCCEEDED')
            ORDER BY requested_at DESC, created_at DESC
            LIMIT 1
            """,
            (rs, rowNum) -> jobRow(rs),
            patientUserId,
            reportId,
            fingerprint
        ).stream().findFirst();
    }

    private Optional<JobRow> activeJob(UUID reportId) {
        return jdbc.query(
            """
            SELECT id, report_id, patient_user_id, extraction_result_id, input_fingerprint, status,
                failure_code, model_name, model_revision, prompt_version, schema_version,
                requested_at, started_at, completed_at
            FROM medical_report_ai_analysis_jobs
            WHERE report_id = ? AND status IN ('QUEUED', 'PROCESSING')
            ORDER BY requested_at DESC
            LIMIT 1
            """,
            (rs, rowNum) -> jobRow(rs),
            reportId
        ).stream().findFirst();
    }

    private Optional<JobRow> latestJob(UUID patientUserId, UUID reportId) {
        return jdbc.query(
            """
            SELECT id, report_id, patient_user_id, extraction_result_id, input_fingerprint, status,
                failure_code, model_name, model_revision, prompt_version, schema_version,
                requested_at, started_at, completed_at
            FROM medical_report_ai_analysis_jobs
            WHERE patient_user_id = ? AND report_id = ?
            ORDER BY requested_at DESC, created_at DESC
            LIMIT 1
            """,
            (rs, rowNum) -> jobRow(rs),
            patientUserId,
            reportId
        ).stream().findFirst();
    }

    private JobRow requireJob(UUID jobId) {
        return jdbc.query(
            """
            SELECT id, report_id, patient_user_id, extraction_result_id, input_fingerprint, status,
                failure_code, model_name, model_revision, prompt_version, schema_version,
                requested_at, started_at, completed_at
            FROM medical_report_ai_analysis_jobs
            WHERE id = ?
            """,
            (rs, rowNum) -> jobRow(rs),
            jobId
        ).stream().findFirst().orElseThrow(() -> new IllegalStateException("AI analysis job not found: " + jobId));
    }

    private JobRow jobRow(ResultSet rs) throws SQLException {
        return new JobRow(
            rs.getObject("id", UUID.class),
            rs.getObject("report_id", UUID.class),
            rs.getObject("patient_user_id", UUID.class),
            rs.getObject("extraction_result_id", UUID.class),
            rs.getString("input_fingerprint"),
            rs.getString("status"),
            rs.getString("failure_code"),
            rs.getString("model_name"),
            rs.getString("model_revision"),
            rs.getString("prompt_version"),
            rs.getString("schema_version"),
            instant(rs, "requested_at"),
            instant(rs, "started_at"),
            instant(rs, "completed_at")
        );
    }

    private Optional<AnalysisResultRow> resultForJob(UUID jobId) {
        return jdbc.query(
            """
            SELECT id, analysis_status, result_json::text AS result_json
            FROM medical_report_ai_analysis_results
            WHERE job_id = ?
            """,
            (rs, rowNum) -> new AnalysisResultRow(
                rs.getObject("id", UUID.class),
                rs.getString("analysis_status"),
                rs.getString("result_json")
            ),
            jobId
        ).stream().findFirst();
    }

    private void validateResponse(WorkItem work, ReportAnalysisResponse response) {
        if (response == null) {
            throw new IllegalStateException("AI service returned an empty response.");
        }
        if (response.analysisStatus() == null || !ALLOWED_ANALYSIS_STATUSES.contains(response.analysisStatus())) {
            throw new IllegalStateException("AI service returned an unsupported analysis status.");
        }
        if (!work.modelName().equals(response.modelName())
            || !work.modelRevision().equals(response.modelRevision())
            || !work.promptVersion().equals(response.promptVersion())
            || !work.schemaVersion().equals(response.schemaVersion())) {
            throw new IllegalStateException("AI service response provenance does not match the queued job.");
        }
        if (response.summary() == null || response.summary().isBlank()
            || response.patientExplanation() == null || response.patientExplanation().isBlank()) {
            throw new IllegalStateException("AI service response is missing required patient-facing content.");
        }
        if (response.analysisStatus().equals("POSSIBLE_CLINICAL_PATTERN") && response.clinicalPatterns().isEmpty()) {
            throw new IllegalStateException("AI service returned a pattern status without a clinical pattern.");
        }
        if (!response.analysisStatus().equals("POSSIBLE_CLINICAL_PATTERN") && !response.clinicalPatterns().isEmpty()) {
            throw new IllegalStateException("AI service returned clinical patterns for a non-pattern result.");
        }
        if (response.clinicalPatterns().stream().anyMatch(pattern -> !ALLOWED_EVIDENCE_SUPPORT.contains(pattern.supportLevel()))) {
            throw new IllegalStateException("AI service returned an unsupported evidence-support label.");
        }
        if (response.discussionPoints().stream().anyMatch(point -> !ALLOWED_DISCUSSION_TYPES.contains(point.type()))) {
            throw new IllegalStateException("AI service returned an unsupported discussion-point type.");
        }

        Set<UUID> allowed = work.input().observations().stream()
            .map(ClinicalObservation::observationId)
            .collect(Collectors.toUnmodifiableSet());
        if (response.notableFindings().stream().anyMatch(item -> !allowed.contains(item.observationId()))) {
            throw new IllegalStateException("AI service returned a finding that does not reference supplied evidence.");
        }
        boolean invalidPattern = response.clinicalPatterns().stream().anyMatch(pattern ->
            pattern.supportingObservationIds().isEmpty()
                || pattern.supportingObservationIds().stream().anyMatch(id -> !allowed.contains(id))
                || pattern.contradictoryObservationIds().stream().anyMatch(id -> !allowed.contains(id))
        );
        if (invalidPattern) {
            throw new IllegalStateException("AI service returned a clinical pattern with invalid evidence references.");
        }

        Stream<String> patientText = Stream.concat(
            Stream.of(response.summary(), response.patientExplanation()),
            Stream.concat(
                response.limitations().stream(),
                Stream.concat(
                    response.notableFindings().stream().flatMap(item -> Stream.of(item.title(), item.interpretation())),
                    Stream.concat(
                        response.clinicalPatterns().stream().flatMap(pattern -> Stream.concat(
                            Stream.of(pattern.name(), pattern.reasoning()),
                            Stream.concat(pattern.missingEvidence().stream(), pattern.possibleCauses().stream())
                        )),
                        response.discussionPoints().stream().flatMap(point -> Stream.of(point.title(), point.reason()))
                    )
                )
            )
        ).filter(value -> value != null && !value.isBlank());
        if (patientText.anyMatch(text -> PROHIBITED_PATIENT_OUTPUT.stream().anyMatch(pattern -> pattern.matcher(text).find()))) {
            throw new IllegalStateException("AI service response crossed the Phase 10P patient-safety boundary.");
        }
    }

    private AnalysisInputSnapshot parseInput(String inputJson) {
        try {
            return objectMapper.readValue(inputJson, AnalysisInputSnapshot.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not read queued AI analysis input.", exception);
        }
    }

    private ReportAnalysisResponse parseResponse(String responseJson) {
        try {
            return objectMapper.readValue(responseJson, ReportAnalysisResponse.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not read stored AI analysis output.", exception);
        }
    }

    private String fingerprint(AnalysisInputSnapshot input) {
        String canonical = json(input) + "\n" + modelName + "\n" + modelRevision + "\n" + promptVersion + "\n" + schemaVersion;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize AI analysis data.", exception);
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
                "Could not publish patient AI analysis job {}. A background recovery attempt will retry it.",
                jobId,
                exception
            );
        }
    }

    private static String fallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private record ReportRow(String reportType, Instant archivedAt) {
    }

    private record VerifiedExtractionRow(UUID id, String documentType, String reviewStatus) {
    }

    private record AnalysisContext(UUID extractionResultId, AnalysisInputSnapshot input, String fingerprint) {
    }

    private record JobRow(
        UUID id,
        UUID reportId,
        UUID patientUserId,
        UUID extractionResultId,
        String inputFingerprint,
        String status,
        String failureCode,
        String modelName,
        String modelRevision,
        String promptVersion,
        String schemaVersion,
        Instant requestedAt,
        Instant startedAt,
        Instant completedAt
    ) {
    }

    private record AnalysisResultRow(UUID id, String analysisStatus, String resultJson) {
    }

    public record WorkItem(
        UUID jobId,
        UUID reportId,
        UUID patientUserId,
        UUID extractionResultId,
        AnalysisInputSnapshot input,
        String modelName,
        String modelRevision,
        String promptVersion,
        String schemaVersion
    ) {
    }

    public record AnalysisView(
        UUID reportId,
        boolean readyForAnalysis,
        String readinessCode,
        UUID jobId,
        String status,
        UUID analysisId,
        String analysisStatus,
        boolean stale,
        ReportAnalysisResponse result,
        String failureCode,
        String modelName,
        String modelRevision,
        String promptVersion,
        String schemaVersion,
        Instant requestedAt,
        Instant startedAt,
        Instant completedAt
    ) {
        static AnalysisView notReady(UUID reportId, String readinessCode) {
            return new AnalysisView(
                reportId, false, readinessCode, null, "NOT_READY", null, null, false, null,
                null, null, null, null, null, null, null, null
            );
        }

        static AnalysisView notRequested(UUID reportId) {
            return new AnalysisView(
                reportId, true, null, null, "NOT_REQUESTED", null, null, false, null,
                null, null, null, null, null, null, null, null
            );
        }
    }
}
