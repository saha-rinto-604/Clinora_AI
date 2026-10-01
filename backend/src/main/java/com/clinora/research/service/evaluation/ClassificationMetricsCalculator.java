package com.clinora.research.service.evaluation;

import com.clinora.research.api.AIEvaluationModels.ConfusionMatrix;
import com.clinora.research.api.AIEvaluationModels.EvaluationMetrics;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Evaluates categorical classification tasks against validated class labels.
 */
@Component
public class ClassificationMetricsCalculator {

    public EvaluationMetrics calculate(long tp, long fp, long tn, long fn) {
        long total = tp + fp + tn + fn;
        if (total == 0) {
            return new EvaluationMetrics(
                    0.0, 0.0, 0.0, 0.0, 0.0,
                    new ConfusionMatrix(0, 0, 0, 0),
                    0.0, 0.0, 0, null, null, null
            );
        }

        double accuracy = round((double) (tp + tn) / total);
        double precision = (tp + fp > 0) ? round((double) tp / (tp + fp)) : 0.0;
        double recall = (tp + fn > 0) ? round((double) tp / (tp + fn)) : 0.0;

        double f1 = 0.0;
        if (precision + recall > 0) {
            f1 = round((2.0 * precision * recall) / (precision + recall));
        }

        double fpr = (fp + tn > 0) ? round((double) fp / (fp + tn)) : 0.0;
        double fnr = (fn + tp > 0) ? round((double) fn / (fn + tp)) : 0.0;

        // Balanced Accuracy = (Sensitivity + Specificity) / 2 = (Recall + (1 - FPR)) / 2
        double specificity = 1.0 - fpr;
        double balancedAccuracy = round((recall + specificity) / 2.0);

        return new EvaluationMetrics(
                accuracy,
                precision,
                recall,
                f1,
                balancedAccuracy,
                new ConfusionMatrix(tp, fp, tn, fn),
                fpr,
                fnr,
                total,
                null,
                null,
                null
        );
    }

    private double round(double val) {
        if (Double.isNaN(val) || Double.isInfinite(val)) return 0.0;
        return BigDecimal.valueOf(val).setScale(4, RoundingMode.HALF_UP).doubleValue();
    }
}
