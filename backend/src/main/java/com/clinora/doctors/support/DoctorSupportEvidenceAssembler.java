package com.clinora.doctors.support;

import com.clinora.doctors.api.DoctorApiException;
import com.clinora.doctors.service.DoctorClinicalAccessService;
import com.clinora.patients.service.HealthRecordLabTaxonomy;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Builds the minimal, authorization-checked clinical truth supplied to Doctor support. */
@Service
public class DoctorSupportEvidenceAssembler {
    private static final Set<String> ELIGIBLE_VERIFICATION = Set.of(
        "PATIENT_CONFIRMED", "PATIENT_CORRECTED", "DOCTOR_VERIFIED"
    );

    private final DoctorClinicalAccessService access;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final DoctorSupportEvidenceScopeResolver scopeResolver;

    public DoctorSupportEvidenceAssembler(DoctorClinicalAccessService access, JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.access = access;
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.scopeResolver = new DoctorSupportEvidenceScopeResolver(jdbc, access);
    }

    public Assembly assemble(UUID doctorId, UUID appointmentId, DoctorSupportExecutionRequest request) {
        long authorizationStarted = System.nanoTime();
        var appointment = access.requireActiveOwnedAppointment(doctorId, appointmentId).appointment();
        var resolved = scopeResolver.resolve(doctorId, appointmentId, appointment.patientId(),
            request.currentReportId(), request.selectedReportIds(), request.selectedObservationIds());
        LinkedHashSet<UUID> reportIds = new LinkedHashSet<>(resolved.reportIds());
        boolean brief = request.taskIds().contains(DoctorSupportTask.BRIEF_PATIENT);
        boolean notesOnly = request.taskIds().stream().allMatch(task -> task == DoctorSupportTask.STRUCTURE_NOTES);
        // Notes structuring needs Doctor-authored text only. Scope validation above still rejects guessed IDs.
        if (notesOnly) reportIds.clear();
        if (reportIds.isEmpty() && !brief && !notesOnly) {
            throw new DoctorApiException(HttpStatus.BAD_REQUEST, "AUTHORIZED_EVIDENCE_REQUIRED",
                "Select authorized evidence before running clinical support.");
        }

        // Complete every access check before reading any clinical evidence so
        // authorization and evidence timings remain distinct and auditable.
        reportIds.forEach(reportId -> access.requireSharedReport(doctorId, appointmentId, reportId));
        long authorizationMs = elapsedMillis(authorizationStarted);
        long evidenceStarted = System.nanoTime();

        List<DoctorSupportEvidenceSnapshot.ReportEvidence> reports = new ArrayList<>();
        List<DoctorSupportEvidenceSnapshot.ObservationEvidence> observations = new ArrayList<>();
        for (UUID reportId : reportIds) {
            reports.add(loadReport(reportId));
            observations.addAll(loadObservations(reportId));
        }

        List<DoctorSupportExecutionResponse.CandidateReport> selectionCandidates = List.of();
        if (request.taskIds().contains(DoctorSupportTask.COMPARE_EVIDENCE) && reports.size() == 1) {
            var current = reports.getFirst();
            List<DoctorSupportExecutionResponse.CandidateReport> authorized = scopeResolver.comparisonCandidates(
                doctorId, appointmentId, appointment.patientId(), reportIds
            ).stream().filter(candidate -> candidate.reportType() != null
                && candidate.reportType().equals(current.reportType())).toList();
            List<DoctorSupportExecutionResponse.CandidateReport> eligible = current.clinicalDate() == null
                ? authorized
                : authorized.stream().filter(candidate -> candidate.clinicalDate().isBefore(current.clinicalDate())).toList();
            // Offer authorized choices, but never silently expand the resolved scope.
            selectionCandidates = current.clinicalDate() == null ? authorized : eligible;
        }

        Set<UUID> requestedObservationIds = notesOnly ? Set.of() : Set.copyOf(resolved.observationIds());
        if (!requestedObservationIds.isEmpty()) {
            observations = observations.stream()
                .filter(item -> requestedObservationIds.contains(item.observationId()))
                .toList();
            Set<UUID> found = observations.stream().map(DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId)
                .collect(java.util.stream.Collectors.toSet());
            if (!found.equals(requestedObservationIds)) {
                throw new DoctorApiException(HttpStatus.NOT_FOUND, "REPORT_OBSERVATION_NOT_AVAILABLE",
                    "That observation is not available for this appointment.");
            }
        }
        if (observations.isEmpty() && !brief && !notesOnly) {
            throw new DoctorApiException(HttpStatus.BAD_REQUEST, "VERIFIED_EVIDENCE_REQUIRED",
                "No verified observations are available in the selected reports.");
        }

        reports.sort(Comparator.comparing(DoctorSupportEvidenceSnapshot.ReportEvidence::reportId));
        observations = observations.stream()
            .sorted(Comparator.comparing(DoctorSupportEvidenceSnapshot.ObservationEvidence::reportId)
                .thenComparing(DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId))
            .toList();
        List<DoctorSupportEvidenceSnapshot.ComparisonFact> comparisons = comparisonFacts(reports, observations);
        DoctorSupportEvidenceSnapshot unhashed = new DoctorSupportEvidenceSnapshot("", reports, observations, comparisons);
        DoctorSupportEvidenceSnapshot snapshot = new DoctorSupportEvidenceSnapshot(
            sha256(unhashed), reports, observations, comparisons
        );
        AppointmentContext appointmentContext = appointmentContext(appointmentId);
        return new Assembly(
            snapshot, selectionCandidates, appointment.patientId(), appointmentContext,
            new AssemblyTimings(authorizationMs, elapsedMillis(evidenceStarted))
        );
    }

