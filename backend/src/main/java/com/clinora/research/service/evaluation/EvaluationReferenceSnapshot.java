package com.clinora.research.service.evaluation;

import com.clinora.research.deid.DeidentificationService.RawObservationRow;
import java.math.BigDecimal;
import java.util.*;

/** Private, immutable reference artifact; never part of the researcher-visible WIDE export. */
public record EvaluationReferenceSnapshot(
        String schemaVersion, UUID datasetVersionId, String datasetChecksum,
        long totalObservations, List<Observation> observations) {
    public static final String SCHEMA = "verified-lab-reference-v1";

    public record Observation(String sampleKey, String variableCode, BigDecimal value, String unit,
            BigDecimal referenceLow, BigDecimal referenceHigh, String derivedGroundTruth) {
        public boolean valid() {
            return sampleKey != null && sampleKey.matches("S[0-9]+") && variableCode != null
                && !variableCode.isBlank() && value != null && unit != null && !unit.isBlank()
                && referenceLow != null && referenceHigh != null && referenceLow.compareTo(referenceHigh) <= 0
                && derive(value, referenceLow, referenceHigh).equals(derivedGroundTruth);
        }
    }

    public static String derive(BigDecimal value, BigDecimal low, BigDecimal high) {
        return value.compareTo(low) < 0 || value.compareTo(high) > 0 ? "ABNORMAL" : "NORMAL";
    }

    /** Rows have already passed the canonical verified/consented SQL eligibility boundary. */
    public static EvaluationReferenceSnapshot create(UUID versionId, String checksum,
            List<RawObservationRow> rows, Set<String> supportedVariables) {
        List<Observation> observations = new ArrayList<>();
        long total = 0;
        for (RawObservationRow row : rows) {
            if (!supportedVariables.contains(row.variableCode())) continue;
            total++;
            if (row.verificationStatus() == null || !Set.of("DOCTOR_VERIFIED", "PATIENT_CONFIRMED", "PATIENT_CORRECTED")
                    .contains(row.verificationStatus()) || row.reviewRequired()
                    || (row.comparator() != null && !row.comparator().isBlank() && !"=".equals(row.comparator()))) continue;
            if (row.numericValue() == null || row.unit() == null || row.unit().isBlank()
                    || row.referenceLow() == null || row.referenceHigh() == null
                    || row.referenceLow().compareTo(row.referenceHigh()) > 0) continue;
            observations.add(new Observation("S" + (observations.size() + 1), row.variableCode(),
                row.numericValue(), row.unit(), row.referenceLow(), row.referenceHigh(),
                derive(row.numericValue(), row.referenceLow(), row.referenceHigh())));
        }
        return new EvaluationReferenceSnapshot(SCHEMA, versionId, checksum, total, List.copyOf(observations));
    }

    public void validate(UUID versionId, String checksum) {
        if (!SCHEMA.equals(schemaVersion) || !versionId.equals(datasetVersionId)
                || !Objects.equals(checksum, datasetChecksum) || observations == null || observations.isEmpty()
                || totalObservations < observations.size()) throw new IllegalArgumentException("Reference unavailable");
        Set<String> keys = new HashSet<>();
        for (Observation observation : observations) {
            if (!observation.valid() || !keys.add(observation.sampleKey()))
                throw new IllegalArgumentException("Invalid reference observation");
        }
    }
}
