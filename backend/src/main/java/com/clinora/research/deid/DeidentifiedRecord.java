package com.clinora.research.deid;

import java.math.BigDecimal;

public record DeidentifiedRecord(
        String subjectId,
        String ageBand,
        String sex,
        String observationPeriod,
        String variableCode,
        BigDecimal value,
        String unit,
        String referenceRange,
        String flag
) {}
