package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class LongitudinalHealthMathTest {

    @Test
    void onePointIsInsufficientForTrend() {
        LongitudinalHealthMath.Trend trend = LongitudinalHealthMath.trend(List.of(point("5.5", "mg/dL")));
        assertEquals(LongitudinalHealthMath.TrendDirection.INSUFFICIENT_DATA, trend.direction());
        assertNull(trend.absoluteChange());
        assertFalse(trend.trendQualified());
    }

    @Test
    void twoPointsCalculateChangeButDoNotQualifyAsLongTermTrend() {
        LongitudinalHealthMath.Trend trend = LongitudinalHealthMath.trend(List.of(point("37.5", "g/dL"), point("36.5", "g/dL")));
        assertEquals(LongitudinalHealthMath.TrendDirection.DECREASING, trend.direction());
        assertEquals(2, trend.comparableDataPoints());
        assertFalse(trend.trendQualified());
    }

    @Test
    void threeComparablePointsProduceQualifiedDirectionAndChange() {
        LongitudinalHealthMath.Trend trend = LongitudinalHealthMath.trend(List.of(
            point("230", "10^9/L"), point("195", "10^9/L"), point("160", "10^9/L")
        ));
        assertEquals(LongitudinalHealthMath.TrendDirection.DECREASING, trend.direction());
        assertEquals(0, new BigDecimal("-70").compareTo(trend.absoluteChange()));
        assertEquals(3, trend.comparableDataPoints());
        assertTrue(trend.trendQualified());
    }

    @Test
    void incompatibleUnitsAreNeverTreatedAsOneTrend() {
        LongitudinalHealthMath.Trend trend = LongitudinalHealthMath.trend(List.of(point("5.2", "mmol/L"), point("94", "mg/dL")));
        assertEquals(LongitudinalHealthMath.TrendDirection.NOT_COMPARABLE, trend.direction());
    }

    @Test
    void nonMonotonicHistoryIsMarkedMixedInsteadOfOverstatingDirection() {
        LongitudinalHealthMath.Trend trend = LongitudinalHealthMath.trend(List.of(point("100", "same"), point("120", "same"), point("105", "same")));
        assertEquals(LongitudinalHealthMath.TrendDirection.MIXED, trend.direction());
        assertTrue(trend.trendQualified());
    }

    @Test
    void onePercentOrLessChangeIsDescribedAsRelativelyStableButTwoPointsRemainChangeOnly() {
        LongitudinalHealthMath.Trend trend = LongitudinalHealthMath.trend(List.of(point("100", "same"), point("100.8", "same")));
        assertEquals(LongitudinalHealthMath.TrendDirection.STABLE, trend.direction());
        assertFalse(trend.trendQualified());
    }

    private static LongitudinalHealthMath.NumericPoint point(String value, String key) {
        return new LongitudinalHealthMath.NumericPoint(new BigDecimal(value), key);
    }
}
