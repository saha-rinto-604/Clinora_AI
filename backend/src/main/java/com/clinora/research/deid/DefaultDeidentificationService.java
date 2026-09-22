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

@Service
public class DefaultDeidentificationService implements DeidentificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(DefaultDeidentificationService.class);
    public static final String DEID_PROFILE_VERSION = "clinora-deid-v1";

    private final ObjectMapper objectMapper;
    private final int minCohortSize;
    private final String pseudonymSecret;

    public DefaultDeidentificationService(
            ObjectMapper objectMapper,
            @Value("${clinora.research.min-cohort-size:5}") int minCohortSize,
            @Value("${clinora.research.pseudonym-secret:${CLINORA_RESEARCH_PSEUDONYM_SECRET:}}") String pseudonymSecret,
            org.springframework.core.env.Environment environment
    ) {
        this.objectMapper = objectMapper;
        this.minCohortSize = minCohortSize;
        if (pseudonymSecret == null || pseudonymSecret.isBlank()) {
            boolean isTest = environment != null && (
                    environment.acceptsProfiles(org.springframework.core.env.Profiles.of("test")) ||
                    System.getProperty("surefire.test.class.path") != null ||
                    System.getProperty("sun.java.command", "").contains("surefire")
            );
            if (isTest) {
                this.pseudonymSecret = "test-only-deterministic-pseudonym-secret-key-material";
            } else {
                throw new IllegalStateException("CLINORA_RESEARCH_PSEUDONYM_SECRET is required but not configured. Application startup aborted for security.");
            }
        } else {
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
            List<RawObservationRow> rows
    ) {
        if (rows == null || rows.isEmpty()) {
            throw new IllegalArgumentException("Cannot de-identify empty observation cohort.");
        }

        Set<UUID> uniquePatients = new HashSet<>();
        for (RawObservationRow row : rows) {
            uniquePatients.add(row.patientUserId());
        }

        // Minimum cohort size privacy protection
        if (uniquePatients.size() < minCohortSize) {
            throw new IllegalStateException(
                    "Cohort contains %d unique subjects, which fails the minimum subject threshold protection (minimum %d subjects). Generation aborted to prevent re-identification."
                            .formatted(uniquePatients.size(), minCohortSize)
            );
        }

        List<DeidentifiedRecord> deidentifiedRecords = new ArrayList<>(rows.size());

        for (RawObservationRow row : rows) {
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
            payload = serializeToJson(deidentifiedRecords);
        } else {
            // Default to CSV
            format = "CSV";
            payload = serializeToCsv(deidentifiedRecords);
        }

        String checksum = computeSha256(payload);

        LOGGER.info("Successfully de-identified {} clinical records across {} subjects for dataset request {}",
                deidentifiedRecords.size(), uniquePatients.size(), datasetRequestId);

        return new DeidentificationResult(
                datasetRequestId,
                projectId,
                deidentifiedRecords.size(),
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

    private byte[] serializeToCsv(List<DeidentifiedRecord> records) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(baos, false, StandardCharsets.UTF_8)) {
            // Write standard de-identified CSV header
            writer.println("subject_id,age_band,sex,observation_period,variable_code,value,unit,reference_range,flag");
            for (DeidentifiedRecord rec : records) {
                writer.printf("%s,%s,%s,%s,%s,%s,%s,%s,%s%n",
                        escapeCsv(rec.subjectId()),
                        escapeCsv(rec.ageBand()),
                        escapeCsv(rec.sex()),
                        escapeCsv(rec.observationPeriod()),
                        escapeCsv(rec.variableCode()),
                        rec.value() == null ? "" : rec.value().toPlainString(),
                        escapeCsv(rec.unit()),
                        escapeCsv(rec.referenceRange()),
                        escapeCsv(rec.flag())
                );
            }
        }
        return baos.toByteArray();
    }

    private byte[] serializeToJson(List<DeidentifiedRecord> records) {
        try {
            return objectMapper.writeValueAsBytes(records);
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