    private AppointmentContext appointmentContext(UUID appointmentId) {
        return jdbc.query(
            "SELECT reason_for_visit, scheduled_start, scheduled_end, booking_timezone FROM appointments WHERE id=?",
            (rs, rowNum) -> new AppointmentContext(rs.getString("reason_for_visit"),
                rs.getTimestamp("scheduled_start") == null ? null : rs.getTimestamp("scheduled_start").toInstant(),
                rs.getTimestamp("scheduled_end") == null ? null : rs.getTimestamp("scheduled_end").toInstant(),
                rs.getString("booking_timezone")), appointmentId
        ).stream().findFirst().orElseThrow();
    }

    private DoctorSupportEvidenceSnapshot.ReportEvidence loadReport(UUID reportId) {
        return jdbc.query(
            """
            SELECT r.id, r.report_type, r.report_date, r.sha256_checksum, r.version, er.id AS extraction_result_id
              FROM patient_medical_reports r
              JOIN LATERAL (
                    SELECT er.id
                      FROM medical_report_extraction_results er
                      JOIN medical_report_extraction_jobs ej ON ej.id = er.job_id
                        AND ej.report_id = r.id AND ej.patient_user_id = r.patient_user_id
                     WHERE er.report_id = r.id AND er.review_status = 'VERIFIED' AND ej.status = 'SUCCEEDED'
                     ORDER BY er.created_at DESC, er.id DESC LIMIT 1
              ) er ON TRUE
             WHERE r.id = ? AND r.archived_at IS NULL AND r.subject_type = 'SELF'
            """,
            (rs, rowNum) -> new DoctorSupportEvidenceSnapshot.ReportEvidence(
                rs.getObject("id", UUID.class), rs.getString("report_type"), rs.getObject("report_date", LocalDate.class),
                rs.getObject("report_date") == null ? "DATE_UNAVAILABLE" : "REPORT_DATE",
                rs.getObject("extraction_result_id", UUID.class), rs.getString("sha256_checksum"), rs.getLong("version")
            ), reportId
        ).stream().findFirst().orElseThrow(() -> new DoctorApiException(
            HttpStatus.BAD_REQUEST, "VERIFIED_EVIDENCE_REQUIRED", "The selected report has no verified evidence."
        ));
    }

