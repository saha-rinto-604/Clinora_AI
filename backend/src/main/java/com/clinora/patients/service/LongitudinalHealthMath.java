package com.clinora.patients.service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.List;

final class LongitudinalHealthMath {
    private static final MathContext MC = new MathContext(12, RoundingMode.HALF_UP);
    private static final BigDecimal STABLE_RELATIVE_THRESHOLD = new BigDecimal("0.01");

    private LongitudinalHealthMath() {
    }

    enum TrendDirection {
        INCREASING,
        DECREASING,
        STABLE,
        MIXED,
        INSUFFICIENT_DATA,
        NOT_COMPARABLE
    }

    record Trend(
        TrendDirection direction,
        BigDecimal absoluteChange,
        BigDecimal percentageChange,
        int comparableDataPoints,
        boolean trendQualified
    ) {
        static Trend insufficient(int points) {
            return new Trend(TrendDirection.INSUFFICIENT_DATA, null, null, points, false);
        }

        static Trend notComparable(int points) {
            return new Trend(TrendDirection.NOT_COMPARABLE, null, null, points, false);
        }
    }

    record NumericPoint(BigDecimal value, String comparisonKey) {
    }

    static Trend trend(List<NumericPoint> points) {
        if (points == null || points.size() < 2) return Trend.insufficient(points == null ? 0 : points.size());
        String comparisonKey = points.getFirst().comparisonKey();
        if (comparisonKey == null
            || points.stream().anyMatch(point -> point.value() == null || !comparisonKey.equals(point.comparisonKey()))) {
            return Trend.notComparable(points.size());
        }

        BigDecimal first = points.getFirst().value();
        BigDecimal latest = points.getLast().value();
        BigDecimal absolute = latest.subtract(first, MC);
        BigDecimal percentage = first.signum() == 0
            ? null
            : absolute.divide(first.abs(), MC).multiply(BigDecimal.valueOf(100), MC);

        TrendDirection direction;
        if (allWithinStableBand(points)) {
            direction = TrendDirection.STABLE;
        } else if (monotonic(points, true)) {
            direction = TrendDirection.INCREASING;
        } else if (monotonic(points, false)) {
            direction = TrendDirection.DECREASING;
        } else {
            direction = TrendDirection.MIXED;
        }
        return new Trend(
            direction,
            absolute.stripTrailingZeros(),
            percentage == null ? null : percentage.stripTrailingZeros(),
            points.size(),
            points.size() >= 3
        );
    }

    private static boolean allWithinStableBand(List<NumericPoint> points) {
        BigDecimal min = points.getFirst().value();
        BigDecimal max = min;
        for (NumericPoint point : points) {
            if (point.value().compareTo(min) < 0) min = point.value();
            if (point.value().compareTo(max) > 0) max = point.value();
        }
        BigDecimal spread = max.subtract(min, MC).abs();
        if (spread.signum() == 0) return true;
        BigDecimal scale = min.abs().max(max.abs());
        if (scale.signum() == 0) return true;
        return spread.divide(scale, MC).compareTo(STABLE_RELATIVE_THRESHOLD) <= 0;
    }

    private static boolean monotonic(List<NumericPoint> points, boolean increasing) {
        boolean changed = false;
        for (int index = 1; index < points.size(); index++) {
            int comparison = points.get(index).value().compareTo(points.get(index - 1).value());
            if (increasing && comparison < 0) return false;
            if (!increasing && comparison > 0) return false;
            if (comparison != 0) changed = true;
        }
        return changed;
    }
}
