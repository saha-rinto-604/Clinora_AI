import { describe, expect, it } from 'vitest';
import type { BodyMeasurementPoint } from './patient-record-api';
import { dashboardTrend, measurementChange } from './dashboard-trend-model';

const point = (id: string, recordedAt: string, weightKg: number | null): BodyMeasurementPoint => ({
  id,
  recordedAt,
  weightKg,
  heightCm: null,
  bmi: null,
  sourceType: 'PATIENT_PROFILE',
});

describe('Patient dashboard history', () => {
  it('sorts real timestamps without resampling or adding points', () => {
    const input = [
      point('c', '2026-09-10T10:00:00Z', 71.4),
      point('a', '2026-09-01T08:00:00Z', 72),
      point('b', '2026-09-09T09:00:00Z', 71.2),
    ];
    const result = dashboardTrend(input, 'weightKg');
    expect(result.observations.map(({ id, value }) => [id, value])).toEqual([
      ['a', 72],
      ['b', 71.2],
      ['c', 71.4],
    ]);
    expect(result.latest?.timestamp).toBe(Date.parse(input[0].recordedAt));
    expect(result.change).toBeCloseTo(-0.6);
    expect(input[0].id).toBe('c');
  });

  it('excludes invalid or absent observations and repeated record IDs', () => {
    const valid = point('valid', '2026-09-01T10:00:00Z', 72);
    const result = dashboardTrend(
      [
        valid,
        valid,
        point('date', 'invalid', 70),
        point('nan', '2026-09-02', NaN),
        point('missing', '2026-09-03', null),
        point('infinity', '2026-09-04', Infinity),
        point('negative', '2026-09-05', -1),
      ],
      'weightKg',
    );
    expect(result.observations).toHaveLength(1);
    expect(result.change).toBeNull();
  });

  it('gives small changes and constant measurements a sensible domain', () => {
    const result = dashboardTrend(
      [point('a', '2026-09-01', 70), point('b', '2026-09-02', 70.01), point('c', '2026-09-03', 70.02)],
      'weightKg',
    );
    expect(result.domain[1] - result.domain[0]).toBeGreaterThanOrEqual(10);
    expect(result.domain[0]).toBeLessThan(70);
    expect(result.domain[1]).toBeGreaterThan(70.02);
    const constant = dashboardTrend([point('a', '2026-09-01', 70), point('b', '2026-09-02', 70)], 'weightKg');
    expect(constant.change).toBe(0);
    expect(measurementChange(0, 'kg')).toBe('No change');
  });
});