    private List<DoctorSupportEvidenceSnapshot.ObservationEvidence> loadObservations(UUID reportId) {
        return jdbc.query(
            """
            WITH latest AS (
                SELECT er.id
                  FROM medical_report_extraction_results er
                  JOIN medical_report_extraction_jobs ej ON ej.id = er.job_id AND ej.report_id = er.report_id
                  JOIN patient_medical_reports r ON r.id = er.report_id AND r.patient_user_id = ej.patient_user_id
                 WHERE er.report_id = ? AND er.review_status = 'VERIFIED' AND ej.status = 'SUCCEEDED'
                 ORDER BY er.created_at DESC, er.id DESC LIMIT 1
            )
            SELECT o.* FROM medical_report_observations o JOIN latest l ON l.id = o.extraction_result_id
             WHERE o.verification_status IN ('PATIENT_CONFIRMED','PATIENT_CORRECTED','DOCTOR_VERIFIED')
             ORDER BY o.page_number, o.updated_at, o.id
            """, (rs, rowNum) -> observation(reportId, rs), reportId
        );
    }

    private DoctorSupportEvidenceSnapshot.ObservationEvidence observation(UUID reportId, ResultSet rs) throws SQLException {
        String verification = rs.getString("verification_status");
        if (!ELIGIBLE_VERIFICATION.contains(verification)) throw new IllegalStateException("Ineligible evidence escaped query.");
        String label = rs.getString("effective_label");
        var concept = HealthRecordLabTaxonomy.resolve(label, rs.getString("normalized_label"));
        BigDecimal numeric = rs.getBigDecimal("effective_numeric_value");
        String unit = rs.getString("effective_unit");
        var normalized = HealthRecordLabTaxonomy.normalizeNumeric(concept, numeric, unit);
        BigDecimal low = rs.getBigDecimal("reference_low");
        BigDecimal high = rs.getBigDecimal("reference_high");
        String text = rs.getString("effective_text_value");
        return new DoctorSupportEvidenceSnapshot.ObservationEvidence(
            rs.getObject("id", UUID.class), reportId, label, concept.code(),
            rs.getString("effective_value_type"), numeric, text,
            rs.getString("effective_comparator"), unit, low, high, rs.getString("reference_range_raw"),
            authoritativeStatus(numeric, low, high, rs.getString("derived_range_flag"), rs.getString("source_flag"), text),
            verification, normalized == null ? null : normalized.value(), normalized == null ? null : normalized.unit(),
            normalized == null ? null : normalized.comparisonKey()
        );
    }

    private static String rangeStatus(BigDecimal value, BigDecimal low, BigDecimal high, String derived, String source) {
        if (low != null && high != null && low.compareTo(high) > 0) return "REPORTED";
        if (value != null) {
            if (low != null && value.compareTo(low) < 0) return "LOW";
            if (high != null && value.compareTo(high) > 0) return "HIGH";
            if (low != null || high != null) return "IN_RANGE";
        }
        String flag = derived != null && !derived.isBlank() ? derived : source;
        if (flag == null) return "REPORTED";
        String upper = flag.toUpperCase(Locale.ROOT);
        if (upper.contains("ABOVE") || upper.matches(".*\\bHIGH\\b.*") || upper.equals("H")) return "HIGH";
        if (upper.contains("BELOW") || upper.matches(".*\\bLOW\\b.*") || upper.equals("L")) return "LOW";
        if (upper.contains("WITHIN") || upper.contains("NORMAL") || upper.contains("IN_RANGE")) return "IN_RANGE";
        return "REPORTED";
    }

    private static String authoritativeStatus(
        BigDecimal value, BigDecimal low, BigDecimal high, String derived, String source, String text
    ) {
        String range = rangeStatus(value, low, high, derived, source);
        if (!"REPORTED".equals(range)) return range;
        String normalized = text == null ? "" : text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
        if (Set.of("abnormal", "detected", "positive", "present", "reactive").contains(normalized)) return "POSITIVE";
        if (Set.of("absent", "negative", "non reactive", "nonreactive", "not detected").contains(normalized)) return "NEGATIVE";
        return "REPORTED";
    }

