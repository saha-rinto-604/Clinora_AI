package com.clinora.research.deid;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface DeidentificationService {

    record RawObservationRow(
            UUID patientUserId,
            LocalDate dateOfBirth,
            String gender,
            LocalDate reportDate,
            String variableCode,
            BigDecimal numericValue,
            String unit,
            BigDecimal referenceLow,
            BigDecimal referenceHigh,
            String flag,
            String verificationStatus,
            boolean reviewRequired,
            String comparator
    ) {
        public RawObservationRow(UUID patientUserId, LocalDate dateOfBirth, String gender, LocalDate reportDate,
                String variableCode, BigDecimal numericValue, String unit, BigDecimal referenceLow,
                BigDecimal referenceHigh, String flag) {
            this(patientUserId, dateOfBirth, gender, reportDate, variableCode, numericValue, unit,
                referenceLow, referenceHigh, flag, null, false, null);
        }
    }

    DeidentificationResult transform(
            UUID datasetRequestId,
            UUID projectId,
            String format,
            List<RawObservationRow> rows,
            List<String> requestedVariables
    );

    String generateProjectScopedPseudonym(UUID patientUserId, UUID projectId);

    String computeAgeBand(LocalDate dateOfBirth, LocalDate observationDate);

    String computeObservationPeriod(LocalDate reportDate);
}
