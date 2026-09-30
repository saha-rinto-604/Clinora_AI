package com.clinora.research.service.evaluation;

import com.clinora.research.api.AIEvaluationModels.ConfusionMatrix;
import com.clinora.research.api.AIEvaluationModels.EvaluationMetrics;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Evaluates extracted structured clinical observation and laboratory values
 * against reference ground truth.
 */
@Component
public class ExtractionMetricsCalculator {

    public EvaluationMetrics calculate(
            long exactMatches,
            long toleranceMatches,
            long totalEvaluated,
            double meanAbsoluteError
    ) {
        if (totalEvaluated <= 0) {
            return new EvaluationMetrics(
                    0.0, 0.0, 0.0, 0.0, 0.0,
                    new ConfusionMatrix(0, 0, 0, 0),
                    0.0, 0.0, 0, 0.0, 0.0, 0.0
            );
        }

        double exactRate = round((double) exactMatches / totalEvaluated);
        double toleranceRate = round((double) toleranceMatches / totalEvaluated);
        double accuracy = toleranceRate; // Field accuracy measured at clinically accepted tolerance
        double precision = exactRate;
        double recall = toleranceRate;
        double f1 = (precision + recall > 0) ? round((2.0 * precision * recall) / (precision + recall)) : 0.0;
        double balancedAccuracy = round((exactRate + toleranceRate) / 2.0);

        long nonMatches = Math.max(0, totalEvaluated - toleranceMatches);

        return new EvaluationMetrics(
                accuracy,
                precision,
                recall,
                f1,
                balancedAccuracy,
                new ConfusionMatrix(toleranceMatches, nonMatches, 0, 0),
                round((double) nonMatches / totalEvaluated),
                0.0,
                totalEvaluated,
                exactRate,
                round(meanAbsoluteError),
                toleranceRate
        );
    }

    private double round(double val) {
        if (Double.isNaN(val) || Double.isInfinite(val)) return 0.0;
        return BigDecimal.valueOf(val).setScale(4, RoundingMode.HALF_UP).doubleValue();
    }
}