    private static List<DoctorSupportEvidenceSnapshot.ComparisonFact> comparisonFacts(
        List<DoctorSupportEvidenceSnapshot.ReportEvidence> reports,
        List<DoctorSupportEvidenceSnapshot.ObservationEvidence> observations
    ) {
        Map<UUID, LocalDate> dates = new HashMap<>();
        reports.forEach(report -> dates.put(report.reportId(), report.clinicalDate()));
        Map<UUID, String> types = new HashMap<>();
        reports.forEach(report -> types.put(report.reportId(), report.reportType()));
        Map<String, List<DoctorSupportEvidenceSnapshot.ObservationEvidence>> groups = new HashMap<>();
        observations.stream().filter(item -> item.normalizedNumericValue() != null && dates.get(item.reportId()) != null
                && (item.comparator() == null || item.comparator().isBlank() || "=".equals(item.comparator())))
            .forEach(item -> groups.computeIfAbsent(item.canonicalCode(), ignored -> new ArrayList<>()).add(item));
        List<DoctorSupportEvidenceSnapshot.ComparisonFact> facts = new ArrayList<>();
        for (var entry : groups.entrySet()) {
            Map<UUID, DoctorSupportEvidenceSnapshot.ObservationEvidence> byReport = new HashMap<>();
            entry.getValue().forEach(item -> byReport.putIfAbsent(item.reportId(), item));
            List<DoctorSupportEvidenceSnapshot.ObservationEvidence> values = byReport.values().stream()
                .sorted(Comparator.comparing((DoctorSupportEvidenceSnapshot.ObservationEvidence item) -> dates.get(item.reportId()))
                    .thenComparing(DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId)).toList();
            // Multiple possible pairs or duplicate analytes are ambiguous; never choose arbitrary endpoints.
            if (values.size() != 2 || entry.getValue().size() != 2) continue;
            var earlier = values.getFirst();
            var later = values.getLast();
            String type = types.get(earlier.reportId());
            if (type == null || type.isBlank() || !type.equals(types.get(later.reportId()))) continue;
            if (!dates.get(earlier.reportId()).isBefore(dates.get(later.reportId()))) continue;
            if (!java.util.Objects.equals(earlier.comparisonKey(), later.comparisonKey())) continue;
            int order = later.normalizedNumericValue().compareTo(earlier.normalizedNumericValue());
            facts.add(new DoctorSupportEvidenceSnapshot.ComparisonFact(
                entry.getKey(), later.label(), earlier.observationId(), later.observationId(),
                dates.get(earlier.reportId()), dates.get(later.reportId()), earlier.normalizedNumericValue(),
                later.normalizedNumericValue(), later.normalizedUnit(), order > 0 ? "INCREASED" : order < 0 ? "DECREASED" : "UNCHANGED"
            ));
        }
        return facts.stream().sorted(Comparator.comparing(DoctorSupportEvidenceSnapshot.ComparisonFact::canonicalCode)).toList();
    }

    private String sha256(DoctorSupportEvidenceSnapshot snapshot) {
        try {
            byte[] canonical = objectMapper.writeValueAsString(snapshot).getBytes(StandardCharsets.UTF_8);
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical));
        } catch (JsonProcessingException | NoSuchAlgorithmException exc) {
            throw new IllegalStateException("Could not fingerprint the authorized evidence snapshot.", exc);
        }
    }

    private static long elapsedMillis(long startedNanos) {
        return Math.max(0, (System.nanoTime() - startedNanos) / 1_000_000);
    }

    public record Assembly(
        DoctorSupportEvidenceSnapshot snapshot,
        List<DoctorSupportExecutionResponse.CandidateReport> selectionCandidates,
        UUID patientId,
        AppointmentContext appointmentContext,
        AssemblyTimings timings
    ) {
        public Assembly(
            DoctorSupportEvidenceSnapshot snapshot,
            List<DoctorSupportExecutionResponse.CandidateReport> candidates,
            UUID patientId,
            AppointmentContext appointmentContext
        ) {
            this(snapshot, candidates, patientId, appointmentContext, new AssemblyTimings(0, 0));
        }

        public Assembly(DoctorSupportEvidenceSnapshot snapshot, List<DoctorSupportExecutionResponse.CandidateReport> candidates) {
            this(snapshot, candidates, null, new AppointmentContext(null, null, null, null), new AssemblyTimings(0, 0));
        }
    }
    public record AssemblyTimings(long authorizationMs, long evidenceMs) {}
    public record AppointmentContext(String reason, java.time.Instant scheduledStart, java.time.Instant scheduledEnd, String timezone) {}
}
