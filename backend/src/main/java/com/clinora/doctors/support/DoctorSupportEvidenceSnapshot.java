package com.clinora.doctors.support;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record DoctorSupportEvidenceSnapshot(
    String snapshotHash,
    List<ReportEvidence> reports,
    List<ObservationEvidence> observations,
    List<ComparisonFact> comparisonFacts
) {
    public DoctorSupportEvidenceSnapshot {
        reports = List.copyOf(reports);
        observations = List.copyOf(observations);
        comparisonFacts = List.copyOf(comparisonFacts);
    }

    public record ReportEvidence(
        UUID reportId, String reportType, LocalDate clinicalDate, String dateReliability,
        UUID extractionResultId, String sourceChecksum, long reportVersion
    ) {}

    public record ObservationEvidence(
        UUID observationId, UUID reportId, String label, String canonicalCode,
        String valueType, BigDecimal numericValue, String textValue, String comparator,
        String unit, BigDecimal referenceLow, BigDecimal referenceHigh,
        String referenceRangeRaw, String authoritativeStatus, String verificationStatus,
        BigDecimal normalizedNumericValue, String normalizedUnit, String comparisonKey
    ) {}

    public record ComparisonFact(
        String canonicalCode, String label, UUID earlierObservationId, UUID laterObservationId,
        LocalDate earlierDate, LocalDate laterDate, BigDecimal earlierValue, BigDecimal laterValue,
        String unit, String direction
    ) {}
}
