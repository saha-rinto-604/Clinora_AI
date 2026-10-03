package com.clinora.research.deid;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.Period;
import java.util.*;
import java.math.BigDecimal;

@Service
public class DefaultDeidentificationService implements DeidentificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(DefaultDeidentificationService.class);
    public static final String DEID_PROFILE_VERSION = "clinora-deid-v1";

    private final ObjectMapper objectMapper;
    private final int minCohortSize;
    private final String pseudonymSecret;

    @org.springframework.beans.factory.annotation.Autowired
    public DefaultDeidentificationService(
            ObjectMapper objectMapper,
            @Value("${clinora.research.min-cohort-size:5}") int minCohortSize,
            @Value("${clinora.research.pseudonym-secret:${CLINORA_RESEARCH_PSEUDONYM_SECRET:}}") String pseudonymSecret,
            org.springframework.core.env.Environment environment
    ) {
        this.objectMapper = objectMapper;
        boolean isDevOrTest = environment != null && (
                environment.acceptsProfiles(org.springframework.core.env.Profiles.of("test", "dev"))
        );
        this.minCohortSize = Math.max(5, minCohortSize);
        if (pseudonymSecret == null || pseudonymSecret.isBlank()) {
            if (isDevOrTest) {
                this.pseudonymSecret = "dev-only-clinora-research-pseudonym-secret-change-me";
            } else {
                throw new IllegalStateException("CLINORA_RESEARCH_PSEUDONYM_SECRET is required but not configured. Application startup aborted for security.");
            }
        } else {
            if (!isDevOrTest && (pseudonymSecret.length() < 32 || pseudonymSecret.contains("dev-only") || pseudonymSecret.contains("test-only") || pseudonymSecret.contains("change-me") || pseudonymSecret.contains("replace-with"))) {
                throw new IllegalStateException("A private research pseudonym secret of at least 32 characters is required.");
            }
            this.pseudonymSecret = pseudonymSecret;
        }
    }

    public DefaultDeidentificationService(
            ObjectMapper objectMapper,
            int minCohortSize,
            String pseudonymSecret
    ) {
        this.objectMapper = objectMapper;
        this.minCohortSize = minCohortSize;
        if (pseudonymSecret == null || pseudonymSecret.isBlank()) {
            throw new IllegalArgumentException("Pseudonym secret cannot be null or blank");
        }
        this.pseudonymSecret = pseudonymSecret;
    }

    public DefaultDeidentificationService(
            ObjectMapper objectMapper,
            int minCohortSize
    ) {
        this(objectMapper, minCohortSize, "test-only-deterministic-pseudonym-secret-key-material");
    }

    @Override
    public DeidentificationResult transform(
            UUID datasetRequestId,
            UUID projectId,
            String requestedFormat,
            List<RawObservationRow> rows,
            List<String> requestedVariables
    ) {
        if (rows == null || rows.isEmpty()) {
            throw new com.clinora.research.service.DatasetGenerationException("EMPTY_ELIGIBLE_COHORT", "No records satisfied all approved eligibility and consent requirements.");
        }

        Set<UUID> uniquePatients = new HashSet<>();
        for (RawObservationRow row : rows) {
            uniquePatients.add(row.patientUserId());
        }

        // Minimum cohort size privacy protection
        if (uniquePatients.size() < minCohortSize) {
            throw new com.clinora.research.service.DatasetGenerationException(
                    "MINIMUM_COHORT_NOT_MET",
                    "This request does not meet Clinora's minimum cohort requirement of " + minCohortSize + " subjects."
            );
        }

        // Deduplicate and fill missing requested variables to prepare for WIDE pivot
        List<String> reqVars = requestedVariables == null ? List.of() : requestedVariables;
        List<RawObservationRow> completeRows = new ArrayList<>();

        Map<UUID, List<RawObservationRow>> byPatient = new HashMap<>();
        for (RawObservationRow row : rows) {
            byPatient.computeIfAbsent(row.patientUserId(), k -> new ArrayList<>()).add(row);
        }

        for (Map.Entry<UUID, List<RawObservationRow>> entry : byPatient.entrySet()) {
            List<RawObservationRow> pRows = entry.getValue();

            // Demographic fallback: find base row (e.g., max reportDate)
            RawObservationRow baseRow = pRows.stream()
                .max(Comparator.comparing(RawObservationRow::reportDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(pRows.get(0));

            for (String rv : reqVars) {
                // Find latest observation for rv
                RawObservationRow bestVarRow = pRows.stream()
                    .filter(r -> rv.equals(r.variableCode()))
                    .max(Comparator
                        .comparing(RawObservationRow::reportDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing((r1, r2) -> {
                            BigDecimal v1 = r1.numericValue() == null ? BigDecimal.ZERO : r1.numericValue();
                            BigDecimal v2 = r2.numericValue() == null ? BigDecimal.ZERO : r2.numericValue();
                            return v1.compareTo(v2);
                        })
                    )
                    .orElse(null);

                if (bestVarRow != null) {
                    completeRows.add(bestVarRow);
                } else {
                    // Missing observation = null cell
                    completeRows.add(new RawObservationRow(
                            baseRow.patientUserId(), baseRow.dateOfBirth(), baseRow.gender(), baseRow.reportDate(),
                            rv, null, null, null, null, null
                    ));
                }
            }
            if (reqVars.isEmpty()) {
                completeRows.add(new RawObservationRow(
                        baseRow.patientUserId(), baseRow.dateOfBirth(), baseRow.gender(), baseRow.reportDate(),
                        null, null, null, null, null, null
                ));
            }
        }

        List<DeidentifiedRecord> deidentifiedRecords = new ArrayList<>(completeRows.size());

        for (RawObservationRow row : completeRows) {
            String subjectId = generateProjectScopedPseudonym(row.patientUserId(), projectId);
            String ageBand = computeAgeBand(row.dateOfBirth(), row.reportDate());
            String sex = row.gender() == null ? "UNKNOWN" : row.gender().toUpperCase(Locale.ROOT);
            String period = computeObservationPeriod(row.reportDate());

            String refRange = null;
            if (row.referenceLow() != null && row.referenceHigh() != null) {
                refRange = row.referenceLow() + " - " + row.referenceHigh();
            } else if (row.referenceLow() != null) {
                refRange = ">= " + row.referenceLow();
            } else if (row.referenceHigh() != null) {
                refRange = "<= " + row.referenceHigh();
            }

            deidentifiedRecords.add(new DeidentifiedRecord(
                    subjectId,
                    ageBand,
                    sex,
                    period,
                    row.variableCode(),
                    row.numericValue(),
                    row.unit(),
                    refRange,
                    row.flag()
            ));
        }

        String format = (requestedFormat == null || requestedFormat.isBlank()) ? "CSV" : requestedFormat.toUpperCase(Locale.ROOT);
        byte[] payload;

        if ("JSON".equals(format)) {
            payload = serializeToJson(deidentifiedRecords, reqVars);
        } else {
            // Default to CSV
            format = "CSV";
            payload = serializeToCsv(deidentifiedRecords, reqVars);
        }

        String checksum = computeSha256(payload);

        LOGGER.info("Successfully de-identified {} clinical records across {} subjects for dataset request {}",
                deidentifiedRecords.size(), uniquePatients.size(), datasetRequestId);

        return new DeidentificationResult(
                datasetRequestId,
                projectId,
                uniquePatients.size(),
                uniquePatients.size(),
                DEID_PROFILE_VERSION,
                deidentifiedRecords,
                payload,
                checksum,
                format
        );
    }

    @Override
    public String generateProjectScopedPseudonym(UUID patientUserId, UUID projectId) {
        try {
            // Step 1: Derive project-scoped HMAC key using server secret + project UUID as context
            Mac projectKeyDeriver = Mac.getInstance("HmacSHA256");
            projectKeyDeriver.init(new SecretKeySpec(pseudonymSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] projectKey = projectKeyDeriver.doFinal(projectId.toString().getBytes(StandardCharsets.UTF_8));

            // Step 2: Generate patient pseudonym using derived project key
            Mac pseudonymMac = Mac.getInstance("HmacSHA256");
            pseudonymMac.init(new SecretKeySpec(projectKey, "HmacSHA256"));
            byte[] hmac = pseudonymMac.doFinal(patientUserId.toString().getBytes(StandardCharsets.UTF_8));

            // Use at least 128 bits (32 hex characters = 16 bytes = 128 bits) of pseudonymous output
            return "SUBJ-" + HexFormat.of().formatHex(hmac).substring(0, 32);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate project-scoped cryptographic pseudonym", e);
        }
    }

    @Override
    public String computeAgeBand(LocalDate dateOfBirth, LocalDate observationDate) {
        if (dateOfBirth == null) return "UNKNOWN";
        LocalDate refDate = observationDate != null ? observationDate : LocalDate.now();
        int age = Period.between(dateOfBirth, refDate).getYears();
        if (age < 0) return "UNKNOWN";
        // Clinora research age generalization: individuals 85 and older are aggregated into an 85+ category
        if (age >= 85) return "85+";
        int lower = (age / 5) * 5;
        int upper = lower + 4;
        return lower + "-" + upper;
    }


    @Override
    public String computeObservationPeriod(LocalDate reportDate) {
        if (reportDate == null) return "UNKNOWN";
        int quarter = (reportDate.getMonthValue() - 1) / 3 + 1;
        return reportDate.getYear() + "-Q" + quarter;
    }

    private byte[] serializeToCsv(List<DeidentifiedRecord> records, List<String> reqVars) {
        Map<String, List<DeidentifiedRecord>> bySubject = new LinkedHashMap<>();
        for (DeidentifiedRecord rec : records) {
            bySubject.computeIfAbsent(rec.subjectId(), k -> new ArrayList<>()).add(rec);
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(baos, false, StandardCharsets.UTF_8)) {
            writer.print("subject_id,age_band,sex");
            for (String rv : reqVars) {
                writer.print("," + escapeCsv(rv.toLowerCase(Locale.ROOT)));
            }
            writer.println();

            for (Map.Entry<String, List<DeidentifiedRecord>> entry : bySubject.entrySet()) {
                List<DeidentifiedRecord> sRecs = entry.getValue();
                DeidentifiedRecord base = sRecs.get(0);
                writer.print(escapeCsv(base.subjectId()) + "," + escapeCsv(base.ageBand()) + "," + escapeCsv(base.sex()));

                Map<String, DeidentifiedRecord> vars = new HashMap<>();
                for (DeidentifiedRecord r : sRecs) {
                    if (r.variableCode() != null) {
                        vars.put(r.variableCode(), r);
                    }
                }

                for (String rv : reqVars) {
                    DeidentifiedRecord r = vars.get(rv);
                    if (r != null && r.value() != null) {
                        writer.print("," + r.value().toPlainString());
                    } else {
                        writer.print(",");
                    }
                }
                writer.println();
            }
        }
        return baos.toByteArray();
    }

    private byte[] serializeToJson(List<DeidentifiedRecord> records, List<String> reqVars) {
        try {
            Map<String, List<DeidentifiedRecord>> bySubject = new LinkedHashMap<>();
            for (DeidentifiedRecord rec : records) {
                bySubject.computeIfAbsent(rec.subjectId(), k -> new ArrayList<>()).add(rec);
            }

            List<Map<String, Object>> wideRecords = new ArrayList<>();
            for (Map.Entry<String, List<DeidentifiedRecord>> entry : bySubject.entrySet()) {
                List<DeidentifiedRecord> sRecs = entry.getValue();
                DeidentifiedRecord base = sRecs.get(0);
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("subject_id", base.subjectId());
                map.put("age_band", base.ageBand());
                map.put("sex", base.sex());

                Map<String, DeidentifiedRecord> vars = new HashMap<>();
                for (DeidentifiedRecord r : sRecs) {
                    if (r.variableCode() != null) {
                        vars.put(r.variableCode(), r);
                    }
                }

                for (String rv : reqVars) {
                    DeidentifiedRecord r = vars.get(rv);
                    map.put(rv.toLowerCase(Locale.ROOT), (r != null && r.value() != null) ? r.value() : null);
                }
                wideRecords.add(map);
            }
            return objectMapper.writeValueAsBytes(wideRecords);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize de-identified dataset to JSON", e);
        }
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private String computeSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(data));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 computation failed", e);
        }
    }
}
